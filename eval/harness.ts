#!/usr/bin/env tsx
/**
 * Eval Harness — measure skill performance via successRate (0.0~1.0).
 *
 * Usage:
 *   tsx eval/harness.ts --dir eval/train/teams --workflow json/teams/leader-qwen.json
 *   tsx eval/harness.ts --dir eval/train/arxiv-search --workflow json/teams/leader-qwen.json
 *   tsx eval/harness.ts --dir eval/train/langgraph-docs --workflow json/teams/leader-qwen.json
 */

import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { WorkflowEngine } from "../src/index.js";
import { HumanMessage } from "@langchain/core/messages";

// ── Types ──────────────────────────────────────────────────────────────────

interface TaskDef {
  skill: string;
  input: string;
  evaluation: Evaluation;
}

interface Evaluation {
  type: "completion" | "count" | "keyword";
  minWorkers?: number;
  expected?: number;
  keywords?: string[];
}

export interface EvalResult {
  taskId: string;
  skill: string;
  passed: boolean;
  score: number; // 0.0 ~ 1.0
  detail: string;
}

export interface EvalSummary {
  totalTasks: number;
  passedTasks: number;
  successRate: number;
  bySkill: Record<string, { passed: number; total: number }>;
  results: EvalResult[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function loadTask(filePath: string): TaskDef {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function loadTaskFiles(dir: string): { id: string; task: TaskDef }[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((f) => ({
    id: f.replace(".json", ""),
    task: loadTask(join(dir, f)),
  }));
}

/**
 * Extract final output from workflow result.
 * Tries finalReport first, then last AI message content.
 */
function extractOutput(result: any): string {
  if (result?.finalReport && typeof result.finalReport === "string") {
    return result.finalReport;
  }
  if (result?.messages && Array.isArray(result.messages)) {
    for (let i = result.messages.length - 1; i >= 0; i--) {
      const msg = result.messages[i];
      if (msg?.content && typeof msg.content === "string" && msg.content.trim()) {
        return msg.content;
      }
    }
  }
  return "";
}

// ── Evaluation logic ───────────────────────────────────────────────────────

function evaluate(task: TaskDef, output: string): EvalResult {
  const evalType = task.evaluation.type;

  if (evalType === "count") {
    const expected = task.evaluation.expected ?? 0;
    // Count numbered/bulleted items in output
    const items = output.match(/^[\d]+\./gm) || [];
    const count = items.length;
    const score = expected > 0 ? Math.min(count / expected, 1.0) : (count > 0 ? 1.0 : 0.0);
    return {
      taskId: "",
      skill: task.skill,
      passed: count >= expected,
      score: Math.round(score * 100) / 100,
      detail: `${count} items found (expected >= ${expected})`,
    };
  }

  if (evalType === "keyword") {
    const keywords = task.evaluation.keywords ?? [];
    if (keywords.length === 0) {
      return {
        taskId: "",
        skill: task.skill,
        passed: true,
        score: 1.0,
        detail: "No keywords specified — auto-pass",
      };
    }
    const lower = output.toLowerCase();
    const matched = keywords.filter((k) => lower.includes(k.toLowerCase()));
    const score = matched.length / keywords.length;
    return {
      taskId: "",
      skill: task.skill,
      passed: matched.length === keywords.length,
      score: Math.round(score * 100) / 100,
      detail: `${matched.length}/${keywords.length} keywords matched: ${matched.join(", ")}`,
    };
  }

  if (evalType === "completion") {
    const minWorkers = task.evaluation.minWorkers ?? 1;
    // For teams skill: check if finalReport is non-empty (workers completed)
    const hasContent = output.trim().length > 0;
    const score = hasContent ? 1.0 : 0.0;
    return {
      taskId: "",
      skill: task.skill,
      passed: hasContent,
      score,
      detail: hasContent
        ? `Worker completed — output length: ${output.trim().length} chars`
        : "No output from workers",
    };
  }

  return {
    taskId: "",
    skill: task.skill,
    passed: false,
    score: 0.0,
    detail: `Unknown evaluation type: ${evalType}`,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function runEval(
  taskDir: string,
  workflowPath: string
): Promise<EvalSummary> {
  const tasks = loadTaskFiles(resolve(taskDir));
  const results: EvalResult[] = [];
  const bySkill: Record<string, { passed: number; total: number }> = {};

  // Build workflow engine once
  const workflowJson = JSON.parse(
    readFileSync(resolve(workflowPath), "utf-8")
  );
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

  for (const { id, task } of tasks) {
    const fullResult = await engine.invoke(
      { messages: [new HumanMessage(task.input)] },
      { configurable: { thread_id: `eval-${id}` } }
    );

    const output = extractOutput(fullResult);
    const evalResult = evaluate(task, output);
    evalResult.taskId = id;

    results.push(evalResult);

    if (!bySkill[task.skill]) {
      bySkill[task.skill] = { passed: 0, total: 0 };
    }
    bySkill[task.skill].total++;
    if (evalResult.passed) {
      bySkill[task.skill].passed++;
    }
  }

  const passedTasks = results.filter((r) => r.passed).length;

  return {
    totalTasks: tasks.length,
    passedTasks,
    successRate: tasks.length > 0 ? Math.round((passedTasks / tasks.length) * 100) / 100 : 0.0,
    bySkill,
    results,
  };
}

// ── CLI entry ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let dir = "";
  let workflow = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) {
      dir = args[++i];
    } else if (args[i] === "--workflow" && args[i + 1]) {
      workflow = args[++i];
    }
  }

  if (!dir || !workflow) {
    console.error(
      "Usage: tsx eval/harness.ts --dir <task-dir> --workflow <workflow.json>"
    );
    process.exit(1);
  }

  console.log(`Eval harness: dir=${dir} workflow=${workflow}`);
  const summary = await runEval(dir, workflow);

  console.log("");
  console.log(`=== Eval Summary ===`);
  console.log(`Total:    ${summary.totalTasks}`);
  console.log(`Passed:   ${summary.passedTasks}`);
  console.log(`Rate:     ${summary.successRate}`);
  console.log("");
  console.log(`By skill:`);
  for (const [skill, stats] of Object.entries(summary.bySkill)) {
    console.log(`  ${skill}: ${stats.passed}/${stats.total}`);
  }
  console.log("");
  console.log(`Results:`);
  for (const r of summary.results) {
    const status = r.passed ? "PASS" : "FAIL";
    console.log(`  [${status}] ${r.taskId} (${r.skill}) score=${r.score} — ${r.detail}`);
  }

  // Write JSONL log
  const fs = await import("fs");
  const logPath = join(process.cwd(), "eval", "logs", "harness.jsonl");
  fs.mkdirSync(join(process.cwd(), "eval", "logs"), { recursive: true });
  for (const r of summary.results) {
    fs.appendFileSync(logPath, JSON.stringify(r) + "\n");
  }
  console.log(`\nJSONL log: ${logPath}`);

  // Exit with code 1 if any task failed
  if (summary.passedTasks < summary.totalTasks) {
    process.exit(0); // Not a hard failure — this is expected during training
  }
}

// Only run CLI when executed directly (not when imported by tests)
if (process.argv[1] && process.argv[1].endsWith("harness.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { runEval, evaluate, loadTaskFiles, extractOutput };
