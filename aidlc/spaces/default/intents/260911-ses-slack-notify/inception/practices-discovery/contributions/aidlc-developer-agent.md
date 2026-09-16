**Collaborator:** aidlc-developer-agent

## Contribution

開発者の観点から、リードのドラフト（team-practices.md / discovered-rules.md / evidence.md）を独立に精査した。全体としてグリーンフィールドの単独開発・小規模サーバーレスツールに対して妥当な特化であり、大きな異論はない。以下は Code Style と実装構造の実効性を高めるための補強提案である。

### 命名（Naming）

- リードの「言語慣用に従う（Python は snake_case、TypeScript は camelCase）」で十分。加えて、ドメイン用語をコード全体で一貫させることを推奨する。本ツールの中核概念は少数（受信メール=`received_mail`/`ReceivedMail`、デコード済み本文=`decoded_body`、S3オブジェクトキー=`object_key`、Slack通知ペイロード=`slack_payload`）に収まるため、これらを用語集的に固定すると読解・保守が容易になる。
- 関数名は「動詞＋名詞」を徹底する（`decode_mail_body`、`build_object_key`、`format_slack_payload`、`store_raw_mail`）。曖昧な `process` / `handle`（Lambdaハンドラのエントリを除く）は避ける。
- ブール値は `is_` / `has_` / `should_` 接頭辞（例: `is_over_attachment_limit`、`has_attachments`）。
- S3オブジェクトキー生成は「受信年月日（時分）＋メッセージID」という規約が hard constraint（discovered-rules.md）であるため、キー整形はマジック文字列を散在させず単一の関数（`build_object_key`）に集約し、日時フォーマット定数を SCREAMING_SNAKE_CASE で一元管理することを推奨する。

### レイヤ境界（Layer Boundaries）

- Lambdaハンドラ（I/O境界）と純粋なドメインロジックを分離することを推奨する。ハンドラは「SES/S3イベントの受領 → 入力検証・ドメイン型への変換 → ドメイン関数呼び出し → 結果の永続化/通知」に徹し、デコード・キー生成・要約整形・ペイロード整形は副作用のない純粋関数として切り出す。これにより Testing Posture が挙げる重点経路（デコード/キー生成/要約/Slackペイロード）をモック不要のユニットテストで厚く検証でき、信頼性目標に直結する。
- 外部依存（S3/Slack Webhook）はアダプタ（薄いラッパ）越しに扱い、ドメイン層は具象SDKに直接依存しない（依存性注入）。これによりユニットテストでのスタブ化（リードの Testing Posture 記載どおり）が自然に成立する。
- 推奨するファイル構成（feature/責務ベース、言語確定後に具体化）:
  - `handler`（Lambdaエントリ、イベント→ドメイン変換のみ）
  - `decode`（本文/添付/ヘッダのデコード）
  - `storage`（S3キー生成・保管アダプタ）
  - `notify`（要約整形・Slackペイロード整形・Webhookアダプタ）
  - `config`（.env読み込みと設定値の型付き検証）
  - テストは各モジュールに隣接配置。

### エラーハンドリング（Error Handling）

- discovered-rules.md の「デコード/Slack通知に失敗しても受信メールのS3保存は継続する」は取りこぼしゼロの要であり、実装上は明確に分離すべき2フェーズとして扱うことを推奨する: (1) 受信メールの生保存（最優先・最初に完了）、(2) デコード・整理保管・通知（失敗許容・個別に握って CloudWatch Logs へ可視化）。この順序を実装規約として明記すると、リードの Mandated 規則がコードで担保しやすい。
- 例外は境界（Lambdaハンドラ）で catch-all し、ドメイン層では想定内の失敗（デコード不能・添付上限超過・Slack送信失敗）を型付きの結果として上位へ伝播させる。想定内失敗と致命的失敗を区別し、前者は保存継続＋ログ、後者は fail loud とする。
- サイレント失敗の禁止（`except: pass` / 空 catch）を Code Style 規約として明文化することを推奨する。ログには受信日時・メッセージID・失敗フェーズを構造化して残し、シークレット/Webhook URL/本文全文は出力しない（Forbidden 規則と整合）。
- 冪等性への言及を検討すべき（後述の Positions 参照）。SES/S3イベントは at-least-once 配信であり得るため、同一メッセージIDでの再実行時に重複保存・重複Slack通知をどう扱うかは実装規約に影響する。

### コードスタイル（Code Style）補足

- リードのリンタ/フォーマッタ委譲・言語慣用命名の方針に同意。加えて型付けの徹底を推奨する（Python は type hints＋mypy相当、TypeScript は strict）。設定値・イベントペイロードは境界で型検証し、ドメイン層は型を信頼する。
- 関数は単一責務・短く保つ（ガード節での早期リターン、ネスト抑制）。特にハンドラは「調整役」に留め、業務ロジックを持ち込まない。
- コメントは日本語可・IaC説明は英語（ja-policy と整合、リード記載どおり）で問題ない。

### ヒアリングで解消すべきギャップ（開発観点）

- 実装言語（Python か TypeScript/Node か）— レイヤ構成・型ツール・命名の最終確定に直結（evidence.md 既出、開発観点でも最優先）。
- 冪等性・重複配信の扱い（メッセージIDによる重複排除の要否）— 取りこぼしゼロと同時に「重複通知しない」も暗黙の期待になり得る。
- 本文要約「冒頭200文字程度」の文字数境界の厳密性（マルチバイト境界・改行・エンコーディング）と、要約整形の正確なルール。

## Positions

- AGREE: Way of Working（トランクベース／squash-merge／単独セルフレビュー）、Walking Skeleton の非セレモニー化、Deployment（手動デプロイ・単一環境・切り戻し方針）は小規模単独開発の文脈で妥当。
- AGREE: discovered-rules.md の Mandated/Forbidden（.env外部化、失敗時ログ可視化、受信保存継続、添付上限超過の非強制デコード、シークレット非記録）は本プロジェクト文脈から直接 defensible。
- OBJECT: Code Style 節が「リンタ委譲・言語慣用命名」に留まり、実装構造の規約（I/O境界＝Lambdaハンドラとドメイン純粋関数の分離、外部依存のアダプタ化・依存性注入、S3キー整形の単一関数集約、サイレント失敗の明示禁止）が欠けている。これらは信頼性目標（取りこぼしゼロ）とテスト容易性に直結するため、Code Style もしくは Way of Working に実装レイヤ規約として一文加えることを提案する。
- OBJECT: 失敗時の「受信保存継続」は方針として明記されているが、SES/S3イベントの at-least-once 配信に対する冪等性（メッセージID単位の重複保存・重複Slack通知の扱い）が未言及。ヒアリング項目に「重複配信・冪等性の扱い」を追加し、確定した方針を Testing Posture の重点エッジケース（同一メッセージID再実行）に反映することを提案する。
