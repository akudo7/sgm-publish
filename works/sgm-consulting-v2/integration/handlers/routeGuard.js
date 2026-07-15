async (state) => {
  if (state.escalated) return 'escalate_node';
  const guard = state.guard_result || {};
  if (!guard.safe && (state.rewrite_count || 0) >= 3) return 'escalate_node';
  if (!guard.safe) return 'rewrite_node';
  return 'evaluate_node';
}
