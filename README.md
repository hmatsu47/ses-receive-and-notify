# ses-receive-and-notify

対象ドメイン宛に稀に届く受信メールを S3 に保管し、Slack に通知する小規模ツールです。

構成: **SES 受信 → 1st S3（原本保存）→ Lambda（デコード）→ 2nd S3（整理保管）→ Slack 通知**。

- 実装: TypeScript / Node.js（AWS Lambda, Node.js 22 LTS）
- IaC: AWS CDK（TypeScript）

## ディレクトリ構成

```
src/
  domain/     # 副作用のない純粋関数（型・キー生成・デコード・要約・整形）
  adapters/   # 外部依存の薄いラッパ（S3 / Slack / 設定読込 / ロガー）
  handler.ts  # Lambda ハンドラ（I/O 境界）
infra/        # AWS CDK（S3×2 / Lambda / S3トリガ / 最小権限IAM / DLQ）
test/         # ユニットテスト（src 構成に対応）
```

## デプロイ全体の流れ

CDK で Lambda・S3×2・IAM・DLQ を作成し、手動設定（Secrets Manager・Route53・SES）と組み合わせて稼働させます。**S3 バケットは CDK が自動命名で生成する**ため、バケット名を事前に決めて渡す必要はありません（生成名は Lambda 環境変数へ自動注入されます）。

次の順序で進めます。

