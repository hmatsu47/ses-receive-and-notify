# 発見された規則 — SES受信メールのSlack通知ツール

> 本プロジェクトから defensible な hard constraint を記載する。ヒアリング Q6 で
> すべて採用が確定した。affirmation ゲートで最終確定する。

## Mandated

- ALWAYS 秘匿値（Slack Webhook URL・対象ドメイン・外部リソース等）は.envまたはSecrets Manager経由で読み込む（affirmed 2026-09-11）
- ALWAYS 受信・デコード失敗は CloudWatch Logs で可視化する（affirmed 2026-09-11）
- ALWAYS 保存本文の先頭に受信日時・エンベロープFrom・Subject・From等のヘッダを付与し、S3キーは受信日時＋メッセージIDで識別可能にする（affirmed 2026-09-11）
- ALWAYS Lambda の IAM 権限は最小権限（対象S3の get/put、CloudWatch Logs、必要な SSM/Secrets に限定）（affirmed 2026-09-11）
- ALWAYS メッセージID単位で冪等に扱い、重複保存・重複Slack通知を避ける（affirmed 2026-09-11）

## Forbidden

- NEVER 添付が処理上限を超える場合に無理にデコードしない（メール保存と通知は継続）（affirmed 2026-09-11）
- NEVER 秘匿値・PIIをソース/IaC/ログ/監査に平文で残さない（affirmed 2026-09-11）
