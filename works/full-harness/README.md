# Full Harness

Sprint Contract + Context Reset + Environment Bootstrapping による長時間安定実行のテスト環境。

---

## 概要

このワークフローは、LLM を用いた自律的実装・評価ループを実現する。

1. **Planner**: 環境スナップショットに基づき実装仕様(taskSpec)を生成
2. **Negotiator**: taskSpec とフィードバックから SprintContract を策定
3. **Generator**: SprintContract に基づき実装を実行
4. **Evaluator**: 実装を SprintContract.successCriteria に基づき評価
5. **Router**: 評価結果に応じてリトライ or 終了 or フィードバックループ
6. **Context Guard**: コンテキストサイズ閾値超過時にリセット実行

---

## アーキテクチャ

```
__start__
  ↓
bootstrap_planner_node ── 環境スナップショット収集
  ↓
planner_node ──────────── LLM による taskSpec 生成
  ↓
bootstrap_generator_node ─ 実装前コンテキスト準備
  ↓
negotiate_node ────────── LLM による SprintContract 策定
  ↓
generator_node ────────── LLM による実装実行
  ↓
bootstrap_evaluator_node ─ 評価前コンテキスト準備
  ↓
evaluator_node ────────── LLM による評価実行
  ↓
router_node ───────────── 条件分岐
  ├─ sprintResult === null → generator_node（再実装）
  ├─ sprintResult.passed === true → __end__（成功）
  ├─ retryCount >= 3 → __end__（失敗）
  └─ それ以外 → bootstrap_feedback_node（フィードバック）
      ↓
bootstrap_feedback_node ── フィードバック収集
  ↓
context_guard_node ────── コンテキストサイズ判定
  ↓
negotiate_node（ループ）
```

**モデル**: unsloth/Qwen3.6-35B-A3B（llama.cpp, `http://localhost:8001`）
**recursionLimit**: 150
**Context Guard**: 200,000トークン / 0.70 しきい値

---

## 使用方法

### 事前準備

```bash
# llama.cpp サーバーを起動
llama-server -m <model_path> --port 8001 --parallel 3
```

### 実行

```bash
# 通常実行
npx tsx works/full-harness/run.ts

# タスク指定
TASK="新しいAPIエンドポイントを追加してください" npx tsx works/full-harness/run.ts

# 最大スプリント数指定
MAX_SPRINTS=10 npx tsx works/full-harness/run.ts

# 途中再開（SEED_FROM で前回実行の results/ を指定）
SEED_FROM=works/full-harness/results npx tsx works/full-harness/run.ts
```

### 結果

`results/` ディレクトリに保存される：

- `metadata.json` — 実行メタデータ
- `status.json` — 実行中のスプリント進行状況（逐次更新）
- `run_output.log` — メッセージログ（直近50件）

**status.json** は各スプリント完了時に自動更新される。中断・再開時は `SEED_FROM` でこのディレクトリを指定すると、直前のスプリント番号・フィードバックをシードして続きから実行する。

### 途中再開

ワークフローは単一 `invoke()` で完結するため、本来は途中から始められない。`SEED_FROM` は前回実行の state をシードし、bootstrap ノードから再生成して router 分岐で本来のパスに合流させる。

```bash
# 1回目の実行
npx tsx works/full-harness/run.ts

# 中断後、同じ results/ から再開
SEED_FROM=works/full-harness/results npx tsx works/full-harness/run.ts
```

---

## アーキテクチャ：bootstrap スクリプト化

bootstrap ノードのロジックは `works/full-harness/scripts/` の TypeScript スクリプトに抽出されている。
JSON ノードはスクリプトを呼ぶだけの薄いラッパー（約 15 行）。

```
works/full-harness/
├── scripts/
│   ├── planner-bootstrap.ts    ← bootstrap_planner_node
│   ├── generator-bootstrap.ts  ← bootstrap_generator_node
│   ├── evaluator-bootstrap.ts  ← bootstrap_evaluator_node
│   └── feedback-bootstrap.ts   ← bootstrap_feedback_node
└── full-harness-workflow.json  ← 各 bootstrap ノードは npx tsx ../scripts/*.ts を呼ぶのみ
```

`skills/harness-bootstrap/SKILL.md` にパターン定義（言語検出ルール・スコア重み付け・環境変数仕様）を記載。

**削減効果**: bootstrap ノード合計 11,023 文字 → 2,456 文字（**-78%**）、JSON 全体で **-46%**

スクリプトへの state 注入は環境変数で行う：

| 変数 | 型 |
|------|----|
| `TASK_SPEC` | string |
| `SPRINT_CONTRACT` | JSON \| null |
| `SPRINT_RESULT` | JSON \| null |

---

## スコア算出ロジック

`evaluator_node` が返す `sprintResult.score`（0〜100）は以下の重み付けで算出される。

| 条件 | 配点 | 判定方法 |
|------|------|---------|
| ビルド成功 | 20点 | `yarn build` / `tsc --noEmit` の終了コード |
| 必須ファイル存在 | 20点 | `src/` 以下の `.ts`/`.js` 等が 1件以上 かつ `index.*`/`main.*`/`app.*` が存在する |
| テスト通過率 | 最大60点 | `passed / total × 60`（テストなし・実行失敗 → 0点） |

**言語検出は `skills/env-bootstrap` に準拠。** `bootstrap_evaluator_node` が `package.json` / `Cargo.toml` / `go.mod` / `pom.xml` / `requirements.txt` の存在から言語を特定し、言語固有のビルド・テストコマンドを実行する。

```
score = ビルド成功(20) + 必須ファイル存在(20) + テスト通過率(60)
```

score は現時点では `status.json` / `metadata.json` への記録と、`bootstrap_feedback_node` 経由で generator へのフィードバックに使用される。ルーティング（継続/終了の判定）は `passed` フラグのみで行う。

---

## よくある警告

### `⚠️ Graph.compile: checkpointerが未設定`

起動時に表示される情報ログ。**エラーではなく、動作に影響しない。**

checkpointer は「ワークフローの途中中断・再開（`interrupt`）」や「スレッドをまたいだ状態永続化」に必要な機能。full-harness は `run.ts` の1回の実行で完結する single-shot ワークフローであるため不要。

実行間の状態引き継ぎは `SEED_FROM` 環境変数で前回実行の `results/` を指定し `metadata.json` から手動ロードする設計になっている。ワークフロー JSON に `checkpointer` を追加する必要はない。

---

## 型定義

`full-harness.lib.ts` で純粋関数・型定義を公開：

- `SprintContract` — スプリント契約
- `SprintResult` — 評価結果
- `RunMetadata` — 実行メタデータ
- `routeSprint()` — ルーター判定（テスト可能）
- `checkContextReset()` — Context Guard 判定（テスト可能）
- `parseSprintContract()` — SprintContract パーサー
- `parseSprintResult()` — SprintResult パーサー

---

## テスト

```bash
# works/full-harness 内で実行
npx jest

# またはプロジェクトルートから
npx jest works/full-harness
```
