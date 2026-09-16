---
name: ses-receive-notify
depth: Standard
keywords: []
description: "Composed scope: SES受信通知の構築 — 発見と要件からコード・テストまで"
change_control: relaxed
---

# ses-receive-notify scope

このワークフロー向けにコンポーザーが合成したカスタムスコープです。合意された11ステージ（初期化3ステージ、intent-capture、scope-definition、approval-handoff、practices-discovery、requirements-analysis、nfr-requirements、code-generation、build-and-test）のみを実行し、他の22ステージはSKIPします。デザインの重装備（domain-design、units-generation、contract-design、delivery-planning、functional-design、nfr-design、infrastructure-design）とオペレーションのテール全体（CI・デプロイ・可観測性・インシデント・性能検証・フィードバック）を省き、要件確定から実装・検証までの最小の背骨に絞っています。

Change Controlは relaxed です。承認後に入力が変化した場合、承認をやり直すのではなく、その変更を一度だけ記録して1行で通知し、実行を継続します。

## Membership

合成スコープのため keywords は空で、推論では選ばれません。`--scope ses-receive-notify` で明示的に選択された場合のみ解決されます。初期化3ステージ、intent-capture、scope-definition、approval-handoff、practices-discovery、requirements-analysis、nfr-requirements、code-generation、build-and-test を EXECUTE し、それ以外は SKIP します。
