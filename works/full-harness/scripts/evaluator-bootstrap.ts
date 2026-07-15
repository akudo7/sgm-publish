/**
 * evaluator-bootstrap.ts
 * bootstrap_evaluator_node 用。ビルド・テスト実行・スコア算出基準を収集し
 * Evaluator Bootstrap メッセージとして stdout に出力する。
 *
 * 環境変数:
 *   SPRINT_CONTRACT  - JSON 文字列（SprintContract | null）
 *
 * 実行: npx tsx ../scripts/evaluator-bootstrap.ts
 * CWD: works/full-harness/results/
 *
 * 言語検出: skills/env-bootstrap に準拠
 * スコア重み: ビルド成功(20) + 必須ファイル存在(20) + テスト通過率(60)
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

interface SprintContract { goals: string[]; successCriteria: string[]; sprintNumber: number; }

const sprintContract: SprintContract | null = process.env.SPRINT_CONTRACT
  ? JSON.parse(process.env.SPRINT_CONTRACT) : null;

const lines: string[] = [];

// ── 起動・テストコマンド ──────────────────────────────────────────────────────
lines.push("=== 起動・テストコマンド ===");
const configDefs = [
  { name: "package.json", keys: ["start", "dev", "serve", "build", "test"] },
  { name: "Makefile",     keys: ["all", "build", "test", "run", "start", "dev"] },
  { name: "Cargo.toml",   keys: ["build", "test", "run"] },
  { name: "go.mod",       keys: [] as string[] },
];
const foundScripts: string[] = [];
for (const cfg of configDefs) {
  try {
    const content = readFileSync(cfg.name, "utf8");
    if (cfg.name === "package.json") {
      const pkg = JSON.parse(content);
      const scripts = pkg.scripts || {};
      const found = cfg.keys.filter(k => scripts[k]).map(k => `${k}: ${scripts[k]}`);
      if (found.length > 0) foundScripts.push(`--- ${cfg.name} ---\n${found.join("\n")}`);
    } else if (cfg.name === "Makefile") {
      const targets = cfg.keys.filter(k => content.includes(`${k}:`));
      if (targets.length > 0) foundScripts.push(`--- ${cfg.name} ---\n${targets.join(", ")} ターゲットあり`);
    } else if (content.trim()) {
      foundScripts.push(`--- ${cfg.name} あり ---`);
    }
  } catch { /* 存在しない */ }
}
lines.push(foundScripts.length > 0 ? foundScripts.join("\n") : "設定ファイルなし");

// ── APIエンドポイント ─────────────────────────────────────────────────────────
lines.push("\n=== APIエンドポイント ===");
try {
  const ep = execSync(
    'grep -rn "\\.(get\\|post\\|put\\|delete\\|patch)" ' +
    '--include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rb" ' +
    '| grep -E "(app|router|@|route|Handle|Controller)" | head -30',
    { encoding: "utf8" }
  );
  lines.push(ep.trim() || "なし");
} catch {
  lines.push("なし");
}

// ── ソースファイル確認 ────────────────────────────────────────────────────────
lines.push("\n=== ソースファイル確認 ===");
try {
  const srcFiles = execSync(
    'find src tests \\( -name "*.ts" -o -name "*.js" \\) 2>/dev/null | head -20',
    { encoding: "utf8" }
  ).trim();
  lines.push(srcFiles || "ソースファイルなし（実装が不完全です）");
} catch {
  lines.push("（取得失敗）");
}

// ── env-bootstrap: 言語検出・ビルド・テスト実行 ──────────────────────────────
lines.push("\n=== ビルド・テスト結果 ===");
let lang = "unknown";
let buildCmd: string | null = null;
let testCmd:  string | null = null;

