async (state) => {
  const guard = state.guard_result || {};
  const leakScore = state.leak_score ?? 0;
  // leak_score=1 → LLM審査で漏洩検出 → 即エスカレーション
  if (leakScore >= 1) return 'escalate_node';
  if (!guard.safe) return 'escalate_node';
  if (state.close) return '__end__';
  if (state.turn_count >= 6) return 'escalate_node';
  const qs = state.quality_score || {};
  if (qs.accuracy >= 3 && qs.usefulness >= 3 && qs.clarity >= 3) return '__end__';
  return 'respond_node';
}
