import { describe, it, expect } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { loadConfig } from '../src/adapters/configLoader.js';

describe('configLoader (FR4.1 secrets externalized, NEVER hardcoded)', () => {
  it('環境変数から設定を読み込む (SECRETS_MANAGER_SECRET_ID 未指定 = ローカル/テスト経路)', async () => {
    // rule: 非機微値は env、秘匿値は SM 経由。ローカルでは env の SLACK_WEBHOOK_URL を使う。
    const config = await loadConfig({
      TARGET_DOMAIN: 'example.com',
      SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/X',
      RAW_MAIL_BUCKET: 'raw',
      DECODED_MAIL_BUCKET: 'decoded',
    });
    expect(config.targetDomain).toBe('example.com');
    expect(config.slackWebhookUrl).toBe('https://hooks.slack.com/services/T/B/X');
    expect(config.rawMailBucket).toBe('raw');
    expect(config.decodedMailBucket).toBe('decoded');
  });

  it('ATTACHMENT_TOTAL_LIMIT_BYTES 未指定時は既定 10MB を使う', async () => {
    const config = await loadConfig({
      TARGET_DOMAIN: 'example.com',
      SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/X',
      RAW_MAIL_BUCKET: 'raw',
      DECODED_MAIL_BUCKET: 'decoded',
    });
    expect(config.attachmentTotalLimitBytes).toBe(10 * 1024 * 1024);
  });

  it('ATTACHMENT_TOTAL_LIMIT_BYTES を指定するとその値を使う / 不正値は既定へフォールバック', async () => {
    const base = {
      TARGET_DOMAIN: 'example.com',
      SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/X',
      RAW_MAIL_BUCKET: 'raw',
      DECODED_MAIL_BUCKET: 'decoded',
    };
    const explicit = await loadConfig({ ...base, ATTACHMENT_TOTAL_LIMIT_BYTES: '1048576' });
    expect(explicit.attachmentTotalLimitBytes).toBe(1048576);

    const invalid = await loadConfig({ ...base, ATTACHMENT_TOTAL_LIMIT_BYTES: 'not-a-number' });
    expect(invalid.attachmentTotalLimitBytes).toBe(10 * 1024 * 1024);
  });

  it('AWS_REGION は任意 (未指定なら undefined)', async () => {
    const config = await loadConfig({
      TARGET_DOMAIN: 'example.com',
      SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/X',
      RAW_MAIL_BUCKET: 'raw',
      DECODED_MAIL_BUCKET: 'decoded',
    });
    expect(config.region).toBeUndefined();
  });

  it('必須設定が欠損すると欠損キー名のみを報告して fail loud する (秘匿値は載せない)', async () => {
    // TARGET_DOMAIN のみ指定 → 残りの必須キーが欠損。
    await expect(loadConfig({ TARGET_DOMAIN: 'example.com' })).rejects.toThrow(
      /missing required settings/,
    );
  });

  it('欠損メッセージには欠損キー名のみを含み、秘匿値そのものは含めない', async () => {
    await expect(loadConfig({ RAW_MAIL_BUCKET: 'raw', DECODED_MAIL_BUCKET: 'decoded' })).rejects.toThrow(
      /TARGET_DOMAIN.*SLACK_WEBHOOK_URL|SLACK_WEBHOOK_URL/,
    );
  });

  it('SECRETS_MANAGER_SECRET_ID 指定時は Secrets Manager から秘匿値を読み env より優先する', async () => {
    const smMock = mockClient(SecretsManagerClient);
    smMock.reset();
    smMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/S/E/C' }),
    });
    const config = await loadConfig({
      SECRETS_MANAGER_SECRET_ID: 'ses-notify/secrets',
      TARGET_DOMAIN: 'example.com',
      // env 側の SLACK_WEBHOOK_URL は SM 値で上書きされる。
      SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/E/N/V',
      RAW_MAIL_BUCKET: 'raw',
      DECODED_MAIL_BUCKET: 'decoded',
    });
    expect(config.slackWebhookUrl).toBe('https://hooks.slack.com/services/S/E/C');
  });
});
