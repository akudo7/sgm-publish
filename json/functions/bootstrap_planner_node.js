async (state) => {
  const fs = require('fs');
  const lines = [];
  lines.push('=== プロジェクト構造 ===');
  try {
    const { execSync } = require('child_process');
    const tree = execSync(
      'find . -type f -not -path "*/.git/*" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/vendor/*" | head -50',
      { encoding: 'utf8' }
    );
    lines.push(tree.trim());
  } catch (e) {
    lines.push('（取得失敗）');
  }
  lines.push('\n=== 依存関係 ===');
  const depFiles = ['package.json', 'Cargo.toml', 'go.mod', 'requirements.txt', 'pyproject.toml', 'pom.xml', 'Gemfile', 'composer.json', 'pubspec.yaml'];
  const foundDeps = [];
  for (const f of depFiles) {
    try {
      const content = fs.readFileSync(f, 'utf8').split('\n').slice(0, 30).join('\n');
      foundDeps.push('--- ' + f + ' ---\n' + content);
    } catch (e) {
      // 存在しないのでスキップ
    }
  }
  if (foundDeps.length > 0) {
    lines.push(foundDeps.join('\n'));
  } else {
    lines.push('依存関係ファイルなし');
  }
  lines.push('\n=== README（先頭50行） ===');
  try {
    const readme = fs.readFileSync('README.md', 'utf8').split('\n').slice(0, 50).join('\n');
    lines.push(readme);
  } catch (e) {
    lines.push('README.md なし');
  }
  const lastMessage = state.messages[state.messages.length - 1];
  const userRequest = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : JSON.stringify(lastMessage.content);
  const taskSpec = [
    '=== ユーザー指示 ===',
    userRequest,
    '',
    '=== 環境スナップショット ===',
    lines.join('\n')
  ].join('\n');
  return { taskSpec };
}