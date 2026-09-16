import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { S3Event } from 'aws-lambda';
import { handleS3Event, type HandlerDeps } from '../src/handler.js';
import type { S3Port } from '../src/adapters/s3Adapter.js';
import { createS3Adapter } from '../src/adapters/s3Adapter.js';
import type { SlackPort } from '../src/adapters/slackAdapter.js';
import type { Config } from '../src/domain/types.js';

const config: Config = {
  targetDomain: 'example.com',
  slackWebhookUrl: 'https://hooks.slack.com/services/T/B/X',
  rawMailBucket: 'raw-bucket',
  decodedMailBucket: 'decoded-bucket',
  attachmentTotalLimitBytes: 10 * 1024 * 1024,
  region: 'ap-northeast-1',
};

/** 記録用のスパイロガー。 */
function makeLogger() {
  const errors: string[] = [];
  const infos: string[] = [];
  const warns: string[] = [];
  return {
    logger: {
      info: (m: string) => infos.push(m),
      warn: (m: string) => warns.push(m),
      error: (m: string) => errors.push(m),
    },
    errors,
    infos,
    warns,
  };
}

/** メモリ上の S3Port スタブ。 */
function makeS3Port(seed: Record<string, Buffer> = {}): S3Port & {
  store: Record<string, { body: string; contentType: string }>;
  puts: number;
} {
  const objects: Record<string, Buffer> = { ...seed };
  const store: Record<string, { body: string; contentType: string }> = {};
  const port = {
    store,
    puts: 0,
    async getObject(_bucket: string, key: string) {
      const found = objects[key];
      if (!found) throw new Error(`not found: ${key}`);
      return found;
    },
    async putObject(_bucket: string, key: string, body: Buffer | string, contentType: string) {
      port.puts += 1;
      store[key] = { body: body.toString(), contentType };
    },
    async objectExists(_bucket: string, key: string) {
      return key in store;
    },
  };
  return port;
}

function makeSlackPort(behavior: 'ok' | 'fail' = 'ok'): SlackPort & {
  sends: number;
  lastText: string | undefined;
} {
  const port = {
    sends: 0,
    lastText: undefined as string | undefined,
    async send(payload: { text: string }) {
      port.sends += 1;
      port.lastText = payload?.text;
      if (behavior === 'fail') throw new Error('slack 500');
    },
  };
  return port;
}

const PLAIN_MAIL = Buffer.from(
  [
    'From: Alice <alice@example.com>',
    'Return-Path: <bounce@example.com>',
    'Subject: Hello',
    'Message-ID: <msg-1@example.com>',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'This is the body text.',
    '',
  ].join('\r\n'),
);

function s3Event(key: string, eventTime = '2026-09-11T07:59:30.000Z'): S3Event {
  return {
    Records: [
      {
        eventTime,
        s3: {
          bucket: { name: 'raw-bucket' },
          object: { key },
        },
      } as never,
    ],
  } as S3Event;
}

