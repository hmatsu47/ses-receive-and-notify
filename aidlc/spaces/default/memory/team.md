# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

- トランクベース開発を採用する。作業は `main` から切った短命のフィーチャーブランチで行い、`main` へは squash-merge でマージする。長寿命ブランチは作らない。
- 単独開発・単独運用のため、レビュー担当者による相互レビューは前提にしない。マージ前に自分自身でセルフレビュー（差分確認・ローカルでのテスト実行）を行うことをもってレビュー相当とする。
- セルフレビューには最低ゲートとして「lint 実行」と「ユニットテスト全緑」を明文チェックリストに含める（品質貢献の提案を採用）。テストは実 AWS 資格情報に依存せずローカル/CI から無認証で実行可能に保つ（モック前提）。
- 小規模ツールであり並列作業はまず発生しないため、フィーチャーブランチは1〜2日以内で解消することを目安とする。マージ debt を溜めない。
- リポジトリはグリーンフィールド（空）から開始する。構築順序は dependency-first（受信保存 → デコード保管 → 通知）で capability 単位に積み上げる。

## Walking Skeleton

- 本スコープは walking skeleton セレモニーを実施しない。単独運用の小規模ツールであり、独立した skeleton Bolt を先行させる価値よりコストが上回る。
- 構築順序は dependency-first（受信保存 → デコード保管 → 通知）であり、最初の Bolt が実質的にエンドツーエンドの最小疎通（SES受信 → S3 → Lambda → 2nd S3 → Slack）を通す薄い縦断となる。これはセレモニーとしての skeleton ではなく、通常の Bolt として扱う。
- SESドメイン検証・Route53登録は手動運用（対象外）のため、疎通確認は検証済みドメイン・手動投函またはテストメール/テストイベントを前提に行う。

## Testing Posture

- **Methodology**: test-after
- **Ordering**: テスト可能な各レイヤ（本文/ヘッダ/添付のデコード、S3オブジェクトキー生成、本文要約整形、Slack通知ペイロード整形、失敗ハンドリング）を実装したのち、そのレイヤのユニットテストを書いて実行する。
- 成功指標「通知の取りこぼしゼロ」を守るため、デコード経路と通知経路の信頼性テストを必須とする。具体的には以下を必須テストとして置く：
  - 冪等性テスト（メッセージID単位の重複排除）：同一メッセージIDの再処理でも 2nd S3 の重複保管が発生せず、Slack通知が意図せず多重発火しないことを検証する。S3オブジェクトキー（受信日時＋メッセージID）を冪等キーとして機能させる設計前提をテストで固定する。
  - 部分失敗継続テスト：デコード失敗時も受信メールのS3保存は継続する／Slack送信失敗時も受信保存は継続しログに可視化する、をそれぞれ独立したユニットテストで担保する。
  - リトライ／失敗注入（failure-injection）テスト：デコード失敗・添付上限超過・Slack送信失敗を注入し、期待挙動（保存継続・ログ可視化）を検証する。添付処理上限は境界値分析（上限ちょうど／超過／未満）でデコードスキップと保存・通知継続を検証する。
- 各ハード制約（`## Mandated` / `## Forbidden`）は少なくとも1件の受け入れテストに対応付ける（規則↔テストの1:1対応。品質貢献の提案を採用）。
- カバレッジは本スコープでは新規の数値フロア（例: 80%）を課さず、既存スイートをグリーンに保つことを floor とする（org既定のスコープfloorに準拠）。数値目標の代わりに、重点経路については「失敗分岐が1つ以上テストされているか」を実質的な品質基準（branch coverage の目視確認）とする。
- 外部依存（SES/S3/Slack Webhook）はユニットテストではモック/スタブ化する。結合確認は検証済み環境への手動投函またはテストイベントで代替し、常時起動の結合テスト基盤は用意しない（小規模・稀受信のため）。
- テスト種別: ユニットテスト中心。Lambdaハンドラは疑似SESイベント/S3イベントを入力とするハンドラ単体テストを置く。テストツールは実装言語の標準的な選択に従う（TypeScript/Node なら vitest/jest ＋ aws-sdk-client-mock、Python なら pytest ＋ moto 等）。

