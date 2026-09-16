import type { MailHeaders } from './types.js';

// FR2.3: 2nd S3 に保管する本文の先頭に、受信年月日(時分)・エンベロープFrom・Subject・From
// 等のヘッダを本文の前に付与する。付与順はここで一元管理する。

/** 保存本文ヘッダブロックと本文を区切るセパレータ。 */
export const STORED_BODY_SEPARATOR = '\n---\n';

/** 欠損ヘッダの表示値。 */
const MISSING = '(unknown)';

/** 受信日時を保存本文ヘッダ用に整形する (UTC, ISO 分精度)。 */
function formatReceivedAtHeader(receivedAt: Date): string {
  if (Number.isNaN(receivedAt.getTime())) {
    return MISSING;
  }
  // 例: 2026-09-11 07:59 UTC
  const iso = receivedAt.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/**
 * 保存本文を組み立てる。ヘッダは固定順:
 * Received-At -> Envelope-From -> Subject -> From -> Message-ID。
 * 欠損ヘッダは (unknown) を表示し、順序は保持する。
 */
export function formatStoredBody(headers: MailHeaders, receivedAt: Date, textBody: string): string {
  const lines = [
    `Received-At: ${formatReceivedAtHeader(receivedAt)}`,
    `Envelope-From: ${headers.envelopeFrom ?? MISSING}`,
    `Subject: ${headers.subject ?? MISSING}`,
    `From: ${headers.from ?? MISSING}`,
    `Message-ID: ${headers.messageId.length > 0 ? headers.messageId : MISSING}`,
  ];
  return lines.join('\n') + STORED_BODY_SEPARATOR + textBody;
}
