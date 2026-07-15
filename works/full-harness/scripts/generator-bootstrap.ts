/**
 * generator-bootstrap.ts
 * bootstrap_generator_node 用。既存テストファイルの一覧と SprintContract を収集し
 * Bootstrap メッセージとして stdout に出力する。
 *
 * 環境変数:
 *   SPRINT_CONTRACT  - JSON 文字列（SprintContract | null）
 *   SPRINT_RESULT    - JSON 文字列（SprintResult | null）
 *
 * 実行: npx tsx ../scripts/generator-bootstrap.ts
 * CWD: works/full-harness/results/
 */

import { execSync } from "child_process";

interface SprintContract { goals: string[]; successCriteria: string[]; sprintNumber: number; }
interface SprintResult   { passed: boolean; feedback: string; score: number; }

const sprintContract: SprintContract | null = process.env.SPRINT_CONTRACT
  ? JSON.parse(process.env.SPRINT_CONTRACT) : null;
const sprintResult: SprintResult | null = process.env.SPRINT_RESULT
  ? JSON.parse(process.env.SPRINT_RESULT) : null;

const lines: string[] = [];

if (sprintContract) {
  lines.push("=== 実装対象のContext ===");
  lines.push("Goals: " + sprintContract.goals.join(", "));
  lines.push("Sprint: " + sprintContract.sprintNumber);
}

// 既存テストファイル（skills/env-bootstrap テストパターン準拠）
lines.push("\n=== 既存テストファイル ===");
const patterns = [
  "*.test.ts", "*.test.js", "*.spec.ts", "*.spec.js",
  "*_test.go", "*_test.py", "*Test.java", "*test.cpp",
];
const foundTests: string[] = [];
for (const p of patterns) {
  try {
    const out = execSync(
      `find . -name "${p}" -not -path "*/node_modules/*" -not -path "*/vendor/*" | head -10`,
      { encoding: "utf8" }
    ).trim();
    if (out) foundTests.push(`[${p}] ${out.split("\n").slice(0, 5).join(", ")}`);
  } catch { /* パターンにマッチなし */ }
}
lines.push(foundTests.length > 0 ? foundTests.join("\n") : "なし");

if (sprintResult && !sprintResult.passed) {
  lines.push("\n=== 前回フィードバック ===");
  lines.push(sprintResult.feedback);
}

process.stdout.write("=== Generator Bootstrap ===\n" + lines.join("\n"));
