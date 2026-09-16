import { describe, it, expect } from 'vitest';
import {
  formatSlackPayload,
  sanitizeForSlack,
  buildS3Reference,
} from '../src/domain/formatSlackPayload.js';

const base = {
  receivedAt: new Date('2026-09-11T07:59:30Z'),
  subject: 'Hello',
  textBody: 'This is the body.',
  decodedBucket: 'decoded-bucket',
  decodedKey: 'decoded/2026/09/11/20260911T0759-msg1.txt',
  attachmentsSkipped: false,
};

describe('formatSlackPayload (FR3.2 / FR3.3 / FR3.4 / NFR3.8)', () => {
  it('受信日時とSubjectを本文概要の前に置き、S3リンクを含む', () => {
    const { text } = formatSlackPayload(base);
    const idxReceived = text.indexOf('*Received:*');
    const idxSubject = text.indexOf('*Subject:*');
    const idxSummary = text.indexOf('*Summary:*');
    const idxLink = text.indexOf('*Stored:*');
    expect(idxReceived).toBeGreaterThanOrEqual(0);
    expect(idxReceived).toBeLessThan(idxSubject);
    expect(idxSubject).toBeLessThan(idxSummary);
    expect(idxSummary).toBeLessThan(idxLink);
    expect(text).toContain('2026-09-11 07:59 UTC');
  });

  it('リンクは s3:// 形式で presigned URL ではない (FR3.4)', () => {
    const { text } = formatSlackPayload(base);
    // rule: link is s3:// path or console URL, NOT a presigned URL.
    expect(text).toContain('s3://decoded-bucket/decoded/2026/09/11/20260911T0759-msg1.txt');
    expect(text).not.toMatch(/X-Amz-Signature|X-Amz-Credential|presigned/i);
  });

  it('受信メール由来テキストをサニタイズする (NFR3.8 injection 防止)', () => {
    const { text } = formatSlackPayload({
      ...base,
      subject: '<script>alert(1)</script> & <b>',
      textBody: 'contact @channel now <hack>',
    });
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
    // @channel の一斉メンション発火が無害化されている (ゼロ幅挿入)。
    expect(text).toContain('@\u200bchannel');
  });

  it('添付上限超過時は注記を付す (FR2.4)', () => {
    const { text } = formatSlackPayload({ ...base, attachmentsSkipped: true });
    expect(text).toContain('attachments exceeded the size limit');
  });

  it('保管済み添付の s3:// リンクを列挙する (FR3.2/FR3.4)', () => {
    const { text } = formatSlackPayload({
      ...base,
      attachmentReferences: [
        {
          filename: 'report.pdf',
          bucket: 'decoded-bucket',
          key: 'decoded/.../attachments/01-report.pdf',
        },
        {
          filename: 'image.png',
          bucket: 'decoded-bucket',
          key: 'decoded/.../attachments/02-image.png',
        },
      ],
    });
    expect(text).toContain('*Attachments:*');
    expect(text).toContain('report.pdf: s3://decoded-bucket/decoded/.../attachments/01-report.pdf');
    expect(text).toContain('image.png: s3://decoded-bucket/decoded/.../attachments/02-image.png');
    // 本文リンクの後に添付リンクが並ぶ。
    expect(text.indexOf('*Stored:*')).toBeLessThan(text.indexOf('*Attachments:*'));
  });

  it('添付が無い場合は Attachments セクションを出さない', () => {
    const { text } = formatSlackPayload({ ...base, attachmentReferences: [] });
    expect(text).not.toContain('*Attachments:*');
  });

  it('添付ファイル名もサニタイズする (NFR3.8 injection 防止)', () => {
    const { text } = formatSlackPayload({
      ...base,
      attachmentReferences: [{ filename: '<script>@channel.txt', bucket: 'b', key: 'k' }],
    });
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
    expect(text).toContain('@\u200bchannel');
  });

  it('Subject 欠損時は (no subject) を表示する', () => {
    const { text } = formatSlackPayload({ ...base, subject: undefined });
    expect(text).toContain('*Subject:* (no subject)');
  });

  it('sanitizeForSlack と buildS3Reference の単体挙動', () => {
    expect(sanitizeForSlack('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
    expect(buildS3Reference('b', 'k/x.txt')).toBe('s3://b/k/x.txt');
  });
});
