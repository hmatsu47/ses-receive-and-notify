// FR3.3: 本文概要の生成。デコード済みプレーンテキスト本文 (HTML はテキスト抽出後) の
// 冒頭 200 文字程度を返す。保存本文先頭に付与するヘッダは概要に含めない
// (この関数へはヘッダを付与する前の本文を渡す契約)。

/** 概要の目安文字数 (FR3.3)。 */
export const SUMMARY_MAX_CHARS = 200;

/** 切り詰め時に付与する省略記号。 */
export const SUMMARY_ELLIPSIS = '…';

/**
 * 極めて素朴な HTML→テキスト抽出。
 * script/style を除去し、タグを空白へ、実体参照を最小限デコードし、連続空白を畳む。
 * 高度な整形は不要 (概要 200 字用途) のため外部依存を持たない純粋関数とする。
 */
export function extractTextFromHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');
  const decoded = withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return decoded.replace(/\s+/g, ' ').trim();
}

/**
 * 本文 (ヘッダ付与前) から概要を生成する。
 * 200 文字以下はそのまま、超過時は 200 文字で切り詰め省略記号を付す。
 * Unicode コードポイント単位で数え、サロゲートペアを壊さない。
 */
export function summarizeBody(body: string): string {
  const normalized = body.replace(/\r\n/g, '\n').trim();
  const codepoints = Array.from(normalized);
  if (codepoints.length <= SUMMARY_MAX_CHARS) {
    return normalized;
  }
  return codepoints.slice(0, SUMMARY_MAX_CHARS).join('') + SUMMARY_ELLIPSIS;
}
