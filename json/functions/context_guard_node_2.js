async (state) => {
  const LIMIT = 200000;
  const THRESHOLD = 140000;
  const msgs = state.messages || [];
  const active = state.activeMessages || [];
  const allMessages = msgs.concat(active);
  const tokens = allMessages.reduce((sum, msg) => {
    const raw = msg && msg.content;
    const c = typeof raw === 'string' ? raw : JSON.stringify(raw);
    return sum + Math.ceil((c || '').length / 4);
  }, 0);
  if (tokens < THRESHOLD) {
    return { activeMessages: msgs, estimatedContextTokens: tokens };
  }
  console.warn(
    '[ContextGuard] Estimated tokens: ' + tokens + ' exceeds threshold: ' + THRESHOLD +
    '. Performing context reset. (Reset count: ' + ((state.contextResetCount ?? 0) + 1) + ')'
  );
  const taskDesc = state.taskSpec ? (state.taskSpec.length > 200 ? state.taskSpec.substring(0, 200) + '...' : state.taskSpec) : null;
  const parts = [
    '=== Context Reset: 重要な状態の引き継ぎ ===',
    taskDesc ? 'タスク仕様: ' + taskDesc : null,
    state.sprintContract ? '現在のSprintContract: ' + JSON.stringify(state.sprintContract, null, 2) : null,
    state.sprintResult ? '前回の評価結果: ' + JSON.stringify(state.sprintResult, null, 2) : null,
    'リトライ回数: ' + (state.retryCount ?? 0),
    '=== 以上を引き継いで作業を継続してください ==='
  ].filter(Boolean).join('\n');
  const resetMsg = new HumanMessage(parts);
  return {
    activeMessages: [resetMsg],
    messages: [],
    taskSpec: taskDesc ? 'タスク: ' + taskDesc : '',
    estimatedContextTokens: Math.ceil(parts.length / 4),
    contextResetCount: (state.contextResetCount ?? 0) + 1,
    lastContextResetAt: new Date().toISOString()
  };
}