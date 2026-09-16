# 根拠（Evidence） — Practices Discovery

## 各参加者が調査・推論した内容

本プロジェクトはグリーンフィールド（空リポジトリ、参照可能なgit履歴なし）である。実践の根拠は
以下の情報源と、リード＋3名の支援貢献＋ヒアリングに基づく。

### リード（aidlc-pipeline-deploy-agent）

- 参照した情報源：組織既定 `aidlc/spaces/default/memory/org.md`（トランクベース/squash-merge、skeletonはスコープ依存、テストはtest-after既定、マージでstagingデプロイ＋本番手動承認、Code Styleはプロジェクト設定依存）、ディスパッチ・ブリーフのプロジェクト文脈（小規模AWSサーバーレスツール、SES受信→S3→Lambdaデコード→2nd S3→Slack通知、取りこぼしゼロが成功指標、稀受信、単独開発・単独運用、手動デプロイ許容、Change Control relaxed）、スコープ文書、`project.md` Tech Stack（Route53別アカウント連携は既存実装 dmarc-report-visualizer を参照）。
- 推論：org既定を「推奨たたき台」とし、単独開発向けにレビュー＝セルフレビュー化、skeleton非セレモニー化、単一環境＋手動デプロイへ特化。`team.md`/`project.md` の実践セクションはテンプレート（空）でありチーム確定事実は未記録と判断。

### 品質（aidlc-quality-agent）

- 検査：リードのTesting Postureドラフトを「取りこぼしゼロ」の観点で精査。
- 指摘・推論：methodology=test-after／ユニット中心は妥当。ただし取りこぼしゼロは境界・失敗系の話であり happy path のみでは不足。冪等性（メッセージID単位の重複排除）、部分失敗継続、リトライ/失敗注入テストを必須化すべきと提案。Mandated/Forbidden 各規則に受け入れテストを1:1で対応付けることを提案。数値カバレッジフロア非採用は支持しつつ、重点経路は「失敗分岐が1つ以上テストされているか」を実質基準とする運用を推奨。

### 開発（aidlc-developer-agent）

- 検査：team-practices.md / discovered-rules.md / evidence.md を独立に精査。
- 指摘・推論：Way of Working / Walking Skeleton / Deployment / Mandated / Forbidden は妥当と AGREE。Code Style がリンタ委譲・言語慣用命名に留まる点を OBJECT し、レイヤ規約の明文化を提案：Lambdaハンドラ（I/O境界）とドメイン純粋関数の分離、外部依存のアダプタ化・依存性注入、S3キー整形の単一関数集約、動詞＋名詞の関数名、ドメイン用語の一貫、明示的な型付け、サイレント失敗の禁止。at-least-once 配信に対する冪等性の明記も提案。

### DevSecOps（aidlc-devsecops-agent）

- 検査：team-practices.md / discovered-rules.md / evidence.md を独立に精査。
- 指摘・推論：シークレット非記録・.env外部化・リンタ委譲・軽量デプロイに全面 AGREE（OBJECT なし）。過剰統制を避けつつ defensible な最小統制として、Lambda最小権限（S3 get/put のプレフィックス限定、CloudWatch Logs、必要なSSM/Secretsのみ）、S3暗号化＋パブリックアクセス全ブロック＋署名付きURL、本文/添付=untrusted data としての入力検証・Slackペイロードのサニタイズ、ログへの本文全文/PII/シークレット非出力を提案。

## ヒアリング（Q1〜Q6）で確定した事項

- Q1: トランクベース開発、短命ブランチ→main、squash-merge、セルフレビュー（単独開発）。
- Q2: walking-skeleton セレモニーは実施しない。dependency-first の最初のBoltが事実上のE2E一本であり通常Boltとして扱う。
- Q3: Methodology=test-after。加えてデコード/通知経路の信頼性テスト（冪等性＝メッセージID単位の重複排除、部分失敗継続、リトライ/失敗注入）を必須とする。スイートはグリーン維持、数値カバレッジフロアは課さない。
- Q4: 単一環境、IaCによる手動デプロイ、セルフ承認をデプロイゲートとする。
- Q5: 実装言語＝TypeScript/Node（AWS Lambda）＋ AWS CDK（IaC）、ESLint/Prettier。ただし「TypeScript/Node で進め、支障があれば Python に切り替える」方向として記録（永続固定ではない）。開発レビューのレイヤ規約を Code Style に採用。
- Q6: 提案されたハード制約（Mandated 5件・Forbidden 2件）をすべて採用。

## DevSecOps の追加提案（推奨。必須ではない）

以下は defensible な推奨事項であり、本ステージでは Mandated/Forbidden 化しない（単独運用の負荷とのバランスを考慮）。

- SAST：リンタのセキュリティルール活用（Node は ESLint security プラグイン、Python は Bandit / Ruff セキュリティルール）。Critical/High はブロック、Medium は警告を目安。
- IaC 静的解析：Checkov / cfn-nag / cdk-nag のいずれか（S3公開禁止・暗号化・IAM過剰権限を検出）。
- 依存関係スキャン：`npm audit`（Node）/ `pip-audit`（Python）。バージョン固定・lockfile コミット・range依存回避・ランタイムバージョン固定。Dependabot 等での定期更新。
- データ保護：2つのS3バケットの暗号化（SSE-S3 か SSE-KMS）＋パブリックアクセス全ブロック、Slackに載せるS3リンクは短命の署名付きURLを推奨。
- ログ衛生：CloudWatch Logs にシークレット/Webhook URL/本文全文/PIIを出力しない。ログはメタデータ（メッセージID・処理結果・エラー種別）中心。
- Slackペイロード入力サニタイズ：デコード本文/Subjectをペイロード整形する際のインジェクション対策（メンション/リンク/制御文字の無害化、要約時の安全な切り詰め）。

## 未解決の不確実性

- 添付の「処理上限」の具体値（サイズ等）。Lambda実行環境の制約に合わせて後続で確定予定。
- 実装言語の最終確認：TypeScript/Node で進めるが、支障が判明した場合は Python へ切り替える（最終確認は実装で行う）。
- シークレット格納先：ランタイムで `.env` に留めるか、SSM Parameter Store / Secrets Manager を標準とするか。
- 2nd バケットの保持期間・ライフサイクル、暗号化に KMS CMK を使うか SSE-S3 で足りるか。
- SlackのS3リンクを署名付きURLとするか、恒久リンク＋別途認証とするか。
- Slack通知先（単一チャネル固定か、複数チャネル分岐の要否）。
- SES/S3/Lambda が同一アカウントか別アカウントか（別アカウント時はクロスアカウント権限の最小化方針が変わる）。
- 本文要約「冒頭200文字程度」の正確な仕様（文字数/表示幅、マルチバイト境界、トリム位置）。
