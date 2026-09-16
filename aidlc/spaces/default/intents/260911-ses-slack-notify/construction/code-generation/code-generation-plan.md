# Code Generation Plan — SES受信メールのSlack通知ツール

> zero-Unit（単一ツール）。record: `construction/code-generation/`。アプリコードはワークスペースルートへ出力（record dir には出さない）。上流: `../../../inception/requirements-analysis/requirements.md`（FR/NFR）、`../nfr-requirements/`（NFR詳細）、`../../../../memory/team.md`（Code Style）。
> 実装言語: TypeScript/Node（AWS Lambda, Node.js LTS）＋ AWS CDK。テストは vitest ＋ aws-sdk-client-mock。方式: test-after（各テスト対象層を実装後にその層のユニットテストを書いて実行）。

## 成果物の全体構成（ワークスペースルート）

```
package.json / tsconfig.json / .eslintrc / .prettierrc / vitest.config.ts / .env.example / README.md
src/
  domain/            # 副作用のない純粋関数（テスト容易）
    types.ts             # ReceivedMail, DecodedMail, SlackPayload 等の型
    buildObjectKey.ts    # 受信日時+メッセージIDのobjectKey整形（単一関数集約）
    decodeMailBody.ts    # MIMEデコード（本文/ヘッダ/添付分離）＋添付10MB上限判定
    formatStoredBody.ts  # 保存本文の先頭ヘッダ付与
    formatSlackPayload.ts# 受信日時・Subject・本文概要200字・S3リンク整形＋サニタイズ
    summarizeBody.ts     # プレーンテキスト本文の冒頭200字抽出
  adapters/          # 外部依存の薄いラッパ（DIでドメインから切り離す）
    s3Adapter.ts         # getObject/putObject
    slackAdapter.ts      # Webhook POST
    configLoader.ts      # .env/Secrets Manager からの設定読込
    logger.ts            # 構造化ログ（PII/秘匿値を出さない）
  handler.ts         # Lambdaハンドラ（S3イベント→ドメイン呼出→保管/通知）
infra/               # AWS CDK
  app.ts / stack.ts      # S3×2(SSE-S3,公開ブロック)/Lambda/受信ルール/最小権限IAM/DLQ
test/                # vitest ユニットテスト（src構成に対応）
```

## 実装ステップ（順次実行・test-after）

