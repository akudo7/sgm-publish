/**
 * Full Harness Workflow Runner
 *
 * Sprint Contract + Context Reset + Environment Bootstrapping による
 * 自律的実装・評価ループを実行する。
 *
 * Setup:
 *   # llama.cpp サーバーを起動
 *   llama-server -m <model_path> --port 8001 --parallel 3
 *
 * Run:
 *   # 単発実行
 *   tsx works/full-harness/run.ts
 *
 *   # 複数スプリント実行（環境変数で制御）
 *   MAX_SPRINTS=5 tsx works/full-harness/run.ts
 *
 * Output:
 *   results/ に実行メタデータとログを保存する。
 */

import { WorkflowEngine } from "@kudos/scene-graph-manager";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import { HumanMessage } from "@langchain/core/messages";
import {
  createRunMetadata,
  type RunMetadata,
  type SprintContract,
  type SprintResult,
} from "./full-harness.lib.js";

// ─── シードモード ─────────────────────────────────────────────────────────────
// SEED_FROM=<resultsディレクトリのパス> で前回実行の状態から再開する

interface SeedState {
  activeMessages: HumanMessage[];
  sprintContract: SprintContract | null;
  sprintResult: SprintResult | null;
}

function loadSeed(seedDir: string): SeedState | null {
  try {
    const metaPath = join(seedDir, "metadata.json");
    if (!existsSync(metaPath)) return null;
    const meta: RunMetadata = JSON.parse(readFileSync(metaPath, "utf-8"));

    // log から activeMessages を抽出
    const logPath = join(seedDir, "run_output.log");
    let activeMessages: Array<{ role: string; content: string }> = [];
    if (existsSync(logPath)) {
      const log = readFileSync(logPath, "utf-8");
      // [N] content の形式から Bootstrap/Reset 系メッセージを抽出
      const msgRegex = /\[(\d+)\]\s*(.+)/g;
      let match;
      const allMessages: Array<{ index: number; content: string }> = [];
      while ((match = msgRegex.exec(log)) !== null) {
        allMessages.push({ index: parseInt(match[1], 10), content: match[2] });
      }
      // Bootstrap/Reset 系のみ activeMessages として抽出
      const bootstrapPattern = /^=== (Context Reset|Generator Bootstrap|Evaluator Bootstrap|Feedback Bootstrap)/;
      activeMessages = allMessages
        .filter(m => bootstrapPattern.test(m.content))
        .map(m => new HumanMessage(m.content));
    }

    // sprintContract を再構築
    const sprintContract: SprintContract | null = meta.finalSprint > 0
      ? { goals: [], successCriteria: [], sprintNumber: meta.finalSprint }
      : null;

    // sprintResult を再構築
    const sprintResult: SprintResult | null = meta.finalSprint > 0
      ? { passed: meta.finalPassed, feedback: "seeded from previous run", score: meta.finalScore }
      : null;

    return { activeMessages, sprintContract, sprintResult };
  } catch (e) {
    console.warn(`[Seed] Failed to load seed from ${seedDir}: ${(e as Error).message}`);
    return null;
  }
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const WORKFLOW_JSON = join(__dir, "../../json/full-harness-workflow-qwen.json");
const RESULTS_DIR = join(__dir, "results");

const LLAMA_SERVER_URL = "http://localhost:8001";
const SERVER_WAIT_MS = 120_000;
const SERVER_POLL_INTERVAL_MS = 5_000;

const MAX_SPRINTS = parseInt(process.env.MAX_SPRINTS || "5", 10);

// ─── 初期化 ───────────────────────────────────────────────────────────────────

function loadWorkflow(): any {
  return JSON.parse(readFileSync(WORKFLOW_JSON, "utf-8"));
}

function ensureResultsDir(): void {
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

// ─── サーバー待機 ─────────────────────────────────────────────────────────────

async function waitForServer(url: string, timeoutMs: number, intervalMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        console.log(`[Server] ${url} is ready`);
        return;
      }
    } catch {
      // サーバーまだ起動中
    }
    console.log(`[Server] Waiting for ${url}... (${Math.round((Date.now() - start) / 1000)}s)`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Server ${url} not ready after ${timeoutMs}ms`);
}

// ─── メイン実行 ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  ensureResultsDir();

  console.log("[FullHarness] Loading workflow...");
  const config = loadWorkflow();

  // ユーザー指示を state に設定
  const userTask = process.env.TASK || "results/ に Node.js + Express + TypeScript の REST API プロジェクトを作成してください。要件：\n- 依存関係: express, zod, dotenv\n- エンドポイント: GET /health, POST /tasks, GET /tasks, GET /tasks/:id, PUT /tasks/:id, DELETE /tasks/:id\n- zod による入力バリデーション\n- エラーハンドリング（400, 404, 500）\n- jest によるユニットテスト\n- README.md にセットアップ・エンドポイント説明付き\n- .env.example と ESLint 設定付き";

  console.log(`[FullHarness] Task: ${userTask}`);
  console.log(`[FullHarness] Max Sprints: ${MAX_SPRINTS}`);
  console.log(`[FullHarness] Model: ${config.models[0]?.config.model}`);
  console.log(`[FullHarness] Server: ${LLAMA_SERVER_URL}`);

  // サーバー待機
  try {
    await waitForServer(LLAMA_SERVER_URL, SERVER_WAIT_MS, SERVER_POLL_INTERVAL_MS);
  } catch (e) {
    console.warn(`[FullHarness] Server not available: ${(e as Error).message}`);
    console.warn("[FullHarness] Proceeding without LLM (dry run mode)");
  }

  // results/ をプロジェクトルートとして変更（LLMのファイル書き出しをサンドボックス内に閉じる）
  process.chdir(RESULTS_DIR);
  console.log(`[FullHarness] Working directory: ${process.cwd()}`);

  // エンジン構築
  const engine = new WorkflowEngine(config);
  await engine.build();

  // 実行 — SEED_FROM で前回実行から状態をシード
  const seedDir = process.env.SEED_FROM;
  let seedState: SeedState | null = null;
  if (seedDir) {
    seedState = loadSeed(seedDir);
    if (seedState) {
      console.log(`[FullHarness] Seeded from: ${seedDir}`);
      console.log(`[FullHarness]   Sprint: ${seedState.sprintContract?.sprintNumber ?? 0}, Passed: ${seedState.sprintResult?.passed}`);
      console.log(`[FullHarness]   Active messages: ${seedState.activeMessages.length}`);
    } else {
      console.warn(`[FullHarness] Seed not found: ${seedDir}`);
    }
  }

  const initialState: Record<string, unknown> = {
    taskSpec: userTask,
    ...seedState,
  };

  console.log("[FullHarness] Starting workflow execution...");
  let latestState: Record<string, unknown> = { ...initialState };
  const streamIterator = await engine.stream(initialState, { streamMode: "values" });
  for await (const stateUpdate of streamIterator) {
    latestState = stateUpdate as Record<string, unknown>;
    // sprint 関連 state が更新されたら status.json に保存
    if (latestState.sprintContract || latestState.sprintResult || latestState.contextResetCount) {
      const status = {
        sprintNumber: (latestState.sprintContract as any)?.sprintNumber ?? 0,
        passed: (latestState.sprintResult as any)?.passed,
        score: (latestState.sprintResult as any)?.score,
        feedback: (latestState.sprintResult as any)?.feedback,
        contextResetCount: latestState.contextResetCount,
        retryCount: latestState.retryCount,
        timestamp: new Date().toISOString(),
      };
      writeFileSync(join(RESULTS_DIR, "status.json"), JSON.stringify(status, null, 2));
      console.log(`[Status] Sprint ${status.sprintNumber} — Passed: ${status.passed}, Score: ${status.score}`);
    }
  }
  // final state を result 形式に変換
  const result: any = {
    messages: latestState.messages,
    sprintContract: latestState.sprintContract as SprintContract,
    sprintResult: latestState.sprintResult as SprintResult,
    contextResetCount: latestState.contextResetCount as number,
    retryCount: latestState.retryCount as number,
    taskSpec: latestState.taskSpec as string,
  };

  const durationMs = Date.now() - startTime;

  // メタデータ生成
  const metadata: RunMetadata = createRunMetadata({
    runId: 1,
    durationMs,
    finalSprint: result.sprintContract?.sprintNumber ?? 0,
    finalPassed: result.sprintResult?.passed ?? false,
    finalScore: result.sprintResult?.score ?? 0,
    contextResetCount: result.contextResetCount ?? 0,
    totalRetries: result.retryCount ?? 0,
    taskSpecLength: (result.taskSpec ?? "").length,
  });

  // 結果保存
  const metaPath = join(RESULTS_DIR, "metadata.json");
  writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

  const logPath = join(RESULTS_DIR, "run_output.log");
  const logLines = [
    `=== Full Harness Run Log ===`,
    `StartTime: ${metadata.startTime}`,
    `Duration: ${metadata.durationMs}ms`,
    `Final Sprint: ${metadata.finalSprint}`,
    `Passed: ${metadata.finalPassed}`,
    `Score: ${metadata.finalScore}`,
    `Context Resets: ${metadata.contextResetCount}`,
    `Retries: ${metadata.totalRetries}`,
    `TaskSpec Length: ${metadata.taskSpecLength}`,
    ``,
    `=== Messages ===`,
    ...((result.messages ?? []).map((m: any, i: number) => `[${i}] ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`).slice(-50)),
  ];
  writeFileSync(logPath, logLines.join("\n"));

  console.log(`\n[FullHarness] Completed in ${durationMs}ms`);
  console.log(`[FullHarness] Sprint: ${metadata.finalSprint}, Passed: ${metadata.finalPassed}, Score: ${metadata.finalScore}`);
  console.log(`[FullHarness] Context Resets: ${metadata.contextResetCount}, Retries: ${metadata.totalRetries}`);
  console.log(`[FullHarness] Results saved to: ${RESULTS_DIR}`);
}

main().catch((e) => {
  console.error("[FullHarness] Fatal error:", e);
  process.exit(1);
});
