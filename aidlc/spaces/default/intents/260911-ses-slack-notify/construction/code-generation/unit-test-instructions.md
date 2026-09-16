# Unit Test Instructions — SES受信メールのSlack通知ツール

> zero-Unit（単一ツール）。テスト方式は test-after（各層を実装後にその層のユニットテストを書いて実行）。フレームワークは vitest ＋ aws-sdk-client-mock。

## テストフレームワークと設定

- ランナー: vitest（`vitest.config.ts`）。
- AWS SDK モック: `aws-sdk-client-mock`（S3Client）。Slack Webhook は fetch/httpsをスタブ化（DIしたslackAdapterをモック）。
- 実 AWS 資格情報に依存せず、ローカル/CI から無認証で実行可能に保つ。

## このユニットのテスト実行コマンド（ユニットスコープ）

- 全体（このツール一式）:
  ```
  npx vitest run test/
  ```
- 単一層の例（実装直後に該当層のみ）:
  ```
  npx vitest run test/domain/buildObjectKey.test.ts
  npx vitest run test/handler.test.ts
  ```

  ※ `test/` 配下がこのツール唯一のテスト対象であり、上記は本ユニットにスコープされた実行コマンドである（プロジェクト全体の別スイートは存在しない）。

## テスト対象と観点（component ごと 5〜8 テスト目安 = Standard）

- `buildObjectKey`: 受信日時＋メッセージIDのキー整形／日時プレフィックスでソート可能／同一入力で同一キー（冪等キーの一意性）／異常入力の扱い。
- `decodeMailBody`: 正常デコード（本文/ヘッダ/添付分離）／添付合計が上限(10MB)ちょうど・超過・未満の境界値（超過時はデコードスキップの型付き結果）／デコード不能時の型付き結果。
- `summarizeBody`: 冒頭200字ちょうど／200字超過の切詰／短文そのまま／HTMLからのテキスト抽出後の冒頭。
- `formatStoredBody`: 受信日時・エンベロープFrom・Subject・From等のヘッダを本文の前に付与／欠損ヘッダの安全な扱い。
- `formatSlackPayload`: 受信日時・Subject・本文概要・s3://リンクを含む構造／Slack向けサニタイズ（メンション/markdown無効化）／リンク形式がs3://パスまたはコンソールURL。
- `handler`（Lambda I/O境界、疑似S3イベント入力・S3/Slackモック）— 必須信頼性テスト:
  - 冪等性: 同一objectKey（受信日時＋メッセージID）の再処理で2nd S3重複保管なし・Slack重複通知なし。
  - 部分失敗継続: デコード失敗でも1st S3原本保存は継続／Slack送信失敗でも保存は継続しログ可視化。
  - 失敗注入: デコード失敗・添付上限超過・Slack送信失敗を注入し期待挙動（保存継続・ログ可視化）を検証。

## カバレッジ目標

- 数値フロア（例: 80%）は本スコープでは課さない。既存スイートを常に全緑に保つ。
- 重点経路（デコード/通知/失敗ハンドリング）は「失敗分岐が最低1つテストされている」ことを実質基準とする（branch coverage の目視確認）。

## モック/スタブ方針

- S3: `aws-sdk-client-mock` で `GetObjectCommand`/`PutObjectCommand`/`HeadObjectCommand`（冪等チェック用）をスタブ。
- Slack: DIした `slackAdapter` をテスト用スタブに差し替え、送信成功/失敗を注入。
- 設定: `configLoader` をスタブし、.env/Secrets Manager アクセスを回避。

## テストデータ管理

- 疑似SESメール（MIMEサンプル: プレーンテキスト、HTML、添付あり/大容量添付）と疑似S3イベントを `test/fixtures/` に用意。実データ・実PIIは用いない。

## ハード制約↔テスト対応（1:1）

- ALWAYS 秘匿値は.env/SM経由 → configLoader テスト＋loggerがWebhook URLを出力しないテスト。
- ALWAYS 失敗はCloudWatch Logsで可視化 → 失敗注入テストでログ出力を検証。
- ALWAYS 本文先頭ヘッダ＋objectKey識別 → formatStoredBody/buildObjectKey テスト。
- ALWAYS メッセージID単位で冪等 → 冪等性テスト。
- NEVER 添付上限超過時に無理にデコードしない → 境界値テスト（超過でスキップ・保存/通知継続）。
- NEVER 秘匿値・PIIを平文で残さない → logger テスト（本文内容・Webhook URLを出さない）。
