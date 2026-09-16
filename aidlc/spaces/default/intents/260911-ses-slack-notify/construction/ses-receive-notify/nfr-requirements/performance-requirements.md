# Performance Requirements — SES受信メールのSlack通知ツール

> 上流: `../../../inception/requirements-analysis/requirements.md`（NFR1信頼性、NFR4軽量スケーラビリティ）。稀受信・単独運用のため厳密なSLAは設けず、測定可能な目標値を置く。

## Requirements

| ID | 要件 | 目標/基準 | 由来 |
|----|------|-----------|------|
| NFR1.1 | 受信からSlack通知までの所要時間 | 受信（1st S3保存）からSlack通知完了まで概ね60秒以内を目標値とする（ハード要件ではなくベストエフォート目標）。 | NFR1, NFR4 |
| NFR4.1 | Lambda実行時間 | 添付合計10MB以下の通常メールを、Lambdaのデフォルトタイムアウト内（余裕を持って設定、例: 60秒以内）に処理完了する。 | NFR4 |
| NFR4.2 | リソース使用 | Lambdaメモリは添付10MB上限のデコードに十分な割当（設計で確定。例: 256〜512MB目安）。一時領域（/tmp）は添付合計を収容できる範囲。 | NFR4 |

## ベンチマーク/測定方法

- 受信→通知の所要時間は、テストイベント投函から通知到達までの実測（手動またはログのタイムスタンプ差）で確認する。常時計測基盤は設けない。

## Assumptions & Open Questions

- Lambdaメモリ/タイムアウトの具体値は infrastructure/実装で確定する（10MB添付処理に必要な余裕を持たせる）。[assumption]
