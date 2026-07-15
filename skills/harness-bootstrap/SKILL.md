---
name: harness-bootstrap
description: Bootstrap context collection for full-harness workflow — project snapshot, test discovery, build/test execution, and feedback aggregation
---

# Harness Bootstrap Skill

`works/full-harness/` の Sprint Contract ループで各フェーズのコンテキスト収集を担う。
bootstrap ノードが `npx tsx ../scripts/<phase>-bootstrap.ts` で呼び出す TypeScript スクリプト群。

## スクリプト一覧

| スクリプト | 対応ノード | 出力 |
|-----------|-----------|------|
| `scripts/planner-bootstrap.ts` | `bootstrap_planner_node` | `taskSpec` 文字列 |
| `scripts/generator-bootstrap.ts` | `bootstrap_generator_node` | Generator Bootstrap メッセージ |
| `scripts/evaluator-bootstrap.ts` | `bootstrap_evaluator_node` | Evaluator Bootstrap メッセージ |
| `scripts/feedback-bootstrap.ts` | `bootstrap_feedback_node` | Feedback Bootstrap メッセージ |

## 実行環境

- **CWD**: `works/full-harness/results/`（`run.ts` の `process.chdir` 後）
- **パス解決**: スクリプトは `../scripts/<name>.ts` として参照

## 環境変数による state 注入

| 変数 | 型 | 使用スクリプト |
|------|----|--------------|
| `TASK_SPEC` | `string` | planner |
| `SPRINT_CONTRACT` | `JSON \| null` | generator, evaluator, feedback |
| `SPRINT_RESULT` | `JSON \| null` | generator, feedback |

## 言語検出

`skills/env-bootstrap` に準拠。以下の優先順で検出する。

| ファイル | 言語 | ビルドコマンド | テストコマンド |
|---------|------|--------------|--------------|
| `package.json` + `yarn.lock` | TypeScript/JS | `yarn build` | `yarn test` |
| `package.json` | TypeScript/JS | `npm run build` | `npm test` |
| `Cargo.toml` | Rust | `cargo check` | `cargo test --no-run` |
| `go.mod` | Go | `go build ./...` | `go test -c ./...` |
| `pom.xml` / `build.gradle` | Java | `mvn compile` / `./gradlew classes` | `mvn test` / `./gradlew test` |
| `requirements.txt` / `pyproject.toml` | Python | — | `python -m pytest` |

## スコア算出（evaluator-bootstrap）

```
score = ビルド成功(20) + 必須ファイル存在(20) + テスト通過率(60)
```

- **ビルド成功 20点**: ビルドコマンドの終了コード 0
- **必須ファイル存在 20点**: `srcFileCount > 0` かつ `hasEntrypoint == true`
- **テスト通過率 60点**: `passed / total × 60`（テストなし・失敗 → 0点）

## JSON ノードのテンプレート

bootstrap ノードは以下の薄いラッパーのみを持つ。

```js
async (state) => {
  process.env.SPRINT_CONTRACT = JSON.stringify(state.sprintContract ?? null);
  process.env.SPRINT_RESULT   = JSON.stringify(state.sprintResult   ?? null);
  const { execSync } = require('child_process');
  const content = execSync('npx tsx ../scripts/<phase>-bootstrap.ts',
    { encoding: 'utf8', timeout: 120000 });
  const { HumanMessage } = require('@langchain/core/messages');
  return { activeMessages: [new HumanMessage(content.trim())] };
}
```

`planner-bootstrap` のみ `activeMessages` でなく `taskSpec` を返す点に注意。
