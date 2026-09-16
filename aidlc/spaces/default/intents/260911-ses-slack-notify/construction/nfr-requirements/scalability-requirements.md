# Scalability Requirements — SES受信メールのSlack通知ツール

> 上流: `../../../inception/requirements-analysis/requirements.md`（NFR4 軽量スケーラビリティ）。

## Requirements

| ID | 要件 | 目標/基準 | 由来 |
|----|------|-----------|------|
| NFR4.3 | 想定流量 | 受信は1日数通〜（いたずら時でも）数十通程度を前提とする。ピークでも数十通/日を超えない想定。 | NFR4 |
| NFR4.4 | 同時実行 | Lambda標準の同時実行で十分。特別なスロットリングやプロビジョンド同時実行は設けない。 | NFR4 |
| NFR4.5 | 暴走防止（任意） | 想定外の大量流入に備え、Lambdaの予約済み同時実行に上限を設けることを検討可（必須ではない）。 | NFR4 |
| NFR4.6 | データ成長 | 2nd S3の保管量は受信数に比例し緩やかに増加する。ライフサイクルポリシーは要件としないが、必要になれば追加可能とする。 | NFR4 |

## Assumptions & Open Questions

- 予約済み同時実行の上限値・S3ライフサイクルは、必要になった時点で infrastructure/運用で追加する。[assumption]
