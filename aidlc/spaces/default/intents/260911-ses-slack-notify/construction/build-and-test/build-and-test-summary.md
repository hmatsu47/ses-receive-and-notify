# Build and Test Summary — SES受信メールのSlack通知ツール

> zero-Unit（単一ツール）。Test Strategy = **Standard**、Depth = Standard。
> 上流: `../code-generation/code-summary.md`、`../code-generation/code-generation-plan.md`、`../code-generation/unit-test-instructions.md`、`../../../inception/requirements-analysis/requirements.md`、`../nfr-requirements/`。
> 生成物: `build-instructions.md`、`integration-test-instructions.md`、本ファイル、`test-results.md`、`cross-unit-traceability.md`。

## ビルド状態と前提（Overall Build Status / Prerequisites）

- ビルド: `npm run build`（tsc, strict）。実行結果は `test-results.md` を参照。
- 前提: Node.js 20 LTS 以上、`npm ci` による再現インストール。実 AWS 資格情報はビルド/単体テストに不要。
- インフラ設定検証（任意）: `npx cdk synth` により IAM 最小権限・SSE-S3・パブリックアクセスブロック・DLQ をテンプレート上で確認可能。

## テスト種別インベントリ（Test Type Inventory）

| 種別 | 生成状況 | 実行手段 |
|------|----------|----------|
| Unit | Code Generation が全層に作成済み（8ファイル） | `npx vitest run test/`（無認証） |
| Integration（境界・クロスユニット） | 本ステージで指示生成（Standard） | `npx vitest run test/handler.test.ts` ＋ 手動投函 |
| Performance | 指示ファイル生成せず（Standard、ハード要件なし・ベストエフォート目標のみ） | 手動実測（デプロイ後、任意） |
| Security | 指示ファイル生成せず（Standard）。セキュリティ観点は単体（logger/configLoader）＋ `cdk synth` 目視で確認 | `npx vitest run test/logger.test.ts test/configLoader.test.ts`、`npx cdk synth`、任意 `npm audit` |

Standard 戦略のため追加生成は結合指示のみ（stage file Step 3-7）。性能・セキュリティは NFR が存在するが、本スコープでは専用指示ファイルを作らず、単体テスト・静的合成・手動確認で担保する（軽量・稀受信・単独運用の方針に整合）。

## ユニットあたりのカバレッジ期待（Coverage Expectations）

- zero-Unit（単一ツール）。数値カバレッジフロアは課さない（team.md 方針）。
- 重点経路（デコード / 通知 / 失敗ハンドリング）は「失敗分岐が最低 1 つテストされている」ことを実質基準とする（branch coverage 目視）。
- 各ハード制約（Mandated / Forbidden）↔ 最低 1 受け入れテストの 1:1 対応を維持（`unit-test-instructions.md` の対応表）。

## Target Verification Matrix（確定版）

