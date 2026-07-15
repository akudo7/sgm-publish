# Loop Engineering 調査レポート

**日付**: 2026-06-30
**対象**: `works/loop-engineering/` の実装 vs Loop-Engineering.md の提言

---

## 1. 調査目的

Loop-Engineering.md（Addy Osmani 他による Loop Engineering の定義書）で提言されている技術が、`works/loop-engineering/` の実装にどの程度適用されているか、また何が欠けているかを検証する。

---

## 2. 既に適用されているテクニック

### 2.1 Generator/Evaluator 分離

`loop-task.json` で 3つのモデルが役割別に定義されている:

- **`plan_model`** (temperature: 0.1) — 実行計画を生成
- **`execute_model`** (temperature: 0.3) — ツール実行（generator）
- **`verify_model`** (temperature: 0.1) — ギャップ検出（evaluator）

execute と verify で異なるモデルインスタンスを使用。構造的分離は完了。

### 2.2 Skills（永続知識）

`config.skills.enabled: true` で SkillsManager が初期化され、`bindSystemSkills: true` のモデルには Claude Code Tools がバインドされる。Skills は `SKILL.md` としてプロジェクトルートに配置可能。

### 2.3 Memory（ディスク上の状態）

`json/metadata.json` で全runの履歴を追記モードで保持。各runの plan, gaps, durationMs, error が記録される。

### 2.4 Structured Output

Plan ノードと Verify ノードの両方で JSON schema による構造化出力が適用されている。

---

## 3. 検証: Verify のエラー検知能力

### 3.1 bash_command ツールの戻り値

`src/lib/tools/claude-code-tools.ts` の `createBashTool` は、コマンド実行結果を ToolMessage content として返す:

- **成功時**: stdout のみを返す（exit code は含まれない）
- **失敗時**: `エラー (exit code <N>):\nSTDERR: ...\nSTDOUT: ...` の形式で exit code, stderr, stdout を含む

つまり `npm test` が fail した場合、ToolMessage content にはテスト結果（PASS/FAIL、exit code 1 など）が文字列として含まれる。

### 3.2 verify.js の自動判定ロジック

`works/loop-engineering/json/handlers/verify.js` の自動判定は 2 層:

**レイヤー1: ファイル作成の検知** (48-81行目)
```javascript
for (const task of planTasks) {
  const taskFiles = task.files ?? [];
  if (taskFiles.length > 0) {
    // writtenFiles に各ファイルが存在するかチェック
    const allFilesDone = taskFiles.every((fp) => writtenFiles.has(fp));
    if (!allFilesDone) {
      gaps.push({ task_id: taskId, description: "未完成: ..." });
    }
  }
}
```
`tool_calls` から `write_file` の呼び出しを抽出し、指定パスが実際に作成されたかチェック。

**レイヤー2: bash_command 実行の検知** (84-113行目)
```javascript
const testKeywords = ['npm test', 'jest', 'npm run test'];
const hasTestExec = executedCommands.some(cmd =>
  testKeywords.some(kw => cmd.includes(kw))
);
if (descLower.includes('test') && !hasTestExec) {
  gaps.push({ task_id: taskId, description: "テストコマンドが実行されていない" });
}
```
`tool_calls` から `bash_command` の呼び出しを抽出し、キーワードマッチで実行有無を判定。

**問題点**: `executedCommands` にはコマンド文字列のみが記録される。ToolMessage content（テスト結果のstdout/stderr/exit code）はチェックされない。`npm test` が実行されて exit code 1 で fail しても `hasTestExec = true` となり、gap が生成されない。

### 3.3 verify.js の LLM 判定ロジック

`verify.js` 169-207行目で `verify_model` に messages を投げて gaps を生成させる:

```javascript
let llmResult = { gaps: [] };
try {
  const response = await model.invoke(stripLastAi);
  // structured output から gaps を抽出
  llmResult = response;
} catch { /* fallback: empty gaps */ }

// 自動判定 + LLM判定をマージ
const mergedGaps = [
  ...gaps,
  ...(llmResult.gaps || []).filter((g) => !autoGapKeys.has(g.task_id)),
];
```

LLMは messages の ToolMessage content を読むことができるが:
- `verify_model` の system prompt は中立的（"実際にファイルが作成されたか、コマンドが成功したかを確認する"）
- adversarial ではない（論文が求める "ASSUME: BROKEN until proven otherwise" ではない）
- messages の最新10件に制限されている（127-159行目）

### 3.4 routeDecide.js の分岐

