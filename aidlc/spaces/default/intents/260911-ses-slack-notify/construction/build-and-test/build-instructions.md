# Build Instructions — SES受信メールのSlack通知ツール

> zero-Unit（単一ツール）。アプリコードはワークスペースルート（`src/` `infra/` `test/`）。
> 上流: `../code-generation/code-summary.md`、`../code-generation/code-generation-plan.md`、`../code-generation/unit-test-instructions.md`。
> 実 AWS 資格情報なしでローカル/CI からビルド・テスト可能（外部依存はモック/DI）。

## 前提条件（Prerequisites）

- Node.js 20 LTS 以上（`package.json` の `engines.node: ">=20"`、`"type": "module"`）。
- npm（`package-lock.json` によりバージョン固定＝再現可能ビルド。NFR3.10 供給網リスク低減）。
- 実 AWS 資格情報は不要。ビルド・ユニットテストはネットワーク/認証なしで完結する。

## 依存インストール（Dependency Installation）

lockfile を尊重した再現可能インストールを行う。

```
npm ci
```

- `npm ci` は `package-lock.json` に固定されたバージョンで厳密に再現インストールする（CI 推奨）。
- ローカル初回で lockfile がない場合のみ `npm install` を用いる。
- 主要依存（ピン留め）: `@aws-sdk/client-s3` / `@aws-sdk/client-secrets-manager`（3.658.1）、`mailparser`（3.7.1）。
- 主要 devDependencies: `typescript`（5.6.2）、`vitest`（2.1.1）、`aws-sdk-client-mock`（4.0.2）、`eslint`（8.57.1）＋ `@typescript-eslint/*`（7.18.0）、`prettier`（3.3.3）、`aws-cdk-lib`/`aws-cdk`（2.160.0）、`esbuild`（0.24.0）、`tsx`（4.19.1）。

## 環境設定（Environment Setup）

- ビルド・ユニットテストには秘匿値は不要（外部依存はモック/DI）。
- 実行時/デプロイ時の設定のみ `.env` を使用する（`.env.example` をコピーして各自設定。`.env` はコミットしない）。

```
cp .env.example .env   # 実行/デプロイ検証時のみ。ビルド・単体テストには不要
```

- `vitest.config.ts` はテスト実行時にダミー AWS 資格情報を注入し、無認証実行を保証する（`configLoader` はテストでスタブ化）。
- 秘匿値（`SLACK_WEBHOOK_URL` 等）はソース/IaC/ログに平文で残さない（NFR3.6）。CDK デプロイ時は環境変数（`.env`）駆動で受け渡す（README のデプロイ手順に統一）。

## ビルドコマンド（Build Commands）

TypeScript は `tsc` による型チェック＆コンパイルを用いる（`package.json` の `build` スクリプト）。

```
npm run build     # = tsc -p tsconfig.json（strict 型チェック＆コンパイル）
```

補助チェック（品質ゲート）:

```
npm run lint      # = eslint "{src,test,infra}/**/*.ts"
npm run format    # = prettier --check "{src,test,infra}/**/*.ts"
```

- `tsconfig.json` は `strict: true`（team.md「TypeScript strict」準拠）。`exactOptionalPropertyTypes` は AWS SDK v3 / CDK 型との衝突回避のため除外（strict より厳しいオプトインの取り下げであり品質緩和ではない — code-summary の「計画からの逸脱」参照）。

## インフラ（CDK）合成の確認（任意・設定検証）

IAM 最小権限・SSE-S3・パブリックアクセスブロック・DLQ 等（NFR3.1/3.3/3.4、FR5.3）は CloudFormation テンプレート合成で静的確認できる。実デプロイは手動運用（本ステージ対象外）。

```
# .env を環境変数としてロードしてから合成（synth/deploy/diff で同一値を共有）
set -a; . ./.env; set +a
npx cdk synth       # CloudFormation テンプレートを生成し設定を目視確認
```

- `npx cdk synth` は AWS 資格情報なしでも合成可能（bootstrap/deploy には資格情報が必要）。
- 生成テンプレートで、両 S3 バケットの `BucketEncryption`（SSE-S3）・`PublicAccessBlockConfiguration`（全ブロック）・Lambda 実行ロールのスコープ付き IAM ステートメント・DLQ（SQS）の存在を確認する。

## ビルド検証ステップ（Build Verification）

1. `npm ci` が成功し、`node_modules` が lockfile どおりに解決されること。
2. `npm run build`（tsc）がエラー 0 で完了すること（型エラーなし）。
3. `npm run lint`（eslint）が警告/エラー 0 で完了すること。
4. `npm run test`（vitest）が全緑であること（詳細はテスト実行、`test-results.md`）。
5. （任意）`npx cdk synth` が成功し、テンプレートにセキュリティ設定が反映されていること。

## トラブルシューティング（Common Build Issues）

- **Node バージョン不一致**: `engines.node: ">=20"`。Node 18 以下ではビルド/テストが失敗しうる。`node -v` で確認し 20 LTS 以上を使用する。
- **`npm ci` が lockfile 不整合で失敗**: `package.json` と `package-lock.json` の不整合。`package.json` を変更した場合は `npm install` で lockfile を更新してからコミットする（ピン留め方針を維持）。
- **ESM 関連エラー**: 本プロジェクトは `"type": "module"`。相対 import の拡張子や CommonJS 前提コードに注意。
- **CDK 合成時の型エラー**: `aws-cdk-lib`/`constructs` のバージョン整合を確認（ともに 2.160.0 / 10.3.0）。
- **`npm audit` の脆弱性報告（transitive: mailparser/eslint 系）**: バージョン緩和はしない。依存更新の別サイクルで対応する（既知の懸念として `build-and-test-summary.md` に記載）。