- [x] **Step 1**: プロジェクト構造と本番設定スケルトン（package.json, tsconfig strict, ESLint/Prettier, .env.example, README, ディレクトリ）。[FR4.1]
- [x] **Step 2**: 最小テストランナー/設定（vitest.config.ts, aws-sdk-client-mock 導入）をブートストラップし、ユニットスコープの実行コマンドを確定・記録（unit-test-instructions.md）。[NFR5]
- [x] **Step 3**: ドメイン型定義 `src/domain/types.ts`（ReceivedMail/DecodedMail/SlackPayload/Config/Result型）。[FR2, FR3]
- [x] **Step 4**: `buildObjectKey.ts` 実装（受信日時プレフィックス＋メッセージID、日時ソート可能、フォーマット定数一元化）。[FR2.2]
- [x] **Step 5**: Step4 のユニットテスト（キー整形・ソート可能性・冪等キーとしての一意性の境界）。[FR2.2, FR2.5]
- [x] **Step 6**: `decodeMailBody.ts` 実装（MIMEデコード、本文/ヘッダ/添付分離、添付合計10MB超過時はデコードスキップの型付き結果）。[FR2.1, FR2.4]
- [x] **Step 7**: Step6 のユニットテスト（正常デコード／添付上限ちょうど・超過・未満の境界値／デコード失敗の型付き結果）。[FR2.4, NFR1.5]
- [x] **Step 8**: `summarizeBody.ts` 実装（プレーンテキスト冒頭200字、HTMLはテキスト抽出後、ヘッダ除外）。[FR3.3]
- [x] **Step 9**: Step8 のユニットテスト（200字ちょうど／超過切詰／短文そのまま）。[FR3.3]
- [x] **Step 10**: `formatStoredBody.ts` 実装（保存本文先頭に受信日時・エンベロープFrom・Subject・From等のヘッダ付与）。[FR2.3]
- [x] **Step 11**: Step10 のユニットテスト（ヘッダ付与順・欠損ヘッダの扱い）。[FR2.3]
- [x] **Step 12**: `formatSlackPayload.ts` 実装（受信日時・Subject・本文概要・s3://リンク、Slack向けサニタイズ）。[FR3.2, FR3.3, FR3.4, NFR3.8]
- [x] **Step 13**: Step12 のユニットテスト（ペイロード構造／サニタイズ／リンク形式）。[FR3.2, NFR3.8]
- [x] **Step 14**: アダプタ実装（`s3Adapter`/`slackAdapter`/`configLoader`/`logger`）。configLoaderは.env/Secrets Manager、loggerはPII/秘匿値非出力。[FR4.1, NFR2.1, NFR2.2, NFR3.6]
- [x] **Step 15**: `handler.ts` 実装（S3イベント受領→入力検証→ドメイン変換→デコード→2nd S3保管→Slack通知。冪等[objectKey存在チェック]、部分失敗継続、失敗はログ＆リトライ/DLQ委譲）。[FR1.2, FR2, FR3, FR5.1, FR5.2, NFR1.6]
- [x] **Step 16**: ハンドラのユニットテスト（疑似S3イベント入力、aws-sdk-client-mockで S3/Slack をモック）。必須信頼性テスト: 冪等性（同一objectKey再処理で重複保管・重複通知なし）／部分失敗継続（デコード失敗でも保存継続・Slack失敗でも保存継続）／失敗注入（デコード失敗・添付上限超過・Slack送信失敗）。[NFR1.2, NFR1.5, NFR1.6]
- [x] **Step 17**: CDK インフラ（`infra/`）: 1st/2nd S3（SSE-S3・パブリックアクセスブロック）、Lambda（Node.js LTS、明示タイムアウト・メモリ）、SES受信ルール前提のS3 ObjectCreatedトリガ、最小権限IAM、DLQ、CloudWatch Logs。IaC内の説明は英語。[FR1.1, FR1.2, FR5.3, NFR1.3, NFR3.1, NFR3.3, NFR3.4]
- [x] **Step 18**: 環境/ビルド設定の最終化（npm scripts: build/lint/test、.env.example に対象ドメイン・Secrets Manager の Secret 名/ARN 等のキー。S3 バケット名は CDK 自動命名のため .env に含めない）。[FR4.1]
- [x] **Step 19**: ドキュメントとトレーサビリティ（README に手動運用手順=Route53/SES検証・デプロイ、traceability.json 作成）。[NFR全般]
- [x] **Step 20**（改訂）: CDK の設定受け渡しを **環境変数（.env）駆動に統一**し、CDK context（`-c`）依存を廃止する。理由: `-c` は `cdk diff` で無視されやすく、`synth`/`deploy`/`diff` 間で値がずれて不都合。`infra/app.ts` は `process.env`（`TARGET_DOMAIN` / `SECRETS_MANAGER_SECRET_ARN` / `SECRETS_MANAGER_SECRET_ID`）から読む。S3 バケットは CDK が自動命名で生成し（`RAW_MAIL_BUCKET` / `DECODED_MAIL_BUCKET` を `.env` で渡さない）、生成名を Lambda 環境変数へ注入する。README の `cdk synth/deploy` 手順を `-c` 列挙から「`.env` を環境変数としてエクスポートしてから `cdk` を実行（`set -a; . ./.env; set +a`）」に統一し、設定値表と実行時供給経路（Slack Webhook URL は Secrets Manager から実行時供給）を整合させる。`.env.example` に CDK デプロイ用キー（`SECRETS_MANAGER_SECRET_ARN` / `SECRETS_MANAGER_SECRET_ID` 等）を明記。設定読込元は環境変数（.env）に一本化し、`CONFIG_SOURCE` / `SSM_PARAMETER_PREFIX`（SSM 経路）は廃止する。[FR4.1, NFR3]

## ストーリー/要件→ステップ トレーサビリティ（要約）

