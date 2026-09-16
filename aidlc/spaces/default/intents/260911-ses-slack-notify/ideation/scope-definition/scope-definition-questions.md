# Scope Definition 明確化質問

> 上流の intent-statement（ideation/intent-capture/intent-statement.md）を踏まえ、スコープ境界と優先順位を確定するための質問です。各 `[Answer]:` は空欄です。回答方法は最後の「回答モード」を参照してください。

## Q1. 価値を届ける最小限のスコープ（MVP）は何ですか？

「稀に届く受信メールを見落とさず把握・保管する」ために、最小限で満たすべき範囲を選んでください。

- A. SES受信 → S3格納 → デコードして別S3へ保管 → Slack通知、の一連が1通でも確実に動くこと（エンドツーエンド1本）
- B. 上記に加え、添付ファイルのデコード・保管まで最初から含める
- C. 上記に加え、受信失敗・デコード失敗時のエラー可視化（Slack/ログ）まで含める
- D. まず通知だけ（S3への整理保管は後回し）で最小化する
- E. Not yet defined
- X. Other (please specify)

[Answer]:C（エラーはCloudWatchログでOK）

## Q2. 各capabilityは must-have か nice-to-have か？

想定される機能について、必須（Must）か任意（Should/Could）かを整理します。ずれがあれば X で補足してください。

- A. 下記の既定分類でよい:
  - Must: SES受信のS3保存 / 本文・添付のデコードと別S3への保管 / 受信日時＋メッセージIDのキー設計 / 本文先頭へのヘッダ付与 / Slack通知（受信日時・Subject・本文概要200字・S3リンク）
  - Should: 受信/デコード失敗時のエラー通知・ログ / .envによる設定外部化
  - Could: 別AWSアカウントのRoute53連携補助 / 添付が大きい場合の扱いの最適化
- B. おおむねAだが一部を格上げ/格下げしたい（X で補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:X（一通り全部／ただし添付が処理上限（Lambda環境などに合わせて設定）を超えるなど問題が発生した場合は無理にデコードしない）

## Q3. capability間の依存関係はありますか？

- A. 「SES受信→S3保存」が起点で、「デコード・別S3保管」がそれに依存し、「Slack通知」が保管結果（S3リンク）に依存する、という直列依存でよい
- B. 通知は保管の完了を待たず、本文概要だけ先行通知してもよい（部分的並行）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q4. 構築の順序（シーケンス）の優先方針は？

- A. dependency-first（依存順＝受信保存→デコード保管→通知の順に積み上げる）
- B. risk-first（最も不確実な所＝デコード/クロスアカウントを先に検証）
- C. value-first（まず通知が届く体験を最短で作る）
- D. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q5. 特定capabilityに紐づく明確な締め切りはありますか？

- A. None（明確な締め切りはない。送信サーバー切替に間に合えばよい程度）
- B. 送信サーバーのクラウド切替時期に合わせた目標時期がある（X で補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q6. スコープの明確な「対象外（Out of Scope）」は何ですか？

- A. 下記を対象外として明記してよい:
  - Route53のドメイン/レコード登録・SESドメイン検証（手動運用）
  - メール返信・自動応答・メールクライアント機能
  - 受信メールの全文検索・可視化ダッシュボード
  - スパム/ウイルススキャンなどの高度なフィルタリング
- B. おおむねAだが増減したい（X で補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

---

## Consolidated Summary Confirmation

回答を反映しました。以下のスコープ理解で成果物（scope-document / intent-backlog）を作成してよいか確認します。

**スコープ境界（まとめ）:**
- **MVP**: SES受信 → S3格納 → 本文・添付をデコードして別S3へ保管 → Slack通知、の一連が確実に動くこと。加えて受信/デコード失敗時のエラー可視化を含む（エラーは CloudWatch Logs で可視化すれば足り、Slackへのエラー通知は必須ではない）。[Q1]
- **In Scope（Must、一通り全て必須）**: SES受信のS3保存 / 本文・添付のデコードと別S3への保管 / 受信日時＋メッセージIDで識別できるキー設計 / 本文先頭への各種ヘッダ付与（受信日時・エンベロープFrom・Subject・From等）/ Slack通知（受信日時・Subject・本文概要200字・保存先S3リンク）/ 受信・デコード失敗時のCloudWatch Logsによる可視化 / .envによる設定外部化。[Q1][Q2]
- **添付の扱い（例外条件）**: 添付が処理上限（Lambda実行環境などに合わせて設定する上限）を超えるなど問題が発生する場合は、無理にデコードしない。[Q2]
- **依存関係**: 直列依存。受信→S3保存 が起点、デコード・別S3保管 がそれに依存、Slack通知 は保管結果（S3リンク）に依存。[Q3]
- **構築順序**: dependency-first（受信保存 → デコード保管 → 通知 の順に積み上げる）。[Q4]
- **締め切り**: なし（送信サーバー切替に間に合えばよい程度）。[Q5]
- **Out of Scope**: Route53のドメイン/レコード登録・SESドメイン検証（手動運用）/ メール返信・自動応答・メールクライアント機能 / 受信メールの全文検索・可視化ダッシュボード / スパム・ウイルススキャン等の高度なフィルタリング。[Q6]

この内容で成果物を作成してよいですか？

- Looks correct
- Request changes

[Answer]: Looks correct
