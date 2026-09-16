# Unit Test Instructions

## ユニットスコープ実行コマンド

```
npx vitest run test/
```

## 前提

- 実 AWS 資格情報は不要（無認証で実行可能）。`vitest.config.ts` がテスト用ダミー資格情報を注入する。
- 外部依存（S3 / Secrets Manager）は `aws-sdk-client-mock` でモックする。
- Slack Webhook は注入された `fetch` 相当のスタブ（DI）で差し替える。

## テスト方針（Testing Contract: test-after / standard）

- 各テスト対象層を実装後に、その層のユニットテストを書いて実行する。
- コンポーネントあたり 5〜8 テストを目安（standard）。
- デコード / 通知 / 失敗ハンドリング経路で最低 1 つの失敗分岐を必ずテストする。
- 数値カバレッジフロアは課さないが、スイートは常に全緑を維持する。
