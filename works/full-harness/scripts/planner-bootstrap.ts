/**
 * planner-bootstrap.ts
 * bootstrap_planner_node 用。プロジェクト構造・依存関係・README を収集し
 * taskSpec 文字列として stdout に出力する。
 *
 * 環境変数:
 *   TASK_SPEC  - ユーザー指示（未設定の場合は messages 最終行から取得できないためデフォルト文言）
 *
 * 実行: npx tsx ../scripts/planner-bootstrap.ts
 * CWD: works/full-harness/results/（run.ts の process.chdir 後）
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

const lines: string[] = [];

// プロジェクト構造
lines.push("=== プロジェクト構造 ===");
try {
  const tree = execSync(
    'find . -type f -not -path "*/.git/*" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/vendor/*" | head -50',
    { encoding: "utf8" }
  );
  lines.push(tree.trim());
} catch {
  lines.push("（取得失敗）");
}

// 依存関係ファイル
lines.push("\n=== 依存関係 ===");
const depFiles = [
  "package.json", "Cargo.toml", "go.mod", "requirements.txt",
  "pyproject.toml", "pom.xml", "Gemfile", "composer.json", "pubspec.yaml",
];
const foundDeps: string[] = [];
for (const f of depFiles) {
  try {
    const content = readFileSync(f, "utf8").split("\n").slice(0, 30).join("\n");
    foundDeps.push(`--- ${f} ---\n${content}`);
  } catch { /* 存在しない場合はスキップ */ }
}
lines.push(foundDeps.length > 0 ? foundDeps.join("\n") : "依存関係ファイルなし");

// README
lines.push("\n=== README（先頭50行） ===");
try {
  const readme = readFileSync("README.md", "utf8").split("\n").slice(0, 50).join("\n");
  lines.push(readme);
} catch {
  lines.push("README.md なし");
}

// taskSpec を構築して出力
const userRequest = process.env.TASK_SPEC || "タスク指定なし";
const taskSpec = [
  "=== ユーザー指示 ===",
  userRequest,
  "",
  "=== 環境スナップショット ===",
  lines.join("\n"),
].join("\n");

process.stdout.write(taskSpec);
