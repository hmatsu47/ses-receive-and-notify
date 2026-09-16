import { describe, it, expect } from 'vitest';
import {
  buildObjectKey,
  buildAttachmentKey,
  OBJECT_KEY_PREFIX,
} from '../src/domain/buildObjectKey.js';

describe('buildObjectKey (FR2.2 / FR2.5)', () => {
  it('受信日時プレフィックスとメッセージIDでキーを構成する (FR2.2)', () => {
    const key = buildObjectKey(new Date('2026-09-11T07:59:12Z'), '<abc123@mail>');
    expect(key.startsWith(OBJECT_KEY_PREFIX)).toBe(true);
    expect(key).toContain('20260911T0759');
    expect(key).toContain('abc123-mail'); // < > @ がハイフンへ正規化される
    expect(key.endsWith('.txt')).toBe(true);
  });

  it('日時プレフィックスにより辞書順ソート=時系列ソートになる (FR2.2 sortable)', () => {
    const earlier = buildObjectKey(new Date('2026-09-11T07:00:00Z'), 'm1');
    const later = buildObjectKey(new Date('2026-09-11T09:00:00Z'), 'm1');
    const nextDay = buildObjectKey(new Date('2026-09-12T00:00:00Z'), 'm1');
    const sorted = [later, nextDay, earlier].sort();
    expect(sorted).toEqual([earlier, later, nextDay]);
  });

  it('同一受信日時(分精度)かつ同一メッセージIDは同一キー=冪等キー (FR2.5)', () => {
    const a = buildObjectKey(new Date('2026-09-11T07:59:10Z'), 'msg-1');
    const b = buildObjectKey(new Date('2026-09-11T07:59:59Z'), 'msg-1');
    expect(a).toBe(b); // 秒は無視され分精度で一致 => 同一冪等キー
  });

  it('異なるメッセージIDは異なるキーになる (冪等キー一意性の境界)', () => {
    const a = buildObjectKey(new Date('2026-09-11T07:59:10Z'), 'msg-1');
    const b = buildObjectKey(new Date('2026-09-11T07:59:10Z'), 'msg-2');
    expect(a).not.toBe(b);
  });

  it('空のメッセージIDは不正入力として fail loud する', () => {
    expect(() => buildObjectKey(new Date('2026-09-11T07:59:10Z'), '   ')).toThrow();
  });

  it('無効な Date は fail loud する', () => {
    expect(() => buildObjectKey(new Date('invalid'), 'msg-1')).toThrow();
  });
});

describe('buildAttachmentKey (FR2.1 / FR2.2)', () => {
  const dt = new Date('2026-09-11T07:59:12Z');

  it('本文キーと同一プレフィックス配下の attachments/ に連番付きで配置する', () => {
    const key = buildAttachmentKey(dt, '<abc123@mail>', 0, 'report.pdf');
    expect(key.startsWith(OBJECT_KEY_PREFIX)).toBe(true);
    expect(key).toContain('20260911T0759');
    expect(key).toContain('/attachments/01-report.pdf');
  });

  it('本文キー(.txt)と衝突しない (添付は messageId フォルダ配下)', () => {
    const bodyKey = buildObjectKey(dt, '<abc123@mail>');
    const attKey = buildAttachmentKey(dt, '<abc123@mail>', 0, 'a.bin');
    expect(attKey).not.toBe(bodyKey);
    expect(bodyKey.endsWith('.txt')).toBe(true);
    expect(attKey.includes('/attachments/')).toBe(true);
  });

  it('index は 2 桁ゼロ埋めの連番になりソート順が安定する', () => {
    const k0 = buildAttachmentKey(dt, 'm', 0, 'a');
    const k9 = buildAttachmentKey(dt, 'm', 9, 'b');
    expect(k0).toContain('/attachments/01-');
    expect(k9).toContain('/attachments/10-');
  });

  it('ファイル名の不正文字・パス区切りをサニタイズする (キー衝突/不正防止)', () => {
    const key = buildAttachmentKey(dt, 'm', 0, '../../etc/pass wd.txt');
    expect(key).not.toContain('../');
    expect(key).not.toContain(' ');
    expect(key).toContain('/attachments/01-');
  });

  it('同一入力は決定的に同一キーを返す (冪等な再保管)', () => {
    const a = buildAttachmentKey(dt, 'msg-1', 2, 'x.bin');
    const b = buildAttachmentKey(new Date('2026-09-11T07:59:59Z'), 'msg-1', 2, 'x.bin');
    expect(a).toBe(b); // 分精度で一致
  });
});
