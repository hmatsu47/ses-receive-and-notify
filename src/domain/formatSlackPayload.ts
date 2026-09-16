import type { SlackPayload } from './types.js';
import { summarizeBody } from './summarizeBody.js';

// FR3.2 / FR3.3 / FR3.4 / NFR3.8:
// 通知に受信日時・Subject・本文概要・保存先 S3 リンクを含める。受信日時と Subject は
// 本文概要の前に置く。リンクは s3:// 形式 (presigned URL は用いない)。
// 受信メール由来のテキストは信頼できない入力として扱い、Slack の意図しない解釈/メンション/
// インジェクションを防ぐためサニタイズする。

/**
 * Slack mrkdwn 向けのサニタイズ。
 * - `&`,`<`,`>` を HTML エンティティへ (Slack 仕様に沿う)。
 * - `@channel`/`@here`/`@everyone` などの一斉メンション発火を無害化する。
 * - 制御文字を除去する。
 */
export function sanitizeForSlack(input: string): string {
  const escaped = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // メンション発火の無害化: @channel などの直後にゼロ幅を挟まず、@ を全角様表現にせず、
  // 単純に @ の後ろのキーワードを分断する。ここでは @ を "@\u200b" として発火を止める。
  const neutralizedMentions = escaped.replace(/@(channel|here|everyone)\b/gi, '@\u200b$1');
  // eslint-disable-next-line no-control-regex
  return neutralizedMentions.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

/** 受信日時を通知用に整形する (UTC 分精度)。 */
function formatReceivedAt(receivedAt: Date): string {
  if (Number.isNaN(receivedAt.getTime())) return '(unknown)';
  const iso = receivedAt.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** s3:// 参照リンクを組み立てる (FR3.4: presigned URL は用いない)。 */
export function buildS3Reference(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

export interface SlackPayloadInput {
  readonly receivedAt: Date;
  readonly subject: string | undefined;
  /** ヘッダ付与前の本文 (概要生成に使う)。 */
  readonly textBody: string;
  readonly decodedBucket: string;
  readonly decodedKey: string;
  /** 保管済み添付の s3 参照リンク一覧 (FR3.2/FR3.4)。空なら添付なし。 */
  readonly attachmentReferences?: readonly AttachmentReference[];
  /** 添付が上限超過でスキップされた場合の注記 (FR2.4)。 */
  readonly attachmentsSkipped: boolean;
}

/** Slack に表示する保管済み添付の参照情報。 */
export interface AttachmentReference {
  readonly filename: string;
  readonly bucket: string;
  readonly key: string;
}

/**
 * Slack Incoming Webhook 用ペイロードを組み立てる。
 * 順序: 受信日時 -> Subject -> 本文概要 -> 本文 S3 リンク -> 添付 S3 リンク。
 */
export function formatSlackPayload(input: SlackPayloadInput): SlackPayload {
  const receivedLine = `*Received:* ${formatReceivedAt(input.receivedAt)}`;
  const subjectLine = `*Subject:* ${sanitizeForSlack(input.subject ?? '(no subject)')}`;
  const summary = sanitizeForSlack(summarizeBody(input.textBody));
  const summaryLine = `*Summary:* ${summary}`;
  const linkLine = `*Stored:* ${buildS3Reference(input.decodedBucket, input.decodedKey)}`;
  const lines = [receivedLine, subjectLine, summaryLine, linkLine];
  const attachments = input.attachmentReferences ?? [];
  if (attachments.length > 0) {
    lines.push('*Attachments:*');
    for (const a of attachments) {
      // ファイル名は受信メール由来のため信頼できない入力としてサニタイズする。
      lines.push(`- ${sanitizeForSlack(a.filename)}: ${buildS3Reference(a.bucket, a.key)}`);
    }
  }
  if (input.attachmentsSkipped) {
    lines.push('*Note:* attachments exceeded the size limit and were not decoded.');
  }
  return { text: lines.join('\n') };
}
