async (state) => {
  process.env.SPRINT_CONTRACT = JSON.stringify(state.sprintContract ?? null);
  const { execSync } = require('child_process');
  // HumanMessage is already injected via globalScope
  try {
    const content = execSync('npx tsx ../scripts/evaluator-bootstrap.ts',
      { encoding: 'utf8', timeout: 180000 });
    return { activeMessages: [new HumanMessage(content.trim())] };
  } catch (e) {
    return { activeMessages: [new HumanMessage('=== Evaluator Bootstrap ===\n（取得失敗: ' + e.message + '）')] };
  }
}