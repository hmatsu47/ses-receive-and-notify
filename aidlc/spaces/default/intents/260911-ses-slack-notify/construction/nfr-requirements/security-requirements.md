# Security Requirements — SES受信メールのSlack通知ツール

> 上流: `../../../inception/requirements-analysis/requirements.md`（NFR3 セキュリティ）。project.md の Mandated/Forbidden 規則（最小権限・秘匿値/PII非平文）に準拠。DevSecOps観点（STRIDE、最小権限、供給網）を反映。

## 認証・認可（Authentication / Authorization）

| ID | 要件 | 由来 |
|----|------|------|
| NFR3.1 | Lambda実行ロールのIAM権限は最小権限とする：1st S3の get、2nd S3の put（および必要なら get）、CloudWatch Logs の書き込み、Slack Webhook URL を格納する Secrets Manager Secret の read に限定。ワイルドカード権限（`s3:*`、`*` リソース）を用いない。 | NFR3, Mandated(最小権限) |
| NFR3.2 | 2nd S3の保管オブジェクトへのアクセスは、IAM権限保有者に限定する。Slack通知に載せるリンクは参照情報（s3://パス/コンソールURL）であり、presigned URL等の匿名アクセス手段は用いない。 | FR3.4, NFR3 |

## データ保護（Data Protection）

| ID | 要件 | 由来 |
|----|------|------|
| NFR3.3 | 1st・2nd の両S3バケットは保管時暗号化（SSE-S3, S3管理鍵）を有効化する。 | NFR3 |
| NFR3.4 | 両S3バケットはパブリックアクセスブロックを全項目有効化し、公開しない。 | NFR3 |
| NFR3.5 | 転送時はAWS SDK/HTTPSによりTLSで保護する（S3・Slack Webhookともに）。 | NFR3 |
| NFR3.6 | 秘匿値（Slack Webhook URL・対象ドメイン・外部リソース識別子等）は .env または Secrets Manager 経由で読み込み、ソース/IaC/ログ/監査に平文で残さない。 | Mandated, Forbidden |

## ログ・監査（Audit / Logging）

| ID | 要件 | 由来 |
|----|------|------|
| NFR3.7 | ログにPII（受信メール本文の内容等）および秘匿値を平文出力しない。相関にはobjectKey/メッセージID等の非機微な識別子を用いる。 | Forbidden, NFR2.2 |

## 入力検証・脅威考慮（Input Validation / Threat Considerations, STRIDE要約）

| ID | 要件 | 由来 |
|----|------|------|
| NFR3.8 | 受信メール由来のデータ（Subject・From・本文等）はSlackペイロード整形時にサニタイズ/エスケープし、Slackのmarkdown/メンション等の意図しない解釈やインジェクションを防ぐ。信頼できない入力として扱う。 | DevSecOps(Tampering/Injection) |
| NFR3.9 | 添付は合計10MB上限を超える場合デコードしない（リソース枯渇＝DoS的挙動の回避。原本保存と通知は継続）。 | Forbidden(添付上限), NFR4 |
| NFR3.10 | 依存パッケージはバージョン固定（lockfile）で管理し、既知脆弱性スキャン（例: npm audit / Inspector）を任意で実施できる構成とする（供給網リスク低減）。 | DevSecOps(供給網) |

## Assumptions & Open Questions

- SSE-KMS（カスタマー管理鍵）は要件としない（SSE-S3で十分と判断）。将来必要になれば infrastructure で切替可能。[assumption]
- 脆弱性スキャンのCI組込みは本スコープでは必須としない（ci-pipeline はSKIP）。ローカル/手動で実施可能とする。[assumption]
