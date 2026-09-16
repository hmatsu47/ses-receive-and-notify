# Stakeholder Map — SES受信メールのSlack通知ツール

## Key Stakeholders（主要な関係者と関心事）

| Stakeholder | Interest（関心事） | Source |
|-------------|-------------------|--------|
| 開発者本人（実装・運用者） | 稀に届く受信メールを見落とさずに把握できること。ツールを実装・運用し、スコープと優先度を決める。 | [Q2][Q5][Q6] |
| 通知を受け取る利用チーム | Slack通知の内容とフォーマット（受信日時・Subject・本文概要・保存先S3リンク）が把握しやすいこと。 | [Q5] |

## Decision-makers vs. Influencers（決定者と影響者）

| Role | Person / Group | Note | Source |
|------|----------------|------|--------|
| 決定者（Decision-maker） | 開発者本人 | スコープ・優先度を単独で決定する。 | [Q6] |
| 影響者（Influencer） | 通知を受け取る利用チーム | 通知内容・フォーマットに対する要望を持つ。 | [Q5] |

## Communication Requirements（連絡要件）

| Requirement | Detail | Source |
|-------------|--------|--------|
| 通知手段 | Slack Webhook 通知のみ。受信メールごとに、受信日時・Subject・本文概要と、本文/添付の保存先S3リンクを通知する。 | [Q7][Q3] |
| 追加レポート | 不要（定期サマリや集計レポートは求められていない）。 | [Q7] |

## Assumptions & Open Questions

- Slack通知の送信先チャネルやWebhook URLは.env経由で指定する前提であり、具体的なチャネル運用（複数チャネル分岐の要否など）は未確定。[assumption]
