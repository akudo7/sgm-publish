import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadSpecialists,
  filterSpecialists,
  deduplicateFindings,
  sortMergedEntries,
  findStartRun,
  SEVERITY_ORDER,
  type SpecialistDef,
  type RawFinding,
  type RunResult,
} from "../sourcehunt.lib.js";

// ─── テストフィクスチャ ────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<RawFinding> = {}): RawFinding {
  return {
    type: "buffer_overflow",
    severity: "high",
    description: "test finding",
    line: 100,
    filePath: "libavformat/mov.c",
    evidenceLevel: 2,
    ...overrides,
  };
}

function makeRunResult(runId: number, overrides: Partial<RunResult> = {}): RunResult {
  return {
    runId,
    startTime: new Date().toISOString(),
    durationMs: 1000,
    detected: true,
    targetFile: "libavformat/mov.c",
    targetRank: 1,
    targetScore: 0.9,
    maxEvidenceLevel: 2,
    reflexionCount: 3,
    stats: {},
    ...overrides,
  };
}

// ─── 1. specialists.json 読み込み ─────────────────────────────────────────────

describe("loadSpecialists()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `sourcehunt-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("正常な specialists.json を読み込む", () => {
    const specialists: SpecialistDef[] = [
      { name: "memory_safety", description: "OOB", guide: "Focus on: buffer overflows" },
      { name: "integer_overflow", description: "overflow", guide: "Focus on: integer" },
    ];
    writeFileSync(join(tmpDir, "specialists.json"), JSON.stringify(specialists));

    const result = loadSpecialists(join(tmpDir, "specialists.json"));
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("memory_safety");
    expect(result[1].name).toBe("integer_overflow");
  });

  test("ファイルが存在しない場合は例外を投げる", () => {
    expect(() => loadSpecialists(join(tmpDir, "nonexistent.json"))).toThrow(
      "specialists.json が見つかりません"
    );
  });

  test("空配列の場合は例外を投げる", () => {
    writeFileSync(join(tmpDir, "specialists.json"), "[]");
    expect(() => loadSpecialists(join(tmpDir, "specialists.json"))).toThrow(
      "エントリが1件もありません"
    );
  });

  test("配列でない場合は例外を投げる", () => {
    writeFileSync(join(tmpDir, "specialists.json"), '{"name":"x"}');
    expect(() => loadSpecialists(join(tmpDir, "specialists.json"))).toThrow(
      "配列である必要があります"
    );
  });

  test("name/description/guide が欠けている場合は例外を投げる", () => {
    writeFileSync(join(tmpDir, "specialists.json"), '[{"name":"x","description":"y"}]');
    expect(() => loadSpecialists(join(tmpDir, "specialists.json"))).toThrow(
      "name/description/guide が必要です"
    );
  });
});

// ─── 2. filterSpecialists() ───────────────────────────────────────────────────

describe("filterSpecialists()", () => {
  const specialists: SpecialistDef[] = [
    { name: "memory_safety", description: "", guide: "" },
    { name: "input_validation", description: "", guide: "" },
    { name: "integer_overflow", description: "", guide: "" },
  ];

  test("SPECIALIST_ENV 未指定時は全 specialist を返す", () => {
    const result = filterSpecialists(specialists, undefined);
    expect(result).toHaveLength(3);
  });

  test("存在する specialist 名を指定すると1件だけ返す", () => {
    const result = filterSpecialists(specialists, "input_validation");
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].name).toBe("input_validation");
  });

  test("存在しない specialist 名を指定すると null を返す", () => {
    const result = filterSpecialists(specialists, "unknown_specialist");
    expect(result).toBeNull();
  });
});

// ─── 3. deduplicateFindings() — dedup ロジック ───────────────────────────────

