# Initiative Brief — SES受信メールのSlack通知ツール

> ideation フェーズの全成果物を統合した一枚ものです。inception フェーズ（要件整理・設計方針）への引き継ぎ判断に用います。上流成果物: `../intent-capture/intent-statement.md`, `../intent-capture/stakeholder-map.md`, `../scope-definition/scope-document.md`, `../scope-definition/intent-backlog.md`。

## Intent & Problem Statement（意図と課題）

- メール送信サーバーをオンプレからクラウドへ切り替えるにあたり、送信ドメインのレピュテーション向上のためMXレコードを登録し、実際に機能する受信サーバーをSESで構築する。当ドメインは原則受信しない旨を明示しているが稀に受信が届くため、その見落としを防ぐ仕組みが必要。（`../intent-capture/intent-statement.md`）

## Market Validation Summary（市場検証）

- 該当なし。社内利用の受信通知ツールであり市場調査は対象外。（`../scope-definition/scope-document.md` Out of Scope 方針、[Q5]）

## Feasibility & Risk Highlights（実現性とリスク）

- SES→S3→Lambda→Slack は標準的な既知パターンで実現性は高い。（`../intent-capture/intent-statement.md`）
- 主要リスクと受容方針:
  - ①別AWSアカウントのRoute53連携: 既存の実装経験（dmarc-report-visualizer）があり難度は限定的。同一/別アカウントの両対応。[Q2]
  - ②添付が処理上限（Lambda実行環境等に合わせた上限）を超える場合: 無理にデコードせず、メール保存と通知は継続。（`../scope-definition/scope-document.md` 境界条件, [Q2]）
  - ③取りこぼしゼロの信頼性目標: 後続の設計・実装で再試行/デッドレター等を検討。[Q2]

## Scope Boundary（スコープ境界）

- In Scope（すべてMust）: SES受信のS3保存 / 本文・添付のデコードと別S3保管 / 受信日時＋メッセージIDのキー設計 / 本文先頭ヘッダ付与 / Slack通知（受信日時・Subject・本文概要200字・S3リンク）/ 失敗時のCloudWatch Logs可視化 / .env設定外部化。（`../scope-definition/scope-document.md`）
- Out of Scope: Route53登録・SES検証（手動）/ 返信・自動応答・メールクライアント / 全文検索・ダッシュボード / スパム・ウイルススキャン。（`../scope-definition/scope-document.md`）
- 構築順序: dependency-first（受信保存 → デコード保管 → 通知）。（`../scope-definition/intent-backlog.md`）

## Concept Visuals（概念図）

- UI/UXを持たないツールのためモック/ワイヤーフレームは該当なし。通知フォーマットは要件で規定済み。[Q4]

## Team Plan（体制）

- 単独開発・単独運用。チーム編成は該当なし。予算はAWS利用料程度で追加調整不要。（`../intent-capture/stakeholder-map.md`, [Q3][Q6]）

## Go/No-Go Recommendation（推奨）

- **Go**: スコープ・リスク・体制の合意が取れており、inception フェーズ（要件整理・設計方針）へ進むことを推奨する。[Q1][Q2][Q7]

## Assumptions & Open Questions

- 添付の「処理上限」の具体値、取りこぼしゼロを支える再試行/デッドレター方式、Slack通知先チャネル運用の詳細は、inception 以降で確定する。[assumption]
