async (state) => {
  const { execSync } = require('child_process');
  const lines = [];
  if (state.sprintResult) {
    lines.push('=== 評価フィードバック ===');
    lines.push('スコア: ' + state.sprintResult.score);
    lines.push('フィードバック: ' + state.sprintResult.feedback);
  }
  lines.push('\n=== 直近の変更ファイル ===');
  try {
    const diff = execSync('git diff --stat HEAD 2>/dev/null | head -20', { encoding: 'utf8' });
    lines.push(diff.trim() || '変更なし');
  } catch (e) {
    lines.push('（取得失敗）');
  }
  lines.push('\n=== ビルドエラー（直近） ===');
  const buildCommands = [
    'yarn build 2>&1 | tail -20',
    'npm run build 2>&1 | tail -20',
    'make build 2>&1 | tail -20',
    'cargo build 2>&1 | tail -20',
    'go build ./... 2>&1 | tail -20',
    'python -m py_compile setup.py 2>&1 | tail -20',
    'bundle exec rake build 2>&1 | tail -20',
  ];
  let buildOutput = '（ビルドコマンドなし）';
  for (const cmd of buildCommands) {
    try {
      buildOutput = execSync(cmd, { encoding: 'utf8' });
      if (buildOutput.trim()) break;
    } catch (e) {}
  }
  lines.push(buildOutput.trim() || '（取得失敗）');
  // HumanMessage is already injected via globalScope
  const num = state.sprintContract ? state.sprintContract.sprintNumber : '?';
  return { activeMessages: [new HumanMessage('=== Feedback Bootstrap（スプリント' + num + '） ===\n' + lines.join('\n'))] };
}