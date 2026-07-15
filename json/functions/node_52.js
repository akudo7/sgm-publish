if (!state.huntTargets || state.huntTargets.length === 0) {
  console.warn('[retryFanOut] No retry targets — routing to __end__');
  return '__end__';
}
console.log(`[retryFanOut] Retrying ${state.huntTargets.length} hunters with verbal gradients`);
return state.huntTargets.map(target => new Send('hunter_node', { ...state, currentTarget: target }));