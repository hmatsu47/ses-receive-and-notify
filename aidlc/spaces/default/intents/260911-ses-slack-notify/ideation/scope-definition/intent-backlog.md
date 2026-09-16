# Intent Backlog — SES受信メールのSlack通知ツール

> 上流の `../intent-capture/intent-statement.md` と本ステージの `scope-document.md` に基づく、優先順位付きのプロトユニット（proto-Units）一覧です。MoSCoW で分類し、dependency-first の構築順序を示します。

## Prioritized Proto-Units（優先順位付きプロトユニット）

| ID | Proto-Unit | 説明 | MoSCoW | 依存 | Source |
|----|-----------|------|--------|------|--------|
| PU1 | 受信・保存（Ingest） | SES受信ルールで受信し、原本メールをS3へ保存する | Must | — | [Q1][Q2][Q3] |
| PU2 | デコード・保管（Decode & Store） | S3の原本を取得し本文・添付をデコード、別S3バケットへ整理保管。受信日時＋メッセージIDのキー設計、本文先頭にヘッダ付与。添付が処理上限超過時は無理にデコードしない | Must | PU1 | [Q2][Q3] |
| PU3 | 通知（Notify） | 受信日時・Subject・本文概要（冒頭200文字程度）・保存先S3リンクをSlack Webhookへ通知 | Must | PU2 | [Q2][Q3] |
| PU4 | エラー可視化（Observability - minimal） | 受信・デコード失敗を CloudWatch Logs で可視化 | Must | PU1, PU2 | [Q1] |
| PU5 | 設定外部化（Config） | 対象ドメイン・外部リソース・Slack Webhook URL等を.envで指定 | Must | — | [Q2] |

## Value Stream Map（価値の流れ）

```
[メール到達]
   → PU1 受信・保存（S3に原本）
   → PU2 デコード・別S3保管（本文＋ヘッダ／添付、キー: 受信日時+メッセージID）
   → PU3 Slack通知（受信日時・Subject・本文概要200字・S3リンク）
   → [運用者が稀な受信を見落とさず把握できる]

横断: PU5 設定外部化（.env）／ PU4 失敗の可視化（CloudWatch Logs）
```

- この価値の流れは「稀に届く受信メールを取りこぼしなく把握・保管する」という成功基準に直結する。[Q1]

## Build Order（構築順序）

1. PU5 設定外部化・PU1 受信保存（起点）[Q4]
2. PU2 デコード・別S3保管 [Q3][Q4]
3. PU3 Slack通知 [Q3][Q4]
4. PU4 エラー可視化（PU1/PU2に付随して整備）[Q1]

- 順序は dependency-first。直列依存（PU1→PU2→PU3）を尊重する。[Q3][Q4]

## Assumptions & Open Questions

- 上記プロトユニットは後続の Units Generation で正式なUnit分解へ発展させる想定。現段階では単一ツールとして1ユニットに束ねられる可能性が高い。[assumption]
