/**
 * SGM Consulting Bot v2 — Production Runner
 *
 * sgm-chat-guard-v2.json を実行する本番用ラッパー。
 * Slack 等の外部システムから 1 リクエストを受け付け、
 * 最大 6 ターンで回答 → クローズ または エスカレーションする。
 *
 * Multi-turn: INITIAL_QUESTION に改行で区切って複数質問を指定（同じ threadId で実行）
 *
 * Run:
 *   # Single turn
 *   node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts
 *   INITIAL_QUESTION="WorkflowEngineの使い方を教えて" \
 *     node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts
 *   # Multi-turn (same thread)
 *   INITIAL_QUESTION="WorkflowEngineとは\n使い方を教えて" \
 *     node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts
 */

import { WorkflowEngine } from "@kudos/scene-graph-manager";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const WORKFLOW_JSON = join(__dir, "json/sgm-chat-guard-v2.json");
const RESULTS_DIR = join(__dir, "results");
const LLAMA_SERVER_URL = "http://localhost:8001";

function isConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("Connection error") ||
    msg.includes("fetch failed") ||
    msg.includes("ECONNRESET")
  );
}

const SERVER_WAIT_MS = 120_000;
const SERVER_POLL_MS = 5_000;

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${LLAMA_SERVER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = SERVER_WAIT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  console.log(`[server] llama.cpp が停止しています。復旧を待ちます（最大 ${timeoutMs / 1000}s）...`);
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${LLAMA_SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) { console.log("[server] llama.cpp が復旧しました。"); return true; }
    } catch {}
    await new Promise((r) => setTimeout(r, SERVER_POLL_MS));
  }
  console.error("[server] タイムアウト: llama.cpp が復旧しませんでした。");
  return false;
}

function attachProgressLogger(engine: WorkflowEngine): void {
  const nodeStartAt = new Map<string, number>();
  engine.addEventListener(async (event: { type: string; nodeId?: string; totalTokens?: number }) => {
    const ts = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    if (event.type === "nodeStart") {
      nodeStartAt.set(event.nodeId!, Date.now());
      process.stdout.write(`[${ts}] ▶ ${event.nodeId} ...\n`);
    } else if (event.type === "nodeComplete") {
      const elapsed = nodeStartAt.has(event.nodeId!)
        ? ((Date.now() - nodeStartAt.get(event.nodeId!)!) / 1000).toFixed(1)
        : "?";
      const tokensLabel = event.totalTokens ? ` | ${event.totalTokens} tokens` : "";
      process.stdout.write(`[${ts}] ✓ ${event.nodeId} (${elapsed}s${tokensLabel})\n`);
    } else if (event.type === "tokenUsage" && event.totalTokens) {
      process.stdout.write(`[${ts}] [tokens] total=${event.totalTokens}\n`);
    }
  });
}

