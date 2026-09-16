import type { SlackPayload } from '../domain/types.js';

// FR3.1: 単一 Slack Incoming Webhook へ HTTP POST する薄いアダプタ。
// NFR5: fetch を注入可能にし、ユニットテストで実ネットワークを使わずスタブ化する。
// NFR3.6: Webhook URL は呼び出し側 (Config) から渡し、ソースにハードコードしない。

/** テスト差し替え可能な fetch シグネチャ (グローバル fetch に準拠)。 */
export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Slack 送信の抽象 (DI 境界)。 */
export interface SlackPort {
  send(payload: SlackPayload): Promise<void>;
}

/**
 * Slack Webhook アダプタ。送信失敗 (非 2xx / ネットワークエラー) は例外を投げ、
 * 呼び出し側 (handler) が「保存継続＋ログ可視化」に分岐できるようにする。
 * 例外を握りつぶさない (no silent failure)。
 */
export function createSlackAdapter(
  webhookUrl: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
): SlackPort {
  return {
    async send(payload) {
      const res = await fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        // URL 自体はメッセージに含めない (秘匿値)。ステータスと短い応答のみ。
        throw new Error(`slackAdapter.send: non-2xx response status=${res.status} ${detail}`);
      }
    },
  };
}
