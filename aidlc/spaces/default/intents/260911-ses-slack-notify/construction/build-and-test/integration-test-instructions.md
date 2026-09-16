# Integration Test Instructions — SES受信メールのSlack通知ツール

> zero-Unit（単一ツール）。Test Strategy = **Standard** → 生成する追加テスト指示は本ファイル（結合＝境界・クロスユニット相互作用）のみ。
> 単体テストは Code Generation が各層に対して作成済み（`../code-generation/unit-test-instructions.md`）。
> team.md 方針: 常時起動の結合テスト基盤は設けない（小規模・稀受信）。結合確認は「モック越しの境界テスト（自動）」＋「検証済み環境への手動投函（手動）」で代替する。

## テスト戦略（Standard の位置づけ）

本ツールの「結合」は、Lambda ハンドラ（I/O 境界）を中心に、ドメイン純粋関数群とアダプタ（S3 / Slack / config / logger）を **DI で結線した状態** の相互作用として検証する。外部依存（S3 / Slack Webhook）は `aws-sdk-client-mock` と注入スタブでモックし、実 AWS 資格情報なしで実行する。エンドツーエンドの実サービス疎通は手動投函で代替する（下記「手動結合確認」）。

## A. 自動結合テスト（モック越しの境界・クロスユニット相互作用）

これらは既存の vitest スイート（特に `test/handler.test.ts`）が担う結合観点である。ハンドラを通じて decode → objectKey 生成 → 2nd S3 保管 → Slack 通知の一連の結線を、モックした S3/Slack で検証する。

### 実行コマンド

```
npx vitest run test/handler.test.ts     # ハンドラ結線（境界）テスト
npx vitest run test/                      # 全スイート（単体＋結線）
```

### 検証する境界・相互作用

- **受信 → 保管 → 通知の結線**: 疑似 S3 ObjectCreated イベントを入力し、`s3Adapter.getObject`（原本取得）→ `decodeMailBody` → `buildObjectKey` → `formatStoredBody` → `s3Adapter.putObject`（2nd S3）→ `formatSlackPayload` → `slackAdapter`（Webhook POST）が期待順序・期待引数で呼ばれること（FR1.2, FR2, FR3）。
- **冪等性（objectKey 単位）**: 同一 objectKey（受信日時＋メッセージID）の再処理で、`HeadObject`（存在確認）により 2nd S3 の重複 `putObject` と Slack 重複 POST が発生しないこと（FR2.5, FR3.5, NFR1.6）。
- **部分失敗継続**:
  - デコード失敗を注入しても、原本の扱いは維持され、失敗はログに可視化され、処理は致命的 throw に至らない範囲で継続すること（FR5.2, NFR1.5）。
  - Slack 送信失敗（アダプタが非2xx で throw）を注入しても、2nd S3 保管は完了しており、失敗はログに可視化されること（FR5.2, NFR1.5）。
- **失敗注入（failure-injection）**: デコード失敗・添付合計上限（10MB）超過・Slack 送信失敗をそれぞれ注入し、期待挙動（保存継続・ログ可視化・添付超過時はデコードスキップ）を検証すること（FR2.4, NFR1.5, NFR3.9）。
- **添付上限の境界値**: 合計サイズ「ちょうど 10MB」「超過」「未満」で、超過時のみデコードスキップとなり、いずれの場合も保存・通知は継続すること（FR2.4, NFR3.9）。
- **ログ衛生の結線**: 一連の処理ログに本文内容（PII）や Webhook URL（秘匿値）が平文出力されないこと（NFR2.2, NFR3.6, NFR3.7）。`test/logger.test.ts` と併せて確認する。

### 期待結果・カバレッジ目標

- 上記境界テストが全緑。
- 数値カバレッジフロアは課さない（team.md 方針）。重点経路（デコード/通知/失敗ハンドリング）で「失敗分岐が最低 1 つテストされている」ことを実質基準とする（branch coverage の目視確認）。

### テストデータ・環境

- 疑似 SES メール（プレーンテキスト / HTML / 添付あり / 大容量添付）と疑似 S3 イベントを `test/fixtures/` に配置（実データ・実 PII は用いない）。
- S3: `aws-sdk-client-mock` で `GetObjectCommand` / `PutObjectCommand` / `HeadObjectCommand` をスタブ。
- Slack: 注入した `slackAdapter`（または fetch）をスタブに差し替え、成功/失敗を注入。
- config: `configLoader` をスタブし `.env` / Secrets Manager アクセスを回避。

## B. 手動結合確認（実サービス疎通 — 本ツールのデプロイ対象外の運用手順）

常時起動の結合テスト基盤は設けない。実サービス経路の疎通は、検証済みドメインへのテスト投函または SES テストイベントで手動確認する（team.md / README「疎通確認」）。

### 手順

1. 手動運用前提を満たす: 対象ドメインの MX を SES 受信エンドポイントへ、SES ドメイン検証・受信ルール（対象ドメイン宛を 1st S3 へ保存）を設定済みにする（Route53 / SES は手動運用・対象外）。
2. CDK でスタック一式をデプロイ（手動）: `set -a; . ./.env; set +a` の後 `npx cdk deploy`。
3. 検証済みドメイン宛にテストメールを投函（または SES のテストイベント）する。
4. 次を確認する（受信 → 通知の end-to-end 経路）:
   - 1st S3 バケットに原本が保存される（FR1.1）。
   - Lambda が ObjectCreated で起動する（FR1.2）。
   - 2nd S3 バケットに、受信日時＋メッセージID の objectKey でデコード結果が保管される（FR2.2, FR2.3）。
   - Slack チャネルに、受信日時・Subject・本文概要（約200字）・S3 リンクを含む通知が **一度だけ** 届く（FR3.2, FR3.3, FR3.5）。
5. 失敗系の確認（任意）: 大容量添付（合計 >10MB）を投函し、添付デコードがスキップされても保存・通知が継続すること、CloudWatch Logs に構造化ログ（相関キー = objectKey / messageId）が出力されること、DLQ 滞留数（正常時 0）を確認する（NFR1.5, NFR2.1, NFR2.3, FR5.3）。

### 手動確認の合否基準

- テストメール 1 通が、1st S3 保存 → Lambda 起動 → 2nd S3 保管 → Slack 通知 まで **取りこぼしなく一度だけ** 流れる（NFR1.2）。
- 秘匿値・PII がログに平文で現れない（NFR2.2, NFR3.7）。

## 実行タイミング

- **自動結合テスト（A）**: ビルド後に単体テストと同一の `npx vitest run test/` で毎回実行（CI/ローカル、無認証）。
- **手動結合確認（B）**: デプロイ後の受け入れ確認として、稀受信ツールの性質上オンデマンドで実施（常時計測基盤は設けない）。
