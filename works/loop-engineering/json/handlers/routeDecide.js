const gaps = state.gaps || [];
if (process.env.LOOP_DEBUG_ROUTE === '1') {
console.error(`[routeDecide] DEBUG: gaps=${JSON.stringify(gaps)}, realGaps=${gaps.filter(g => g && typeof g === 'object' && Object.keys(g).length > 0).length}`);
}
// 空文字・null・undefined・空オブジェクトを除き、実質的な gap が存在するか判定
const realGaps = gaps.filter(g => g && typeof g === 'object' && Object.keys(g).length > 0);
return realGaps.length > 0 ? 'plan_node' : '__end__';
