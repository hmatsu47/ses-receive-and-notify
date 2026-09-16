<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-11T06:23Z 要件確定: Q1 S3イベント駆動(SES受信ルール→S3→ObjectCreated→Lambda), Q2 S3リンクはs3://パス/コンソールURL(presigned不使用), Q3 単一Webhook単一チャネル, Q4 Lambda自動リトライ+DLQ退避+CloudWatch可視化+部分失敗継続, Q5 添付上限=合計10MB(超過はデコードスキップ・保存/通知継続), Q6 本文概要=デコード済みプレーンテキスト冒頭200字(ヘッダ除外)。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-11T06:37Z R-01対応（人間決定）: 冪等キーはobjectKey全体（受信日時＋メッセージID）に統一。日時でソート可能なキー設計とし、同一メールが別日時タイムスタンプで届く稀な二重記録は影響軽微として許容。NFR2のDLG誤記をDLQに修正。FR2.2/FR2.5/FR3.5/NFR1/NFR2を改訂。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
