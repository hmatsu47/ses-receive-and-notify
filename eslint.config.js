// ESLint 9 flat config。@typescript-eslint 8 系 + prettier 連携。
// 旧 .eslintrc.json から移行。lint 対象は package.json の lint スクリプトで指定する。
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  // グローバル無視パターン（旧 ignorePatterns 相当）。
  {
    ignores: ['dist/**', 'cdk.out/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        // Node.js 実行環境のグローバル。
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',
    },
  },
];
