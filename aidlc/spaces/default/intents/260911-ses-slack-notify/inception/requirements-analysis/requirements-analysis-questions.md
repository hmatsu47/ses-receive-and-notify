# Requirements Analysis 明確化質問

> 上流（intent-statement / scope-document）と確定した慣習を踏まえ、FR/NFR を確定する前に残る技術的曖昧点を詰めます。各 `[Answer]:` は空欄です。

## Q1. SES受信からLambda起動までの経路（トリガ方式）は？

SESで受信 → S3保存 → デコードLambda、の起動方式を確定します。

- A. SES受信ルールでS3へ保存し、S3のObjectCreatedイベントでLambdaを起動（S3イベント駆動）
- B. SES受信ルールのアクションから直接Lambdaを起動（SESイベント駆動）＋Lambda内でS3保存
- C. SES→SNS/SQS経由でLambdaを起動（キューを挟む）
- D. Not yet defined（設計ステージで確定）
- X. Other (please specify)

[Answer]:A

## Q2. 通知に載せる「保存先S3リンク」の形式は？

Slack通知に含める本文・添付の保存先リンクの形式を確定します。

- A. 署名付きURL（presigned URL、期限付き）でブラウザから直接ダウンロード可能にする
- B. s3:// 形式のパスまたはコンソールURL（アクセスはIAM権限者のみ、リンクは参照情報）
- C. 両方（presigned URLを基本、期限や運用は設計で調整）
- D. Not yet defined
- X. Other (please specify)

[Answer]:B

## Q3. Slack通知の送信先チャネルの扱いは？

- A. 単一のWebhook URL（.env指定）で単一チャネルに通知する
- B. 宛先ドメインや条件によって複数チャネルに振り分ける
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q4. 失敗時のリトライ／取りこぼしゼロの担保方式は？

「取りこぼしゼロ」を支える失敗時の扱いを確定します（冪等性はメッセージID単位で担保する前提）。

- A. Lambdaの自動リトライ＋失敗継続分はデッドレターキュー（DLQ）へ退避し、CloudWatch Logsで可視化。デコード失敗でも受信メールのS3保存は継続、Slack送信失敗でも保存は継続
- B. リトライは最小限（Lambda標準リトライのみ）、DLQは設けずログ可視化で足りる
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q5. 添付の「処理上限」の考え方は？

- A. Lambda実行環境の制約（メモリ/一時領域/実行時間）に収まる範囲を上限とし、超過分はデコードをスキップして原本保存＋通知は継続（上限の具体値は設計で確定）
- B. 明示的なサイズ上限（例: 合計◯MB）を要件として今決めたい（X で数値を補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:B, X（合計10MB）

## Q6. 本文概要の「冒頭200文字程度」の対象は？

- A. デコード済みのプレーンテキスト本文の冒頭200文字程度（HTMLメールはテキスト抽出後の冒頭）。ヘッダ部分は概要文字数に含めない
- B. ヘッダ付与後のテキスト全体の冒頭200文字程度
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

---

## Consolidated Summary Confirmation

回答を反映しました。以下の理解で requirements.md（FR/NFR）を作成してよいか確認します。

- **受信〜起動経路**: SES受信ルールでメールをS3（1st bucket）へ保存し、S3のObjectCreatedイベントでデコードLambdaを起動する（S3イベント駆動）。
- **保存先S3リンク**: Slack通知に載せるリンクは s3:// パスまたはコンソールURL（参照情報。実アクセスはIAM権限者のみ）。presigned URLは用いない。
- **Slackチャネル**: 単一のWebhook URL（.env指定）で単一チャネルへ通知する。
- **失敗時の担保**: Lambda自動リトライ＋失敗継続分はDLQへ退避し、CloudWatch Logsで可視化。デコード失敗でも受信メールのS3保存は継続、Slack送信失敗でも保存は継続。
- **冪等性（改訂）**: 冪等キーはオブジェクトキー全体（受信日時＋メッセージID）とする。S3オブジェクトキーは受信日時でソート可能な形式にする。同一メールが何らかのトラブルで別日時タイムスタンプで届き二重記録される稀なケースは、影響が軽微なため許容する。
- **添付の処理上限**: 合計10MBを上限とする。超過時はデコードをスキップし、原本保存とSlack通知は継続する。
- **本文概要**: デコード済みプレーンテキスト本文（HTMLはテキスト抽出後）の冒頭200文字程度。付与したヘッダは概要文字数に含めない。

この内容で requirements.md を作成してよいですか？

- Looks correct
- Request changes

[Answer]: Looks correct
