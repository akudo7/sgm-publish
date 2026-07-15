/**
 * Route from execute → tools or verify.
 *
 * ループ検出: execute→tools→execute が MAX_ITERATIONS 回を超えたら
 * 強制的に verify へ遷移させる。
 */

const MAX_ITERATIONS = 15;
const loopCount = state.loop_count ?? 0;

const lastMessage = state.messages[state.messages.length - 1];
const hasToolCalls = lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0;

if (process.env.LOOP_DEBUG_ROUTE === '1') {
console.error(`[routeExecute] DEBUG: loop_count=${loopCount}, lastMsgType=${lastMessage?.type || lastMessage?._getType?.() || lastMessage?.role}, hasToolCalls=${hasToolCalls}, totalMessages=${state.messages.length}`);
console.error(`[routeExecute] DEBUG: lastMsg content preview: ${(lastMessage?.content || '').toString().slice(0, 100)}`);
}

// ループ上限超過 → 必ず verify へ（agent が「完了」と判断するのを待つ）
if (loopCount >= MAX_ITERATIONS) {
  if (process.env.LOOP_DEBUG_ROUTE === '1') {
  console.error(`[routeExecute] DEBUG: -> verify (loop limit ${loopCount}>=${MAX_ITERATIONS})`);
  }
  return 'verify';
}

// execute が tool call を返した → tools で実行
if (hasToolCalls) {
  if (process.env.LOOP_DEBUG_ROUTE === '1') {
  console.error(`[routeExecute] DEBUG: -> tools (tool_calls=${lastMessage.tool_calls.length})`);
  }
  return 'tools';
}

if (process.env.LOOP_DEBUG_ROUTE === '1') {
console.error(`[routeExecute] DEBUG: -> verify (no tool calls)`);
}
// tool call がなければ verify へ（execute が完了を宣言 or 停止）
return 'verify';
