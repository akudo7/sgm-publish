// works/full-harness/__tests__/full-harness.test.ts

import { readFileSync } from "fs";
import { join, dirname } from "path";
import {
  routeSprint,
  estimateTokens,
  checkContextReset,
  parseSprintContract,
  parseSprintResult,
  createRunMetadata,
  validateWorkflowConfig,
  validateNodes,
  validateEdges,
  type SprintContract,
  type SprintResult,
  type RunMetadata,
  type WorkflowNode,
  type WorkflowEdge,
} from "../full-harness.lib.js";

// ─── テストフィクスチャ ────────────────────────────────────────────────────────

function makeSprintContract(overrides: Partial<SprintContract> = {}): SprintContract {
  return {
    goals: ["implement feature X"],
    successCriteria: ["unit tests pass", "integration tests pass"],
    sprintNumber: 1,
    ...overrides,
  };
}

function makeSprintResult(overrides: Partial<SprintResult> = {}): SprintResult {
  return {
    passed: false,
    feedback: "tests failing",
    score: 60,
    ...overrides,
  };
}

function makeRunMetadata(overrides: Partial<RunMetadata> = {}): RunMetadata {
  return {
    runId: 1,
    startTime: new Date().toISOString(),
    durationMs: 1000,
    finalSprint: 1,
    finalPassed: false,
    finalScore: 60,
    contextResetCount: 0,
    totalRetries: 0,
    taskSpecLength: 100,
    ...overrides,
  };
}

// ─── 1. ワークフロー JSON 読み込み ─────────────────────────────────────────────

describe("Workflow JSON", () => {
  const WORKFLOW_JSON = join(__dirname, "../../../json/full-harness-workflow-qwen.json");

  it("ワークフロー JSON を正常に読み込めるべき", () => {
    const config = JSON.parse(readFileSync(WORKFLOW_JSON, "utf-8"));
    expect(config.config.info.version).toBeDefined();
    expect(config.config.info.description).toContain("Sprint Contract");
    expect(config.nodes.length).toBeGreaterThan(0);
    expect(config.edges.length).toBeGreaterThan(0);
  });

  it("4つのモデルが定義されているべき", () => {
    const config = JSON.parse(readFileSync(WORKFLOW_JSON, "utf-8"));
    expect(config.models).toHaveLength(4);
    const modelIds = config.models.map((m: any) => m.id);
    expect(modelIds).toContain("planner_model");
    expect(modelIds).toContain("negotiator_model");
    expect(modelIds).toContain("generator_model");
    expect(modelIds).toContain("evaluator_model");
  });

  it("11個のノードが定義されているべき", () => {
    const config = JSON.parse(readFileSync(WORKFLOW_JSON, "utf-8"));
    expect(config.nodes).toHaveLength(11);
  });

  it("再帰制限が150に設定されるべき", () => {
    const config = JSON.parse(readFileSync(WORKFLOW_JSON, "utf-8"));
    expect(config.config.recursionLimit).toBe(150);
  });

  it("Context Guard が有効に設定されるべき", () => {
    const config = JSON.parse(readFileSync(WORKFLOW_JSON, "utf-8"));
    expect(config.config.contextGuard?.enabled).toBe(true);
    expect(config.config.contextGuard?.modelContextLimit).toBe(200000);
    expect(config.config.contextGuard?.thresholdRatio).toBe(0.70);
  });
});

// ─── 2. Router Logic ──────────────────────────────────────────────────────────

describe("routeSprint()", () => {
  it("sprintResult が null の場合、generator_node を返すべき", () => {
    expect(routeSprint(null, 0)).toBe("generator_node");
  });

  it("sprintResult.passed === true の場合、__end__ を返すべき", () => {
    expect(routeSprint({ passed: true, feedback: "ok", score: 90 }, 1)).toBe("__end__");
  });

  it("retryCount >= MAX_RETRIES の場合、__end__ を返すべき", () => {
    expect(routeSprint({ passed: false, feedback: "fail", score: 50 }, 3)).toBe("__end__");
    expect(routeSprint({ passed: false, feedback: "fail", score: 50 }, 5)).toBe("__end__");
  });

  it("retryCount < MAX_RETRIES で失敗の場合、bootstrap_feedback_node を返すべき", () => {
    expect(routeSprint({ passed: false, feedback: "fail", score: 50 }, 0)).toBe("bootstrap_feedback_node");
    expect(routeSprint({ passed: false, feedback: "fail", score: 50 }, 2)).toBe("bootstrap_feedback_node");
  });

  it("カスタム MAX_RETRIES で動作するべき", () => {
    expect(routeSprint({ passed: false, feedback: "fail", score: 50 }, 2, 3)).toBe("bootstrap_feedback_node");
    expect(routeSprint({ passed: false, feedback: "fail", score: 50 }, 3, 3)).toBe("__end__");
  });
});

