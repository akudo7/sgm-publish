async (state) => {
  const fs = require('fs');
  const lines = [];
  lines.push('=== 起動・テストコマンド ===');
  const configFiles = [
    { name: 'package.json', patterns: ['start', 'dev', 'serve', 'build', 'test'] },
    { name: 'Makefile', patterns: ['all', 'build', 'test', 'run', 'start', 'dev'] },
    { name: 'Rakefile', patterns: ['build', 'test', 'run'] },
    { name: 'Cargo.toml', patterns: ['build', 'test', 'run'] },
  ];
  const foundScripts = [];
  for (const cfg of configFiles) {
    try {
      const content = fs.readFileSync(cfg.name, 'utf8');
      if (cfg.name === 'package.json') {
        const pkg = JSON.parse(content);
        const scripts = pkg.scripts || {};
        const found = cfg.patterns.filter(p => scripts[p]).map(p => p + ': ' + scripts[p]);
        if (found.length > 0) foundScripts.push('--- ' + cfg.name + ' ---\n' + found.join('\n'));
      } else if (cfg.name === 'Makefile') {
        const targets = cfg.patterns.filter(p => content.includes(p + ':'));
        if (targets.length > 0) foundScripts.push('--- ' + cfg.name + ' ---\n' + targets.join(', ') + ' ターゲットあり');
      } else {
        const targets = cfg.patterns.filter(p => content.includes(p));
        if (targets.length > 0) foundScripts.push('--- ' + cfg.name + ' ---\n' + targets.join(', ') + ' あり');
      }
    } catch (e) {}
  }
  if (foundScripts.length > 0) {
    lines.push(foundScripts.join('\n'));
  } else {
    lines.push('設定ファイルなし');
  }
  lines.push('\n=== APIエンドポイント ===');
  try {
    const { execSync } = require('child_process');
    const p = 'grep -rn "\\.\\(get\\|post\\|put\\|delete\\|patch\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rb" --include="*.java" | grep -E "(app|router|@|route|Handle|Controller)" | head -30';
    const ep = execSync(p, { encoding: 'utf8' });
    lines.push(ep.trim() || 'なし');
  } catch (e) {
    lines.push('（取得失敗）');
  }
  if (state.sprintContract) {
    lines.push('\n=== 評価基準 ===');
    state.sprintContract.successCriteria.forEach((c, i) => lines.push((i + 1) + '. ' + c));
  }
  // HumanMessage is already injected via globalScope
  return { activeMessages: [new HumanMessage('=== Evaluator Bootstrap ===\n' + lines.join('\n'))] };
}