describe("deduplicateFindings()", () => {
  test("同一 filePath:line で evidenceLevel が高い方を残す", () => {
    const f1 = makeFinding({ filePath: "mov.c", line: 100, evidenceLevel: 1, description: "low" });
    const f2 = makeFinding({ filePath: "mov.c", line: 100, evidenceLevel: 2, description: "high" });

    const result = deduplicateFindings([
      { specialistName: "memory_safety", runId: 1, findings: [f1] },
      { specialistName: "integer_overflow", runId: 1, findings: [f2] },
    ]);

    expect(result.size).toBe(1);
    const entry = result.get("mov.c:100")!;
    expect(entry.finding.evidenceLevel).toBe(2);
    expect(entry.finding.description).toBe("high");
  });

  test("同一 filePath:line で複数 specialist が検出した場合、specialists Set に両方が入る", () => {
    const f = makeFinding({ filePath: "mov.c", line: 200, evidenceLevel: 2 });

    const result = deduplicateFindings([
      { specialistName: "memory_safety", runId: 1, findings: [f] },
      { specialistName: "input_validation", runId: 2, findings: [f] },
    ]);

    const entry = result.get("mov.c:200")!;
    expect(entry.specialists.size).toBe(2);
    expect(entry.specialists.has("memory_safety")).toBe(true);
    expect(entry.specialists.has("input_validation")).toBe(true);
  });

  test("異なる filePath:line は全件残る", () => {
    const f1 = makeFinding({ filePath: "mov.c", line: 100 });
    const f2 = makeFinding({ filePath: "mov.c", line: 200 });
    const f3 = makeFinding({ filePath: "avc.c", line: 100 });

    const result = deduplicateFindings([
      { specialistName: "memory_safety", runId: 1, findings: [f1, f2, f3] },
    ]);

    expect(result.size).toBe(3);
  });

  test("全 findings が空の場合は空 Map を返す", () => {
    const result = deduplicateFindings([
      { specialistName: "memory_safety", runId: 1, findings: [] },
      { specialistName: "integer_overflow", runId: 1, findings: [] },
    ]);
    expect(result.size).toBe(0);
  });

  test("runIds に specialist/run 識別子が記録される", () => {
    const f = makeFinding({ filePath: "mov.c", line: 100 });

    const result = deduplicateFindings([
      { specialistName: "memory_safety", runId: 3, findings: [f] },
    ]);

    const entry = result.get("mov.c:100")!;
    expect(entry.runIds.has("memory_safety/run-3")).toBe(true);
  });

  test("同一 evidenceLevel の場合は最初の finding を維持する", () => {
    const f1 = makeFinding({ filePath: "mov.c", line: 100, evidenceLevel: 2, description: "first" });
    const f2 = makeFinding({ filePath: "mov.c", line: 100, evidenceLevel: 2, description: "second" });

    const result = deduplicateFindings([
      { specialistName: "memory_safety", runId: 1, findings: [f1] },
      { specialistName: "integer_overflow", runId: 1, findings: [f2] },
    ]);

    expect(result.size).toBe(1);
    // 同 evidenceLevel では上書きしない
    expect(result.get("mov.c:100")!.finding.description).toBe("first");
  });
});

// ─── 4. sortMergedEntries() ───────────────────────────────────────────────────

describe("sortMergedEntries()", () => {
  function makeEntry(
    severity: string,
    specialists: string[],
    evidenceLevel = 2,
    filePath = "libavformat/mov.c"
  ) {
    return {
      finding: makeFinding({ severity, evidenceLevel, filePath }),
      specialists: new Set(specialists),
      runIds: new Set(["memory_safety/run-1"]),
    };
  }

  test("severity 順（critical > high > medium > low）でソートされる", () => {
    const entries = [
      makeEntry("low", ["a"]),
      makeEntry("critical", ["a"]),
      makeEntry("medium", ["a"]),
      makeEntry("high", ["a"]),
    ];
    const sorted = sortMergedEntries(entries);
    const severities = sorted.map((e) => e.finding.severity);
    expect(severities).toEqual(["critical", "high", "medium", "low"]);
  });

  test("同 severity では複数 specialist が検出したものが先", () => {
    const single = makeEntry("high", ["memory_safety"]);
    const multi = makeEntry("high", ["memory_safety", "integer_overflow"]);

    const sorted = sortMergedEntries([single, multi]);
    expect(sorted[0].specialists.size).toBe(2);
  });

  test("同 severity・同 specialist 数では evidenceLevel が高い方が先", () => {
    const low = makeEntry("high", ["memory_safety"], 1);
    const high = makeEntry("high", ["memory_safety"], 2);

    const sorted = sortMergedEntries([low, high]);
    expect(sorted[0].finding.evidenceLevel).toBe(2);
  });

  // ─── CVE-aware sort ───────────────────────────────────────────────────────

  test("cveMap あり: 同 severity・同 specialist 数で CVE 既知が先", () => {
    const noCve  = makeEntry("critical", ["memory_safety"], 2, "libavcodec/h264_slice.c");
    const hasCve = makeEntry("critical", ["memory_safety"], 2, "libavformat/mov.c");
    const cveMap = new Map([["mov.c", ["CVE-2022-2566"]]]);

    const sorted = sortMergedEntries([noCve, hasCve], cveMap);
    expect(sorted[0].finding.filePath).toBe("libavformat/mov.c");
  });

  test("cveMap あり: CVE > evidenceLevel（CVE Lv1 が non-CVE Lv2 より先）", () => {
    const highEv  = makeEntry("critical", ["memory_safety"], 2, "libavcodec/h264_slice.c");
    const lowEvCve = makeEntry("critical", ["memory_safety"], 1, "libavformat/mov.c");
    const cveMap  = new Map([["mov.c", ["CVE-2022-2566"]]]);

    const sorted = sortMergedEntries([highEv, lowEvCve], cveMap);
    expect(sorted[0].finding.filePath).toBe("libavformat/mov.c");
  });

  test("cveMap あり: specialist 数 > CVE（multi-specialist non-CVE が single-specialist CVE より先）", () => {
    const singleCve  = makeEntry("high", ["memory_safety"],                         2, "libavformat/mov.c");
    const multiNoCve = makeEntry("high", ["memory_safety", "integer_overflow"],     2, "libavcodec/h264_slice.c");
    const cveMap = new Map([["mov.c", ["CVE-2022-2566"]]]);

    const sorted = sortMergedEntries([singleCve, multiNoCve], cveMap);
    expect(sorted[0].specialists.size).toBe(2);
  });

  test("cveMap なし: CVE 基準をスキップし evidenceLevel で比較する", () => {
    const lv1 = makeEntry("high", ["memory_safety"], 1, "libavformat/mov.c");
    const lv2 = makeEntry("high", ["memory_safety"], 2, "libavcodec/h264_slice.c");

    const sorted = sortMergedEntries([lv1, lv2]);
    expect(sorted[0].finding.evidenceLevel).toBe(2);
  });

  test("cveMap に空 CVE 配列: CVE なし扱いになる", () => {
    const noCve  = makeEntry("high", ["memory_safety"], 2, "libavcodec/h264_slice.c");
    const empty  = makeEntry("high", ["memory_safety"], 1, "libavformat/mov.c");
    const cveMap = new Map([["mov.c", [] as string[]]]);

    const sorted = sortMergedEntries([empty, noCve], cveMap);
    // 空配列は CVE なし扱い → evidenceLevel が高い noCve が先
    expect(sorted[0].finding.evidenceLevel).toBe(2);
  });

  test("ソートは元の配列を破壊しない", () => {
    const entries = [
      makeEntry("low", ["a"]),
      makeEntry("critical", ["a"]),
    ];
    const original = [...entries];
    sortMergedEntries(entries);
    expect(entries[0].finding.severity).toBe(original[0].finding.severity);
  });
});

