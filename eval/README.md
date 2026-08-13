# Eval — Workflow Skill Evaluation

ワークフローのスキル性能を `successRate`（0.0〜1.0）で計測・評価するためのハーネス。

## ディレクトリ構造

```
eval/
├── harness.ts          # 評価ハーネス（CLI + ライブラリ）
├── README.md
├── logs/               # 評価結果のJSONLログ（自動生成）
├── train/              # 訓練用タスクセット（reflect_nodeが学習に使う）
│   ├── teams/            # teams スキル用タスク（5件）
│   ├── arxiv-search/     # arxiv-search スキル用タスク（5件）
│   └── langgraph-docs/   # langgraph-docs スキル用タスク（5件）
└── holdout/            # 検証用タスクセット（Phase 4: Reward Hacking対策）
    ├── teams/            # teams スキル用タスク（3件）
    ├── arxiv-search/     # arxiv-search スキル用タスク（3件）
    └── langgraph-docs/   # langgraph-docs スキル用タスク（3件）
```

### train と holdout の違い

| | train | holdout |
|---|---|---|
| 用途 | reflect_nodeが学習に使う | 最終評価のみ（ループ中は非公開） |
| 件数 | 各スキル5件 | 各スキル3件 |
| 表現 | 標準的な言い回し | 異なる言い回し・やや難易度高め |

holdoutタスクはtrainと同じドメインだが異なる表現で記述する。これにより、SKILL.mdがtrainに過適合（Reward Hacking）していないかを検証できる。

## 使用方法

### CLI で実行

```bash
tsx eval/harness.ts --dir <タスクディレクトリ> --workflow <ワークフローJSON>
```

例：

```bash
# teams スキルの評価
tsx eval/harness.ts --dir eval/train/teams --workflow json/teams/leader-qwen.json

# arxiv-search スキルの評価
tsx eval/harness.ts --dir eval/train/arxiv-search --workflow json/arxiv-search/leader-qwen.json

# langgraph-docs スキルの評価
tsx eval/harness.ts --dir eval/train/langgraph-docs --workflow json/langgraph-docs/leader-qwen.json
```

### npm script で実行

```bash
yarn eval:train
```

`package.json` に `eval:train` スクリプトが登録してある。 teams スキルを対象に評価する。

### ライブラリとしてインポート

```typescript
import { runEval, evaluate, loadTaskFiles } from "./eval/harness.js";

// 評価を実行
const summary = await runEval(
  "eval/train/teams",
  "json/teams/leader-qwen.json"
);

console.log(summary.successRate); // 0.0 ~ 1.0
```

## 評価タイプ

タスクJSONの `evaluation.type` で評価方法を指定する。

### completion

出力が空でないかを判定。ワークフローが何らかの結果を返したかをチェック。

```json
{
  "skill": "teams",
  "input": "市場調査レポートを作成してください...",
  "evaluation": { "type": "completion", "minWorkers": 1 }
}
```

### count

出力内の番号付き項目の数を数え、指定数以上かを判定。

```json
{
  "skill": "arxiv-search",
  "input": "attention mechanismに関する論文を3件検索してください",
  "evaluation": { "type": "count", "expected": 3 }
}
```

### keyword

出力内に必須キーワードが全て含まれるかを判定。

```json
{
  "skill": "langgraph-docs",
  "input": "StateGraphの使い方を教えてください",
  "evaluation": { "type": "keyword", "keywords": ["StateGraph", "addNode", "compile"] }
}
```

## タスクファイルの追加

`eval/train/<skill>/` または `eval/holdout/<skill>/` 配下に JSON ファイルを追加する。ファイル名は `task_NNN.json` の形式が推奨。

### holdoutタスクの作成ガイドライン

- trainと同じドメインだが、異なる言い回し・異なるキーワードを使う
- train: `「attention mechanismに関する論文を3件検索してください」`
- holdout: `「graph transformer networksの最近の論文を4件探してください」`
- reflect_nodeはholdoutタスクを実行しない（学習に使用しない）