1. [依存インストール](#1-依存インストール)
2. [事前の手動設定（Secrets Manager）](#2-事前の手動設定secrets-manager)
3. [CDK デプロイ](#3-cdk-デプロイ)
4. [事前の手動設定（Route53 / SES）](#4-事前の手動設定route53--ses本ツールのデプロイ対象外)
5. [疎通確認](#5-疎通確認)

> 秘匿値 `SLACK_WEBHOOK_URL` は Lambda 環境変数に置きません。Secrets Manager に格納し、Lambda 実行時に読み込みます（NFR3.6）。

## 1. 依存インストール

```bash
npm install
```

## 2. 事前の手動設定（Secrets Manager）

秘匿値 `SLACK_WEBHOOK_URL` を格納する Secret を作成します。まず Slack 側で Incoming Webhook を作成して Webhook URL を取得し、その URL を Secret に格納します。

### Slack Incoming Webhook の設定

1. [Slack App 管理画面](https://api.slack.com/apps) を開き「Create New App」→「Blank app」を選択する。
2. アプリ名（例: `Security Trend Alert`）とワークスペースを選択して作成する。
3. 左メニューの「Incoming Webhooks」を選択し、トグルを「On」にする。
4. 「Add New Webhook」をクリックする。
5. 配信先チャンネル（例: `#security-alerts`）を選択して「許可する」を押す。
6. 生成された Webhook URL（`https://hooks.slack.com/services/T.../B.../xxx...`）をコピーする。

### Secrets Manager への格納

コピーした Webhook URL を Secret に格納します（手動、または別途の運用手順で）。Secret 値は JSON とし、`SLACK_WEBHOOK_URL` キーに前手順でコピーした Webhook URL を設定します。

```json
{ "SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/XXX/YYY/ZZZ" }
```

作成した Secret の **名前/ID** と **ARN** を控え、`.env` に設定します（次節で `cdk` が参照）。

- `SECRETS_MANAGER_SECRET_ID` … Lambda 実行時に読み込む Secret 名/ID（Lambda 環境変数に設定される。秘匿値ではない）。
- `SECRETS_MANAGER_SECRET_ARN` … Lambda に read 権限（`secretsmanager:GetSecretValue`）を与える対象 Secret の ARN。

## 3. CDK デプロイ

`cdk` は設定を環境変数から読みます。`synth`/`deploy`/`diff` で同じ値を共有するため、実行前に `.env` を環境変数としてエクスポートしてください（CDK context `-c` は使いません）。

```bash
# .env を環境変数としてロード（値はコミットしない .env に記載）
set -a; . ./.env; set +a

# 初回のみ（アカウント/リージョンごと）
npx cdk bootstrap

# 合成（テンプレート確認）
npx cdk synth

# 差分確認
npx cdk diff

# デプロイ
npx cdk deploy
```

`cdk` が読む環境変数（`.env` に設定）は [環境変数リファレンス](#環境変数リファレンス) を参照してください。

CDK スタックが作成するもの:

- 1st / 2nd S3 バケット（**自動命名**・SSE-S3 暗号化・パブリックアクセス全ブロック・TLS 強制）
- デコード Lambda（Node.js 22、タイムアウト 60 秒 / メモリ 512MB、非同期リトライ 2 回、DLQ 連携）
- 1st バケットの ObjectCreated → Lambda トリガ
- 最小権限 IAM（1st バケット read、2nd バケット read/write ＋ 冪等性チェックの存在確認用に 2nd バケットへの `s3:ListBucket`、DLQ への `sqs:SendMessage`、CloudWatch Logs、指定した Secrets Manager Secret のみ）
- 失敗退避用 DLQ（SQS, 保持 14 日）

> **バケット名の確認**: デプロイ後、生成された 1st / 2nd バケット名は CloudFormation スタックの出力、または AWS コンソール / `aws cloudformation describe-stack-resources` で確認できます。1st バケット名は次節の SES 受信ルール設定で必要です。

## 4. 事前の手動設定（Route53 / SES、本ツールのデプロイ対象外）

以下は **手動運用** であり、CDK / パイプラインの対象外です。SES 受信が 1st S3 バケットへ書き込めるよう、**デプロイ後**（バケット名が確定してから）設定します。手順は既存実装 [dmarc-report-visualizer](https://github.com/hmatsu47/dmarc-report-visualzer) の「デプロイ後の手動手順」に準拠します（DMARC 集計固有の手順は本ツールの対象外のため除外）。

### 1. SES ドメイン検証

SES でメールを受信するには、受信ドメインの所有権を検証する必要があります。

1. SES コンソールで「ID」→「ID の作成」を選択する。
2. 「ドメイン」を選択し、「ドメイン」入力欄に設定した受信ドメイン（例: `example.com`）を入力する。
3. 「DKIM の詳細設定」で「Easy DKIM」を選択する（署名キー長は「RSA_2048_BIT」推奨）。
4. DNS の管理方法に応じて以下のいずれかを選択する。
   - **同一 AWS アカウントの Route53 でホストしている場合**: 「DNS レコードの Route53 への発行」の「有効化」にチェックを入れる。
   - **別 AWS アカウントの Route53 または外部 DNS を使用する場合**: チェックを入れずに（外して）進む。
5. 「ID の作成」をクリック後、DKIM の 3 つの CNAME レコードを登録する。
   - **同一アカウントの Route53 の場合**: 自動登録される（対応不要）。
   - **別アカウントの Route53 の場合**: SES コンソールの「認証」タブに表示される 3 つの CNAME レコードを、該当アカウントの Route53 ホストゾーンに手動で追加する。
   - **Route53 以外の DNS の場合**: 表示される 3 つの CNAME レコードを、利用中の DNS サービスの管理画面で手動で追加する。

> ステータスが「検証済み」になるまで数分〜最大 72 時間かかる場合があります。

### 2. MX レコード設定

受信ドメインの DNS に、SES 受信エンドポイントへ向ける MX レコードを追加する（`<region>` はデプロイ先リージョン）。

```
受信ドメイン.  MX  10 inbound-smtp.<region>.amazonaws.com.
```

### 3. SES 受信ルールセットの作成・有効化

1. **ルールセット名・ルール名を先に決める**。`aws:SourceArn` にはこれから作る受信ルールの ARN を書くため、次の 2 つの名前を先に確定させる（作成前でも自分で決めた名前なので確定できる）。
   - **ルールセット名**（`<RULE_SET_NAME>`、例: `ses-receive-notify-ruleset`）
   - **ルール名**（`<RULE_NAME>`、例: `store-to-s3`）

   ARN は次の形式になる（実リソース作成前でも、上記の名前・リージョン・アカウント ID から確定できる）。

   ```
   arn:aws:ses:<REGION>:<SES_ACCOUNT_ID>:receipt-rule-set/<RULE_SET_NAME>:receipt-rule/<RULE_NAME>
   ```

2. **バケットポリシーで SES からの書き込みを許可する**。SES 受信ルールが 1st S3 バケット（`RAW_MAIL_BUCKET`）へ保存できるよう、対象バケットのバケットポリシーに SES サービスプリンシパル（`ses.amazonaws.com`）の `s3:PutObject` を許可するステートメントを追加する。誤配送防止のため、送信元を `aws:SourceAccount`（受信を行う AWS アカウント ID）と `aws:SourceArn`（手順 1 で確定した受信ルールの ARN）で絞る。`aws:Referer` はコンソールで非推奨警告が出るため使用しない。`<1ST_BUCKET_NAME>` はデプロイで生成された 1st バケット名、`<SES_ACCOUNT_ID>` は SES 受信を行う AWS アカウント ID、`<REGION>` はデプロイ先リージョン、`<RULE_SET_NAME>` / `<RULE_NAME>` は手順 1 で決めた名前に置き換える。

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowSESPuts",
         "Effect": "Allow",
         "Principal": { "Service": "ses.amazonaws.com" },
         "Action": "s3:PutObject",
         "Resource": "arn:aws:s3:::<1ST_BUCKET_NAME>/*",
         "Condition": {
           "StringEquals": { "aws:SourceAccount": "<SES_ACCOUNT_ID>" },
           "ArnLike": {
             "aws:SourceArn": "arn:aws:ses:<REGION>:<SES_ACCOUNT_ID>:receipt-rule-set/<RULE_SET_NAME>:receipt-rule/<RULE_NAME>"
           }
         }
       }
     ]
   }
   ```

   > このバケットポリシーを **先に** 設定しておく理由: SES コンソールで S3 配信アクション付きのルールを保存する際、SES が対象バケットへの書き込み可否を検証するため、権限が無いとルール保存が失敗する。既存のバケットポリシー（CDK が設定する TLS 強制の `Deny` など）は消さず、上記 `Statement` を **追記** する。SSE-S3 で暗号化されるため、SES 側で追加の KMS 権限設定は不要。

3. **受信ルールセットを作成する**。SES コンソールで「Email receiving」→「Create rule set」を選び、手順 1 で決めた **ルールセット名**（`<RULE_SET_NAME>`）を入力して作成する。既にアクティブなルールセットがある場合は、新規作成せず既存のものにルールを追加してもよい（その場合は手順 1・2 の `<RULE_SET_NAME>` を既存名に合わせる）。

4. **受信ルールを追加する**。作成したルールセットで「Create rule」を選び、以下を設定する。
   - **Rule name**: 手順 1 で決めた **ルール名**（`<RULE_NAME>`）。バケットポリシーの ARN と一致させること。
   - **Recipient conditions**: 受信対象を `TARGET_DOMAIN`（例: `example.com`）に設定する。ドメイン全体を受ける場合はドメイン名を、特定アドレスのみ受ける場合はそのアドレスを指定する。空にすると全受信が対象になる。
   - **Actions**: 「Deliver to Amazon S3 bucket」アクションを追加し、**デプロイで生成された 1st バケット**（`RAW_MAIL_BUCKET`、前節「バケット名の確認」で控えたもの）を選択する。
     - **Object key prefix**: 任意。指定しても Lambda トリガはバケット全体の ObjectCreated で起動する（プレフィックスフィルタは設定していない）ため、空欄のままで問題ない。整理したい場合のみ設定する。
     - **KMS key**: 指定しない（バケットは SSE-S3 で暗号化される）。
   - 保存してルールを作成する。手順 2 のバケットポリシーが正しく設定されていれば保存できる。

5. **ルールセットをアクティブ化する**。作成したルールセットを選択し「Set as active」を実行する。新規アカウントなど有効なルールセットが存在しない状態ではこの有効化を忘れると受信されないので必ず確認する。アクティブなルールセットはアカウント・リージョンごとに 1 つのみである点に注意する。

## 5. 疎通確認

- 検証済みドメイン宛にテストメールを投函（または SES のテストイベント）し、
  1st S3 保存 → Lambda 起動 → 2nd S3 保管 → Slack 通知 まで流れることを確認する。
- 失敗時は CloudWatch Logs（構造化ログ、相関キー = objectKey / messageId）と DLQ 滞留数を確認する。

## ロールバック

- IaC の前リビジョンへの再デプロイ、または Lambda の前バージョン / エイリアス切り戻しで行う。稀受信のため無停止要件はゆるく、短時間の切り戻しで足りる。

---

## 環境変数リファレンス

設定は環境変数（`.env`）に一本化します。秘匿値（`SLACK_WEBHOOK_URL`）はソース・IaC・Lambda 環境変数に平文で残さず、Secrets Manager から実行時に読み込みます。**S3 バケット名は CDK が自動命名で生成し、生成名を Lambda 環境変数へ注入するため、`.env` では指定しません。**

### アプリ設定

| キー | 必須/任意 | デフォルト値 | 説明 |
|------|-----------|--------------|------|
| `TARGET_DOMAIN` | 必須 | なし | 対象受信ドメイン（環境固有のためデフォルトなし。Lambda 環境変数に設定） |
| `ATTACHMENT_TOTAL_LIMIT_BYTES` | 任意 | `10485760`（10MB） | 添付デコードの合計上限（バイト）。未設定・不正値時は既定へフォールバック |
| `AWS_REGION` | 任意 | なし（未設定時は SDK / 実行環境から解決） | AWS リージョン |

> `TARGET_DOMAIN` は CDK は未指定でも `synth` を通しますが、Lambda 実行時に必須チェックで fail loud します。必ず設定してください。

### 秘匿値の実行時供給（Secrets Manager）

`SLACK_WEBHOOK_URL` は秘匿値です。下記の Secret に格納し、Lambda 実行時に Secrets Manager から読み込みます。**Lambda 環境変数には設定しません**（NFR3.6）。

| キー | 必須/任意 | デフォルト値 | 説明 |
|------|-----------|--------------|------|
| `SECRETS_MANAGER_SECRET_ID` | 必須 | なし | Lambda 実行時に読み込む Secret 名/ID。当該 Secret（JSON）の `SLACK_WEBHOOK_URL` を読み込む。**秘匿値ではない**ため Lambda 環境変数に設定される |
| `SECRETS_MANAGER_SECRET_ARN` | 必須 | なし | Lambda へ read 権限（`secretsmanager:GetSecretValue`）を与える Secret の ARN。`SECRETS_MANAGER_SECRET_ID` と対で同じ Secret を指す |

### CDK 標準の環境変数

| 環境変数 | 必須/任意 | デフォルト値 | 説明 |
|----------|-----------|--------------|------|
| `CDK_DEFAULT_ACCOUNT` | 任意 | なし | CDK 標準。スタックの `env.account` |
| `CDK_DEFAULT_REGION` | 任意 | なし | CDK 標準。スタックの `env.region` |

---

## 信頼性・可観測性の要点

- **取りこぼしゼロ**: 原本は必ず 1st S3 に保存され、objectKey（受信日時＋メッセージID）単位で一度 Slack 通知。
- **冪等性**: 同一 objectKey の再処理では 2nd S3 重複保管・Slack 重複通知を行わない（HeadObject で存在確認）。
- **部分失敗継続**: デコード失敗・添付上限超過・Slack 送信失敗でも保管は維持し、失敗は CloudWatch Logs に可視化。
- **失敗退避**: リトライ後も継続できない致命的失敗は DLQ へ退避。
- **セキュリティ**: 秘匿値 / PII をソース・IaC・ログに平文で残さない。IAM は最小権限。
