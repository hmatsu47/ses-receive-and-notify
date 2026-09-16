// FR2.2 / FR2.5: 2nd S3 のオブジェクトキーを一元的に生成する純粋関数。
// キーは「受信日時プレフィックス + メッセージID」で構成し、日時プレフィックスにより
// 辞書順ソート = 時系列ソートとなる設計。冪等キー = objectKey 全体。
// フォーマット定数はこのモジュールに集約し、マジック文字列を散在させない。

/** 日時プレフィックスのフォーマット (UTC, ソート可能な固定桁)。 */
export const OBJECT_KEY_PREFIX = 'decoded/';
export const OBJECT_KEY_EXTENSION = '.txt';

/**
 * 受信日時を YYYY/MM/DD/YYYYMMDDTHHmm という階層 + ソート可能プレフィックスに整形する。
 * 年月日の階層はプレフィックス列挙を容易にし、末尾の分精度トークンで同日内も時系列ソート可能。
 */
function formatReceivedAtPrefix(receivedAt: Date): string {
  if (Number.isNaN(receivedAt.getTime())) {
    throw new Error('buildObjectKey: receivedAt is an invalid Date');
  }
  const yyyy = receivedAt.getUTCFullYear().toString().padStart(4, '0');
  const mm = (receivedAt.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = receivedAt.getUTCDate().toString().padStart(2, '0');
  const hh = receivedAt.getUTCHours().toString().padStart(2, '0');
  const min = receivedAt.getUTCMinutes().toString().padStart(2, '0');
  // 例: decoded/2026/09/11/20260911T0759-<messageId>.txt
  return `${OBJECT_KEY_PREFIX}${yyyy}/${mm}/${dd}/${yyyy}${mm}${dd}T${hh}${min}`;
}

/**
 * メッセージ ID を S3 キーに安全な文字へ正規化する。
 * `<`/`>`/空白/スラッシュ等をハイフンに畳み込み、キー衝突と不正キーを防ぐ。
 */
function sanitizeMessageId(messageId: string): string {
  const trimmed = messageId.trim();
  if (trimmed.length === 0) {
    throw new Error('buildObjectKey: messageId must not be empty');
  }
  return trimmed.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * 冪等キー兼 2nd S3 オブジェクトキーを生成する。
 * 同一 receivedAt(分精度) かつ 同一 messageId なら常に同一キーを返す (冪等性の基盤)。
 */
export function buildObjectKey(receivedAt: Date, messageId: string): string {
  const prefix = formatReceivedAtPrefix(receivedAt);
  const id = sanitizeMessageId(messageId);
  return `${prefix}-${id}${OBJECT_KEY_EXTENSION}`;
}

/** 添付ファイル名を S3 キーに安全な文字へ正規化する (パス区切りや不正文字を畳み込む)。 */
function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim();
  const normalized = trimmed.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'attachment';
}

/**
 * 添付ファイルの 2nd S3 オブジェクトキーを生成する (FR2.1/FR2.2)。
 * 本文キー (`...-<messageId>.txt`) と衝突しないよう、同一の受信日時プレフィックス配下の
 * `-<messageId>/attachments/NN-<filename>` に配置する。index は 0 始まりで受け取り、
 * 2 桁ゼロ埋めの連番 (01,02,...) にしてソート順を安定させる。
 * 冪等性は本文キーの存在確認で担保するため、添付キーも受信日時+messageId+index+filename で決定的。
 */
export function buildAttachmentKey(
  receivedAt: Date,
  messageId: string,
  index: number,
  filename: string,
): string {
  const prefix = formatReceivedAtPrefix(receivedAt);
  const id = sanitizeMessageId(messageId);
  const seq = (index + 1).toString().padStart(2, '0');
  const name = sanitizeFilename(filename);
  return `${prefix}-${id}/attachments/${seq}-${name}`;
}