```javascript
const realGaps = gaps.filter(g => g && typeof g === 'object' && Object.keys(g).length > 0);
return realGaps.length > 0 ? 'plan_node' : '__end__';
```

空文字・null・空オブジェクトをフィルタ。実質的な gap があれば Plan に戻る。

### 3.5 metadata.json の現実

全42runで `plan.tasks: []`, `gaps: []`。Planが空タスクを返しているため、Verifyには検証対象がない。

---

## 4. 欠けているテクニック

| # | 論文の提言 | 現状 | 必須度 |
|---|---|---|---|
| 1 | Worktreeによる並列分離 | 未実装（OUTPUT_DIRで手動分離可能） | 低い（単一エージェントなので） |
| 2 | Verifyの「行動」 | **部分的** — ToolMessage contentのexit code/PASS判定がない | **中** |
| 3 | Human Review Checkpoint | 未実装（ループ外の手動runのみ） | 低い（手動runで代替可能） |
| 4 | Token Cap | 未実装（recursionLimitのみ） | 低い（ローカルLLMなので） |
| 5 | Adversarial Evaluator | 中立的なsystem prompt | 低〜中 |

---

## 5. Plan 空タスク問題 — 原因特定

### 5.1 現象

`metadata.json` の全42runで `plan.tasks: []`。

### 5.2 `_createResilientStructuredModel` の3段階fallback

`src/lib/workflow.ts` の `_createResilientStructuredModel` (47-350行目) は、モデルの構造化出力失敗時に3段階のfallbackを実装している。

**Level 1: `withStructuredOutput` + `jsonMode`** (65-70行目)

```javascript
const isNonGpt = modelName.length > 0 && !modelName.startsWith("gpt-");
if (isNonGpt) {
  structured = baseModel.withStructuredOutput(schema, { method: "jsonMode" as any });
}
```

Qwen3.6-35B-A3B は非GPTモデルなので `jsonMode` を使用する。`jsonMode` がモデルの出力からJSONを抽出できない場合、例外を投げてLevel 2へ。

**Level 2: baseModel.invoke + `extractJson`** (269-282行目)

```javascript
let rawResponse = await invokeWithoutTools(input);
const text = responseToText(rawResponse);
const parsed = extractJson(text);
```

`extractJson` (104-153行目) の処理順序:
1. `JSON.parse(cleaned)` — 直接パース
2. thinkingブロック削除 (`<think>...</think>`)
3. XML tool call フラグメント削除 (`<tool_call>`, `<function=...>`)
4. markdown fence 削除 (` ```json ... ``` `)
5. `{ ... }` brace matching

**問題**: 日本語テキストを削除するロジックがない。モデルが日本語混じりの出力を返すと、`JSON.parse` は失敗し、brace matching も `{` と `}` を正しく認識できない。

**Level 3: strict prompt retry + `extractJson`** (284-298行目)

```javascript
const STRICT_SUFFIX = "\n\n=== CRITICAL OUTPUT FORMAT RULE ===\n...";
```

`STRICT_SUFFIX` (198行目) の内容:
```
- NO Japanese text, NO natural language
- NO explanations, NO greetings, NO reasoning
- The very first character MUST be { and the very last MUST be }
```

**致命的な矛盾**:

`plan_model` の system prompt (`loop-task.json` 75行目):
```
あなたは実行計画を生成するエージェントです。
【絶対守るルール】
- 出力はJSONのみ。マークダウンコードブロックは一切不要
- 前後のテキスト、挨拶、説明を付けない
- 純粋なJSON文字列だけで開始と終了をする
```

system prompt は **日本語** で記述され、strict suffix は **日本語を禁止** している。モデルが system prompt に則って日本語で応答しようとすると strict suffix に矛盾し、出力が壊れる。`extractJson` は日本語をクリーンアップできないため、Level 3でもパース失敗。

**All levels failed → 空デフォルト** (300-302行目)

```javascript
log.error(`[structured-output] All levels failed, returning empty default`);
return { tasks: [], gaps: [] };
```

3段階全部失敗すると、**空のデフォルト**が返る。これが `plan.tasks: []` の正体。

### 5.3 原因の特定

```
plan_model system prompt (日本語)
    ↓
withStructuredOutput(jsonMode) → JSON抽出失敗 → Level 1 fail
    ↓
baseModel.invoke → 日本語混じり出力 → extractJson失敗 → Level 2 fail
    ↓
strict prompt retry → 日本語禁止とsystem promptの矛盾 → 出力壊滅 → Level 3 fail
    ↓
{ tasks: [], gaps: [] } ← metadata.json に記録
```