> Step 9 実行後の確定値。詳細なエビデンス・コマンド出力は `test-results.md` を参照。
> Owning Stage: ローカル実行/静的検証は `build-and-test`。デプロイ後・実サービス前提で本スコープに所有ステージがないものは `(none scheduled)`。

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|-----------|--------|----------|--------|----------|--------------|---------|
| BT-BUILD | package.json `build` (tsc strict) | 型エラー 0 でコンパイル成功 | tsc exit 0 | `npm run build` | build-and-test | Met |
| BT-LINT | package.json `lint` (eslint) | 警告/エラー 0 | eslint exit 0 | `npm run lint` | build-and-test | Met |
| BT-UNIT | unit-test-instructions.md / vitest | 全ユニットテスト緑 | 42 passed / 0 failed | `npx vitest run test/` | build-and-test | Met |
| NFR1.6-IDEMPOTENT | reliability NFR1.6 / FR2.5 / FR3.5 | 同一 objectKey 再処理で重複保管・重複通知なし | 冪等性テスト緑 | test/handler.test.ts | build-and-test | Met |
| NFR1.5-PARTIALFAIL | reliability NFR1.5 / FR5.2 | デコード/Slack 失敗でも保存継続・ログ可視化 | 部分失敗継続テスト緑 | test/handler.test.ts | build-and-test | Met |
| NFR1.5-FAILINJECT | reliability NFR1.5 / team.md | 失敗注入で期待挙動 | 失敗注入テスト緑 | test/handler.test.ts | build-and-test | Met |
| FR2.4-ATTACHLIMIT | requirements FR2.4 / NFR3.9 | 添付 10MB 境界でスキップ＋保存継続 | 境界値テスト緑 | test/decodeMailBody.test.ts | build-and-test | Met |
| NFR2.2-LOGHYGIENE | observability NFR2.2 / security NFR3.6 / NFR3.7 | ログに PII/秘匿値を平文出力しない | logger テスト緑 | test/logger.test.ts | build-and-test | Met |
| FR2.2-OBJECTKEY | requirements FR2.2 | ソート可能な objectKey 整形 | テスト緑 | test/buildObjectKey.test.ts | build-and-test | Met |
| FR3.3-SUMMARY | requirements FR3.3 | 本文概要 約200字（境界含む） | テスト緑 | test/summarizeBody.test.ts | build-and-test | Met |
| FR2.3-STOREDHDR | requirements FR2.3 | 保存本文先頭にヘッダ付与 | テスト緑 | test/formatStoredBody.test.ts | build-and-test | Met |
| FR3.2-SLACKPAYLOAD | requirements FR3.2 / NFR3.8 | Slack ペイロード構造＋サニタイズ | テスト緑 | test/formatSlackPayload.test.ts | build-and-test | Met |
| FR4.1-CONFIG | requirements FR4.1 / NFR2.1 | .env/SM から読込、欠損は fail-loud | テスト緑 | test/configLoader.test.ts | build-and-test | Met |
| NFR3.1-IAMLEASTPRIV | security NFR3.1 | Lambda IAM 最小権限（ワイルドカードなし） | get/put/sqs:SendMessage のみ | cdk.out template IAM 検査 | build-and-test (static) | Met |
| NFR3.3-SSE | security NFR3.3 | 両 S3 が SSE-S3 | BucketEncryption × 2 | cdk.out template | build-and-test (static) | Met |
| NFR3.4-PUBLICBLOCK | security NFR3.4 | 両 S3 パブリックアクセス全ブロック | PublicAccessBlock 4×2 | cdk.out template | build-and-test (static) | Met |
| FR5.3-DLQ | requirements FR5.3 / NFR1.3 | 非同期リトライ＋DLQ 退避 | SQS DLQ ＋ Lambda 連携 | cdk.out template | build-and-test (static) | Met |
| NFR3.10-DEPPIN | security NFR3.10 | 依存バージョン固定（lockfile） | lockfile ピン留め、npm ci 再現 | package-lock.json | build-and-test (static) | Met |
| NFR1.1-LATENCY | performance NFR1.1 | 受信→通知 概ね60秒以内（ベストエフォート目標） | ローカル測定不可 | — | (none scheduled) | Unverified |
| NFR4.1-LAMBDATIME | performance NFR4.1 | 通常メールを Lambda タイムアウト内に処理 | ローカル測定不可 | — | (none scheduled) | Unverified |

判定サマリ: **Met 18 / Unverified 2 / Not Met 0**。Unverified の 2 件（NFR1.1 受信→通知レイテンシ、NFR4.1 Lambda 実行時間）はベストエフォート目標で、確定測定に実サービス経路（デプロイ後実測）が必要。performance-validation は本スコープ SKIP のため所有ステージなし。手動実測手順は `integration-test-instructions.md` B 章。

## 準備状況（Readiness — 確定）

- **build-ready**: Yes（tsc / eslint クリーン）。
- **test-ready**: Yes（42/42 緑、無認証実行）。
- **deployment-ready**: 手動デプロイ運用（本ステージ対象外）。CDK 合成でセキュリティ設定（SSE-S3・パブリックブロック・最小権限 IAM・DLQ）を確認済み。実サービス疎通とレイテンシ目標はデプロイ後の手動確認事項。

## 既知の制限 / 未解決事項（Known Limitations）

- `npm audit` が transitive 依存（mailparser / eslint 系）で脆弱性を報告。バージョン緩和はせず、依存更新の別サイクルで対応する（品質目標の緩和ではない）。
- 実行時レイテンシ（NFR1.1 / NFR4.1）はベストエフォート目標であり、ローカルで確定的に測定できない。performance-validation ステージは本スコープでは SKIP のため、明示的な所有ステージが存在しない → これらは `Unverified`（手動実測で任意確認）。