if (existsSync("package.json")) {
  lang = "JavaScript/TypeScript";
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const scripts = pkg.scripts || {};
  const pm = existsSync("yarn.lock") ? "yarn" : "npm";
  if (!existsSync("node_modules")) {
    try { execSync(`${pm} install --silent`, { encoding: "utf8", timeout: 120_000 }); } catch { /* ignore */ }
  }
  buildCmd = scripts.build ? `${pm} run build 2>&1 | tail -30` : "npx tsc --noEmit 2>&1 | tail -30";
  testCmd  = scripts.test  ? `${pm} test 2>&1 | tail -50`      : null;
} else if (existsSync("Cargo.toml")) {
  lang = "Rust";
  buildCmd = "cargo check 2>&1 | tail -30";
  testCmd  = "cargo test --no-run 2>&1 | tail -30";
} else if (existsSync("go.mod")) {
  lang = "Go";
  buildCmd = "go build ./... 2>&1 | tail -30";
  testCmd  = "go test -c ./... 2>&1 | tail -30";
} else if (existsSync("pom.xml") || existsSync("build.gradle")) {
  lang = "Java";
  buildCmd = existsSync("pom.xml") ? "mvn compile -q 2>&1 | tail -30" : "./gradlew classes 2>&1 | tail -30";
  testCmd  = existsSync("pom.xml") ? "mvn test -q 2>&1 | tail -50"    : "./gradlew test 2>&1 | tail -50";
} else if (existsSync("requirements.txt") || existsSync("pyproject.toml")) {
  lang = "Python";
  testCmd = "python -m pytest 2>&1 | tail -50";
}

lines.push(`言語: ${lang}`);

if (buildCmd) {
  try {
    const out = execSync(buildCmd, { encoding: "utf8", timeout: 60_000 });
    lines.push(`--- ビルド: 成功 ---\n${out.trim().slice(0, 500)}`);
  } catch (e: any) {
    const out = (e.stdout ?? "") + (e.stderr ?? "") || e.message;
    lines.push(`--- ビルド: 失敗 ---\n${String(out).slice(0, 500)}`);
  }
}

if (testCmd) {
  try {
    const out = execSync(testCmd, { encoding: "utf8", timeout: 120_000 });
    lines.push(`--- テスト: 成功 ---\n${out.trim().slice(0, 1000)}`);
  } catch (e: any) {
    const out = (e.stdout ?? "") + (e.stderr ?? "") || e.message;
    lines.push(`--- テスト: 失敗あり ---\n${String(out).slice(0, 1000)}`);
  }
} else {
  lines.push("テスト: コマンドなし");
}

// ── スコア算出基準 ────────────────────────────────────────────────────────────
lines.push("\n=== スコア算出基準 ===");
const srcCount = (() => {
  try {
    const out = execSync(
      'find src tests \\( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" \\) 2>/dev/null | wc -l',
      { encoding: "utf8" }
    );
    return parseInt(out.trim(), 10) || 0;
  } catch { return 0; }
})();
const hasEntry = (() => {
  try {
    const out = execSync(
      'find src -maxdepth 2 \\( -name "index.*" -o -name "main.*" -o -name "app.*" \\) 2>/dev/null | wc -l',
      { encoding: "utf8" }
    );
    return parseInt(out.trim(), 10) > 0;
  } catch { return false; }
})();
lines.push(`srcFileCount: ${srcCount}（0なら実装未完）`);
lines.push(`hasEntrypoint: ${hasEntry}（index.*/main.*/app.* の存在）`);
lines.push("");
lines.push("スコア重み付け（evaluatorへの指示）:");
lines.push("  ビルド成功     : 20点（前述のビルド結果を参照）");
lines.push("  必須ファイル存在: 20点（srcFileCount > 0 かつ hasEntrypoint が true）");
lines.push("  テスト通過率   : 60点 × (passed / total)");
lines.push("  合計最大       : 100点");

// ── 評価基準 ─────────────────────────────────────────────────────────────────
if (sprintContract) {
  lines.push("\n=== 評価基準 ===");
  sprintContract.successCriteria.forEach((c, i) => lines.push(`${i + 1}. ${c}`));
}

process.stdout.write("=== Evaluator Bootstrap ===\n" + lines.join("\n"));
