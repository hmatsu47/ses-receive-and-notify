import { simpleParser } from 'mailparser';
import type { AddressObject, ParsedMail } from 'mailparser';
import type { DecodedMail, DecodedAttachment, MailHeaders, Result } from './types.js';
import { ok, err } from './types.js';
import { extractTextFromHtml } from './summarizeBody.js';

/** 添付合計サイズの既定上限 (FR2.4: 10MB)。呼び出し側が Config から上書き可能。 */
export const DEFAULT_ATTACHMENT_TOTAL_LIMIT_BYTES = 10 * 1024 * 1024;

/** デコード失敗の分類。 */
export interface DecodeFailure {
  readonly kind: 'decode-failed';
  readonly message: string;
}

function addressText(addr: AddressObject | AddressObject[] | undefined): string | undefined {
  if (!addr) return undefined;
  const first = Array.isArray(addr) ? addr[0] : addr;
  const text = first?.text?.trim();
  return text && text.length > 0 ? text : undefined;
}

function toHeaders(parsed: ParsedMail): MailHeaders {
  // messageId が欠損する MIME は稀だが存在しうる。相関キーの安定性のため空文字は許容せず、
  // 呼び出し側 (handler) が欠損検知できるよう素の値を返す (整形は buildObjectKey 側)。
  const messageId = (parsed.messageId ?? '').trim();
  // エンベロープ From は SES 保存の raw ヘッダでは Return-Path に相当することが多い。
  // mailparser は return-path を AddressObject として解釈するため、addressText で取り出す。
  const returnPath = parsed.headers.get('return-path') as
    | AddressObject
    | AddressObject[]
    | string
    | undefined;
  const envelopeFrom =
    typeof returnPath === 'string'
      ? returnPath.trim().length > 0
        ? returnPath.trim()
        : addressText(parsed.from)
      : (addressText(returnPath) ?? addressText(parsed.from));
  return {
    messageId,
    envelopeFrom,
    from: addressText(parsed.from),
    subject: parsed.subject?.trim() || undefined,
  };
}

function sumAttachmentBytes(parsed: ParsedMail): number {
  return parsed.attachments.reduce((total, a) => total + (a.size ?? a.content?.length ?? 0), 0);
}

function toAttachmentMeta(parsed: ParsedMail): DecodedAttachment[] {
  return parsed.attachments.map((a, i) => {
    // mailparser の content は Uint8Array/Buffer。保管のため確実に Buffer 化する。
    const content = Buffer.isBuffer(a.content)
      ? a.content
      : Buffer.from((a.content ?? new Uint8Array()) as Uint8Array);
    return {
      filename: a.filename ?? `attachment-${i + 1}`,
      contentType: a.contentType ?? 'application/octet-stream',
      size: a.size ?? content.length,
      content,
    };
  });
}

/**
 * FR2.1 / FR2.4: raw MIME をデコードして本文/ヘッダ/添付を分離する。
 * - 添付合計サイズが上限を超える場合、添付のデコード(展開)は行わず attachmentsSkipped=true を返す。
 *   この場合も本文とヘッダは返し、呼び出し側は原本保存・通知を継続できる (NEVER force-decode)。
 * - パース自体に失敗した場合は型付き失敗 (decode-failed) を返す。例外を握りつぶさない (fail loud via Result)。
 */
export async function decodeMailBody(
  raw: Buffer,
  attachmentTotalLimitBytes: number = DEFAULT_ATTACHMENT_TOTAL_LIMIT_BYTES,
): Promise<Result<DecodedMail, DecodeFailure>> {
  let parsed: ParsedMail;
  try {
    parsed = await simpleParser(raw);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err({ kind: 'decode-failed', message });
  }

  const headers = toHeaders(parsed);
  const totalAttachmentBytes = sumAttachmentBytes(parsed);
  const overLimit = totalAttachmentBytes > attachmentTotalLimitBytes;

  // 本文抽出:
  // mailparser は text/plain が無い HTML メールでも parsed.text にテキスト抽出結果を格納する。
  // - text/plain パートがあれば parsed.text はそのプレーンテキスト。
  // - HTML のみなら parsed.text は HTML から抽出済みだが、より確実に整形するため html があれば
  //   自前の extractTextFromHtml を優先し、無ければ parsed.text を用いる。
  // hadPlainText は「元がプレーンテキスト由来か」= HTML パートが無いこと、で判定する。
  const hadPlainText = !parsed.html;
  const textBody = hadPlainText ? (parsed.text ?? '') : extractTextFromHtml(parsed.html as string);

  return ok({
    headers,
    textBody,
    hadPlainText,
    // 上限超過時は添付のメタも展開しない (デコードスキップ)。
    attachments: overLimit ? [] : toAttachmentMeta(parsed),
    totalAttachmentBytes,
    attachmentsSkipped: overLimit,
  });
}
