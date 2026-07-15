/**
 * feedback-bootstrap.ts
 * bootstrap_feedback_node 用。評価フィードバック・git diff・ビルドエラーを収集し
 * Feedback Bootstrap メッセージとして stdout に出力する。
 *
 * 環境変数:
 *   SPRINT_RESULT    - JSON 文字列（SprintResult | null）
 *   SPRINT_CONTRACT  - JSON 文字列（SprintContract | null）
 *
 * 実行: npx tsx ../scripts/feedback-bootstrap.ts
 * CWD: works/full-harness/results/
 */

import { execSync } from "child_process";
import { existsSync } from "fs";

interface SprintResult   { passed: boolean; feedback: string; score: number; }
interface SprintContract { goals: string[]; successCriteria: string[]; sprintNumber: number; }

const sprintResult:   SprintResult   | null = process.env.SPRINT_RESULT
  ? JSON.parse(process.env.SPRINT_RESULT)   : null;
const sprintContract: SprintContract | null = process.env.SPRINT_CONTRACT
  ? JSON.parse(process.env.SPRINT_CONTRACT) : null;

const lines: string[] = [];

if (sprintResult) {
  lines.push("=== 評価フィードバック ===");
  lines.push(`スコア: ${sprintResult.score}`);
  lines.push(`フィードバック: ${sprintResult.feedback}`);
}

// 直近の変更ファイル
lines.push("\n=== 直近の変更ファイル ===");
try {
  const diff = execSync("git diff --stat HEAD 2>/dev/null | head -20", { encoding: "utf8" });
  lines.push(diff.trim() || "変更なし");
} catch {
  lines.push("（取得失敗）");
}

// ビルドエラー（言語検出で最適コマンドを選択）
lines.push("\n=== ビルドエラー（直近） ===");
const buildCandidates = existsSync("yarn.lock")
  ? ["yarn build 2>&1 | tail -20"]
  : existsSync("package.json")
  ? ["npm run build 2>&1 | tail -20"]
  : existsSync("Cargo.toml")
  ? ["cargo build 2>&1 | tail -20"]
  : existsSync("go.mod")
  ? ["go build ./... 2>&1 | tail -20"]
  : existsSync("Makefile")
  ? ["make build 2>&1 | tail -20"]
  : existsSync("requirements.txt") || existsSync("pyproject.toml")
  ? ["python -m py_compile setup.py 2>&1 | tail -20"]
  : [];

let buildOutput = "（ビルドコマンドなし）";
for (const cmd of buildCandidates) {
  try {
    buildOutput = execSync(cmd, { encoding: "utf8" });
    if (buildOutput.trim()) break;
  } catch { /* 次のコマンドを試す */ }
}
lines.push(buildOutput.trim() || "（取得失敗）");

const num = sprintContract?.sprintNumber ?? "?";
process.stdout.write(`=== Feedback Bootstrap（スプリント${num}） ===\n` + lines.join("\n"));
