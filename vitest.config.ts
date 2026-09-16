import { defineConfig } from 'vitest/config';

// ユニットテストは実 AWS 資格情報なしで実行する (NFR5)。
// 外部依存 (S3/Slack/Secrets) は aws-sdk-client-mock / DI で差し替える。
// unit-scoped run command: npx vitest run test/
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // 実 AWS を絶対に呼ばないよう、テスト環境の認証情報をダミーで固定する。
    env: {
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      AWS_REGION: 'ap-northeast-1',
    },
  },
});
