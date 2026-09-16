# Code Summary — SES受信メールのSlack通知ツール

> zero-Unit（単一ツール）。アプリコードはワークスペースルート、設計/サマリ成果物は本 record 配下。実装: TypeScript/Node（AWS Lambda, Node.js 20）＋ AWS CDK。テスト: vitest ＋ aws-sdk-client-mock（実 AWS 資格情報不要）。方式: test-after。

## 生成/変更ファイル

### アプリケーションソース（`src/`）
| ファイル | 役割 |
|----------|------|
| `src/domain/types.ts` | `ReceivedMail` / `DecodedMail` / `SlackPayload` / `Config` と型付き `Result` ヘルパー |
| `src/domain/buildObjectKey.ts` | 受信日時＋メッセージIDのソート可能な objectKey（冪等キー、フォーマット定数一元化） |
| `src/domain/decodeMailBody.ts` | MIME デコード（本文/ヘッダ/添付分離）、添付合計 >10MB は `attachmentsSkipped`、デコード失敗は型付き Result |
| `src/domain/summarizeBody.ts` | プレーンテキスト冒頭約200字要約、HTML はテキスト抽出後（サロゲート安全） |
| `src/domain/formatStoredBody.ts` | 保存本文先頭に Received-At / Envelope-From / Subject / From / Message-ID を付与 |
| `src/domain/formatSlackPayload.ts` | 受信日時→Subject→概要→s3:// リンク、Slack サニタイズ（メンション無効化、presigned 不使用） |
| `src/adapters/logger.ts` | 構造化 JSON ログ、禁止キー除去（PII/秘匿値を出力しない） |
| `src/adapters/configLoader.ts` | 環境変数（.env）に一本化。秘匿値 `SLACK_WEBHOOK_URL` は `SECRETS_MANAGER_SECRET_ID` 指定時に Secrets Manager から読み env より優先。欠損キーは fail-loud（秘匿値をログ出力しない） |
| `src/adapters/s3Adapter.ts` | get/put/objectExists（HeadObject）。NotFound→false、それ以外は rethrow |
| `src/adapters/slackAdapter.ts` | 注入可能 fetch による Webhook POST。非2xx は throw（メッセージに URL を含めない） |
| `src/handler.ts` | DI ハンドラ（`handleS3Event`）＋ Lambda エントリ。冪等・部分失敗継続・致命的失敗は throw で retry/DLQ |

### テスト（`test/`、8ファイル 42テスト全緑）
`buildObjectKey` / `decodeMailBody` / `summarizeBody` / `formatStoredBody` / `formatSlackPayload` / `configLoader` / `logger` / `handler`。ハンドラテストは冪等性・部分失敗継続・失敗注入の必須信頼性テストを含む。実行コマンドは `npx vitest run test/`（`test/unit-test-instructions.md` に記録、実 AWS 資格情報不要）。

### インフラ（`infra/`）
`app.ts` / `stack.ts`: S3×2（**自動命名** ＋ SSE-S3 ＋ BlockPublicAccess ＋ enforceSSL、生成名を Lambda 環境変数へ注入）、NodejsFunction（Node 20、60s/512MB、非同期リトライ2＋SQS DLQ 保持14日）、1st バケットの S3 ObjectCreated トリガ、最小権限 IAM（1st: `s3:GetObject`／2nd: `s3:GetObject`＋`s3:PutObject`／必要時のみスコープ付き Secrets Manager read）、CloudWatch Logs。IaC 内コメントは英語のみ。`cdk.json` 追加。

### 設定/ビルド
`package.json`（build/lint/test/format＋cdk スクリプト、依存はピン留め）、`tsconfig.json`（strict）、`.eslintrc.json`、`.prettierrc.json`、`vitest.config.ts`（ダミー AWS 資格情報）、`.env.example`、`README.md`（手動 Route53/SES 運用＋デプロイ手順）、`.gitignore` 追記（`.env`、`cdk.out`）。

## 主要な実装判断
- **冪等性**: 分精度の objectKey（受信日時＋メッセージID）に対する HeadObject 存在確認で、2nd S3 重複保管と Slack 重複通知の双方を抑止。異なる受信日時での再到達は FR2.5 のとおり許容。
- **DI 徹底**: `S3Port` / `SlackPort` / `Logger` を注入し、全スイートを実 AWS 資格情報なしで実行可能に。
- **失敗の型付き伝播**: 想定内失敗（デコード不能・添付上限超過・Slack 送信失敗）は保存継続＋ログ。原本取得/保存の失敗のみ throw して Lambda リトライ/DLQ へ。
- **最小権限 IAM**: `grantReadWrite`（delete/list が付与される）を避け、明示的なスコープ付き PolicyStatement で構成。

## 計画からの逸脱
- `tsconfig` の `exactOptionalPropertyTypes: true` を除外。AWS SDK v3 / CDK の型（Environment, BucketProps, GetParametersByPath の NextToken）と衝突するため。`strict: true` は維持しており team.md の「TypeScript strict」を満たす。品質目標の緩和ではなく、strict より厳しいオプトインの取り下げ。

## Step 20 改訂（設定受け渡しの統一）
- レビュー後のユーザー指摘（`-c` context は `cdk diff` で無視され不都合、設定値は `.env` で統一）を受け、CDK の設定受け渡しを環境変数（.env）駆動に統一。
  - `infra/app.ts`: `app.node.tryGetContext(...)`（`-c`）依存を廃止し、`process.env`（`TARGET_DOMAIN` / `SECRETS_MANAGER_SECRET_ARN` / `SECRETS_MANAGER_SECRET_ID`）から読む。`synth`/`deploy`/`diff` が同一の値を見る。S3 バケットは CDK 自動命名で生成し生成名を Lambda 環境変数へ注入（バケット名は `.env` 不要）。設定読込元は env 一本化とし、`CONFIG_SOURCE` / `SSM_PARAMETER_PREFIX` は廃止。
  - `README.md`: デプロイ手順を `-c` 列挙から「`set -a; . ./.env; set +a` で環境変数をロードしてから `cdk` を実行」に統一。`cdk` が読む環境変数の一覧表を追加（必須/任意・デフォルト値を明示）。秘匿値（`SLACK_WEBHOOK_URL`）の実行時供給経路（Secrets Manager）とローカルテスト用環境変数を別セクションで明記。
  - `.env.example`: CDK デプロイ用の `SECRETS_MANAGER_SECRET_ARN`（IAM read 権限付与用の ARN）を追記し、実行時読込用の `SECRETS_MANAGER_SECRET_ID` と役割を区別。設定読込元は env 一本化とし、`CONFIG_SOURCE` / `SSM_PARAMETER_PREFIX` は廃止。
- 検証: `npm run build`（tsc）・`npm run lint`（eslint）クリーン、`npx vitest run test/` で 42 テスト全緑（回帰なし）。

## 既知の懸念
- `npm audit` が transitive 依存（mailparser/eslint 系）で脆弱性を報告。バージョン緩和は行わず未対応（本ステージのスコープ外、Build and Test / 依存更新で扱う）。
