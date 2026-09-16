# NFR Requirements 明確化質問

> requirements.md の NFR1〜NFR5 を踏まえ、各カテゴリの定量目標・具体制約を詰めます。稀受信・単独運用・取りこぼしゼロという前提を踏まえ、過剰にならない範囲で測定可能な目標を置きます。各 `[Answer]:` は空欄です。

## Q1. 性能（Performance）— 受信からSlack通知までの目標所要時間は？

稀受信のため厳密なSLAは不要ですが、測定可能な目安を置きます。

- A. 受信（S3保存）からSlack通知まで概ね1分以内を目安（ハード要件ではなく目標値）
- B. 5分以内で足りる（急がない）
- C. 目標値は設けない（ベストエフォート）
- X. Other (please specify)

[Answer]:A

## Q2. 信頼性（Reliability）— リトライ回数・DLQ・可用性の考え方は？

- A. Lambdaの非同期呼び出し標準リトライ（2回）＋失敗はDLQへ退避。可用性はAWSマネージド（SES/S3/Lambda）に委ね独自のSLO数値は設けない。DLQ滞留は0件を正常とみなす
- B. リトライ回数やSLO数値を明示的に定義したい（X で補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q3. セキュリティ（Security）— 保管データの暗号化とアクセス制御は？

- A. 両S3バケットはSSE（S3管理鍵 SSE-S3 で十分）で保管時暗号化＋パブリックアクセスブロック。Lambda IAMは最小権限。秘匿値は.env/Secrets Manager。ログにPII/秘匿値を出さない
- B. SSE-KMS（カスタマー管理鍵）を要件とする（X で理由）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q4. スケーラビリティ（Scalability）— 同時実行・流量の考え方は？

- A. 1日数通〜数十通程度を前提に、Lambda標準の同時実行で十分。特別なスロットリング/予約同時実行は設けない（暴走防止に予約上限のみ検討可）
- B. 予約同時実行やスロットリングを明示要件にしたい（X で補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q5. 可観測性（Observability）— ログ・メトリクス・アラートの範囲は？

- A. CloudWatch Logsに受信/デコード/通知の各段階と失敗を構造化ログ出力。DLQ滞留数のメトリクス確認のみ（常時アラートは必須としない）。必要ならDLQ>0でアラート追加可
- B. アラート（SNS/メール等）を明示要件にしたい（X で補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Q6. 技術スタック（Tech Stack）— 確定方針の再確認は？

- A. TypeScript/Node（AWS Lambda, Node.js LTSランタイム）＋ AWS CDK（IaC）＋ ESLint/Prettier で確定方針とする（支障時Pythonへ切替。最終確定は実装時）。テストは vitest または jest ＋ aws-sdk-client-mock
- B. 別の構成にしたい（X で補足）
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

---

## Consolidated Summary Confirmation

回答を反映しました。以下の定量NFRで成果物（performance/security/scalability/reliability/observability/tech-stack + traceability）を作成してよいか確認します。

- **性能（NFR）**: 受信（S3保存）からSlack通知まで概ね1分以内を目標値（ハード要件ではない）。
- **信頼性**: Lambda非同期呼び出しの標準リトライ（2回）＋失敗はDLQへ退避。可用性はAWSマネージドに委ね独自SLO数値は設けない。DLQ滞留0件を正常とみなす。冪等キー=objectKey（受信日時＋メッセージID）。
- **セキュリティ**: 両S3バケットは保管時暗号化（SSE-S3）＋パブリックアクセスブロック。Lambda IAMは最小権限。秘匿値は.env/Secrets Manager。ログにPII/秘匿値を出さない。
- **スケーラビリティ**: 1日数通〜数十通前提でLambda標準同時実行で十分。特別なスロットリングは設けない（暴走防止の予約上限のみ検討可）。
- **可観測性**: CloudWatch Logsへ受信/デコード/通知の各段階と失敗を構造化ログ出力。DLQ滞留数メトリクス確認（常時アラートは必須としない。DLQ>0でアラート追加可）。
- **技術スタック**: TypeScript/Node（AWS Lambda, Node.js LTS）＋ AWS CDK（IaC）＋ ESLint/Prettier で確定方針（支障時Pythonへ切替。最終確定は実装時）。テストは vitest または jest ＋ aws-sdk-client-mock。

この内容で成果物を作成してよいですか？

- Looks correct
- Request changes

[Answer]: Looks correct
