<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-11T09:40:00Z — Standard 戦略のため integration-test-instructions.md のみ生成し、performance/security 専用指示ファイルは作らなかった。NFR に性能・セキュリティ項目は存在するが、稀受信・単独運用の軽量方針に沿い、セキュリティは単体（logger/configLoader）＋cdk synth 静的検査、性能はベストエフォート目標として summary に記録する形で担保した。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-11T09:40:10Z — インフラのセキュリティ目標（SSE-S3・パブリックブロック・最小権限IAM・DLQ）を実デプロイではなく cdk synth のテンプレート静的検査で確認する方針を採った。実 AWS 資格情報なしで検証可能・再現的である利点を取り、実デプロイ挙動の確認はデプロイ後の手動運用に委ねるトレードオフ。テンプレート上の s3:* が enforceSSL の Deny 条件付きであり過剰付与でないことを明示的に確認して誤検知を排除した。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-11T09:40:20Z — npm audit が transitive 依存（aws-cdk-lib配下のyaml、mailparser、eslint系）で32件を報告。lockfile ピン留め（NFR3.10）は満たすが、依存更新の別サイクルで追跡・解消が必要。次回の依存更新時に再評価する。
- 2026-09-11T09:40:30Z — 受信→通知レイテンシ（NFR1.1）と Lambda 実行時間（NFR4.1）はベストエフォート目標でローカル確定測定不可。performance-validation が本スコープ SKIP のため所有ステージがなく Unverified。デプロイ後にテスト投函で手動実測して確認するか、必要なら performance-validation を後日追加するか要判断。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