// ─── 5. findStartRun() — Resume ロジック ─────────────────────────────────────

describe("findStartRun()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `sourcehunt-resume-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeMetadata(runId: number, hasError = false) {
    const runDir = join(tmpDir, `run-${runId}`);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      join(runDir, "metadata.json"),
      JSON.stringify(makeRunResult(runId, hasError ? { error: "failed" } : {}))
    );
  }

  test("metadata.json が1件もない場合は startRun=1、completedRows=[]", () => {
    const { startRun, completedRows } = findStartRun(tmpDir, 5);
    expect(startRun).toBe(1);
    expect(completedRows).toHaveLength(0);
  });

  test("run-1, run-2 が完了済みなら startRun=3", () => {
    writeMetadata(1);
    writeMetadata(2);

    const { startRun, completedRows } = findStartRun(tmpDir, 5);
    expect(startRun).toBe(3);
    expect(completedRows).toHaveLength(2);
  });

  test("全 run が完了済みなら startRun=RUNS+1", () => {
    for (let i = 1; i <= 5; i++) writeMetadata(i);

    const { startRun, completedRows } = findStartRun(tmpDir, 5);
    expect(startRun).toBe(6);
    expect(completedRows).toHaveLength(5);
  });

  test("エラー終了した run は completedRows に含まれず、その run から再開", () => {
    writeMetadata(1);
    writeMetadata(2);
    writeMetadata(3, true); // run-3 はエラー

    const { startRun, completedRows } = findStartRun(tmpDir, 5);
    expect(startRun).toBe(3);
    expect(completedRows).toHaveLength(2);
    expect(completedRows.map((r) => r.runId)).toEqual([1, 2]);
  });

  test("run-1 完了、run-2 が存在しない場合は startRun=2", () => {
    writeMetadata(1);
    // run-2 は存在しない

    const { startRun, completedRows } = findStartRun(tmpDir, 5);
    expect(startRun).toBe(2);
    expect(completedRows).toHaveLength(1);
  });
});

// ─── 6. SEVERITY_ORDER 定数 ───────────────────────────────────────────────────

describe("SEVERITY_ORDER", () => {
  test("critical=0, high=1, medium=2, low=3", () => {
    expect(SEVERITY_ORDER["critical"]).toBe(0);
    expect(SEVERITY_ORDER["high"]).toBe(1);
    expect(SEVERITY_ORDER["medium"]).toBe(2);
    expect(SEVERITY_ORDER["low"]).toBe(3);
  });
});