```json
{
  "skill": "<スキル名>",
  "input": "<ワークフローに渡すプロンプト>",
  "evaluation": {
    "type": "completion",
    "minWorkers": 1
  }
}
```

## 出力

### コンソール

```
=== Eval Summary ===
Total:    5
Passed:   3
Rate:     0.6

By skill:
  teams: 3/5

Results:
  [PASS] task_001 (teams) score=1.0 — Worker completed
  [FAIL] task_002 (teams) score=0.0 — No output from workers
```

### JSONL ログ

評価結果は `eval/logs/harness.jsonl` に追記される。1行1件、JSON 形式。

```json
{"taskId":"task_001","skill":"teams","passed":true,"score":1.0,"detail":"Worker completed — output length: 1234 chars"}
```

## Holdout 検証（Phase 4）

`scripts/autoresearch.ts` は N イテレーション完了後、自動的に holdout タスクセットで最終評価を実行する。

### Reward Hacking 検出シグナル

| シグナル | 閾値 | 対応 |
|---|---|---|
| train/holdout スコア乖離 | `trainScore - holdoutScore > 0.2` | 警告出力 |
| SKILL.md 肥大化 | 追記行数 > 50行/イテレーション | 警告出力 |
| 同じパターンの繰り返し追記 | git diffで3回以上重複 | 警告出力 |

### 結果処理

- holdoutスコアが改善 → `git commit`（SKILL.md確定）
- holdoutスコアが未改善 → `git checkout -- skills/`（全変更巻き戻し）

CLI フラグ `--holdout-eval-dir` で holdout ディレクトリを指定できる（デフォルト: `eval/holdout`）。

## AutoResearch（自己改善機能）

eval/harness.ts は AutoResearch 自己改善機能の**評価側**として使われます。改善の本体は `scripts/autoresearch.ts` にあります。

### 全体アーキテクチャ

```
autoresearch.ts（オーケストレータ）
  │
  ├─ 1. trainタスクを1件ランダムに選択
  │
  ├─ 2. WorkflowEngine を実行
  │     └─ planner → workers → aggregator → finalize → reflect_node
  │                                  ↑
  │                            reflect_node が SKILL.md に追記
  │
  ├─ 3. eval/harness.ts で successRate 計測
  │
  ├─ 4. スコア比較: 前回より悪ければ git checkout -- skills/（巻き戻し）
  │
  └─ 5. Nイテレーション後 → holdout で最終評価
        └─ holdout 改善 → git commit / 未改善 → 全巻き戻し
```

### reflect_node の役割

ワークフロー内のノードとして実装され、各イテレーションで SKILL.md を改善します。

**実装場所**: `json/teams/leader-qwen.json` の reflect_node（lines 127-144）

**動作**:
1. `workerPlans` と `workerResults` を分析
2. モデルに「どのパターンが有用だったか」を考察させる
3. 有用なパターンがあれば `edit_file` で `skills/teams/SKILL.md` に追記
4. 改善なしなら何もしない

**制約**: 既存内容は消さず「追記のみ」。`## Learned Patterns` セクションに `### YYYY-MM-DD -- Pattern Name` 形式で追加。

### スコアベースの選択

| 状態 | 行動 |
|---|---|
| successRate >= 前回 | 変更を保持、ベースライン更新 |
| successRate < 前回 | `git checkout -- skills/` で巻き戻し |
| holdout 改善 | `git commit`（SKILL.md確定） |
| holdout 未改善 | `git checkout -- skills/`（全変更巻き戻し） |

### Karpathy へのインスパイア

この設計は Karpathy 氏の「Memento-Skills」コンセプトにインスパイアされています。AIの論文改善プロセス（書く → 読む → 改善して書く）を、SKILL.md改善のループに落とし込んでいます。

## 設計方針

- `successRate` = `passedTasks / totalTasks`（0.0〜1.0）
- 全てのタスクがPASSしなくてもエラーにならない（訓練中の期待状態）
- ワークフローエンジン（`WorkflowEngine`）は1回だけ構築し、全タスクで共用
- スレッド分離のため `thread_id` をタスクごとにユニークにする
- train と holdout は同じドメイン・異なる表現で分離し、過適合を検出
