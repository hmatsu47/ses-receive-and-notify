import { describe, it, expect } from 'vitest';
import { decodeMailBody } from '../src/domain/decodeMailBody.js';

/** 指定バイト数の base64 添付を持つ multipart MIME を組み立てる。 */
function mimeWithAttachment(rawBytes: number): Buffer {
  const payload = Buffer.alloc(rawBytes, 0x41); // 'A'
  const b64 = payload.toString('base64');
  const mail = [
    'From: sender@example.com',
    'Return-Path: <envelope@example.com>',
    'To: inbox@example.com',
    'Subject: With attachment',
    'Message-ID: <att-1@example.com>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="B"',
    '',
    '--B',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'hello body',
    '--B',
    'Content-Type: application/octet-stream',
    'Content-Disposition: attachment; filename="blob.bin"',
    'Content-Transfer-Encoding: base64',
    '',
    b64,
    '--B--',
    '',
  ].join('\r\n');
  return Buffer.from(mail, 'utf-8');
}

const PLAIN_MAIL = Buffer.from(
  [
    'From: Alice <alice@example.com>',
    'Return-Path: <bounce@example.com>',
    'Subject: Hello',
    'Message-ID: <plain-1@example.com>',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'This is the body text.',
    '',
  ].join('\r\n'),
);

const HTML_ONLY_MAIL = Buffer.from(
  [
    'From: Bob <bob@example.com>',
    'Subject: HTML',
    'Message-ID: <html-1@example.com>',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<html><body><p>Hello <b>World</b></p></body></html>',
    '',
  ].join('\r\n'),
);

describe('decodeMailBody (FR2.1 / FR2.4 / NFR1)', () => {
  it('正常デコード: 本文/ヘッダを分離して返す (FR2.1)', async () => {
    const res = await decodeMailBody(PLAIN_MAIL);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.textBody).toContain('This is the body text.');
    expect(res.value.hadPlainText).toBe(true);
    expect(res.value.headers.subject).toBe('Hello');
    expect(res.value.headers.from).toContain('alice@example.com');
    expect(res.value.headers.envelopeFrom).toContain('bounce@example.com');
    expect(res.value.attachmentsSkipped).toBe(false);
  });

  it('HTML のみのメールはテキスト抽出後の本文を返す (FR3.3 前段)', async () => {
    const res = await decodeMailBody(HTML_ONLY_MAIL);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.hadPlainText).toBe(false);
    expect(res.value.textBody).toContain('Hello World');
    expect(res.value.textBody).not.toContain('<b>');
  });

  it('添付合計が上限未満: デコード継続 (境界値: 未満)', async () => {
    const limit = 1000;
    const res = await decodeMailBody(mimeWithAttachment(500), limit);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.attachmentsSkipped).toBe(false);
    expect(res.value.attachments.length).toBe(1);
  });

  it('添付本体(content)を Buffer として返す (FR2.1/FR2.2 保管用)', async () => {
    const res = await decodeMailBody(mimeWithAttachment(500), 1000);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const a = res.value.attachments[0];
    expect(a).toBeDefined();
    expect(Buffer.isBuffer(a.content)).toBe(true);
    expect(a.content.length).toBe(500); // 'A' * 500
    expect(a.filename).toBe('blob.bin');
    expect(a.size).toBe(500);
  });

  it('添付合計が上限ちょうど: スキップしない (境界値: 上限=許容)', async () => {
    const limit = 500;
    const res = await decodeMailBody(mimeWithAttachment(500), limit);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 上限「ちょうど」は超過ではないためスキップしない。
    expect(res.value.attachmentsSkipped).toBe(false);
  });

  it('添付合計が上限超過: デコードスキップだが本文は保持 (FR2.4 NEVER force-decode)', async () => {
    const limit = 500;
    const res = await decodeMailBody(mimeWithAttachment(501), limit);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // NEVER force-decode when attachments exceed the 10MB total limit.
    expect(res.value.attachmentsSkipped).toBe(true);
    expect(res.value.attachments.length).toBe(0);
    expect(res.value.textBody).toContain('hello body'); // 本文は保持され保存継続可能
  });

  it('パース不能な入力は型付き失敗 (decode-failed) を返し例外を握りつぶさない (NFR1.5)', async () => {
    // simpleParser はほとんどの入力を寛容に扱うため、Buffer 以外を渡して失敗経路を注入する。
    // rule: ALWAYS decode failures are typed Results (no silent failure).
    const res = await decodeMailBody(undefined as unknown as Buffer);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('decode-failed');
    expect(res.error.message.length).toBeGreaterThan(0);
  });
});
