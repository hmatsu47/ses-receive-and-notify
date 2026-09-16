import { describe, it, expect } from 'vitest';
import {
  summarizeBody,
  extractTextFromHtml,
  SUMMARY_MAX_CHARS,
  SUMMARY_ELLIPSIS,
} from '../src/domain/summarizeBody.js';

describe('summarizeBody (FR3.3)', () => {
  it('短い本文はそのまま返す (verbatim)', () => {
    expect(summarizeBody('short body')).toBe('short body');
  });

  it('200文字ちょうどは切り詰めない (境界値: =200)', () => {
    const body = 'a'.repeat(SUMMARY_MAX_CHARS);
    const out = summarizeBody(body);
    expect(out).toBe(body);
    expect(out.includes(SUMMARY_ELLIPSIS)).toBe(false);
  });

  it('200文字超過は200文字で切り詰め省略記号を付す (境界値: >200)', () => {
    const body = 'b'.repeat(SUMMARY_MAX_CHARS + 50);
    const out = summarizeBody(body);
    expect(Array.from(out.replace(SUMMARY_ELLIPSIS, '')).length).toBe(SUMMARY_MAX_CHARS);
    expect(out.endsWith(SUMMARY_ELLIPSIS)).toBe(true);
  });

  it('前後の空白は trim される', () => {
    expect(summarizeBody('  \n padded \n ')).toBe('padded');
  });

  it('HTML はタグ除去後のテキストを概要にできる', () => {
    const text = extractTextFromHtml('<p>Hello <b>World</b></p><script>x()</script>');
    expect(text).toBe('Hello World');
    expect(summarizeBody(text)).toBe('Hello World');
  });

  it('サロゲートペア(絵文字)を壊さずに数える', () => {
    const body = '😀'.repeat(SUMMARY_MAX_CHARS + 10);
    const out = summarizeBody(body);
    // 省略記号を除いたコードポイント数が上限と一致し、壊れた文字が無い。
    expect(Array.from(out.replace(SUMMARY_ELLIPSIS, '')).length).toBe(SUMMARY_MAX_CHARS);
    expect(out).not.toContain('\uFFFD');
  });
});
