# Cross-Unit Final Coverage Gate — SES受信メールのSlack通知ツール

> zero-Unit（単一ツール）。stage-level のトレーサビリティ（`../code-generation/traceability.json`）を唯一のソースとして検証する（per-unit ディレクトリは存在しない）。
> user-stories ステージは本スコープで SKIP のため、列挙対象は `requirements.md` の FR/NFR のみ（三分節 AC は存在しない）。

## 検証方法

- 列挙元: `../../../inception/requirements-analysis/requirements.md` の全 FR（FR1.1〜FR5.3）と全 NFR（NFR1〜NFR5）。
- 突合先: `../code-generation/traceability.json` の `coverage[]`（status と target）。
- 各 ID が status `OK` で少なくとも 1 エントリに存在し、その target ファイルが実在することを確認。
- target ファイル実在性は本ステージ Step 10 実行時に全 11 ファイルを確認済み（すべて存在）。

## 判定（Verdict）: **PASS**

全 FR（16 サブ要件）と全 NFR（5 グループ）が status `OK` で被覆され、target ファイルはすべて実在する。未被覆 ID なし。

### Functional Requirements カバレッジ

| ID | 要件 | Status | Owning（target file, 実在） |
|----|------|--------|------------------------------|
| FR1.1 | SES受信ルールで1st S3に原本保存 | OK | infra/stack.ts ✓ |
| FR1.2 | ObjectCreated トリガで Lambda 起動 | OK | infra/stack.ts ✓ |
| FR2.1 | 本文/添付のデコード | OK | src/domain/decodeMailBody.ts ✓ |
| FR2.2 | 2nd S3 保管＋ソート可能 objectKey | OK | src/domain/buildObjectKey.ts ✓ |
| FR2.3 | 保存本文先頭のヘッダ付与 | OK | src/domain/formatStoredBody.ts ✓ |
| FR2.4 | 添付合計10MB超過でデコードスキップ | OK | src/domain/decodeMailBody.ts ✓ |
| FR2.5 | objectKey 単位の冪等（重複保管なし） | OK | test/handler.test.ts ✓ |
| FR3.1 | 単一 Slack Webhook で単一チャネル通知 | OK | src/adapters/slackAdapter.ts ✓ |
| FR3.2 | 通知に受信日時/Subject/概要/S3リンク | OK | src/domain/formatSlackPayload.ts ✓ |
| FR3.3 | 本文概要 約200字 | OK | src/domain/summarizeBody.ts ✓ |
| FR3.4 | S3リンクは s3:///コンソールURL（presigned不使用） | OK | src/domain/formatSlackPayload.ts ✓ |
| FR3.5 | objectKey 単位の Slack 通知冪等 | OK | test/handler.test.ts ✓ |
| FR4.1 | 設定を .env/Secrets Manager から外部化 | OK | src/adapters/configLoader.ts ✓ |
| FR5.1 | 受信・デコード失敗を CloudWatch Logs 可視化 | OK | src/adapters/logger.ts ✓ |
| FR5.2 | 部分失敗継続（原本保存維持） | OK | src/handler.ts ✓ |
| FR5.3 | 自動リトライ＋DLQ 退避 | OK | infra/stack.ts ✓ |

### Non-Functional Requirements カバレッジ

> `traceability.json` は NFR をグループ ID（NFR1〜NFR5）で被覆記録する。`requirements.md` の NFR 見出しも同じ 5 グループ単位であり、詳細番号（NFR1.1 等）は `nfr-requirements/` で細分化された下位要件（本ゲートの列挙対象は requirements.md の 5 グループ）。

| ID | 要件グループ | Status | Owning（target file, 実在） |
|----|--------------|--------|------------------------------|
| NFR1 | 信頼性（取りこぼしゼロ・冪等・部分失敗継続） | OK | test/handler.test.ts ✓ |
| NFR2 | 可観測性（構造化ログ・失敗可視化・DLQ） | OK | src/adapters/logger.ts ✓ |
| NFR3 | セキュリティ（最小権限IAM・SSE・秘匿値/PII非平文） | OK | infra/stack.ts ✓ |
| NFR4 | スケーラビリティ（軽量・標準同時実行） | OK | infra/stack.ts ✓ |
| NFR5 | テスタビリティ（アダプタ/DI・無認証実行） | OK | test/handler.test.ts ✓ |

## 未被覆要素（Uncovered Elements）

- なし。

## 検証で確認された関連事項（build-and-test の所見）

- 上記 OK 被覆は Build and Test の実行結果（42/42 テスト緑、tsc/eslint クリーン、cdk synth 静的検証）と整合する。詳細は `test-results.md`。
- 実行時レイテンシ目標（NFR1.1 詳細 / NFR4.1）は NFR グループ NFR1/NFR4 に属するベストエフォート目標であり、コード被覆は存在するが実測はデプロイ後の手動確認事項（`test-results.md` で `Unverified`）。これは要件被覆の欠落（GAP）ではなく、実測の性質上の未検証であり、承認ゲートで明示する。
