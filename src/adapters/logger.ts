// NFR2.1 / NFR2.2 / NFR3.7: 構造化ログ。
// ログには objectKey / messageId 等の非機微な相関キーのみを出力し、
// メール本文 (PII) や秘匿値 (Webhook URL 等) を平文で出さない。

export type LogLevel = 'info' | 'warn' | 'error';

/** ログに載せてよいフィールドのみを受け付ける (自由な any を避ける)。 */
export interface LogContext {
  readonly stage?: string;
  readonly objectKey?: string;
  readonly messageId?: string;
  readonly sourceKey?: string;
  readonly errorKind?: string;
  readonly errorMessage?: string;
  readonly attachmentsSkipped?: boolean;
  readonly totalAttachmentBytes?: number;
  readonly durationMs?: number;
  readonly idempotentSkip?: boolean;
}

/** 秘匿値らしきキーやメール本文キーを弾くための拒否リスト (防御的)。 */
const FORBIDDEN_KEYS = new Set([
  'webhookurl',
  'slackwebhookurl',
  'secret',
  'password',
  'token',
  'body',
  'textbody',
  'rawmail',
  'raw',
]);

function stripForbidden(context: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    if (FORBIDDEN_KEYS.has(k.toLowerCase())) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

function emit(level: LogLevel, message: string, context: LogContext | undefined): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? stripForbidden(context) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/** 既定ロガー。CloudWatch Logs は stdout/stderr を取り込む。 */
export const logger: Logger = {
  info: (m, c) => emit('info', m, c),
  warn: (m, c) => emit('warn', m, c),
  error: (m, c) => emit('error', m, c),
};
