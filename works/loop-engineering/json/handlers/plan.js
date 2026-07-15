/**
 * Plan handler — 構造化出力で実行計画を生成する。
 *
 * structuredOutput schema (loop-task.json) を基にフレームワークが withStructuredOutput を自動適用。
 * model.invoke() の返り値は既にパース済みオブジェクト。
 *
 * Fallback: モデルがマークダウンコードブロック (```json / ```bash) を返した場合、
 *            内容から JSON を抽出してパースし直す。
 */

const outputDir = process.env.OUTPUT_DIR ?? 'results/';

// TASK メッセージ中のファイルパス（.md 等）を検出して内容を注入する。
// plan_model はツールを持たないため、spec ファイルを自力で読めない。
// この注入によりモデルが仕様全文を元に計画を生成できるようになる。
const fs = require('fs');
const userMsg = state.messages.find(m => {
  const t = m?._getType?.() || m?.type || m?.role || '';
  return t === 'user' || t === 'human';
});
const specMatch = (userMsg?.content || '').match(/([^\s'"]+\.(md|txt|json))/);
let specInjection = '';
if (specMatch) {
  const specPath = specMatch[1];
  try {
    if (fs.existsSync(specPath)) {
      specInjection = '\n\n【仕様書全文】\n' + fs.readFileSync(specPath, 'utf-8');
    }
  } catch { /* 読み取り失敗は無視 */ }
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  // Try direct parse first
  try { return JSON.parse(trimmed); } catch {}

  // Strip markdown code fences: ```json ... ``` or ```bash ... ```
  const fenceMatch = trimmed.match(/^```(?:json|bash|js)?\s*\n([\s\S]*?)\n\s*```$/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // Find first { ... } block
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)); } catch {}
  }

  return null;
}

// assistant/AI メッセージをフィルタ（_getType で判定: 'ai'/'assistant'）
// LlamaCpp は末尾の assistant メッセージを prefill として使い、thinking と競合する
// 過去の tool メッセージも積み上がりを防止するため制限
const MAX_TOOL_MSGS = 10;
const aiTypes = new Set(['ai', 'assistant']);
const toolMsgs = [];
const otherMsgs = [];
for (const m of state.messages) {
  const t = m?._getType?.() || m?.type || m?.role || '';
  if (t === 'tool') {
    toolMsgs.push(m);
  } else if (!aiTypes.has(t)) {
    otherMsgs.push(m);
  }
}
// spec 内容を最初の user/human メッセージに追記（初回 plan のみ効果的）
const baseMessages = [...otherMsgs, ...toolMsgs.slice(-MAX_TOOL_MSGS)];
const cleanMessages = specInjection
  ? baseMessages.map((m, i) => {
      if (i !== 0) return m;
      const t = m?._getType?.() || m?.type || m?.role || '';
      if (t !== 'user' && t !== 'human') return m;
      return { ...m, content: (m.content || '') + specInjection };
    })
  : baseMessages;

if (process.env.LOOP_DEBUG_PLAN === '1') {
console.error(`[plan] state.plan=${JSON.stringify(state.plan ? {tasks: state.plan.tasks.length} : null)}, state.gaps=${JSON.stringify(state.gaps ? {count: state.gaps.length} : null)}, state.loop_count=${state.loop_count}`);
console.error(`[plan] Sending ${cleanMessages.length} messages to plan_model (assistant filtered)`);
console.error(`[plan] Last user message: ${(cleanMessages.filter(m=>m.role==='user').pop()?.content || '').toString().slice(0, 200)}`);
}

// withStructuredOutput はフレームワークがノード定義から自動適用
// model.invoke() の返り値は { tasks: [...] } 形式のオブジェクト
if (process.env.LOOP_DEBUG_PLAN === '1') {
console.error(`[plan] Calling model.invoke()...`);
}
const response = await model.invoke(cleanMessages);
if (process.env.LOOP_DEBUG_PLAN === '1') {
console.error(`[plan] model.invoke() returned: type=${typeof response}, hasTasks=${Array.isArray(response?.tasks)}`);
}

// 返り値がオブジェクトでない場合は fallback（モデルがマークダウンを返した場合用）
let plan = response && typeof response === 'object' && Array.isArray(response.tasks) ? response : null;
if (!plan && typeof response === 'string') {
  if (process.env.LOOP_DEBUG_PLAN === '1') {
    console.error('[plan] Fallback: extracting JSON from model string response');
  }
  plan = extractJson(response);
}

if (!plan) {
  if (process.env.LOOP_DEBUG_PLAN === '1') {
  console.error('[plan] WARNING: structured output not returned, returning null');
  }
}

if (process.env.LOOP_DEBUG_PLAN === '1') {
console.error(`[plan] Generated plan with ${plan?.tasks?.length ?? 0} tasks`);
}

// 計画を HumanMessage として state.messages に追加
const planMsg = new HumanMessage({
  content: '【計画】\n' + JSON.stringify(plan, null, 2) + '\n\n' +
    '【作業ディレクトリ】\n' + outputDir
});

// 構造化出力結果を AIMessage として state に追加
const aiMsg = new AIMessage({
  content: JSON.stringify(plan, null, 2),
  additional_kwargs: { structured_output: plan },
});

// plan フィールドに全体オブジェクトを返す（reducer: (x,y)=>y）
return { messages: [aiMsg, planMsg], plan: plan, loop_count: state.loop_count ?? 0 };
