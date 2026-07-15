async (state) => {
  process.env.TASK_SPEC = typeof state.taskSpec === 'string'
    ? state.taskSpec
    : (state.messages && state.messages.length > 0
        ? (typeof state.messages[state.messages.length - 1].content === 'string'
            ? state.messages[state.messages.length - 1].content
            : JSON.stringify(state.messages[state.messages.length - 1].content))
        : 'タスク指定なし');
  const { execSync } = require('child_process');
  try {
    const taskSpec = execSync('npx tsx ../scripts/planner-bootstrap.ts',
      { encoding: 'utf8', timeout: 30000 });
    return { taskSpec: taskSpec.trim() };
  } catch (e) {
    return { taskSpec: process.env.TASK_SPEC || 'タスク指定なし' };
  }
}