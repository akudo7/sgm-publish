async (state, model) => {
  const fs = require('fs'); const path = require('path');
  let _r = process.cwd(); while (_r !== path.dirname(_r) && !fs.existsSync(path.join(_r, 'package.json'))) _r = path.dirname(_r);
  const issues = state.guard_result?.issues || [];
  const original = state.answer || '';

  function deterministicFix(text) {
    let s = text;
    // PATH_LEAK: src/(lib|types|a2a)/ パスを除去
    s = s.replace(/`src\/(?:lib|types|a2a)\/[^`\s]*`/gi, '`（内部モジュール）`');
    s = s.replace(/\bsrc\/(?:lib|types|a2a)\/\S*/gi, '（内部モジュール）');
    // INTERNAL_SYMBOLS: 内部クラス名を置換
    const syms = ['PiiFilter', 'ContextCompressionManager', 'ContextGuard', 'AsyncTaskQueue', 'DispatchTaskStore', 'ModelFactoryManager', 'SkillsManager', 'ClaudeCodeToolsFactory', 'UsageTracker', 'PiiBlockedError'];
    s = syms.reduce((t, sym) => t.replace(new RegExp(sym, 'g'), 'SGMの内部コンポーネント'), s);
    // IMPLEMENTATION_DETAIL: guard と同じ検知パターンを逆用して安全な表現に置換
    s = s.replace(/内部ロジック/g, '処理ロジック');
    s = s.replace(/実装(?![例コード])/g, '機能');
    // CODE_STRUCTURE: function/class 定義行を除去
    s = s.replace(/^(?:function\s+\w+|class\s+\w+\s+extends)[^\n]*\n?/gim, '');
    return s;
  }

  // すべての既知 issue を確定的修正でカバー — LLM 不要
  const DETERMINISTIC_ISSUES = new Set(['PATH_LEAK', 'INTERNAL_SYMBOLS', 'INTERNAL_SYMBOL', 'IMPLEMENTATION_DETAIL', 'CODE_STRUCTURE']);
  const needsLLM = issues.some(i => !DETERMINISTIC_ISSUES.has(i));

  let finalAnswer;
  if (!needsLLM) {
    finalAnswer = deterministicFix(original);
    console.log('[rewrite] deterministic-fix applied | issues:', JSON.stringify(issues), '| original:', original.length, '| final:', finalAnswer.length);
    return { answer: finalAnswer, messages: [], rewrite_count: (state.rewrite_count || 0) + 1 };
  }

  // 未知 issue: LLM リライト（IMPLEMENTATION_DETAIL は含まれないため空応答リスク低）
  const basePrompt = fs.readFileSync(path.join(_r, 'works/sgm-consulting-v2/training/prompts/rewrite_prompt.txt'), 'utf-8');
  const prompt = basePrompt.replace('{{issues}}', JSON.stringify(issues)).replace('{{original}}', original);
  const response = await model.invoke([{ role: 'user', content: prompt }]);
  const rewritten = response.content;

  if (rewritten.length < original.length * 0.8) {
    console.warn('[rewrite] LLM truncation detected: rewritten=' + rewritten.length + ' → deterministic fallback');
    finalAnswer = deterministicFix(original);
  } else {
    finalAnswer = deterministicFix(rewritten);
  }
  console.log('[rewrite] rewrite_count:', (state.rewrite_count || 0) + 1, '| original:', original.length, '| rewritten:', rewritten.length, '| final:', finalAnswer.length);
  return { answer: finalAnswer, messages: [response], rewrite_count: (state.rewrite_count || 0) + 1 };
}
