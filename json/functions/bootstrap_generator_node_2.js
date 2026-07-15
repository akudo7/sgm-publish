async (state) => {
  process.env.SPRINT_CONTRACT = JSON.stringify(state.sprintContract ?? null);
  process.env.SPRINT_RESULT   = JSON.stringify(state.sprintResult   ?? null);
  const { execSync } = require('child_process');
  // HumanMessage is already injected via globalScope
  try {
    const content = execSync('npx tsx ../scripts/generator-bootstrap.ts',
      { encoding: 'utf8', timeout: 30000 });
    return { activeMessages: [new HumanMessage(content.trim())] };
  } catch (e) {
    return { activeMessages: [new HumanMessage('=== Generator Bootstrap ===\n（取得失敗: ' + e.message + '）')] };
  }
}