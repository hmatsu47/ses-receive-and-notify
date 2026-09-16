# Tech Stack Decisions — SES受信メールのSlack通知ツール

> 上流: `../../../inception/requirements-analysis/requirements.md`（Constraints）、`../../../../memory/team.md`（Code Style / Deployment）。

## 選定と根拠

| 領域 | 選定 | 根拠 | 代替（不採用）|
|------|------|------|----------------|
| 実装言語/ランタイム | TypeScript / Node.js（AWS Lambda, Node.js LTSランタイム） | 型付けによる境界の安全性、AWS SDK v3 の型サポート、チーム確定方針。 | Python（支障時のフォールバックとして保持。永続的な不採用ではない）|
| IaC | AWS CDK（TypeScript） | 実装言語と統一でき、SES受信ルール・S3・Lambda・IAM・DLQをコードで表現。 | SAM / Terraform（CDKで統一する方が単一言語で完結）|
| Lint/Format | ESLint / Prettier | 言語慣用、リポジトリ直下に設定。 | Biome等（標準的なESLint/Prettierで十分）|
| テスト | vitest または jest ＋ aws-sdk-client-mock | ハンドラ単体テスト・ドメイン純粋関数テストをモックで無認証実行。 | 実AWS結合テスト常設（稀受信・小規模のため不要、手動投函で代替）|
| メール解析 | Node.js のメール解析ライブラリ（実装時に選定、例: mailparser 等） | MIMEデコード・本文/添付分離・ヘッダ抽出を担う。 | 自前パーサ（保守負担が大きく不採用）|
| Slack通知 | Incoming Webhook（HTTP POST） | 要件どおり単一Webhook・単一チャネル。 | Slack Web API（Webhookで十分、権限管理を最小化）|
| シークレット管理 | 設定は環境変数（.env）に一本化。秘匿値（Slack Webhook URL）は本番では Secrets Manager から実行時に読み込み、ローカル/テストでは .env から読む | Mandated規則に準拠。設定読込元は env 一本化とし、SSM Parameter Store は不採用（対象ドメイン等が非機微で単一秘匿値のみのため Secrets Manager で十分）。 | ハードコード（Forbidden、不採用）／SSM Parameter Store（不採用）|

## Node.js ランタイム方針

- Lambda は Node.js の LTS ランタイム（実装時点で AWS がサポートする LTS）を用いる。具体バージョンは実装/infrastructure で確定する。

## トレードオフ

- TypeScript を第一候補としつつ Python フォールバックを明記（team.md Code Style に準拠）。最終確定は実装ステージで行うため、本ステージでは「方向＋フォールバック」を記録する。

## Assumptions & Open Questions

- メール解析ライブラリの具体選定、Node.js ランタイムの具体バージョン、シークレットを .env と Secrets Manager のどちらで運用するかは、infrastructure/実装で確定する。[assumption]
