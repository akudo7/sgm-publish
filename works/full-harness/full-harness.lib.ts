/**
 * full-harness.lib.ts — テスト可能な純粋関数・型定義
 *
 * run.ts からインポートされ、ユニットテストからも直接インポートされる。
 * ファイルシステム・ネットワーク・process.exit に依存しない関数のみを配置する。
 */

// ─── 型定義 ───────────────────────────────────────────────────────────────────

export interface SprintContract {
  goals: string[];
  successCriteria: string[];
  sprintNumber: number;
}

export interface SprintResult {
  passed: boolean;
  feedback: string;
  score: number;
}

export interface WorkflowConfig {
  version: string;
  description: string;
  recursionLimit: number;
  contextGuard?: {
    enabled: boolean;
    modelContextLimit: number;
    thresholdRatio: number;
  };
}

export interface RunMetadata {
  runId: number;
  startTime: string;
  durationMs: number;
  finalSprint: number;
  finalPassed: boolean;
  finalScore: number;
  contextResetCount: number;
  totalRetries: number;
  taskSpecLength: number;
  error?: string;
}

export interface WorkflowNode {
  id: string;
  type: string;
  handler: {
    function: string;
    parameters: Array<{ name: string; parameterType: string }>;
    output: Record<string, unknown>;
  };
}

export interface WorkflowEdge {
  from: string;
  to?: string;
  type?: string;
  condition?: {
    name: string;
    handler: {
      function: string;
      possibleTargets: string[];
    };
  };
}

export interface WorkflowModel {
  id: string;
  type: string;
  config: {
    model: string;
    temperature: number;
    serverUrl: string;
  };
  systemPrompt: string;
}

// ─── Router Logic ─────────────────────────────────────────────────────────────

/**
 * router_node の condition ハンドラを純粋関数として実装する。
 *
 * - sprintResult が null → 'generator_node'
 * - sprintResult.passed === true → '__end__'
 * - retryCount >= MAX_RETRIES → '__end__'
 * - それ以外 → 'bootstrap_feedback_node'
 */
export function routeSprint(
  sprintResult: SprintResult | null,
  retryCount: number,
  maxRetries: number = 3
): "generator_node" | "bootstrap_feedback_node" | "__end__" {
  if (!sprintResult) {
    return "generator_node";
  }
  if (sprintResult.passed) {
    return "__end__";
  }
  if (retryCount >= maxRetries) {
    return "__end__";
  }
  return "bootstrap_feedback_node";
}

// ─── Context Guard ────────────────────────────────────────────────────────────

/**
 * メッセージの推定トークン数を計算する。
 * 1文字 ≈ 4バイト ≈ 0.25トークン と単純換算。
 */
export function estimateTokens(messages: Array<{ content: string | object }>): number {
  return messages.reduce((sum, msg) => {
    const c = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    return sum + Math.ceil(c.length / 4);
  }, 0);
}

/**
 * Context Guard の判定を行う。
 * THRESHOLD を超えた場合、状態を引き継ぎ用のメッセージを生成してリセットフラグを返す。
 */
export function checkContextReset(
  messages: Array<{ content: string | object }>,
  activeMessages: Array<{ content: string }>,
  limit: number,
  thresholdRatio: number,
  taskSpec?: string,
  sprintContract?: SprintContract | null,
  sprintResult?: SprintResult | null,
  retryCount?: number,
  contextResetCount?: number
): {
  shouldReset: boolean;
  tokens: number;
  resetMessage?: string;
  newResetCount?: number;
} {
  const allMessages = [...messages, ...activeMessages];
  const tokens = estimateTokens(allMessages);
  const threshold = limit * thresholdRatio;

  if (tokens < threshold) {
    return { shouldReset: false, tokens };
  }

  const newResetCount = (contextResetCount ?? 0) + 1;
  const parts = [
    "=== Context Reset: 重要な状態の引き継ぎ ===",
    taskSpec ? `タスク仕様: ${taskSpec}` : null,
    sprintContract ? `現在のSprintContract: ${JSON.stringify(sprintContract, null, 2)}` : null,
    sprintResult ? `前回の評価結果: ${JSON.stringify(sprintResult, null, 2)}` : null,
    `リトライ回数: ${retryCount ?? 0}`,
    "=== 以上を引き継いで作業を継続してください ===",
  ].filter(Boolean);

  return {
    shouldReset: true,
    tokens,
    resetMessage: parts.join("\n"),
    newResetCount,
  };
}

// ─── Sprint Contract ──────────────────────────────────────────────────────────

/**
 * taskSpec と feedback から SprintContract を生成する（パーサー風）。
 * raw に JSON が含まれていればパース、失敗すればデフォルト値を返す。
 */
export function parseSprintContract(
  raw: string,
  taskSpec: string,
  sprintNumber: number
): SprintContract {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    return {
      goals: parsed.goals || [`implement: ${taskSpec}`],
      successCriteria: parsed.successCriteria || ["task completed"],
      sprintNumber,
    };
  } catch {
    return {
      goals: [`implement: ${taskSpec}`],
      successCriteria: ["task is complete"],
      sprintNumber,
    };
  }
}

/**
 * evaluator の結果を SprintResult にパースする。
 */
export function parseSprintResult(raw: string): SprintResult {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    return {
      passed: parsed.passed !== false,
      feedback: parsed.feedback || "evaluated",
      score: typeof parsed.score === "number" ? parsed.score : 80,
    };
  } catch {
    return { passed: true, feedback: "evaluation complete", score: 80 };
  }
}

// ─── Run Metadata ─────────────────────────────────────────────────────────────

/**
 * RunMetadata を生成するヘルパー。
 */
export function createRunMetadata(overrides: Partial<RunMetadata> = {}): RunMetadata {
  return {
    runId: 1,
    startTime: new Date().toISOString(),
    durationMs: 0,
    finalSprint: 1,
    finalPassed: false,
    finalScore: 0,
    contextResetCount: 0,
    totalRetries: 0,
    taskSpecLength: 0,
    ...overrides,
  };
}

// ─── Workflow JSON 検証 ───────────────────────────────────────────────────────

/**
 * ワークフロー JSON が基本的な構造を持つことを検証する。
 */
export function validateWorkflowConfig(config: WorkflowConfig): string[] {
  const errors: string[] = [];

  if (!config.version) {
    errors.push("config.version is required");
  }
  if (!config.description) {
    errors.push("config.description is required");
  }
  if (typeof config.recursionLimit !== "number" || config.recursionLimit <= 0) {
    errors.push("config.recursionLimit must be a positive number");
  }

  return errors;
}

/**
 * ノード定義を検証する。
 */
export function validateNodes(nodes: WorkflowNode[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const node of nodes) {
    if (!node.id) {
      errors.push("Node must have an id");
    }
    if (ids.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`);
    }
    ids.add(node.id);
    if (!node.handler?.function) {
      errors.push(`Node ${node.id} must have a handler.function`);
    }
  }

  return errors;
}

/**
 * エッジ定義を検証する。
 */
export function validateEdges(edges: WorkflowEdge[], nodeIds: Set<string>): string[] {
  const errors: string[] = [];

  for (const edge of edges) {
    if (edge.from === "__start__" || edge.from === "__end__") {
      continue;
    }
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge from unknown node: ${edge.from}`);
    }
    if (edge.to && edge.from !== "__start__" && !nodeIds.has(edge.to)) {
      errors.push(`Edge to unknown node: ${edge.to}`);
    }
  }

  return errors;
}