// ─── 3. Context Guard ─────────────────────────────────────────────────────────

describe("estimateTokens()", () => {
  it("空配列の場合は 0 を返すべき", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("文字列の content を推定トークン数に変換するべき", () => {
    // 400文字 → 100トークン
    const msg = { content: "a".repeat(400) };
    expect(estimateTokens([msg])).toBe(100);
  });

  it("オブジェクトの content は JSON.stringify 後に換算するべき", () => {
    const msg = { content: { text: "hello" } };
    const tokens = estimateTokens([msg]);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe("checkContextReset()", () => {
  it("しきい値未満の場合はリセットしないべき", () => {
    const messages = [{ content: "short" }];
    const result = checkContextReset(messages, [], 200000, 0.70);
    expect(result.shouldReset).toBe(false);
  });

  it("しきい値超えの場合はリセットするべき", () => {
    const longContent = "x".repeat(600000); // 150000 トークン > 140000 しきい値
    const messages = [{ content: longContent }];
    const result = checkContextReset(messages, [], 200000, 0.70);
    expect(result.shouldReset).toBe(true);
    expect(result.resetMessage).toContain("=== Context Reset: 重要な状態の引き継ぎ ===");
    expect(result.newResetCount).toBe(1);
  });

  it("taskSpec が引き継がれるべき", () => {
    const messages = [{ content: "x".repeat(600000) }];
    const result = checkContextReset(messages, [], 200000, 0.70, "some task spec");
    expect(result.shouldReset).toBe(true);
    expect(result.resetMessage).toContain("タスク仕様: some task spec");
  });

  it("sprintContract が引き継がれるべき", () => {
    const messages = [{ content: "x".repeat(600000) }];
    const contract = makeSprintContract();
    const result = checkContextReset(messages, [], 200000, 0.70, undefined, contract);
    expect(result.resetMessage).toContain("現在のSprintContract:");
  });

  it("既存の contextResetCount をインクリメントするべき", () => {
    const messages = [{ content: "x".repeat(600000) }];
    const result = checkContextReset(messages, [], 200000, 0.70, undefined, undefined, undefined, 0, 2);
    expect(result.newResetCount).toBe(3);
  });
});

// ─── 4. Sprint Contract / Result パーサー ─────────────────────────────────────

describe("parseSprintContract()", () => {
  it("有効な JSON からパースするべき", () => {
    const raw = `{"goals": ["fix bug"], "successCriteria": ["test passes"], "sprintNumber": 2}`;
    const result = parseSprintContract(raw, "some task", 2);
    expect(result.goals).toEqual(["fix bug"]);
    expect(result.successCriteria).toEqual(["test passes"]);
    expect(result.sprintNumber).toBe(2);
  });

  it("JSON パース失敗時はデフォルト値を返すべき", () => {
    const result = parseSprintContract("not json at all", "fix bug", 3);
    expect(result.goals).toEqual(["implement: fix bug"]);
    expect(result.successCriteria).toEqual(["task is complete"]);
    expect(result.sprintNumber).toBe(3);
  });

  it("goals が欠落時は taskSpec からのデフォルトを使用するべき", () => {
    const raw = `{"successCriteria": ["pass"], "sprintNumber": 1}`;
    const result = parseSprintContract(raw, "add feature", 1);
    expect(result.goals).toEqual(["implement: add feature"]);
  });
});

describe("parseSprintResult()", () => {
  it("有効な JSON からパースするべき", () => {
    const raw = `{"passed": false, "feedback": "tests fail", "score": 45}`;
    const result = parseSprintResult(raw);
    expect(result.passed).toBe(false);
    expect(result.feedback).toBe("tests fail");
    expect(result.score).toBe(45);
  });

  it("JSON パース失敗時はデフォルト値を返すべき", () => {
    const result = parseSprintResult("garbage");
    expect(result.passed).toBe(true);
    expect(result.feedback).toBe("evaluation complete");
    expect(result.score).toBe(80);
  });

  it("passed が明示的に false の場合のみ失敗とするべき", () => {
    const result = parseSprintResult(`{"passed": false, "feedback": "x", "score": 70}`);
    expect(result.passed).toBe(false);
  });
});

// ─── 5. Run Metadata ──────────────────────────────────────────────────────────

describe("createRunMetadata()", () => {
  it("デフォルト値を持つメタデータを生成するべき", () => {
    const meta = createRunMetadata();
    expect(meta.runId).toBe(1);
    expect(meta.startTime).toBeDefined();
    expect(meta.finalSprint).toBe(1);
    expect(meta.finalPassed).toBe(false);
  });

  it("オーバーライドできるべき", () => {
    const meta = createRunMetadata({
      runId: 5,
      finalPassed: true,
      finalScore: 95,
      contextResetCount: 3,
    });
    expect(meta.runId).toBe(5);
    expect(meta.finalPassed).toBe(true);
    expect(meta.finalScore).toBe(95);
    expect(meta.contextResetCount).toBe(3);
  });
});

// ─── 6. Workflow 検証 ─────────────────────────────────────────────────────────

describe("validateWorkflowConfig()", () => {
  it("有効な設定はエラーを返さないべき", () => {
    const errors = validateWorkflowConfig({
      version: "1.0.0",
      description: "test",
      recursionLimit: 100,
    });
    expect(errors).toHaveLength(0);
  });

  it("version がない場合はエラーを返すべき", () => {
    const errors = validateWorkflowConfig({
      version: "",
      description: "test",
      recursionLimit: 100,
    });
    expect(errors).toContain("config.version is required");
  });

  it("recursionLimit が負の場合はエラーを返すべき", () => {
    const errors = validateWorkflowConfig({
      version: "1.0.0",
      description: "test",
      recursionLimit: -1,
    });
    expect(errors).toContain("config.recursionLimit must be a positive number");
  });
});

describe("validateNodes()", () => {
  it("有効なノード配列はエラーを返さないべき", () => {
    const nodes: WorkflowNode[] = [
      { id: "node1", type: "function", handler: { function: "()", parameters: [], output: {} } },
    ];
    const errors = validateNodes(nodes);
    expect(errors).toHaveLength(0);
  });

  it("重複 ID がある場合はエラーを返すべき", () => {
    const nodes: WorkflowNode[] = [
      { id: "node1", type: "function", handler: { function: "()", parameters: [], output: {} } },
      { id: "node1", type: "function", handler: { function: "()", parameters: [], output: {} } },
    ];
    const errors = validateNodes(nodes);
    expect(errors).toContain("Duplicate node id: node1");
  });
});

describe("validateEdges()", () => {
  it("__start__ と __end__ を含まない有効なエッジはエラーを返さないべき", () => {
    const nodeIds = new Set(["node1", "node2"]);
    const edges: WorkflowEdge[] = [{ from: "node1", to: "node2" }];
    const errors = validateEdges(edges, nodeIds);
    expect(errors).toHaveLength(0);
  });

  it("存在しないノードを参照するエッジはエラーを返すべき", () => {
    const nodeIds = new Set(["node1"]);
    const edges: WorkflowEdge[] = [{ from: "node1", to: "node3" }];
    const errors = validateEdges(edges, nodeIds);
    expect(errors).toContain("Edge to unknown node: node3");
  });
});

// ─── 7. ワークフロー JSON 構造検証 ────────────────────────────────────────────

describe("Workflow JSON Structure", () => {
  const config = JSON.parse(readFileSync(join(__dirname, "../../../json/full-harness-workflow-qwen.json"), "utf-8"));

  it("全ノードに id が一意であるべき", () => {
    const ids = config.nodes.map((n: any) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("全ノードに handler.function が定義されているべき", () => {
    config.nodes.forEach((node: any) => {
      expect(node.handler.function).toBeDefined();
      expect(typeof node.handler.function).toBe("string");
      expect(node.handler.function.length).toBeGreaterThan(0);
    });
  });

  it("全エッジの from/target が有効なノードを参照するべき", () => {
    const nodeIds = new Set(config.nodes.map((n: any) => n.id));
    const errors = validateEdges(
      config.edges.map((e: any) => ({ from: e.from, to: e.to })),
      nodeIds as Set<string>
    );
    expect(errors).toHaveLength(0);
  });

  it("conditional edge が possibleTargets を持つべき", () => {
    const conditionalEdges = config.edges.filter((e: any) => e.type === "conditional");
    expect(conditionalEdges.length).toBe(1);
    expect(conditionalEdges[0].condition.possibleTargets).toContain("__end__");
  });
});
