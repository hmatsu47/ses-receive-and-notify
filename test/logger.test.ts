import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from '../src/adapters/logger.js';

describe('logger (NFR2.2 / NFR3.7 no PII / no secrets in logs)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('構造化JSONで level/message/timestamp と相関キーを出力する', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('stored', { stage: 'store', objectKey: 'decoded/x.txt', messageId: 'm1' });
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe('info');
    expect(parsed.objectKey).toBe('decoded/x.txt');
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('禁止キー(body/webhookUrl/secret等)は出力から除外される', () => {
    // rule: NEVER leave secrets/PII in plaintext in logs.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Cast to a permissive shape to inject forbidden runtime keys and verify they are stripped.
    logger.error('failed', {
      stage: 'notify',
      objectKey: 'decoded/x.txt',
      body: 'SENSITIVE MAIL CONTENT',
      slackWebhookUrl: 'https://hooks.slack.com/secret',
    } as unknown as Parameters<typeof logger.error>[1]);
    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toContain('SENSITIVE MAIL CONTENT');
    expect(line).not.toContain('hooks.slack.com/secret');
    expect(line).toContain('decoded/x.txt');
  });
});
