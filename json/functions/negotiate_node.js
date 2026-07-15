const sprintNumber = state.sprintContract ? state.sprintContract.sprintNumber + 1 : 1;
const userContent = 'Task: ' + state.taskSpec + (state.sprintResult ? '. Previous feedback: ' + state.sprintResult.feedback : '');
const res = await model.invoke([{ role: 'user', content: userContent }]);
const raw = typeof res.content === 'string' ? res.content.trim() : JSON.stringify(res.content);
try {
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);
  return { sprintContract: { goals: parsed.goals || ['implement: ' + state.taskSpec], successCriteria: parsed.successCriteria || ['task completed'], sprintNumber } };
} catch {
  return { sprintContract: { goals: ['implement: ' + state.taskSpec], successCriteria: ['task is complete'], sprintNumber } };
}