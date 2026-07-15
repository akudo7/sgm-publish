async (state) => {
  console.log('[escalate] turn_count:', state.turn_count, '| guard_result:', JSON.stringify(state.guard_result));
  return { escalated: true, answer: '申し訳ございません。お答えできる範囲を超えているため、担当者にエスカレーションします。' };
}