## Change Control

<!-- Affirmed by the team. Mode: strict or relaxed. Strict here holds for every intent and cannot be changed from chat. -->

## Deployment

- 単独運用の小規模ツールであり、手動デプロイを許容する。IaC（AWS CDK）による `deploy` コマンド実行を基本とする。
- 環境は単一環境を基本とする（staging を必須としない）。org既定の「マージでstagingへ自動デプロイ」は本ツールには過剰であり適用しない。必要になった時点で staging を追加する。
- 本番反映は自分自身の手動承認（差分・テスト結果の確認）をもってデプロイゲートとする。自動の本番連続デプロイは行わない。
- Route53のドメイン/レコード登録と SESドメイン検証は手動運用であり、デプロイパイプラインの対象外。同一AWSアカウント・別AWSアカウントの両方に対応する。別アカウント連携は既存実装 dmarc-report-visualizer を参照する（`project.md` Tech Stack 記載のとおり）。
- ロールバックは、IaC の前リビジョンへの再デプロイ、または Lambda の前バージョン/エイリアス切り戻しで行う。稀受信のため無停止要件はゆるく、短時間の切り戻しで足りる。

## Code Style

- 実装は TypeScript/Node（AWS Lambda）＋ AWS CDK（IaC）を第一候補として進める。支障が生じた場合は Python へ切り替える（固定の永続決定ではなく、選択した方向＋フォールバックの位置づけ。最終確定は実装ステージで行う）。
- 整形・リントは ESLint/Prettier を用いる（Python へ切り替えた場合は Ruff/Black）。設定はリポジトリ直下に置く。
- 命名は言語慣用（TypeScript は camelCase、Python は snake_case）に従う。加えてドメイン用語をコード全体で一貫させる（受信メール=`ReceivedMail`、デコード済み本文=`decodedBody`、S3オブジェクトキー=`objectKey`、Slack通知ペイロード=`slackPayload` 等）。関数名は「動詞＋名詞」を徹底する（`decodeMailBody`、`buildObjectKey`、`formatSlackPayload`、`storeRawMail`）。曖昧な `process`/`handle`（Lambdaハンドラのエントリを除く）は避ける。
- レイヤ境界を明確にする：Lambdaハンドラ（I/O境界）と純粋なドメインロジックを分離する。ハンドラは「イベント受領 → 入力検証・ドメイン型への変換 → ドメイン関数呼び出し → 永続化/通知」に徹し、デコード・キー生成・要約整形・ペイロード整形は副作用のない純粋関数として切り出す。
- 外部依存（S3/Slack Webhook）はアダプタ（薄いラッパ）越しに扱い、依存性注入によりドメイン層が具象SDKに直接依存しないようにする（ユニットテストのスタブ化が自然に成立する）。
- S3オブジェクトキー整形は単一の関数（`buildObjectKey`）に集約し、日時フォーマット定数を一元管理する。マジック文字列を散在させない。
- 型付けを徹底する（TypeScript は strict、Python は type hints ＋ mypy 相当）。設定値・イベントペイロードは境界で型検証し、ドメイン層は型を信頼する。
- サイレント失敗を禁止する：空 catch / `except: pass` を置かず、すべてのエラーを上位へ surface するかログに可視化する。想定内失敗（デコード不能・添付上限超過・Slack送信失敗）は型付き結果として伝播させ保存継続＋ログ、致命的失敗は fail loud とする。
- コードコメントは日本語で記述してよい（識別子は可読性優先で英語）。CloudFormation/IaC テンプレート内の説明は英語で記述する（プロジェクト言語ポリシーに準拠）。
## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->