- FR1（受信・S3保存/トリガ）→ Step15, Step17
- FR2（デコード・2nd S3保管/キー/ヘッダ/添付上限/冪等）→ Step4-7, Step10-11, Step15
- FR3（Slack通知/概要/リンク/冪等）→ Step8-9, Step12-13, Step15
- FR4（設定外部化）→ Step1, Step14, Step18
- FR5（失敗ハンドリング・可視化・DLQ）→ Step14, Step15, Step17
- NFR1-5 → 各実装＋テスト（Step5,7,9,11,13,16）＋インフラ（Step17）

## テスト方針（Testing Contract 準拠）

- test-after：各テスト対象層（buildObjectKey/decodeMailBody/summarizeBody/formatStoredBody/formatSlackPayload/handler）を実装後にその層のユニットテストを書いて実行。
- 必須信頼性テスト（team.md Testing Posture）: 冪等性・部分失敗継続・リトライ/失敗注入。添付上限は境界値分析。
- 各ハード制約（Mandated/Forbidden）↔最低1受け入れテストの対応をテストコメントで明示。
- 外部依存（S3/Slack）はモック。ユニットスコープの実行コマンドは unit-test-instructions.md に記録。
- カバレッジ数値フロアは課さない（スイート全緑を維持）。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "テスト可能な各レイヤ（本文/ヘッダ/添付のデコード、S3オブジェクトキー生成、本文要約整形、Slack通知ペイロード整形、失敗ハンドリング）を実装したのち、そのレイヤのユニットテストを書いて実行する。",
  "scope": "ses-receive-notify",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: テスト可能な各レイヤ（本文/ヘッダ/添付のデコード、S3オブジェクトキー生成、本文要約整形、Slack通知ペイロード整形、失敗ハンドリング）を実装したのち、そのレイヤのユニットテストを書いて実行する。\n- 成功指標「通知の取りこぼしゼロ」を守るため、デコード経路と通知経路の信頼性テストを必須とする。具体的には以下を必須テストとして置く：\n  - 冪等性テスト（メッセージID単位の重複排除）：同一メッセージIDの再処理でも 2nd S3 の重複保管が発生せず、Slack通知が意図せず多重発火しないことを検証する。S3オブジェクトキー（受信日時＋メッセージID）を冪等キーとして機能させる設計前提をテストで固定する。\n  - 部分失敗継続テスト：デコード失敗時も受信メールのS3保存は継続する／Slack送信失敗時も受信保存は継続しログに可視化する、をそれぞれ独立したユニットテストで担保する。\n  - リトライ／失敗注入（failure-injection）テスト：デコード失敗・添付上限超過・Slack送信失敗を注入し、期待挙動（保存継続・ログ可視化）を検証する。添付処理上限は境界値分析（上限ちょうど／超過／未満）でデコードスキップと保存・通知継続を検証する。\n- 各ハード制約（`## Mandated` / `## Forbidden`）は少なくとも1件の受け入れテストに対応付ける（規則↔テストの1:1対応。品質貢献の提案を採用）。\n- カバレッジは本スコープでは新規の数値フロア（例: 80%）を課さず、既存スイートをグリーンに保つことを floor とする（org既定のスコープfloorに準拠）。数値目標の代わりに、重点経路については「失敗分岐が1つ以上テストされているか」を実質的な品質基準（branch coverage の目視確認）とする。\n- 外部依存（SES/S3/Slack Webhook）はユニットテストではモック/スタブ化する。結合確認は検証済み環境への手動投函またはテストイベントで代替し、常時起動の結合テスト基盤は用意しない（小規模・稀受信のため）。\n- テスト種別: ユニットテスト中心。Lambdaハンドラは疑似SESイベント/S3イベントを入力とするハンドラ単体テストを置く。テストツールは実装言語の標準的な選択に従う（TypeScript/Node なら vitest/jest ＋ aws-sdk-client-mock、Python なら pytest ＋ moto 等）。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:31034d36afd76834cf17680ec8df52d173a41689fd1ad2bc7fb57df07d9eb357",
  "contract_sha256": "sha256:5dc3351608820f294a077406ca2d3b415e38cde9d42c7aa9f0c6ca60a6c13452"
}
```
