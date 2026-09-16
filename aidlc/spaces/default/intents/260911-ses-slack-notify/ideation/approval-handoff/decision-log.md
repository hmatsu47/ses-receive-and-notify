# Decision Log — SES受信メールのSlack通知ツール（Ideation フェーズ）

> ideation フェーズ（intent-capture / scope-definition / approval-handoff）で確定した意思決定の記録です。

| # | Decision（決定事項） | Rationale（根拠） | Stage | Source |
|---|---------------------|-------------------|-------|--------|
| D1 | 目的は送信ドメインのレピュテーション向上のためのMX登録に伴うSES受信サーバー構築。稀な受信の見落とし防止を主眼とする | 送信サーバーのオンプレ→クラウド切替に伴う要件 | intent-capture | [Q1][Q4] |
| D2 | 最重視する成功基準は「通知の取りこぼしゼロ（受信メールが必ず通知・保管される信頼性）」 | 受信は稀だが見落とすと運用上の問題 | intent-capture | [Q3] |
| D3 | 受信頻度は1日数通（いたずら時でも数十通）程度で特殊なスケーリング対策は不要 | 想定トラフィックが小さい | intent-capture | [Q10] |
| D4 | Slack通知の本文は長い場合、冒頭200文字程度に切り詰める | 通知の可読性 | intent-capture | [Q9] |
| D5 | 通知手段は Slack Webhook のみ。追加レポートは不要 | 目的に対し十分 | intent-capture | [Q7] |
| D6 | MVPはSES受信→S3保存→デコード別S3保管→Slack通知のE2E＋失敗の可視化。エラーはCloudWatch Logsで足りる（Slackエラー通知は必須でない） | 最小で価値を出しつつ失敗を検知 | scope-definition | [Q1] |
| D7 | 機能は一通りMust。ただし添付が処理上限超過時は無理にデコードしない（保存・通知は継続） | 実行環境制約への現実的対処 | scope-definition | [Q2] |
| D8 | 依存は直列（受信保存→デコード保管→通知）、構築順序は dependency-first | 依存関係に沿った着実な積み上げ | scope-definition | [Q3][Q4] |
| D9 | Out of Scope: Route53登録・SES検証（手動）/ 返信・自動応答・クライアント / 全文検索・ダッシュボード / スパム・ウイルススキャン | スコープを小規模ツールに集中 | scope-definition | [Q6] |
| D10 | Route53は同一/別AWSアカウントの両対応。別アカウント連携は既存実装経験（dmarc-report-visualizer）ありで難度限定的 | 要件＋実装経験によるリスク低減 | approval-handoff | [Q2] |
| D11 | ideation → inception へ Go 判断 | スコープ・リスク・体制の合意が成立 | approval-handoff | [Q7] |

## Deferred Decisions（後続へ先送りした決定）

- 添付の「処理上限」の具体値（サイズ等）。[assumption]
- 取りこぼしゼロを支える再試行/デッドレター（DLQ）方式の具体設計。[assumption]
- Slack通知先チャネルの運用詳細（複数チャネル分岐の要否等）。[assumption]

## Assumptions & Open Questions

- 上記 Deferred Decisions は inception フェーズ（要件整理・設計方針）で扱う。[assumption]
