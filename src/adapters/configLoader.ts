import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { Config } from '../domain/types.js';

// FR4.1 / NFR3.6: 対象ドメイン・バケット名等の非機微な設定値は環境変数 (.env)
// から読み込む。秘匿値 (SLACK_WEBHOOK_URL) はソース・IaC・Lambda 環境変数に
// 平文で残さず、SECRETS_MANAGER_SECRET_ID で指定した Secrets Manager から
// 実行時に読み込む。ローカル/テスト時のみ env に置いて差し替える。

type RawSettings = Record<string, string | undefined>;

// env に直接置く (非機微)。欠損時はデフォルトがなければ fail loud する。
const REQUIRED_ENV_KEYS = [
  'TARGET_DOMAIN',
  'RAW_MAIL_BUCKET',
  'DECODED_MAIL_BUCKET',
] as const;

// 秘匿値。SECRETS_MANAGER_SECRET_ID 指定時は Secrets Manager から供給され、
// 未指定時 (ローカル/テスト) は env から読む。どちらの経路でも最終的に必須。
const REQUIRED_SECRET_KEYS = ['SLACK_WEBHOOK_URL'] as const;

// 添付デコード合計上限のデフォルト (10MB)。
const DEFAULT_ATTACHMENT_TOTAL_LIMIT_BYTES = 10 * 1024 * 1024;

function parseLimit(value: string | undefined): number {
  const n = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ATTACHMENT_TOTAL_LIMIT_BYTES;
}

function assembleConfig(raw: RawSettings): Config {
  const missing = [...REQUIRED_ENV_KEYS, ...REQUIRED_SECRET_KEYS].filter(
    (k) => !raw[k] || raw[k]?.trim().length === 0,
  );
  if (missing.length > 0) {
    // 秘匿値そのものはログ/例外メッセージに載せない。欠損したキー名のみを報告する。
    throw new Error(`configLoader: missing required settings: ${missing.join(', ')}`);
  }
  return {
    targetDomain: raw.TARGET_DOMAIN as string,
    slackWebhookUrl: raw.SLACK_WEBHOOK_URL as string,
    rawMailBucket: raw.RAW_MAIL_BUCKET as string,
    decodedMailBucket: raw.DECODED_MAIL_BUCKET as string,
    attachmentTotalLimitBytes: parseLimit(raw.ATTACHMENT_TOTAL_LIMIT_BYTES),
    region: raw.AWS_REGION,
  };
}

async function loadFromSecretsManager(
  secretId: string,
  region: string | undefined,
): Promise<RawSettings> {
  const client = new SecretsManagerClient(region ? { region } : {});
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!res.SecretString) {
    throw new Error('configLoader: Secrets Manager secret has no SecretString');
  }
  const parsed = JSON.parse(res.SecretString) as RawSettings;
  return parsed;
}

/**
 * 実行時設定を解決する。読込元は環境変数 (.env) に一本化する:
 * - 非機微値 (TARGET_DOMAIN / RAW_MAIL_BUCKET / DECODED_MAIL_BUCKET /
 *   ATTACHMENT_TOTAL_LIMIT_BYTES / AWS_REGION) は常に env から読む。
 * - 秘匿値 (SLACK_WEBHOOK_URL) は SECRETS_MANAGER_SECRET_ID が指定されていれば
 *   Secrets Manager の JSON secret から読み、env より優先してマージする。
 *   未指定時 (ローカル/テスト) は env の SLACK_WEBHOOK_URL を使う。
 */
export async function loadConfig(env: RawSettings = process.env): Promise<Config> {
  const region = env.AWS_REGION;
  let secret: RawSettings = {};

  const secretId = env.SECRETS_MANAGER_SECRET_ID;
  if (secretId && secretId.trim().length > 0) {
    secret = await loadFromSecretsManager(secretId, region);
  }

  // env を基底とし、Secrets Manager の秘匿値で上書きする。
  return assembleConfig({ ...env, ...secret });
}