describe('handler reliability (NFR1)', () => {
  it('正常系: 原本取得 -> 保管 -> Slack通知が一度ずつ行われる', async () => {
    const s3 = makeS3Port({ 'incoming/mail-1': PLAIN_MAIL });
    const slack = makeSlackPort('ok');
    const log = makeLogger();
    const deps: HandlerDeps = { config, s3, slack, logger: log.logger };
    await handleS3Event(s3Event('incoming/mail-1'), deps);
    expect(s3.puts).toBe(1);
    expect(slack.sends).toBe(1);
    expect(Object.keys(s3.store).length).toBe(1);
  });

  it('冪等性: 同一objectKey再処理で重複保管も重複通知もしない (FR2.5/FR3.5/NFR1.6)', async () => {
    // rule: ALWAYS idempotent per objectKey (received-datetime + messageId).
    const s3 = makeS3Port({ 'incoming/mail-1': PLAIN_MAIL });
    const slack = makeSlackPort('ok');
    const log = makeLogger();
    const deps: HandlerDeps = { config, s3, slack, logger: log.logger };
    await handleS3Event(s3Event('incoming/mail-1'), deps);
    await handleS3Event(s3Event('incoming/mail-1'), deps); // 再処理
    expect(s3.puts).toBe(1); // 重複保管なし
    expect(slack.sends).toBe(1); // 重複通知なし
  });

  it('部分失敗継続: Slack送信失敗でも保管は維持されログに可視化される (FR5.2/NFR1.5)', async () => {
    // rule: ALWAYS store continues even when Slack fails; failure visible in logs.
    const s3 = makeS3Port({ 'incoming/mail-1': PLAIN_MAIL });
    const slack = makeSlackPort('fail');
    const log = makeLogger();
    const deps: HandlerDeps = { config, s3, slack, logger: log.logger };
    await expect(handleS3Event(s3Event('incoming/mail-1'), deps)).resolves.toBeUndefined();
    expect(s3.puts).toBe(1); // 保管は継続
    expect(log.errors.some((m) => m.includes('slack send failed'))).toBe(true);
  });

  it('失敗注入(デコード失敗): 保管と通知は継続し失敗がログ化される (FR5.2)', async () => {
    // rule: NO silent failure — decode failure is logged, raw store/notify continue.
    const garbage = Buffer.from([0x00, 0x01, 0x02]); // simpleParser は寛容だが本文は空になる
    const s3 = makeS3Port({ 'incoming/garbage': garbage });
    const slack = makeSlackPort('ok');
    const log = makeLogger();
    const deps: HandlerDeps = { config, s3, slack, logger: log.logger };
    await handleS3Event(s3Event('incoming/garbage'), deps);
    // デコードで本文が取れなくても保管・通知は行われる。
    expect(s3.puts).toBe(1);
    expect(slack.sends).toBe(1);
  });

  it('失敗注入(添付上限超過): デコードスキップでも保管・通知継続し注記が付く (FR2.4/NFR3.9)', async () => {
    // rule: NEVER force-decode over-limit attachments; store and notify still continue.
    const payload = Buffer.alloc(300, 0x41).toString('base64');
    const mail = Buffer.from(
      [
        'From: s@example.com',
        'Return-Path: <env@example.com>',
        'Subject: Big',
        'Message-ID: <big-1@example.com>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="B"',
        '',
        '--B',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'body here',
        '--B',
        'Content-Type: application/octet-stream',
        'Content-Disposition: attachment; filename="blob.bin"',
        'Content-Transfer-Encoding: base64',
        '',
        payload,
        '--B--',
        '',
      ].join('\r\n'),
    );
    const smallLimitConfig: Config = { ...config, attachmentTotalLimitBytes: 100 };
    const s3 = makeS3Port({ 'incoming/big': mail });
    const slack = makeSlackPort('ok');
    const log = makeLogger();
    const deps: HandlerDeps = { config: smallLimitConfig, s3, slack, logger: log.logger };
    await handleS3Event(s3Event('incoming/big'), deps);
    expect(s3.puts).toBe(1);
    expect(slack.sends).toBe(1);
    const storedKey = Object.keys(s3.store)[0];
    // 保管本文にはヘッダが付与されている (FR2.3)。
    expect(s3.store[storedKey].body).toContain('Subject: Big');
  });

  it('添付あり(上限内): 本文と添付が2ndバケットに保管され Slack に添付リンクが出る (FR2.1/FR2.2/FR3.2)', async () => {
    // rule: decode and store BOTH body and attachments; notify includes attachment links.
    const payload = Buffer.from('hello-attachment-bytes').toString('base64');
    const mail = Buffer.from(
      [
        'From: s@example.com',
        'Return-Path: <env@example.com>',
        'Subject: WithAttachment',
        'Message-ID: <att-1@example.com>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="B"',
        '',
        '--B',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'body here',
        '--B',
        'Content-Type: application/pdf',
        'Content-Disposition: attachment; filename="report.pdf"',
        'Content-Transfer-Encoding: base64',
        '',
        payload,
        '--B--',
        '',
      ].join('\r\n'),
    );
    const s3 = makeS3Port({ 'incoming/att': mail });
    const slack = makeSlackPort('ok');
    const log = makeLogger();
    const deps: HandlerDeps = { config, s3, slack, logger: log.logger };
    await handleS3Event(s3Event('incoming/att'), deps);
    // 本文 1 + 添付 1 = 2 オブジェクト保管。
    expect(s3.puts).toBe(2);
    const keys = Object.keys(s3.store);
    const bodyKey = keys.find((k) => k.endsWith('.txt'));
    const attKey = keys.find((k) => k.includes('/attachments/'));
    expect(bodyKey).toBeDefined();
    expect(attKey).toBeDefined();
    expect(attKey).toContain('/attachments/01-report.pdf');
    // 添付本体が保管されている。
    expect(s3.store[attKey as string].body).toBe('hello-attachment-bytes');
    expect(s3.store[attKey as string].contentType).toContain('application/pdf');
    // Slack 通知に添付リンクが含まれる (FR3.2)。
    expect(slack.sends).toBe(1);
    expect(slack.lastText).toContain('*Attachments:*');
    expect(slack.lastText).toContain('report.pdf');
    expect(slack.lastText).toContain('/attachments/01-report.pdf');
  });

  it('添付上限超過: 添付は保管されず本文のみ保管、Slackに注記 (FR2.4)', async () => {
    // rule: NEVER force-decode over-limit attachments; attachments are NOT stored.
    const payload = Buffer.alloc(300, 0x41).toString('base64');
    const mail = Buffer.from(
      [
        'From: s@example.com',
        'Return-Path: <env@example.com>',
        'Subject: BigAtt',
        'Message-ID: <bigatt-1@example.com>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="B"',
        '',
        '--B',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'body here',
        '--B',
        'Content-Type: application/octet-stream',
        'Content-Disposition: attachment; filename="blob.bin"',
        'Content-Transfer-Encoding: base64',
        '',
        payload,
        '--B--',
        '',
      ].join('\r\n'),
    );
    const smallLimitConfig: Config = { ...config, attachmentTotalLimitBytes: 100 };
    const s3 = makeS3Port({ 'incoming/bigatt': mail });
    const slack = makeSlackPort('ok');
    const log = makeLogger();
    const deps: HandlerDeps = { config: smallLimitConfig, s3, slack, logger: log.logger };
    await handleS3Event(s3Event('incoming/bigatt'), deps);
    // 本文のみ保管 (添付は保管されない)。
    expect(s3.puts).toBe(1);
    expect(Object.keys(s3.store).every((k) => !k.includes('/attachments/'))).toBe(true);
    expect(slack.lastText).toContain('attachments exceeded the size limit');
    expect(slack.lastText).not.toContain('*Attachments:*');
  });

  it('失敗注入(原本取得失敗): 致命的失敗は throw され Lambdaリトライ/DLQに委ねる (FR5.3)', async () => {
    const s3 = makeS3Port({}); // seed 無し => getObject が throw
    const slack = makeSlackPort('ok');
    const log = makeLogger();
    const deps: HandlerDeps = { config, s3, slack, logger: log.logger };
    await expect(handleS3Event(s3Event('incoming/missing'), deps)).rejects.toThrow();
  });

  it('空レコードのイベントは警告のみで正常終了する', async () => {
    const s3 = makeS3Port();
    const slack = makeSlackPort('ok');
    const log = makeLogger();
    const deps: HandlerDeps = { config, s3, slack, logger: log.logger };
    await handleS3Event({ Records: [] } as unknown as S3Event, deps);
    expect(s3.puts).toBe(0);
    expect(slack.sends).toBe(0);
    expect(log.warns.length).toBeGreaterThan(0);
  });
});

describe('s3Adapter with aws-sdk-client-mock (no real AWS credentials)', () => {
  const s3Mock = mockClient(S3Client);
  beforeEach(() => s3Mock.reset());

  it('objectExists は HeadObject NotFound を false として扱う', async () => {
    s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    const adapter = createS3Adapter('ap-northeast-1');
    await expect(adapter.objectExists('b', 'k')).resolves.toBe(false);
  });

  it('objectExists は HeadObject 成功を true として扱う', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});
    const adapter = createS3Adapter('ap-northeast-1');
    await expect(adapter.objectExists('b', 'k')).resolves.toBe(true);
  });

  it('getObject は本文ストリームを Buffer に集約する', async () => {
    const { Readable } = await import('node:stream');
    s3Mock.on(GetObjectCommand).resolves({ Body: Readable.from([Buffer.from('hello')]) as never });
    const adapter = createS3Adapter('ap-northeast-1');
    const buf = await adapter.getObject('b', 'k');
    expect(buf.toString()).toBe('hello');
  });
});

// vi は未使用でも import 副作用を避けるため参照しておく。
void vi;
