# Code Generation 質問

## Plan Approval

このステージの実装計画（`code-generation-plan.md`、埋め込みの Testing Contract を含む）と、ユニットテスト指示（`unit-test-instructions.md`）を承認するか確認します。

**計画の要旨:**
- 言語/構成: TypeScript/Node（AWS Lambda, Node.js LTS）＋ AWS CDK。ドメイン純粋関数（buildObjectKey/decodeMailBody/summarizeBody/formatStoredBody/formatSlackPayload）＋アダプタ（S3/Slack/config/logger）＋Lambdaハンドラ＋CDKインフラ。
- 実装順（test-after）: 構造→テストランナー→各ドメイン関数（実装→そのテスト）→アダプタ→ハンドラ→ハンドラテスト（冪等性・部分失敗継続・失敗注入の必須信頼性テスト）→CDKインフラ→設定→ドキュメント/traceability。全19ステップ。
- テスト: vitest ＋ aws-sdk-client-mock。ユニットスコープの実行コマンドは unit-test-instructions.md に記録済み（`npx vitest run test/...`）。数値カバレッジフロアは課さず全緑維持。重点経路は失敗分岐を最低1つ検証。
- 反映済みハード制約: 秘匿値.env/SM・失敗のCloudWatch可視化・本文先頭ヘッダ＋objectKey識別・Lambda最小権限IAM・objectKey単位の冪等・添付上限超過はデコードしない・秘匿値/PII非平文。
- 改訂（Step 20）: CDK 設定受け渡しを環境変数（.env）駆動に統一し `-c` context 依存を廃止（`cdk diff` で無視される不都合を解消）。README の synth/deploy 手順と .env.example を整合。

[Approval Fingerprint]: sha256:v3:ca2d06e1f61771eccd2d7b11037b5f03d82d497cc8bb7778229533a76d60b566
[Planned Source]: 28b476be4accc4f219c4c04f65591da0a951c43a64a888cd7299286fe0105877

- Approve Plan
- Request Changes

[Answer]: Approve Plan