async function invokeOnce(
  engine: WorkflowEngine,
  question: string,
  threadId: string,
  opts: {
    buildEngine: () => Promise<WorkflowEngine>;
    start: number;
    currentTurn: number;
    totalTurns: number;
  }
): Promise<Record<string, unknown> | undefined> {
  try {
    return (await engine.invoke(
      { messages: [{ type: "human", content: question }] },
      { configurable: { thread_id: threadId } },
    )) as Record<string, unknown>;
  } catch (err) {
    if (isConnectionError(err)) {
      console.warn("[warn] 接続エラーを検出しました。");
      const recovered = await waitForServer();
      if (recovered) {
        engine = await opts.buildEngine();
        attachProgressLogger(engine);
        return (await engine.invoke(
          { messages: [{ type: "human", content: question }] },
          { configurable: { thread_id: threadId } },
        )) as Record<string, unknown>;
      } else {
        console.error("\nFailed: LlamaCpp server connection lost");
        process.exit(1);
      }
    } else {
      const durationMs = Date.now() - opts.start;
      console.error(`\n[Turn ${opts.currentTurn}] Failed after ${(durationMs / 1000).toFixed(1)}s:`, err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("SGM Consulting Bot v2 — Production Runner");
  console.log("=".repeat(60));

  if (!await isServerRunning()) {
    console.error(`ERROR: LlamaCpp server is not running at ${LLAMA_SERVER_URL}`);
    console.error("Please start the server:");
    console.error("  bash ~/Desktop/Work/run_qwen.sh > /tmp/qwen_server.log 2>&1 &");
    console.error("  curl http://localhost:8001/health");
    process.exit(1);
  }

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const rawQuestion = process.env.INITIAL_QUESTION ?? "SceneGraphManagerとは何ですか？";
  const questions = rawQuestion.split("\n").map(q => q.trim()).filter(Boolean);
  const threadId = process.env.THREAD_ID ?? `slack-test-${Date.now()}`;
  const multiTurn = questions.length > 1;
  const sessionId = `consulting-v2-${Date.now()}`;

  console.log(`[config] Session : ${sessionId}`);
  console.log(`[config] Thread  : ${threadId}`);
  console.log(`[config] Questions: ${questions.length} turn(s)`);
  questions.forEach((q, i) => console.log(`  [${i + 1}] ${q}`));

  const config = JSON.parse(readFileSync(WORKFLOW_JSON, "utf-8"));
  // Multi-turn: disable auto-close by setting threshold to impossible value
  if (multiTurn) {
    const evaluateNode = config.nodes.find((n: any) => n.id === "evaluate_node");
    if (evaluateNode) {
      evaluateNode.handler.function = evaluateNode.handler.function.replace(
        "quality_score.accuracy >= 3",
        "quality_score.accuracy >= 99"
      );
    }
  }

  process.once("SIGINT", () => {
    process.stdout.write("\n[SIGINT] 中断を受信しました。処理を停止します...\n");
    process.exit(130);
  });

  const buildEngine = async () => {
    const eng = new WorkflowEngine(config);
    await eng.build();
    return eng;
  };

  let engine = await buildEngine();
  attachProgressLogger(engine);

  const start = Date.now();
  let lastResult: Record<string, unknown> | undefined;
  let allAnswers: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`\n${"─".repeat(60)}`);
    console.log(`[Turn ${i + 1}/${questions.length}] ${question}`);
    console.log("─".repeat(60));

    const turnResult = await invokeOnce(engine, question, threadId, {
      buildEngine,
      start: start,
      currentTurn: i + 1,
      totalTurns: questions.length,
    });

    if (!turnResult) {
      console.error("[error] No result returned from workflow");
      process.exit(1);
    }

    lastResult = turnResult;
    // Extract answers from conversation history (answer field is overwritten each turn)
    const conv = turnResult.conversation as Array<{ role: string; content: string }> | undefined;
    if (conv) {
      for (const msg of conv) {
        if (msg.role === 'assistant' && msg.content && !allAnswers.includes(msg.content)) {
          allAnswers.push(msg.content);
        }
      }
    }

    // Stop if escalated (never continue)
    if (Boolean(turnResult.escalated)) {
      console.log(`[info] Workflow escalated after turn ${i + 1}`);
      break;
    }
  }

  if (!lastResult) { console.error("[error] No result returned from workflow"); process.exit(1); }

  const durationMs = Date.now() - start;
  const guardResult = lastResult.guard_result as { safe?: boolean; issues?: string[]; score?: number } | undefined;
  const turnCount = Number(lastResult.turn_count) || 0;
  const rewriteCount = Number(lastResult.rewrite_count) || 0;
  const escalated = Boolean(lastResult.escalated);
  const close = Boolean(lastResult.close);
  const qualityScore = lastResult.quality_score as { accuracy?: number; usefulness?: number; clarity?: number } | undefined;

  console.log("\n" + "=".repeat(60));
  console.log("[Result]");
  console.log("=".repeat(60));
  console.log(`  ターン数    : ${turnCount}`);
  console.log(`  実行ターン  : ${questions.length} turn(s)`);
  console.log(`  書き換え回数: ${rewriteCount}`);
  console.log(`  安全審査    : ${guardResult?.safe ?? "?"} (score: ${guardResult?.score?.toFixed(2) ?? "?"})`);
  if (guardResult?.issues && guardResult.issues.length > 0) {
    console.log(`  検出イシュー: ${guardResult.issues.join(", ")}`);
  }
  console.log(`  品質スコア  : accuracy=${qualityScore?.accuracy ?? "?"} usefulness=${qualityScore?.usefulness ?? "?"} clarity=${qualityScore?.clarity ?? "?"}`);
  console.log(`  クローズ    : ${close}`);
  console.log(`  エスカレーション: ${escalated}`);
  console.log(`  実行時間    : ${(durationMs / 1000).toFixed(1)}s`);
  console.log("=".repeat(60));

  if (allAnswers.length > 0) {
    console.log(`[Answer] (${allAnswers.length} turn(s))`);
    allAnswers.forEach((a, i) => {
      console.log(`\n--- Turn ${i + 1} ---`);
      console.log(a);
    });
    console.log("\n" + "=".repeat(60));
  }

  const resultData = {
    sessionId, threadId, initialQuestion: questions, durationMs,
    turnCount, rewriteCount, guard_result: guardResult,
    quality_score: qualityScore, close, escalated,
    answers: allAnswers,
    timestamp: new Date().toISOString(),
  };

  const summaryPath = join(RESULTS_DIR, `summary-${sessionId}.json`);
  writeFileSync(summaryPath, JSON.stringify(resultData, null, 2));
  console.log(`\n[saved] ${summaryPath}`);
}

if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
}
