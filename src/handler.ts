import type { S3Event, S3EventRecord } from 'aws-lambda';
import type { Config, ReceivedMail, DecodedAttachment } from './domain/types.js';
import { decodeMailBody } from './domain/decodeMailBody.js';
import { formatStoredBody } from './domain/formatStoredBody.js';
import { formatSlackPayload, type AttachmentReference } from './domain/formatSlackPayload.js';
import { buildObjectKey, buildAttachmentKey } from './domain/buildObjectKey.js';
import { createS3Adapter, type S3Port } from './adapters/s3Adapter.js';
import { createSlackAdapter, type SlackPort } from './adapters/slackAdapter.js';
import { loadConfig } from './adapters/configLoader.js';
import { logger, type Logger } from './adapters/logger.js';

// FR1.2 / FR2 / FR3 / FR5: S3 ObjectCreated イベントを受け、原本取得 -> デコード ->
// 2nd S3 保管 -> Slack 通知 を行う。冪等性 (objectKey 存在チェック)・部分失敗継続・失敗ログを担保する。

/** ハンドラの依存 (DI)。テストではモックを注入する。 */
export interface HandlerDeps {
  readonly config: Config;
  readonly s3: S3Port;
  readonly slack: SlackPort;
  readonly logger: Logger;
}

/** S3 イベントレコードから受信メール参照を組み立てる (入力検証)。 */
function toReceivedMailRef(record: S3EventRecord): {
  bucket: string;
  key: string;
  receivedAt: Date;
} {
  const bucket = record.s3?.bucket?.name;
  const rawKey = record.s3?.object?.key;
  if (!bucket || !rawKey) {
    throw new Error('handler: invalid S3 event record (missing bucket/key)');
  }
  // S3 のキーは URL エンコードされて届く。
  const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
  // 受信日時は S3 イベントの eventTime を用いる (無ければ現在時刻)。
  const receivedAt = record.eventTime ? new Date(record.eventTime) : new Date();
  return { bucket, key, receivedAt };
}

/**
 * 1 レコード分の処理。想定内失敗は throw せず、部分失敗継続・ログ可視化で吸収する。
 * S3 保管失敗など致命的な失敗は throw して Lambda リトライ/DLQ (FR5.3) に委ねる。
 */
