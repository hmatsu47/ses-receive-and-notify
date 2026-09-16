import { describe, it, expect } from 'vitest';
import { formatStoredBody, STORED_BODY_SEPARATOR } from '../src/domain/formatStoredBody.js';
import type { MailHeaders } from '../src/domain/types.js';

const fullHeaders: MailHeaders = {
  messageId: '<msg-1@example.com>',
  envelopeFrom: 'bounce@example.com',
  from: 'Alice <alice@example.com>',
  subject: 'Hello',
};

describe('formatStoredBody (FR2.3)', () => {
  it('本文の前に受信日時・エンベロープFrom・Subject・From等を固定順で付与する', () => {
    const out = formatStoredBody(fullHeaders, new Date('2026-09-11T07:59:30Z'), 'body content');
    const [headerBlock, body] = out.split(STORED_BODY_SEPARATOR);
    // rule: ALWAYS stored body prepends received-datetime, envelope-From, Subject, From headers.
    const idxReceived = headerBlock.indexOf('Received-At:');
    const idxEnvelope = headerBlock.indexOf('Envelope-From:');
    const idxSubject = headerBlock.indexOf('Subject:');
    const idxFrom = headerBlock.indexOf('From: Alice');
    expect(idxReceived).toBeGreaterThanOrEqual(0);
    expect(idxReceived).toBeLessThan(idxEnvelope);
    expect(idxEnvelope).toBeLessThan(idxSubject);
    expect(idxSubject).toBeLessThan(idxFrom);
    expect(headerBlock).toContain('2026-09-11 07:59 UTC');
    expect(body).toBe('body content');
  });

  it('欠損ヘッダは (unknown) で表示し順序を保持する', () => {
    const partial: MailHeaders = {
      messageId: '',
      envelopeFrom: undefined,
      from: undefined,
      subject: undefined,
    };
    const out = formatStoredBody(partial, new Date('2026-09-11T00:00:00Z'), 'x');
    expect(out).toContain('Envelope-From: (unknown)');
    expect(out).toContain('Subject: (unknown)');
    expect(out).toContain('From: (unknown)');
    expect(out).toContain('Message-ID: (unknown)');
  });

  it('本文はヘッダブロックの後に区切りを挟んで置かれる', () => {
    const out = formatStoredBody(fullHeaders, new Date('2026-09-11T07:59:30Z'), 'the body');
    expect(out.endsWith('the body')).toBe(true);
    expect(out.includes(STORED_BODY_SEPARATOR)).toBe(true);
  });
});
