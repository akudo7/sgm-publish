const contract = state.sprintContract;
const bootstrapMsg = (state.activeMessages || []).find(
  m => typeof m.content === 'string' && m.content.startsWith('=== Evaluator Bootstrap')
);
const systemPrompt = bootstrapMsg
  ? bootstrapMsg.content + '\n\n=== Sprint Contract ===\n' + JSON.stringify(contract, null, 2)
  : 'Sprint Contract: ' + JSON.stringify(contract);
const res = await model.invoke([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: '上記のcontractとビルド・テスト実行結果に基づき、実装を評価してください。\n'  + '以下の重み付けで score を 0〜100 で算出してください:\n'  + '  ビルド成功         : 20点\n'  + '  必須ファイル存在    : 20点（srcFileCount > 0 かつ hasEntrypoint: true）\n'  + '  テスト通過率        : 60点 × (passed / total)\n'  + 'テストがない・実行失敗の場合は score: 0 としてください。\n'  + '必ず {"passed": bool, "feedback": "...", "score": number} の JSON 形式のみで返してください。' }
]);
const raw = (res.reasoning_content && res.reasoning_content.trim()) || (typeof res.content === 'string' ? res.content.trim() : JSON.stringify(res.content));
try {
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);
  return { sprintResult: { passed: parsed.passed !== false, feedback: parsed.feedback || 'evaluated', score: typeof parsed.score === 'number' ? parsed.score : 80 } };
} catch {
  return { sprintResult: { passed: false, feedback: 'evaluation failed: LLM response was not valid JSON', score: 0 } };
}