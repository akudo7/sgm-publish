# Plan タスク空問題 — 調査メモ

## 現象

`metadata.json` の全42runで `plan.tasks: []`。Verifyが検証対象を失う。

## 原因の推定

### 1. Structured Output Fallback が空を返す

`workflow.ts` の `_createResilientStructuredModel` (300-302行目):

```javascript
// All levels failed — return empty structured result so handler can use auto-detection
log.error(`[structured-output] All levels failed, returning empty default`);
return { tasks: [], gaps: [] };
```

3段階のfallback:
- **Level 1**: `withStructuredOutput` 直接呼び出し → 失敗
- **Level 2**: baseModel.invoke → JSON extraction → 失敗
- **Level 3**: strict prompt retry → 失敗
- **最終**: `{ tasks: [], gaps: [] }` を返す

### 2. Qwen3.6-35B-A3B の構造化出力能力

`plan_model` は LlamaCpp経由で `unsloth/Qwen3.6-35B-A3B` を使用。
このモデルが `jsonMode` による構造化出力に失敗し、Level 2/3でもJSON抽出できない場合、空のデフォルトが返る。

### 3. Spec 注入の条件

`plan.js` 21行目:
```javascript
const specMatch = (userMsg?.content || '').match(/([^\s'"]+\.(md|txt|json))/);
```

`TASK` 環境変数に `.md` / `.txt` / `.json` のファイルパスが含まれていないと spec 注入が失敗。
注入が失敗すると、モデルが仕様を知らずに計画を生成しようとする。

## 検証方法

```bash
# debugログ付きで実行
OUTPUT_DIR=/tmp/todo-app \
TASK='./spec.md に従って実装して下さい' \
LOOP_DEBUG_PLAN=1 \
LOOP_DEBUG_EXECUTE=1 \
LOOP_DEBUG_ROUTE=1 \
LOOP_DEBUG_VERIFY=1 \
npx tsx src/runner.ts 2>&1 | tee /tmp/loop-debug.log
```

`LOOP_DEBUG_PLAN=1` で出力されるログ:
- `[plan] Sending N messages to plan_model` — 入力メッセージ数
- `[plan] Last user message: ...` — 最初のuserメッセージのプレビュー
- `[plan] Calling model.invoke()...` — モデル呼び出し
- `[plan] model.invoke() returned: type=X, hasTasks=Y` — 返り値の型
- `[plan] Generated plan with N tasks` — 最終的なタスク数

## 修正案

### 案A: fallback を空にしない

`workflow.ts` の fallback を null を返すか、エラーを投げる:
```javascript
// 空のデフォルトではなく、handlerがauto-detectionに任せる
return { tasks: null }; // handlerがnullチェックして空planを返す
```

### 案B: Plan handler にデフォルトタスクを注入

specファイルが読み込めない場合でも、TASKプロンプトからタスクを抽出する:
```javascript
// plan.js — spec注入が失敗した場合のフォールバック
if (!specInjection) {
  // TASKプロンプトから基本的なタスクを生成
  specInjection = '\n\n【タスク指示】\n' + (userMsg?.content || '');
}
```

### 案C: モデルのstructured output出力を改善

`plan_model` の system prompt を改善し、Qwen3.6がjsonModeで正しく出力できるようにする。
