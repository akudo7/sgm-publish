async (state) => {
  const LIMIT = 200000;
  const THRESHOLD = LIMIT * 0.70;
  const tokens = ((state.messages || []).concat(state.activeMessages || [])).reduce((sum, msg) => {
    const c = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return sum + Math.ceil(c.length / 4);
  }, 0);
  if (tokens < THRESHOLD) {
    return { estimatedContextTokens: tokens };
  }
  console.warn('[ContextGuard] Estimated tokens: ' + tokens + ' exceeds threshold: ' + THRESHOLD + '. Performing context reset.');
  const parts = [
    '=== Context Reset: 重要な状態の引き継ぎ ===',
    state.taskSpec ? 'タスク仕様: ' + state.taskSpec : null,
    state.sprintContract ? '現在のSprintContract: ' + JSON.stringify(state.sprintContract, null, 2) : null,
    state.sprintResult ? '前回の評価結果: ' + JSON.stringify(state.sprintResult, null, 2) : null,
    'リトライ回数: ' + (state.retryCount ?? 0),
    '=== 以上を引き継いで作業を継続してください ==='
  ].filter(Boolean).join('\n');
  // HumanMessage is already injected via globalScope
  return {
    activeMessages: [new HumanMessage(parts)],
    messages: [],
    estimatedContextTokens: Math.ceil(parts.length / 4),
    contextResetCount: (state.contextResetCount ?? 0) + 1,
    lastContextResetAt: new Date().toISOString()
  };
}