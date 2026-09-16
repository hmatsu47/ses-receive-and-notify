# Observability Requirements — SES受信メールのSlack通知ツール

> 上流: `../../../inception/requirements-analysis/requirements.md`（NFR2 可観測性、FR5 失敗ハンドリング）。

## Requirements

| ID | 要件 | 目標/基準 | 由来 |
|----|------|-----------|------|
| NFR2.1 | 構造化ログ | 受信・デコード・通知の各段階と失敗を CloudWatch Logs に構造化ログ（JSON等）で出力する。ログにはobjectKey/メッセージID等の相関キーを含める。 | NFR2, FR5.1 |
| NFR2.2 | ログ衛生 | ログにPII（メール本文の内容等）・秘匿値（Webhook URL等）を平文で出力しない。 | NFR3, Forbidden規則 |
| NFR2.3 | DLQ可観測性 | DLQの滞留メッセージ数を CloudWatch メトリクスで確認できる。DLQ滞留0を正常とみなす。 | FR5.3 |
| NFR2.4 | アラート（任意） | 常時アラートは必須要件としない。必要に応じて「DLQ滞留数 > 0」でアラート（SNS等）を追加できる余地を残す。 | NFR2 |

## SLI/SLO

- 独自の数値SLOは設けない（可用性はAWSマネージドに委ねる）。実質的な健全性指標は「DLQ滞留=0」「失敗ログが出ていないこと」とする。

## Assumptions & Open Questions

- アラート追加（SNSトピック/通知先）は必要時に observability/infrastructure で追加する。[assumption]
