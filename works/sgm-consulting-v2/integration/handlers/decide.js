async (state) => {
  const leakScore = state.leak_score ?? 0;
  console.log('[decide] turn_count:', state.turn_count, '| close:', state.close, '| leak_score:', leakScore, '| guard:', JSON.stringify(state.guard_result));
  return { close: state.close || false, leak_score: leakScore };
}
