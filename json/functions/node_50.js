if (!state.huntTargets || state.huntTargets.length === 0) {
  console.warn('[fanOut] No huntTargets — routing to __end__');
  return '__end__';
}
console.log(`[fanOut] Dispatching ${state.huntTargets.length} hunters`);
return state.huntTargets.map(target => new Send('hunter_node', { ...state, currentTarget: target }));