async function processRecord(record: S3EventRecord, deps: HandlerDeps): Promise<void> {
  const started = Date.now();
  const { config, s3, slack } = deps;
  const log = deps.logger;

  const ref = toReceivedMailRef(record);
  log.info('received S3 object created event', { stage: 'receive', sourceKey: ref.key });

  // 原本取得 (失敗は致命的 -> throw でリトライ/DLQ)。
  const raw = await s3.getObject(ref.bucket, ref.key);
  const received: ReceivedMail = {
    raw,
    sourceBucket: ref.bucket,
    sourceKey: ref.key,
    receivedAt: ref.receivedAt,
  };

  // デコード (想定内失敗は型付き Result)。失敗時も後続の保存/通知を継続する (FR5.2)。
  const decodeResult = await decodeMailBody(received.raw, config.attachmentTotalLimitBytes);

  // messageId が取れない場合の相関キーは sourceKey を代替に用いる。
  let messageId: string;
  let textBody: string;
  let subject: string | undefined;
  let attachmentsSkipped = false;
  let attachments: readonly DecodedAttachment[] = [];
  let headers: Parameters<typeof formatStoredBody>[0];

  if (decodeResult.ok) {
    const d = decodeResult.value;
    messageId = d.headers.messageId.length > 0 ? d.headers.messageId : ref.key;
    textBody = d.textBody;
    subject = d.headers.subject;
    attachmentsSkipped = d.attachmentsSkipped;
    attachments = d.attachments;
    headers = d.headers;
    if (d.attachmentsSkipped) {
      log.warn('attachments exceeded limit; decode skipped for attachments', {
        stage: 'decode',
        sourceKey: ref.key,
        attachmentsSkipped: true,
        totalAttachmentBytes: d.totalAttachmentBytes,
      });
    }
  } else {
    // デコード失敗: 原本の保存/通知は継続する (FR5.2)。本文は空、相関に sourceKey を使う。
    messageId = ref.key;
    textBody = '';
    subject = undefined;
    headers = { messageId: '', envelopeFrom: undefined, from: undefined, subject: undefined };
    log.error('decode failed; continuing with raw store and notify', {
      stage: 'decode',
      sourceKey: ref.key,
      errorKind: decodeResult.error.kind,
      errorMessage: decodeResult.error.message,
    });
  }

  // 冪等キー = objectKey (受信日時 + messageId)。
  const objectKey = buildObjectKey(received.receivedAt, messageId);

  // 冪等性チェック (FR2.5 / FR3.5 / NFR1.6): 既に保管済みなら重複保管も重複通知も行わない。
  const alreadyStored = await s3.objectExists(config.decodedMailBucket, objectKey);
  if (alreadyStored) {
    log.info('object already stored; skipping duplicate store and notify (idempotent)', {
      stage: 'idempotency',
      objectKey,
      messageId,
      idempotentSkip: true,
    });
    return;
  }

  // 2nd S3 へ保管 (本文先頭にヘッダ付与 FR2.3)。保管失敗は致命的 -> throw。
  const storedBody = formatStoredBody(headers, received.receivedAt, textBody);
  await s3.putObject(config.decodedMailBucket, objectKey, storedBody, 'text/plain; charset=utf-8');
  log.info('stored decoded mail to 2nd bucket', { stage: 'store', objectKey, messageId });

  // 添付本体を 2nd S3 へ保管する (FR2.1/FR2.2)。本文キーと衝突しない添付キーを用いる。
  // 上限超過時は attachments が空 (デコードスキップ) のためループは実行されない (FR2.4)。
  // 保管失敗は本文と同様に致命的とみなし throw (リトライ/DLQ)。
  const attachmentReferences: AttachmentReference[] = [];
  for (let i = 0; i < attachments.length; i += 1) {
    const a = attachments[i];
    const attachmentKey = buildAttachmentKey(received.receivedAt, messageId, i, a.filename);
    await s3.putObject(config.decodedMailBucket, attachmentKey, a.content, a.contentType);
    attachmentReferences.push({
      filename: a.filename,
      bucket: config.decodedMailBucket,
      key: attachmentKey,
    });
  }
  if (attachmentReferences.length > 0) {
    log.info('stored attachments to 2nd bucket', {
      stage: 'store',
      objectKey,
      messageId,
    });
  }

  // Slack 通知 (FR3)。送信失敗は部分失敗として吸収 (保存は継続済み、ログ可視化)。
  try {
    const payload = formatSlackPayload({
      receivedAt: received.receivedAt,
      subject,
      textBody,
      decodedBucket: config.decodedMailBucket,
      decodedKey: objectKey,
      attachmentReferences,
      attachmentsSkipped,
    });
    await slack.send(payload);
    log.info('slack notification sent', { stage: 'notify', objectKey, messageId });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    log.error('slack send failed; store retained (partial-failure continuation)', {
      stage: 'notify',
      objectKey,
      messageId,
      errorKind: 'slack-send-failed',
      errorMessage: message,
    });
    // Slack 失敗は保存を巻き戻さない。ここでは throw しない (FR5.2)。
  } finally {
    log.info('record processing finished', {
      stage: 'done',
      objectKey,
      messageId,
      durationMs: Date.now() - started,
    });
  }
}

/** DI 版ハンドラ本体 (テストから直接呼ぶ)。 */
export async function handleS3Event(event: S3Event, deps: HandlerDeps): Promise<void> {
  const records = event.Records ?? [];
  if (records.length === 0) {
    deps.logger.warn('S3 event contained no records', { stage: 'receive' });
    return;
  }
  // レコード単位で独立処理。1 レコードの致命的失敗は throw され Lambda リトライ/DLQ へ。
  for (const record of records) {
    await processRecord(record, deps);
  }
}

let cachedDeps: HandlerDeps | undefined;

async function resolveDeps(): Promise<HandlerDeps> {
  if (cachedDeps) return cachedDeps;
  const config = await loadConfig();
  cachedDeps = {
    config,
    s3: createS3Adapter(config.region),
    slack: createSlackAdapter(config.slackWebhookUrl),
    logger,
  };
  return cachedDeps;
}

/** Lambda エントリポイント (I/O 境界)。ここだけ handler 名を許容する。 */
export async function handler(event: S3Event): Promise<void> {
  const deps = await resolveDeps();
  await handleS3Event(event, deps);
}
