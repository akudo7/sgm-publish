async (state) => {
  const answer = state.answer || '';
  const issues = [];
  const pathRe = /src\/(lib|types|a2a)/i;
  if (pathRe.test(answer)) issues.push('PATH_LEAK');
  const internalTerms = ['PiiFilter', 'ContextCompressionManager', 'ContextGuard', 'AsyncTaskQueue', 'DispatchTaskStore', 'ModelFactoryManager', 'SkillsManager', 'ClaudeCodeToolsFactory', 'UsageTracker', 'PiiBlockedError'];
  const count = internalTerms.filter(t => answer.includes(t)).length;
  if (count >= 2) issues.push('INTERNAL_SYMBOLS');
  else if (count === 1) issues.push('INTERNAL_SYMBOL');
  const implRe = /実装[^例コード]|内部ロジック/;
  const denyRe = /(?:公開|開示|お伝え|記載|含まれ|回答|お答え|説明)[^。]{0,15}(?:ません|ない|できません|いません)|非公開|管理されて|保護|対象外|範囲外|(?:ご)?確認いただく|該当します|ことができません/;
  const hasImplLeak = answer.split(/[。！？]/).some(s => implRe.test(s) && !denyRe.test(s));
  if (hasImplLeak) issues.push('IMPLEMENTATION_DETAIL');
  const structRe = /function\s+\w+|class\s+\w+\s+extends/i;
  if (structRe.test(answer)) issues.push('CODE_STRUCTURE');
  const uniqueIssues = [...new Set(issues)];
  const penalties = { PATH_LEAK: 0.25, INTERNAL_SYMBOL: 0.125, INTERNAL_SYMBOLS: 0.25, IMPLEMENTATION_DETAIL: 0.125, CODE_STRUCTURE: 0.125 };
  let score = 1.0;
  for (const issue of uniqueIssues) { score -= penalties[issue] || 0.1; }
  score = Math.max(0, score);
  const safe = uniqueIssues.length === 0;
  const result = { safe, issues: uniqueIssues, score };
  if (uniqueIssues.length > 0) {
    console.warn('[guard] issues:', uniqueIssues.join(', '), '| score:', score.toFixed(2));
  } else {
    console.log('[guard] safe | score:', score.toFixed(2));
  }
  console.log('[guard] turn_count:', state.turn_count + 1, '| safe:', safe);
  return { guard_result: result, answer: state.answer, referenced_files: state.referenced_files || [], messages: [{ role: 'assistant', content: safe ? state.answer : '[GUARD] Issues detected: ' + uniqueIssues.join(', ') }] };
}
