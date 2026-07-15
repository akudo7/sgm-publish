# Loop Engineering

LLM エージェントによる Plan → Execute → Verify → Gap の反復ループで、自律的にタスクを完遂するワークフローエンジン。

## 実装目的

LangGraph を基盤とした State Graph で、LLM エージェントを反復ループさせ、自律的にタスク実行・検証・ギャップ解消を行う。

1. **Plan**: エージェントに実行計画（JSON）を生成させる
2. **Execute**: 計画に従ってエージェントがファイル作成・コマンド実行を行う
3. **Verify**: エージェントに計画と結果のギャップを検出させる
4. **Decide**: ギャップがあれば Plan に戻る、なければ終了

各反復の plan / gaps は `json/metadata.json` に追記され、デバッグ時に過去の計画履歴を参照できる。

## ディレクトリ構成

```
loop-engineering/
├── src/
│   └── runner.ts          # Runner — ワークフローのロード・実行・メタデータ管理
├── json/
│   ├── loop-task.json     # ワークフロー定義（ノード・エッジ・モデル・状態アノテーション）
│   └── handlers/
│       ├── plan.js        # Plan ノード — 実行計画を生成
│       ├── execute.js     # Execute ノード — 計画に従ってタスク実行
│       ├── verify.js      # Verify ノード — ギャップを検出
│       ├── routeExecute.js # Execute 後の分岐 — tool か execute か
│       └── routeDecide.js  # Decide 後の分岐 — plan_node か __end__ か
├── __tests__/
│   └── metadata.test.ts   # metadata.json 更新のユニットテスト
├── json/
│   └── metadata.json      # 全 run の履歴（追記モード、固定場所）
├── results/               # Runner の出力ディレクトリ（エージェント作業用）
├── spec.md                # プロジェクト仕様（デフォルトプロンプト）
└── README.md
```

## 実行方法

### Runner

```bash
pkill -f "tsx src/runner.ts"
cd /home/akudo/Desktop/Work/SceneGraphManager/works/loop-engineering
rm -rf /tmp/todo-app

# 基本実行
LOOP_DEBUG_PLAN=0 LOOP_DEBUG_EXECUTE=0 LOOP_DEBUG_ROUTE=1 LOOP_DEBUG_VERIFY=1 LOOP_DEBUG_TOOLS=0 \
OUTPUT_DIR=/tmp/todo-app \
TASK='/home/akudo/Desktop/Work/SceneGraphManager/works/loop-engineering/spec.md に従って実装して下さい' \
npx tsx src/runner.ts

OUTPUT_DIR=/tmp/todo-app \
TASK='- `GET /todos/:id` — TODO 個別取得 \
-- レスポンス: `{ "id": number, "title": string, "done": boolean }` を/tmp/todo-app に追加して下さい。' \
npx tsx src/runner.ts


# カスタムワークフロー
WORKFLOW_FILE=custom-workflow.json \
OUTPUT_DIR=/tmp/output \
TASK='タスク説明' \
npx tsx src/runner.ts
```

環境変数:

| 変数 | 説明 | デフォルト |
|---|---|---|
| `TASK` | エージェントに渡すタスク | `''` |
| `OUTPUT_DIR` | 出力ディレクトリ（エージェントの作業用） | `results/` |
| `WORKFLOW_FILE` | ワークフロー JSON ファイル | `json/loop-task.json` |
| `LOOP_DEBUG_PLAN` | `1` を設定すると plan ノードのデバッグログを出力 | — |
| `LOOP_DEBUG_EXECUTE` | `1` を設定すると execute ノードのデバッグログを出力 | — |
| `LOOP_DEBUG_VERIFY` | `1` を設定すると verify ノードのデバッグログを出力 | — |

### テスト

```bash
# metadata.json のユニットテスト（__tests__/）
cd /home/akudo/Desktop/Work/SceneGraphManager
./node_modules/.bin/jest works/loop-engineering/__tests__/metadata.test.ts \
  --testPathIgnorePatterns=[] \
  --config='{"transform":{"^.+\\.ts$":"ts-jest"}}'
```

11 テスト:

| Describe | Test | 検証内容 |
|---|---|---|
| `loadMeta` | 存在しないファイル | 空の runs + latestRunIndex: -1 |
| `loadMeta` | 破損ファイル | 再生成して空を返す |
| `loadMeta` | 正しい JSON | 内容がそのまま戻る |
| `saveMeta / loadMeta` | roundtrip | save → load で同じ内容 |
| `startRun` | 空 meta | run が 1 つ追記される |
| `startRun` | 既存 completed | 上書きされず追記 |
| `startRun` | 既存 running | 既存が failed に、新規追記 |
| `completeRun` | running → completed | plan / gaps / duration が更新 |
| `completeRun` | 複数 run 中 | latestRunIndex のみ更新 |
| `failRun` | running → failed | error メッセージが記録 |
| `end-to-end` | 2 回実行 | ディスク上の metadata.json で 2 run 保持 |

## metadata.json の構造

追記モード。各 run が履歴として残る。

```jsonc
{
  "runs": [
    {
      "runId": "run-1782136784845-0pdx9p",
      "startedAt": "2026-06-22T13:59:44.845Z",
      "completedAt": "2026-06-22T14:05:29.318Z",
      "status": "failed",            // "running" | "completed" | "failed"
      "plan": [                      // 全反復の plan 履歴（配列）
        { "tasks": [...] },
        { "tasks": [...] }
      ],
      "gaps": [                      // 全反復の gaps 履歴（配列）
        ["missing build step"],
        ["incomplete tests"]
      ],
      "durationMs": 300000,
      "error": "Recursion limit reached..."  // status: "failed" の場合
    }
  ],
  "latestRunIndex": 0
}
```

## 現状の問題

### 1. Recursion Limit に到達して無限ループする

`recursionLimit: 100` で、Verify → routeDecide → gaps 有無で Plan / __end__ に分岐するループが 100 回で制限される。

```
Recursion limit of 100 reached without hitting a stop condition.
```

**対応案**:
- `recursionLimit` を増やす（200〜300）
- Verify の gap 検出ロジックを強化し、真の未完成のみを gap としてカウントする
- Execute の bash_command 実行で `mkdir -p` 等の失敗を gap として検出し、停止条件にする

### 2. `plan` の reducer 変更による互換性

`plan` の型を `object` から `object[]` に変更し、reducer を `(_, y) => y`（上書き）から `(x, y) => x.concat(y)`（追記）に変更した。既存の handler が object を返す限り動作するが、handler 側で配列を期待している場合は修正が必要。

### 3. `routeDecide.js` の分岐

```js
// routeDecide.js
const gaps = state.gaps || [];
return gaps.length > 0 ? 'plan' : '__end__';
```

gaps が空の配列でも `gaps.length > 0` は false になり、`__end__` に遷移する。gaps に空文字や null が混入すると false negative になる可能性がある。

## 関連ドキュメント

- [investigation-report.md](investigation-report.md) — Loop-Engineering.md 提言 vs 実装の比較調査レポート
- [plan-debug-investigation.md](plan-debug-investigation.md) — Plan タスク空問題の原因調査メモ

## 依存

- `@anthropic-ai/sdk` — Anthropic API
- `@langchain/langgraph` — State Graph エンジン
- `@langchain/core` — BaseMessage, ToolNode
- `langchain` — LLM インテグレーション
- `@types/node` — TypeScript 型定義
- `tsx` — TypeScript 実行環境
- `@types/jest` + `ts-jest` — テスト

SGM（SceneGraphManager）の `WorkflowEngine` を経由して LangGraph をラップしている。