### 5.4 修正案

**案A: strict suffix から日本語禁止を削除**

```javascript
// 変更前
const STRICT_SUFFIX = "...NO Japanese text, NO natural language...";

// 変更後
const STRICT_SUFFIX = "...NO natural language explanations...";
```

**案B: system prompt と strict suffix の言語を統一**

両方を英語にするか、両方を日本語にする。

**案C: extractJson に日本語クリーンアップを追加**

```javascript
// thinking/XML削除の後に追加
cleaned = cleaned.replace(/[　-鿿㐀-䶿]/g, ""); // 日本語文字削除
```

---

## 6. 提案: Verify の自動判定強化

`verify.js` で `tool_calls` だけでなく `ToolMessage` の content を解析する:

```javascript
// 現在: tool_calls からコマンド文字列だけを取得
// 改善: ToolMessage content から exit code / PASS / FAIL を検知
const toolResults = {};
for (const msg of state.messages) {
  if (msg.tool_call_id && msg.content) {
    toolResults[msg.tool_call_id] = msg.content;
  }
}

// bash_command の結果に "エラー (exit code" や "FAIL" が含まれるかチェック
for (const [callId, content] of Object.entries(toolResults)) {
  const isFailure = content.includes('エラー (exit code') ||
                    content.includes('FAIL') ||
                    content.includes('failed');
  // 失敗があれば gap を生成
}
```

これにより、`npm test` が実行されて fail した場合でも Verify が gap を検知し、Plan が再生成される。

---

## 7. 参考文献

- `works/loop-engineering/Loop-Engineering.md` — Loop Engineering 定義書
- `works/loop-engineering/json/loop-task.json` — ワークフロー定義
- `works/loop-engineering/json/handlers/verify.js` — Verify ハンドラ
- `works/loop-engineering/json/handlers/routeDecide.js` — 分岐ハンドラ
- `works/loop-engineering/json/handlers/plan.js` — Plan ハンドラ
- `src/lib/tools/claude-code-tools.ts` — bash_command ツール実装
- `src/lib/workflow.ts` — WorkflowEngine 実装 (`_createResilientStructuredModel`)

### 5.1 自己修正ループとしての機能

理論的には機能する構造を持っている:

```
Plan → Execute → Tools → Execute → Verify → routeDecide → (gaps有) → Plan → ...
```

- Planがタスクを生成
- Executeがツールで実行
- Verifyが自動判定（ファイル存在チェック + コマンド実行有無）とLLM判定（messages contentの解釈）でgapを検出
- routeDecideがgapの有無で分岐

### 5.2 現在の主要問題

**Planが空タスクを返している**。`metadata.json` の全runで `plan.tasks: []`。これが根本原因で、Verifyが検証対象を失い、gapsが空になる。

### 5.3 修正すべき箇所

1. **Planノードの出力** — 空タスクを返す理由の調査（モデルのsystem prompt、構造化出力のschema、メッセージの注入方法）
2. **Verifyの自動判定** — ToolMessage contentのstdout/stderr/exit codeを解析し、テスト結果のPASS/FAILを検知するロジックを追加

---

## 6. 提案: Verify の自動判定強化

`verify.js` で `tool_calls` だけでなく `ToolMessage` の content を解析する:

```javascript
// 現在: tool_calls からコマンド文字列だけを取得
// 改善: ToolMessage content から exit code / PASS / FAIL を検知
const toolResults = {};
for (const msg of state.messages) {
  if (msg.tool_call_id && msg.content) {
    toolResults[msg.tool_call_id] = msg.content;
  }
}

// bash_command の結果に "エラー (exit code" や "FAIL" が含まれるかチェック
for (const [callId, content] of Object.entries(toolResults)) {
  const isFailure = content.includes('エラー (exit code') ||
                    content.includes('FAIL') ||
                    content.includes('failed');
  // 失敗があれば gap を生成
}
```

これにより、`npm test` が実行されて fail した場合でも Verify が gap を検知し、Plan が再生成される。

---

## 7. 参考文献

- `works/loop-engineering/Loop-Engineering.md` — Loop Engineering 定義書
- `works/loop-engineering/json/loop-task.json` — ワークフロー定義
- `works/loop-engineering/json/handlers/verify.js` — Verify ハンドラ
- `works/loop-engineering/json/handlers/routeDecide.js` — 分岐ハンドラ
- `src/lib/tools/claude-code-tools.ts` — bash_command ツール実装
- `src/lib/workflow.ts` — WorkflowEngine 実装
