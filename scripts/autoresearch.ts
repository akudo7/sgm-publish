#!/usr/bin/env tsx
/**
 * AutoResearch Orchestrator — autonomous SKILL.md improvement loop.
 *
 * Karpathy's autoresearch philosophy applied to SceneGraphManager:
 *   1. Run workflow with a train task → reflect_node updates SKILL.md
 *   2. Measure successRate via eval harness
 *   3. If score degrades → git checkout skills/ (rollback)
 *   4. Log diff and continue
 *
 * Usage:
 *   tsx scripts/autoresearch.ts                          # default: 100 iterations
 *   tsx scripts/autoresearch.ts --iterations 50          # custom iterations
 *   tsx scripts/autoresearch.ts --dry-run --iterations 3 # dry run (no SKILL.md changes)
 *   tsx scripts/autoresearch.ts --workflow json/teams/leader-qwen.json
 *   tsx scripts/autoresearch.ts --eval-dir eval/train/arxiv-search
 */

import { readFileSync, readdirSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { WorkflowEngine } from "@kudos/scene-graph-manager";
import { HumanMessage } from "@langchain/core/messages";
import { runEval, type EvalSummary } from "../eval/harness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

// ── Types ──────────────────────────────────────────────────────────────────

interface AutoresearchConfig {
  maxIterations: number;
  workflowConfigPath: string;
  evalDir: string;
  holdoutEvalDir: string;
  logDir: string;
}

interface IterationResult {
  iteration: number;
  scoreBefore: number;
  scoreAfter: number;
  accepted: boolean;
  skillDiff: string;
  durationMs: number;
  triggerTask?: string;
  triggerSkill?: string;
}

interface HoldoutResult {
  trainScore: number;
  holdoutScore: number;
  divergence: number;
  warnings: string[];
  finalCommit: boolean;
}

interface TaskFile {
  id: string;
  task: { skill: string; input: string; evaluation: any };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function loadTaskFiles(dir: string): TaskFile[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.map((f) => ({
    id: f.replace(".json", ""),
    task: JSON.parse(readFileSync(join(dir, f), "utf-8")),
  }));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function gitDiffSkills(): string {
  try {
    const { execSync } = require("child_process");
    return execSync("git diff skills/", { cwd: ROOT, encoding: "utf-8" }) || "";
  } catch {
    return "";
  }
}

function gitCheckoutSkills(): void {
  const { execSync } = require("child_process");
  execSync("git checkout -- skills/", { cwd: ROOT });
}

function getSkillBaseline(): string {
  try {
    const { execSync } = require("child_process");
    return execSync("git log -1 --format=%H -- skills/", { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function countDiffLines(diff: string): number {
  const addRegex = /^\+[^+]/gm;
  const adds = (diff.match(addRegex) || []).length;
  return adds;
}

function hasRepeatedPattern(diff: string): boolean {
  // Detect if the same pattern is repeated >3 times in a diff
  const lines = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  const freq = new Map<string, number>();
  for (const line of lines) {
    const normalized = line.trim().replace(/\s+/g, " ");
    freq.set(normalized, (freq.get(normalized) || 0) + 1);
  }
  for (const [, count] of freq) {
    if (count > 3) return true;
  }
  return false;
}

async function runHoldoutEval(
  holdoutDir: string,
  trainDir: string,
  workflowPath: string,
  logDir: string,
  iterationResults: IterationResult[]
): Promise<HoldoutResult> {
  const { runEval: runEvalFromHarness } = await import("../eval/harness.js");

  // Run train eval
  const trainSummary = await runEvalFromHarness(resolve(trainDir), workflowPath);

  // Run holdout eval
  const holdoutSummary = await runEvalFromHarness(resolve(holdoutDir), workflowPath);

  const divergence = trainSummary.successRate - holdoutSummary.successRate;
  const warnings: string[] = [];

  // Signal 1: train/holdout divergence > 0.2
  if (divergence > 0.2) {
    warnings.push(
      `Reward hacking detected: train (${trainSummary.successRate.toFixed(2)}) - holdout (${holdoutSummary.successRate.toFixed(2)}) = ${divergence.toFixed(2)} > 0.2`
    );
  }

  // Signal 2: SKILL.md bloat (check per-iteration average)
  const diffs = iterationResults.filter((r) => r.skillDiff && r.skillDiff !== "(no changes)" && r.skillDiff !== "(dry-run, no changes)");
  if (diffs.length > 0) {
    const avgLines = diffs.reduce((sum, r) => sum + countDiffLines(r.skillDiff), 0) / diffs.length;
    if (avgLines > 50) {
      warnings.push(`SKILL.md bloat: avg ${avgLines.toFixed(0)} lines/iteration > 50`);
    }
  }

  // Signal 3: repeated diff patterns
  for (const r of diffs.slice(-5)) {
    if (hasRepeatedPattern(r.skillDiff)) {
      warnings.push(`Repeated diff pattern detected in iteration ${r.iteration}`);
      break;
    }
  }

  // Decision: commit if holdout improved, rollback if not
  const holdoutBaseline = 0.0; // same as train baseline
  const finalCommit = holdoutSummary.successRate > holdoutBaseline;

  // Log holdout result
  const holdoutLog = {
    trainScore: trainSummary.successRate,
    holdoutScore: holdoutSummary.successRate,
    divergence,
    warnings,
    finalCommit,
  };
  appendFileSync(join(logDir, "holdout_result.json"), JSON.stringify(holdoutLog, null, 2) + "\n");

  return holdoutLog;
}

// ── Single iteration ───────────────────────────────────────────────────────

async function runIteration(
  i: number,
  config: AutoresearchConfig,
  allTasks: TaskFile[],
  dryRun: boolean
): Promise<IterationResult> {
  const startMs = Date.now();

  // 1. Pick a random trigger task
  const trigger = pickRandom(allTasks);
  const workflowJson = JSON.parse(
    readFileSync(resolve(config.workflowConfigPath), "utf-8")
  );

  // 2. Build and invoke workflow engine
  const engine = new WorkflowEngine({
    nodes: workflowJson.nodes,
    edges: workflowJson.edges,
    stateAnnotation: workflowJson.stateAnnotation,
    annotation: workflowJson.annotation,
    models: workflowJson.models,
    config: workflowJson.config,
    stateGraph: workflowJson.stateGraph,
  });
  await engine.build();

  try {
    await engine.invoke(
      { messages: [new HumanMessage(trigger.task.input)] },
      { configurable: { thread_id: `autoresearch-iter-${i}` } }
    );
  } finally {
    engine.close();
  }

  // 3. In dry-run mode: skip eval, just report
  if (dryRun) {
    const durationMs = Date.now() - startMs;
    console.log(
      `  [${String(i).padStart(4)}] DRY-RUN trigger=${trigger.id} (${trigger.task.skill}) — skipped eval`
    );
    return {
      iteration: i,
      scoreBefore: 0,
      scoreAfter: 0,
      accepted: false,
      skillDiff: "(dry-run, no changes)",
      durationMs,
      triggerTask: trigger.id,
      triggerSkill: trigger.task.skill,
    };
  }

  // 4. Run full eval harness
  const summary: EvalSummary = await runEval(config.evalDir, config.workflowConfigPath);

  // 6. Capture diff after eval
  const diffAfter = gitDiffSkills();

  const durationMs = Date.now() - startMs;

  // 7. Decide accept/rollback
  const accepted = summary.successRate >= config._previousScore;

  if (!accepted) {
    gitCheckoutSkills();
  }

  // 8. Log per-iteration artifacts
  const iterDir = join(config.logDir, `iteration_${i}`);
  mkdirSync(iterDir, { recursive: true });
  writeFileSync(
    join(iterDir, "score.json"),
    JSON.stringify({
      iteration: i,
      scoreBefore: config._previousScore,
      scoreAfter: summary.successRate,
      accepted,
      triggerTask: trigger.id,
      triggerSkill: trigger.task.skill,
    }, null, 2)
  );
  writeFileSync(join(iterDir, "skill_diff.patch"), diffAfter || "(no changes)");

  const status = accepted ? "ACCEPT" : "ROLLBACK";
  console.log(
    `  [${String(i).padStart(4)}] ${status} score=${config._previousScore.toFixed(2)}→${summary.successRate.toFixed(2)} trigger=${trigger.id} (${trigger.task.skill}) ${durationMs}ms`
  );

  // Update baseline
  if (accepted) {
    config._previousScore = summary.successRate;
  }

  return {
    iteration: i,
    scoreBefore: config._previousScore,
    scoreAfter: summary.successRate,
    accepted,
    skillDiff: diffAfter,
    durationMs,
    triggerTask: trigger.id,
    triggerSkill: trigger.task.skill,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(): Partial<AutoresearchConfig> & { dryRun: boolean } {
  const args = process.argv.slice(2);
  let iterations = 100;
  let dryRun = false;
  let workflow = "json/teams/leader-qwen.json";
  let evalDir = "eval/train";
  let holdoutEvalDir = "eval/holdout";
  let logDir = "logs/autoresearch";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--iterations":
      case "-n":
        iterations = parseInt(args[++i] ?? "100", 10);
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--workflow":
        workflow = args[++i] ?? workflow;
        break;
      case "--eval-dir":
        evalDir = args[++i] ?? evalDir;
        break;
      case "--holdout-eval-dir":
        holdoutEvalDir = args[++i] ?? holdoutEvalDir;
        break;
      case "--log-dir":
        logDir = args[++i] ?? logDir;
        break;
      case "--help":
      case "-h":
        console.log(`
AutoResearch Orchestrator — autonomous SKILL.md improvement loop

Usage:
  tsx scripts/autoresearch.ts                         # 100 iterations, teams skill
  tsx scripts/autoresearch.ts --iterations 50         # custom iteration count
  tsx scripts/autoresearch.ts --dry-run --iterations 3 # dry run (no SKILL.md changes)
  tsx scripts/autoresearch.ts --workflow json/teams/leader-qwen.json
  tsx scripts/autoresearch.ts --eval-dir eval/train/arxiv-search
  tsx scripts/autoresearch.ts --holdout-eval-dir eval/holdout

Options:
  --iterations, -n N          Number of iterations (default: 100)
  --dry-run                   Skip eval and SKILL.md changes
  --workflow PATH             Workflow config path (default: json/teams/leader-qwen.json)
  --eval-dir PATH             Train eval task directory (default: eval/train)
  --holdout-eval-dir PATH     Holdout eval task directory (default: eval/holdout)
  --log-dir PATH              Log output directory (default: logs/autoresearch)
  --help, -h                  Show this help
        `);
        process.exit(0);
    }
  }

  return { dryRun, maxIterations: iterations, workflowConfigPath: workflow, evalDir, holdoutEvalDir, logDir };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const cli = parseArgs();
  const config: AutoresearchConfig & { _previousScore: number } = {
    maxIterations: cli.maxIterations ?? 100,
    workflowConfigPath: cli.workflowConfigPath ?? "json/teams/leader-qwen.json",
    evalDir: cli.evalDir ?? "eval/train",
    holdoutEvalDir: cli.holdoutEvalDir ?? "eval/holdout",
    logDir: cli.logDir ?? "logs/autoresearch",
    _previousScore: 0.0,
  };

  const dryRun = cli.dryRun ?? false;

  // Validate inputs
  if (!readFileSync(resolve(config.workflowConfigPath), "utf-8")) {
    console.error(`[ERROR] Workflow config not found: ${config.workflowConfigPath}`);
    process.exit(1);
  }

  // Load all train tasks for random trigger selection
  const evalDirResolved = resolve(config.evalDir);
  const allTasks: TaskFile[] = [];
  const skillDirs = readdirSync(evalDirResolved).filter(
    (f) => f !== ".gitkeep" && f !== "holdout"
  );
  for (const skillDir of skillDirs) {
    const skillPath = join(evalDirResolved, skillDir);
    try {
      const tasks = loadTaskFiles(skillPath);
      allTasks.push(...tasks.map((t) => ({ ...t, task: { ...t.task, skill: skillDir } })));
    } catch {
      // Skip non-directory entries
    }
  }

  if (allTasks.length === 0) {
    console.error(`[ERROR] No train tasks found in ${config.evalDir}`);
    process.exit(1);
  }

  console.log("=== AutoResearch Orchestrator ===");
  console.log(`  Iterations: ${config.maxIterations}`);
  console.log(`  Dry run:    ${dryRun}`);
  console.log(`  Workflow:   ${config.workflowConfigPath}`);
  console.log(`  Eval dir:   ${config.evalDir} (${allTasks.length} tasks across ${skillDirs.length} skills)`);
  console.log(`  Log dir:    ${config.logDir}`);
  console.log(`  Baseline:   score=0.00`);
  console.log("");

  // Ensure log directory exists
  mkdirSync(config.logDir, { recursive: true });

  // Save baseline git state
  const baselineCommit = getSkillBaseline();
  if (baselineCommit) {
    console.log(`  Baseline commit: ${baselineCommit}`);
  }
  console.log("");

  const results: IterationResult[] = [];
  let acceptedCount = 0;
  let interrupted = false;

  // Ctrl+C handler — clean shutdown
  const handleInterrupt = () => {
    if (interrupted) {
      console.log("\n[!] Force quitting...");
      process.exit(130);
    }
    interrupted = true;
    console.log("");
    console.log("[!] Interrupted (Ctrl+C). Saving state...");
    printSummary(results);
    process.exit(130);
  };
  process.on("SIGINT", handleInterrupt);

  // Main loop
  for (let i = 1; i <= config.maxIterations; i++) {
    if (interrupted) break;

    const result = await runIteration(i, config, allTasks, dryRun);
    results.push(result);
    if (result.accepted && !dryRun) acceptedCount++;

    // Write to summary.jsonl
    const logLine = JSON.stringify({
      iteration: result.iteration,
      scoreBefore: result.scoreBefore,
      scoreAfter: result.scoreAfter,
      accepted: result.accepted,
      durationMs: result.durationMs,
      triggerTask: result.triggerTask,
    }) + "\n";
    appendFileSync(join(config.logDir, "summary.jsonl"), logLine);
  }

  // Restore git state if interrupted mid-iteration
  if (interrupted && !dryRun) {
    console.log("  Restoring git state to pre-run baseline...");
    try {
      const { execSync } = require("child_process");
      execSync(`git checkout ${baselineCommit} -- skills/`, { cwd: ROOT });
      console.log("  Git state restored.");
    } catch {
      console.log("  [WARN] Could not restore git state. Manual intervention may be needed.");
    }
  }

  console.log("");
  printSummary(results);

  // ── Holdout validation (Phase 4) ─────────────────────────────────────
  const holdoutExists = (() => {
    try {
      const files = readdirSync(resolve(config.holdoutEvalDir)).filter((f) => f.endsWith(".json"));
      return files.length > 0;
    } catch {
      return false;
    }
  })();

  if (!dryRun && holdoutExists) {
    console.log("");
    console.log("=== Holdout Validation ===");

    try {
      const holdoutResult = await runHoldoutEval(
        config.holdoutEvalDir,
        config.evalDir,
        config.workflowConfigPath,
        config.logDir,
        results
      );

      console.log(`  Train score:    ${holdoutResult.trainScore.toFixed(2)}`);
      console.log(`  Holdout score:  ${holdoutResult.holdoutScore.toFixed(2)}`);
      console.log(`  Divergence:     ${holdoutResult.divergence.toFixed(2)}`);

      if (holdoutResult.warnings.length > 0) {
        console.log("  Warnings:");
        for (const w of holdoutResult.warnings) {
          console.log(`    ⚠ ${w}`);
        }
      }

      if (holdoutResult.finalCommit) {
        console.log("  Holdout improved → committing...");
        const { execSync } = require("child_process");
        execSync(`git add skills/`, { cwd: ROOT });
        execSync(
          `git commit -m "autoresearch: improve skills (holdout: ${holdoutResult.holdoutScore.toFixed(2)}, train: ${holdoutResult.trainScore.toFixed(2)})"`,
          { cwd: ROOT }
        );
        console.log("  Committed successfully.");
      } else {
        console.log("  Holdout did not improve → rolling back skills/...");
        gitCheckoutSkills();
        console.log("  All skill changes reverted.");
      }
    } catch (e) {
      console.log(`  [WARN] Holdout validation failed: ${e instanceof Error ? e.message : e}`);
    }
  } else if (dryRun) {
    console.log("");
    console.log("=== Holdout Validation skipped (dry-run mode) ===");
  }
}

function printSummary(results: IterationResult[]) {
  const accepted = results.filter((r) => r.accepted).length;
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
  const bestScore = results.length > 0
    ? Math.max(...results.map((r) => Math.max(r.scoreAfter, r.scoreBefore)))
    : 0;

  console.log("=== Summary ===");
  console.log(`  Total iterations: ${results.length}`);
  console.log(`  Accepted:         ${accepted}`);
  console.log(`  Rejected:         ${results.length - accepted}`);
  console.log(`  Best score:       ${bestScore.toFixed(2)}`);
  console.log(`  Total time:       ${(totalDuration / 1000).toFixed(1)}s`);
}

// ── Entry ──────────────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith("autoresearch.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
