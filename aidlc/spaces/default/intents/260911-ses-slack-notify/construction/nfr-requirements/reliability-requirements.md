# Reliability Requirements — SES受信メールのSlack通知ツール

> 上流: `../../../inception/requirements-analysis/requirements.md`（NFR1 信頼性＝取りこぼしゼロ、FR5 失敗ハンドリング）。

## Requirements

| ID | 要件 | 目標/基準 | 由来 |
|----|------|-----------|------|
| NFR1.2 | 取りこぼしゼロ | 受信したメールは必ず1st S3に原本保存され、objectKey（受信日時＋メッセージID）単位で少なくとも一度Slack通知される。 | NFR1, FR1, FR3 |
| NFR1.3 | リトライ | デコードLambdaは非同期呼び出しの標準リトライ（既定2回）を用いる。リトライ後も継続できない処理はDLQへ退避する。 | FR5.3 |
| NFR1.4 | DLQ滞留 | DLQ滞留は0件を正常状態とみなす。滞留発生時はCloudWatch Logs/メトリクスで確認可能とする。 | FR5.3 |
| NFR1.5 | 部分失敗継続 | デコード失敗時も1st S3の原本保存は維持する。Slack送信失敗時も保存は維持し、失敗はログに可視化する。 | FR5.2 |
| NFR1.6 | 冪等性 | 同一objectKey（受信日時＋メッセージID）に対して2nd S3重複保管・Slack重複通知を行わない。別日時タイムスタンプでの稀な二重記録は許容する。 | FR2.5, FR3.5 |
| NFR1.7 | 可用性 | 可用性はAWSマネージドサービス（SES/S3/Lambda）に委ね、本ツール独自の数値SLOは設けない。 | NFR1 |

## 障害時の挙動 / グレースフルデグラデーション

- 添付が処理上限（合計10MB）超過時はデコードをスキップし、原本保存とSlack通知は継続する（機能低下を許容し停止しない）。

## Assumptions & Open Questions

- DLQの具体構成（SQS DLQ / Lambda destinations）は infrastructure/設計で確定する。[assumption]
