# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

- Build and Test では Test Strategy=Standard のとき integration-test-instructions.md のみを生成し、性能/セキュリティ専用の指示ファイルは作らない。性能はベストエフォート目標として build-and-test-summary に記録し、セキュリティは単体テスト（logger/configLoader）＋ cdk synth のテンプレート静的検査で担保する。 (learned 2026-09-11) <!-- cid:260911-ses-slack-notify:build-and-test:5fd6f91ae2bd38aae7e57a936e9738b1ecaa9e7d5cd325f9eb15067fe227b3bd -->
## Change Control

<!-- Project-specific. Mode: strict or relaxed. Strict here holds for every intent and cannot be changed from chat. -->

## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

- Route53別アカウント連携は既存実装 dmarc-report-visualizer (https://github.com/hmatsu47/dmarc-report-visualzer) を参照する (learned 2026-09-11) <!-- cid:260911-ses-slack-notify:approval-handoff:f6a5e05be75de545ac568eb1f5fea7a7c8ad21fc35f3ffa37681587022bf0e55 -->
## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER 添付が処理上限を超える場合に無理にデコードしない（メール保存と通知は継続）（affirmed 2026-09-11） (affirmed 2026-09-11)
- NEVER 秘匿値・PIIをソース/IaC/ログ/監査に平文で残さない（affirmed 2026-09-11） (affirmed 2026-09-11)
## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS 秘匿値（Slack Webhook URL・対象ドメイン・外部リソース等）は.envまたはSecrets Manager経由で読み込む（affirmed 2026-09-11） (affirmed 2026-09-11)
- ALWAYS 受信・デコード失敗は CloudWatch Logs で可視化する（affirmed 2026-09-11） (affirmed 2026-09-11)
- ALWAYS 保存本文の先頭に受信日時・エンベロープFrom・Subject・From等のヘッダを付与し、S3キーは受信日時＋メッセージIDで識別可能にする（affirmed 2026-09-11） (affirmed 2026-09-11)
- ALWAYS Lambda の IAM 権限は最小権限（対象S3の get/put、CloudWatch Logs、必要な SSM/Secrets に限定）（affirmed 2026-09-11） (affirmed 2026-09-11)
- ALWAYS メッセージID単位で冪等に扱い、重複保存・重複Slack通知を避ける（affirmed 2026-09-11） (affirmed 2026-09-11)
## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- インフラのセキュリティ目標（SSE-S3・パブリックアクセスブロック・最小権限IAM・DLQ）は実デプロイではなく cdk synth のテンプレート静的検査で検証する（無認証・再現的）。テンプレート上の s3:* が enforceSSL の Deny 条件付き（aws:SecureTransport）であり過剰付与でないことを明示的に確認して誤検知を避ける。 (learned 2026-09-11) <!-- cid:260911-ses-slack-notify:build-and-test:35e869bc25909ca9c762b784ab5a9a9b08b7b26525f50292e4fc11a53be5d596 -->
