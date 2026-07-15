async (state) => {
  const fs = require('fs');
  const lines = [];
  if (state.sprintContract) {
    lines.push('=== 実装対象のContext ===');
    lines.push('Goals: ' + state.sprintContract.goals.join(', '));
    lines.push('Sprint: ' + state.sprintContract.sprintNumber);
  }
  lines.push('\n=== 既存テストファイル ===');
  try {
    const { execSync } = require('child_process');
    const patterns = ['*.test.*', '*_test.*', '*_spec.*', '*.spec.*', '*Test.*', '*.test.go', '*.test.py', '*.test.ts', '*.test.js'];
    const foundTests = [];
    for (const p of patterns) {
      try {
        const tests = execSync('find . -name "' + p + '" -not -path "*/node_modules/*" -not -path "*/vendor/*" | head -10', { encoding: 'utf8' });
        const found = tests.trim();
        if (found) {
          const files = found.split('\n').slice(0, 5).join(', ');
          foundTests.push('[' + p + '] ' + files);
        }
      } catch (e) {}
    }
    lines.push(foundTests.length > 0 ? foundTests.join('\n') : 'なし');
  } catch (e) {
    lines.push('（取得失敗）');
  }
  if (state.sprintResult && !state.sprintResult.passed) {
    lines.push('\n=== 前回フィードバック ===');
    lines.push(state.sprintResult.feedback);
  }
  // HumanMessage is already injected via globalScope (see workflow.ts buildNodeFunction)
  return { activeMessages: [new HumanMessage('=== Generator Bootstrap ===\n' + lines.join('\n'))] };
}