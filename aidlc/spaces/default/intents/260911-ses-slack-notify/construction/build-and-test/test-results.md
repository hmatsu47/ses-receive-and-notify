# Test Results — SES受信メールのSlack通知ツール

> zero-Unit（単一ツール）。Test Strategy = Standard。実 AWS 資格情報なしでローカル実行。
> 実行日時（UTC）: 2026-09-11。実行環境: Node.js 20、`npm ci` による再現インストール（346 packages）。

## ビルド状態（Build Status）

| ステップ | コマンド | 結果 | 備考 |
|----------|----------|------|------|
| 依存インストール | `npm ci` | 成功（exit 0） | lockfile どおり 383 packages を監査。deprecation 警告のみ（ビルド影響なし） |
| ビルド | `npm run build`（tsc strict） | 成功（exit 0） | 型エラー 0 |
| Lint | `npm run lint`（eslint） | 成功（exit 0） | 警告/エラー 0 |
| CDK 合成 | `npx cdk synth` | 成功（exit 0） | テンプレート `SesNotifyStack.template.json` 生成。出力は通知メッセージのみ |

## テスト結果（Test Results — vitest）

```
npx vitest run test/
Test Files  8 passed (8)
     Tests  42 passed (42)
  Duration  4.88s
```

| テストファイル | テスト数 | 結果 |
|----------------|----------|------|
| test/handler.test.ts | 10 | ✓ pass |
| test/decodeMailBody.test.ts | 6 | ✓ pass |
| test/formatSlackPayload.test.ts | 6 | ✓ pass |
| test/formatStoredBody.test.ts | 3 | ✓ pass |
| test/buildObjectKey.test.ts | 6 | ✓ pass |
| test/configLoader.test.ts | 3 | ✓ pass |
| test/summarizeBody.test.ts | 6 | ✓ pass |
| test/logger.test.ts | 2 | ✓ pass |
| **合計** | **42** | **42 passed / 0 failed / 0 skipped** |

- 単一ツールのため `test/` が唯一のテスト対象。実行コマンドは 1 種（`npx vitest run test/`）で重複実行なし。
- 結合観点（`test/handler.test.ts`）: 受信→保管→通知の結線、冪等性、部分失敗継続、失敗注入を含む（Standard の結合カバレッジを既存スイートで担保）。

## 失敗詳細（Failure Details）

- なし（全 42 テスト緑、ビルド・Lint・synth すべて成功）。

## カバレッジ（Coverage）

- 数値カバレッジフロアは本スコープでは課さない（team.md 方針）。カバレッジレポートは未計測。
- 重点経路（デコード / 通知 / 失敗ハンドリング）は「失敗分岐が最低 1 つテストされている」を実質基準とし、`handler.test.ts` の失敗注入テスト群（デコード失敗・添付超過・Slack 送信失敗）でこれを満たす。

## 静的セキュリティ検証（CDK synth 由来のエビデンス）

`cdk.out/SesNotifyStack.template.json` を検査:

- **SSE-S3**: `BucketEncryption`（`SSEAlgorithm`）が両バケットに存在（NFR3.3 Met）。
- **パブリックアクセスブロック**: `PublicAccessBlockConfiguration` の 4 フラグ × 2 バケット = 全ブロック（NFR3.4 Met）。
- **TLS 強制**: 両バケットポリシーに `aws:SecureTransport: false` の **Deny** ステートメント（enforceSSL, NFR3.5）。テンプレート内の `s3:*` はこの Deny 条件付きステートメントのみで、Lambda ロールへの過剰付与ではない。
- **最小権限 IAM**: Lambda 実行ロール（`DecodeFunctionServiceRole`）の付与アクションは `sqs:SendMessage`（DLQ）・`s3:GetObject`（1st）・`s3:GetObject`＋`s3:PutObject`（2nd）のみ。ワイルドカード Allow（`s3:*` / `*` リソース）なし（NFR3.1 Met）。
- **DLQ**: `AWS::SQS::Queue`（DLQ）＋ Lambda の非同期リトライ/DLQ 連携構成が存在（FR5.3 / NFR1.3 Met）。

## 依存脆弱性スキャン（参考・既知の懸念）

`npm audit`: 32 件（low 5 / moderate 17 / high 8 / critical 2）。いずれも transitive 依存（`aws-cdk-lib` 配下の `yaml`、`mailparser`、`eslint` 系のビルド/開発チェーン）。

- NFR3.10 は「依存のバージョン固定（lockfile）＋任意の脆弱性スキャン構成」を要件とし、これは満たしている（lockfile ピン留め済み、`npm audit` 実行可能）。
- 検出された transitive 脆弱性はランタイム経路の直接依存ではなく、バージョン緩和（`audit fix --force` はレンジ外への破壊的更新）を避けて依存更新の別サイクルで対応する。品質目標の緩和ではない。

