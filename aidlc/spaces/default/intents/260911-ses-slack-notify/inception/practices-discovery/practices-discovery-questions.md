# Practices Discovery インタビュー

> リリースエンジニアのドラフトと、品質・開発・DevSecOps の独立レビューを踏まえ、このプロジェクトの進め方（5領域）を確定するための質問です。各 `[Answer]:` は空欄です。グリーンフィールドのため、組織デフォルトを土台にした提案を確認する形です。

## Q1. 進め方（ブランチ運用）— trunk-based でよいですか？

単独開発として、短命なブランチから main へマージ（squash-merge）、レビューは自己レビュー、という進め方を想定しています。

- A. Yes — trunk-based / squash-merge / 自己レビューでよい
- B. main へ直接コミットで十分（ブランチ運用は不要）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q2. 最初に「薄いエンドツーエンドの一本」を先に作りますか？

ウォーキングスケルトン（＝全体を貫く最小構成を最初に作り、部品が繋がることを先に確認する作り方）を、セレモニーとして特別扱いするか。ドラフトでは「特別扱いしない（dependency-first の最初のBoltが事実上のE2E一本）」を提案しています。

- A. Yes（特別扱いしない） — 最初のBoltを通常どおり進め、それが事実上のE2E一本になる
- B. 明示的にスケルトン一本を最初に作りたい
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q3. テスト方針 — test-after でよいですか？また信頼性テストの扱いは？

ドラフトは Methodology=test-after（各層を実装後にテストを書いて実行）、数値カバレッジ床は設けず既存スイートをグリーンに保つ、を提案。品質・開発レビューから「取りこぼしゼロ」を守るため、デコード/通知経路の信頼性テスト（冪等性＝メッセージID単位の重複排除、部分失敗時の継続、再試行/失敗注入）を必須にすべきとの指摘があります。

- A. test-after で進め、かつデコード/通知経路の信頼性テスト（冪等性・部分失敗の継続・失敗注入）を必須テストとして含める
- B. test-after のみでよい（信頼性テストは任意）
- C. TDD/BDD など先にテストを書く方式にしたい（X で補足）
- D. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q4. デプロイ — 単一環境・手動デプロイでよいですか？

組織デフォルトは「mainマージでstaging自動デプロイ、本番は手動承認」ですが、単独運用の小規模ツールのため、単一環境＋手動デプロイ（IaCで適用）に簡素化することを提案しています。

- A. Yes — 単一環境・手動デプロイ（IaC適用）でよい。承認は自己承認
- B. staging/本番を分けたい（X で補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q5. 実装言語とコードスタイル — どうしますか？

SES/S3/Lambda 構成の実装言語（開発レビューは境界/ドメイン分離・外部依存のアダプタ化・S3キー整形の単一関数集約・サイレント失敗の明示禁止といったレイヤ規約の明文化を提案）。IaC も含めて選択してください。

- A. Python（Lambda）＋ IaC（AWS CDK）。lint/format は言語標準（ruff/black 等）に委譲。開発レビューのレイヤ規約を Code Style に採用
- B. TypeScript/Node（Lambda）＋ IaC（AWS CDK）。lint/format は ESLint/Prettier。開発レビューのレイヤ規約を Code Style に採用
- C. 言語は今は決めない（後続の設計/実装で確定）。レイヤ規約の考え方のみ採用
- D. Not yet defined
- X. Other (please specify)

[Answer]:X（Bで進めるが支障があればAに切り替え）

## Q6. ハード制約（Mandated / Forbidden）の確認

ドラフト＋DevSecOpsレビューから、以下を恒久ルールとして採用することを提案します。過不足があれば X で補足してください。

- ALWAYS: 秘匿値（Slack Webhook URL・対象ドメイン・外部リソース等）は.envまたはSecrets Manager経由で読み込む（ハードコード禁止）
- ALWAYS: 受信・デコード失敗は CloudWatch Logs で可視化する
- ALWAYS: 保存本文の先頭に受信日時・エンベロープFrom・Subject・From等のヘッダを付与し、S3キーは受信日時＋メッセージIDで識別可能にする
- ALWAYS: Lambda の IAM 権限は最小権限（対象S3の get/put、CloudWatch Logs、必要な SSM/Secrets に限定）
- ALWAYS: メッセージID単位で冪等に扱い、重複保存・重複Slack通知を避ける
- NEVER: 添付が処理上限を超える場合に無理にデコードしない（メール保存と通知は継続）
- NEVER: 秘匿値・PIIをソース/IaC/ログ/監査に平文で残さない

- A. 上記をすべて採用する
- B. 一部を除外/修正したい（X で補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

---

## Consolidated Summary Confirmation

インタビューと3名のレビューを反映し、リリースエンジニアが4つの成果物（team-practices / discovered-rules / evidence / timestamp）に統合しました。確定内容は以下です。承認すると team.md / project.md に反映されます。

**確定した慣習（5領域）:**
- **Way of Working**: trunk-based、短命ブランチ→main、squash-merge、自己レビュー。lint・ユニットテスト全緑を最低ゲートとする。
- **Walking Skeleton**: セレモニーとして特別扱いしない（dependency-first の最初のBoltが事実上のE2E一本）。
- **Testing Posture**: Methodology=test-after、Ordering=各テスト対象層を実装後にその層のテストを書いて実行。信頼性テストを必須化（冪等性＝メッセージID単位の重複排除・重複通知防止／部分失敗時の継続／再試行・失敗注入）。数値カバレッジ床は設けず既存スイートをグリーンに保つ。各ハードルールは最低1つの受け入れテストに対応づける。
- **Deployment**: 単一環境＋IaC手動デプロイ＋自己承認。Route53/SES検証は手動（同一/別AWSアカウント両対応、別アカウント参照=dmarc-report-visualizer）。
- **Code Style**: TypeScript/Node（Lambda）+ AWS CDK + ESLint/Prettier（支障があればPythonへ切替）。レイヤ規約（I/O境界とドメインの分離、外部依存のアダプタ/DI、S3キー整形の単一関数集約、動詞+名詞命名、明示的型付け、サイレント失敗禁止）。IaC説明は英語・日本語コメント可。

**確定したハード制約（discovered-rules）:**
- ALWAYS 秘匿値は.env/Secrets Manager経由で読み込む
- ALWAYS 受信・デコード失敗は CloudWatch Logs で可視化
- ALWAYS 保存本文先頭にヘッダ付与＋S3キーは受信日時＋メッセージIDで識別可能に
- ALWAYS Lambda IAM は最小権限
- ALWAYS メッセージID単位で冪等に扱い重複保存・重複通知を避ける
- NEVER 添付が処理上限超過時に無理にデコードしない（保存・通知は継続）
- NEVER 秘匿値・PIIをソース/IaC/ログ/監査に平文で残さない

この内容で確定してよいですか？

- Looks correct
- Request changes

[Answer]: Looks correct
