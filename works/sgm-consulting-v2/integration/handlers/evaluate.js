async (state, evaluator) => {
  const fs = require('fs'); const path = require('path');
  let _r = process.cwd(); while (_r !== path.dirname(_r) && !fs.existsSync(path.join(_r, 'package.json'))) _r = path.dirname(_r);
  const basePrompt = fs.readFileSync(path.join(_r, 'works/sgm-consulting-v2/training/prompts/evaluate_prompt.txt'), 'utf-8');
  const guard = state.guard_result || {};
  const guardCtx = guard.safe ? '\n\nguard_result: safe (issues=none)' : '\n\nguard_result: UNSAFE (issues=' + JSON.stringify(guard.issues || []) + ')';
  const refCtx = (state.referenced_files && state.referenced_files.length > 0) ? '\n\n参照ファイル: ' + JSON.stringify(state.referenced_files) : '';
  const prompt = basePrompt + guardCtx + refCtx + '\n\n【評価対象】\n回答: ' + (state.answer || '');
  const result = await evaluator.invoke([{ role: 'user', content: prompt }]);
  let ev;
  try {
    let c = String(result.content).trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    ev = JSON.parse(c);
  } catch (e) {
    ev = { accuracy: 3, usefulness: 3, clarity: 3, leak_score: 0 };
  }
  const quality_score = { accuracy: ev.accuracy || 3, usefulness: ev.usefulness || 3, clarity: ev.clarity || 3 };
  // leak_score: guard safeなら0、LLM評価があれば採用、なければ0
  const leak_score = guard.safe ? 0 : (ev.leak_score ?? 0);
  const close = ev.outcome === 'close' && quality_score.accuracy >= 4 && quality_score.usefulness >= 4 && quality_score.clarity >= 4 && leak_score === 0;
  const autoClose = !close && (state.answer || '').length >= 200 && quality_score.accuracy >= 3 && quality_score.usefulness >= 3 && quality_score.clarity >= 3 && leak_score === 0;
  if (autoClose) console.log('[evaluate] auto-close:', JSON.stringify(quality_score));
  console.log('[evaluate] quality:', JSON.stringify(quality_score), '| leak_score:', leak_score, '| close:', close);
  return { quality_score, close: close || autoClose, leak_score };
}