## Target Verification Matrix（確定版）

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|-----------|--------|----------|--------|----------|--------------|---------|
| BT-BUILD | package.json `build` (tsc strict) | 型エラー 0 でコンパイル成功 | tsc exit 0、型エラー 0 | `npm run build` 出力 | build-and-test | Met |
| BT-LINT | package.json `lint` (eslint) | 警告/エラー 0 | eslint exit 0 | `npm run lint` 出力 | build-and-test | Met |
| BT-UNIT | unit-test-instructions.md / vitest | 全ユニットテスト緑 | 42 passed / 0 failed | `npx vitest run test/` 出力 | build-and-test | Met |
| NFR1.6-IDEMPOTENT | NFR1.6 / FR2.5 / FR3.5 | 同一 objectKey 再処理で重複保管・重複通知なし | handler 冪等性テスト緑 | test/handler.test.ts (10 tests pass) | build-and-test | Met |
| NFR1.5-PARTIALFAIL | NFR1.5 / FR5.2 | デコード/Slack 失敗でも保存継続・ログ可視化 | 部分失敗継続テスト緑 | test/handler.test.ts | build-and-test | Met |
| NFR1.5-FAILINJECT | NFR1.5 / team.md | 失敗注入で期待挙動 | 失敗注入テスト緑 | test/handler.test.ts | build-and-test | Met |
| FR2.4-ATTACHLIMIT | FR2.4 / NFR3.9 | 添付 10MB 境界でスキップ＋保存継続 | 境界値テスト緑 | test/decodeMailBody.test.ts (6 tests) | build-and-test | Met |
| NFR2.2-LOGHYGIENE | NFR2.2 / NFR3.6 / NFR3.7 | ログに PII/秘匿値を平文出力しない | logger テスト緑 | test/logger.test.ts (2 tests) | build-and-test | Met |
| FR2.2-OBJECTKEY | FR2.2 | ソート可能な objectKey 整形 | テスト緑 | test/buildObjectKey.test.ts (6 tests) | build-and-test | Met |
| FR3.3-SUMMARY | FR3.3 | 本文概要 約200字（境界含む） | テスト緑 | test/summarizeBody.test.ts (6 tests) | build-and-test | Met |
| FR2.3-STOREDHDR | FR2.3 | 保存本文先頭にヘッダ付与 | テスト緑 | test/formatStoredBody.test.ts (3 tests) | build-and-test | Met |
| FR3.2-SLACKPAYLOAD | FR3.2 / NFR3.8 | Slack ペイロード構造＋サニタイズ | テスト緑 | test/formatSlackPayload.test.ts (6 tests) | build-and-test | Met |
| FR4.1-CONFIG | FR4.1 / NFR2.1 | 設定を .env/SM から読込、欠損は fail-loud | テスト緑 | test/configLoader.test.ts (3 tests) | build-and-test | Met |
| NFR3.1-IAMLEASTPRIV | NFR3.1 | Lambda IAM 最小権限（ワイルドカードなし） | 付与は get/put/sqs:SendMessage のみ | cdk.out template IAM policy 検査 | build-and-test (static) | Met |
| NFR3.3-SSE | NFR3.3 | 両 S3 が SSE-S3 | BucketEncryption × 2 | cdk.out template | build-and-test (static) | Met |
| NFR3.4-PUBLICBLOCK | NFR3.4 | 両 S3 パブリックアクセス全ブロック | PublicAccessBlock 4×2 | cdk.out template | build-and-test (static) | Met |
| FR5.3-DLQ | FR5.3 / NFR1.3 | 非同期リトライ＋DLQ 退避 | SQS DLQ ＋ Lambda DLQ 連携 | cdk.out template | build-and-test (static) | Met |
| NFR3.10-DEPPIN | NFR3.10 | 依存バージョン固定（lockfile） | package-lock.json ピン留め、npm ci 再現 | package-lock.json / npm ci | build-and-test (static) | Met |
| NFR1.1-LATENCY | NFR1.1 | 受信→通知 概ね60秒以内（ベストエフォート目標） | ローカル測定不可（実サービス経路が必要） | — | (none scheduled) | Unverified |
| NFR4.1-LAMBDATIME | NFR4.1 | 通常メールを Lambda タイムアウト内に処理 | ローカル測定不可（デプロイ後実測が必要） | — | (none scheduled) | Unverified |

### 判定サマリ

- **Met: 18 / 20**（全ローカル実行・静的検証ターゲット）。
- **Unverified: 2 / 20** — NFR1.1（受信→通知レイテンシ）、NFR4.1（Lambda 実行時間）。いずれもベストエフォート目標であり、確定測定には実サービス経路（デプロイ後の手動実測）が必要。performance-validation ステージは本スコープで SKIP のため、明示的な所有ステージが存在しない。要件上はハード要件でなく「目標値」だが、本ステージでは確定検証できないため誠実に `Unverified` とする（手動実測で任意確認可能。手順は `integration-test-instructions.md` B 章）。
- `Not Met` は 0。ビルド・Lint・全テスト・静的セキュリティはすべて成功。

## 準備状況（Readiness）

- **build-ready**: Yes（tsc/eslint クリーン）。
- **test-ready**: Yes（42/42 緑、無認証実行）。
- **deployment-ready**: 手動デプロイ運用（本ステージ対象外）。CDK 合成でセキュリティ設定を確認済み。実サービス疎通とレイテンシ目標はデプロイ後の手動確認事項。

<!-- Loop-Back Log は本ステージでループバックが発生した場合のみ追記する（APPEND-ONLY）。今回のランではループバックなし。 -->
