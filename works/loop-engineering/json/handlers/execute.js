/**
 * Execute handler — 計画に従ってツールを実行する。
 *
 * systemPrompt は loop-task.json の execute ノード設定から
 * workflow.ts がメッセージ先頭に注入する。
 *
 * 計画と作業ディレクトリは plan_node が user メッセージとして state.messages に追加済み。
 * ループカウンターをインクリメントして、routeExecute が上限を検出できるようにする。
 */

// assistant/AI メッセージをフィルタ（_getType で判定: 'ai'/'assistant'）
// LlamaCpp は末尾の assistant メッセージを prefill として使い、thinking と競合する
// ツール結果の積み上がり防止: 最新の tool メッセージを最大 10 件に制限
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
const recentToolMsgs = toolMsgs.slice(-MAX_TOOL_MSGS);
const cleanMessages = [...otherMsgs, ...recentToolMsgs];
if (process.env.LOOP_DEBUG_EXECUTE === '1') {
console.error(`[execute] DEBUG: loop_count=${state.loop_count}, cleanMsgs=${cleanMessages.length}, lastMsg=${cleanMessages[cleanMessages.length-1]?.type || cleanMessages[cleanMessages.length-1]?._getType?.() || cleanMessages[cleanMessages.length-1]?.role}`);
console.error(`[execute] Calling model.invoke()...`);
}
const response = await model.invoke(cleanMessages);
if (process.env.LOOP_DEBUG_EXECUTE === '1') {
console.error(`[execute] DEBUG: response type=${response?.type || response?._getType?.() || response?.role}, hasToolCalls=${!!response?.tool_calls}, toolCallsCount=${response?.tool_calls?.length || 0}`);
if (response?.tool_calls) {
  console.error(`[execute] tool_calls: ${response.tool_calls.map(tc => tc.function?.name || tc.name || '?')}`);
}
}

// ループカウンターをインクリメント
const newLoopCount = (state.loop_count ?? 0) + 1;

return { messages: [response], loop_count: newLoopCount };
