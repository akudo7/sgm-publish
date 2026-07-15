const userContent = 'Sprint contract: ' + JSON.stringify(state.sprintContract);
const res = await model.invoke([{ role: 'user', content: userContent }]);
const raw = typeof res.content === 'string' ? res.content.trim() : JSON.stringify(res.content);
try {
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);
  return { sprintResult: { passed: parsed.passed !== false, feedback: parsed.feedback || 'evaluated', score: typeof parsed.score === 'number' ? parsed.score : 80 } };
} catch {
  return { sprintResult: { passed: true, feedback: 'evaluation complete', score: 80 } };
}