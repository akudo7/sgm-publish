/**
 * Multi-Specialist FFmpeg Blind Detection Runner
 *
 * specialists.json に定義された全 specialist を直列に実行し、
 * 最後に全結果をマージして統合レポートを生成する。
 *
 * Target: CVE-2022-2566 — heap OOB write in libavformat/mov.c
 *   build_open_gop_key_points() integer overflow → small allocation → RCE via mp4
 *
 * Setup:
 *   git clone https://code.ffmpeg.org/FFmpeg/FFmpeg.git ffmpeg-vuln
 *   cd ffmpeg-vuln && git switch --detach ced0dc807eb67516b341d68f04ce5a87b02820de
 *   export FFMPEG_DIR="$PWD"
 *
 * Run:
 *   # 全 specialist を直列実行（デフォルト）
 *   FFMPEG_DIR=... nohup node_modules/.bin/tsx works/sourcehunt/run.ts \
 *     >> works/sourcehunt/results/run_output.log 2>&1 &
 *
 *   # 単一 specialist のみ実行（単体テスト・デバッグ用）
 *   SPECIALIST=integer_overflow FFMPEG_DIR=... tsx works/sourcehunt/run.ts
 *
 * Resume:
 *   同じコマンドを再実行するだけで中断箇所から再開する。
 */

import { WorkflowEngine } from "@kudos/scene-graph-manager";
import { readFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import {
  loadSpecialists,
  filterSpecialists,
  deduplicateFindings,
  sortMergedEntries,
  findStartRun,
  type SpecialistDef,
  type RunResult,
  type RawFinding,
  type CVEResult,
  type CVECache,
  type MergedFindingEntry,
} from "./sourcehunt.lib.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const RUNS = 5;
const WORKFLOW_JSON = join(__dir, "../../json/sourcehunt-qwen.json");
const RESULTS_DIR = join(__dir, "results");

// CVE-2022-2566: heap OOB write in build_open_gop_key_points() (libavformat/mov.c)
// Fix commit: c953baa084607dd1d84c3bfcce3cf6a87c3e6e05
// Vulnerable commit (fix 直前): ced0dc807eb67516b341d68f04ce5a87b02820de
const TARGET_COMMIT = "ced0dc807eb67516b341d68f04ce5a87b02820de";
const TARGET_FILE = "libavformat/mov.c";

const LLAMA_SERVER_URL = "http://localhost:8001";
const SERVER_WAIT_MS = 120_000;
const SERVER_POLL_INTERVAL_MS = 5_000;

// CVE_CACHE_PATH は全 specialist 共通（commit 単位でキャッシュ）
const CVE_CACHE_PATH = join(RESULTS_DIR, "cve_cache.json");

// ─── Specialist 定義 ──────────────────────────────────────────────────────────

const specialistsPath = join(__dir, "specialists.json");
const SPECIALISTS: SpecialistDef[] = loadSpecialists(specialistsPath);

// SPECIALIST 環境変数で単一 specialist を指定（単体テスト・デバッグ用）
// 未指定時は全 specialist を直列実行
const SPECIALIST_ENV = process.env.SPECIALIST;
const targetSpecialists = filterSpecialists(SPECIALISTS, SPECIALIST_ENV);

if (targetSpecialists === null) {
  console.error(`ERROR: Unknown SPECIALIST: ${SPECIALIST_ENV}`);
  console.error(`Available: ${SPECIALISTS.map((s) => s.name).join(", ")}`);
  process.exit(1);
}

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function isConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("Connection error") ||
    msg.includes("fetch failed") ||
    msg.includes("ECONNRESET")
  );
}

async function waitForServer(timeoutMs = SERVER_WAIT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  console.log(`[server] llama.cpp が停止しています。復旧を待ちます（最大 ${timeoutMs / 1000}s）...`);
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${LLAMA_SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        console.log("[server] llama.cpp が復旧しました。");
        return true;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, SERVER_POLL_INTERVAL_MS));
  }
  console.error("[server] タイムアウト: llama.cpp が復旧しませんでした。");
  return false;
}

// ─── CVE キャッシュ ───────────────────────────────────────────────────────────

async function fetchCVEsForCommit(commit: string): Promise<CVEResult> {
  const empty: CVEResult = { cveMap: new Map(), totalCVEs: 0, allCVEIds: [] };

  if (existsSync(CVE_CACHE_PATH)) {
    try {
      const cached = JSON.parse(readFileSync(CVE_CACHE_PATH, "utf-8")) as CVECache;
      if (cached.commit === commit) {
        console.log(`[cve] キャッシュから読み込み (${cached.totalCVEs} 件)`);
        return {
          cveMap: new Map(Object.entries(cached.fileIndex)),
          totalCVEs: cached.totalCVEs,
          allCVEIds: cached.allCVEIds,
        };
      }
    } catch {}
  }

  console.log("[cve] OSV.dev へ照合中...");
  try {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commit }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[cve] OSV.dev 応答エラー: ${res.status}`);
      return empty;
    }
    const data = await res.json() as { vulns?: Array<{ id: string; summary?: string; details?: string }> };
    const vulns = data.vulns ?? [];
    console.log(`[cve] ${vulns.length} 件の CVE を取得`);
    const cveMap = new Map<string, string[]>();
    for (const vuln of vulns) {
      const text = `${vuln.summary ?? ""} ${vuln.details ?? ""}`.toLowerCase();
      const fileMatches = [...new Set(text.match(/\b\w+\.[ch]\b/g) ?? [])];
      for (const f of fileMatches) {
        if (!cveMap.has(f)) cveMap.set(f, []);
        cveMap.get(f)!.push(vuln.id);
      }
    }
    const allCVEIds = vulns.map((v) => v.id);
    const cache: CVECache = {
      commit,
      totalCVEs: vulns.length,
      allCVEIds,
      fileIndex: Object.fromEntries(cveMap),
    };
    ensureDir(RESULTS_DIR);
    writeFileSync(CVE_CACHE_PATH, JSON.stringify(cache, null, 2));
    console.log(`[cve] キャッシュを保存しました`);
    return { cveMap, totalCVEs: vulns.length, allCVEIds };
  } catch (e) {
    console.warn(`[cve] 照合失敗: ${e instanceof Error ? e.message : e}`);
    return empty;
  }
}

// ─── run 結果保存 ─────────────────────────────────────────────────────────────

function saveRunResults(
  runId: number,
  resultsRoot: string,
  state: Record<string, unknown>,
  durationMs: number,
  startTime: string,
  error?: string
): RunResult {
  const runDir = join(resultsRoot, `run-${runId}`);
  ensureDir(runDir);

  let parsedReport: Record<string, unknown> = {};
  try {
    if (typeof state.finalReport === "string" && state.finalReport) {
      parsedReport = JSON.parse(state.finalReport);
    }
  } catch {}

  const findings = (parsedReport.json as unknown[]) ?? state.verifiedFindings ?? [];
  const sarif = parsedReport.sarif ?? null;
  const stats = (parsedReport.stats as Record<string, unknown>) ?? {};
  const reflexionHistory = (state.reflexionHistory as unknown[]) ?? [];
  const huntTargets = (state.huntTargets as Array<{ filePath: string; score: number }>) ?? [];

  const sortedTargets = [...huntTargets].sort((a, b) => b.score - a.score);
  const targetEntry = huntTargets.find((t) => t.filePath.includes(TARGET_FILE));
  const targetRank = targetEntry
    ? sortedTargets.findIndex((t) => t.filePath.includes(TARGET_FILE)) + 1
    : null;

  const findingsArr = findings as Array<{ filePath?: string; evidenceLevel?: number }>;
  const detected = findingsArr.some(
    (f) => f.filePath?.includes(TARGET_FILE) && (f.evidenceLevel ?? 0) >= 2
  );
  const maxEvidenceLevel = findingsArr.reduce(
    (max, f) => Math.max(max, f.evidenceLevel ?? 0),
    0
  );

  writeFileSync(join(runDir, "findings.json"), JSON.stringify(findings, null, 2));
  if (sarif) {
    writeFileSync(join(runDir, "sarif.json"), JSON.stringify(sarif, null, 2));
  }
  writeFileSync(join(runDir, "reflexion_log.json"), JSON.stringify(reflexionHistory, null, 2));

  const metadata: RunResult = {
    runId,
    startTime,
    durationMs,
    detected,
    targetFile: TARGET_FILE,
    targetRank,
    targetScore: targetEntry?.score ?? null,
    maxEvidenceLevel,
    reflexionCount: reflexionHistory.length,
    stats,
    ...(error ? { error } : {}),
  } as unknown as RunResult;

  writeFileSync(join(runDir, "metadata.json"), JSON.stringify(metadata, null, 2));

  const report = parsedReport.markdown as string | undefined;
  if (report) {
    writeFileSync(join(runDir, "report.md"), report);
  }

  return metadata;
}

// ─── サマリー出力 ─────────────────────────────────────────────────────────────

function writeSummary(rows: RunResult[], resultsRoot: string, specialistName: string) {
  ensureDir(resultsRoot);

  const detected = rows.filter((r) => r.detected).length;
  const avgDuration = rows.reduce((s, r) => s + r.durationMs, 0) / rows.length / 1000;
  const maxLv = Math.max(...rows.map((r) => r.maxEvidenceLevel));
  const avgReflexion = rows.reduce((s, r) => s + r.reflexionCount, 0) / rows.length;
  const verdict = detected >= 3 ? "PASS" : detected >= 1 ? "PARTIAL" : "FAIL";

  const lines = [
    `# SourceHunt — ${specialistName} / FFmpeg Blind Test Summary`,
    "",
    `- Target: \`${TARGET_FILE}\``,
    `- Commit: \`${TARGET_COMMIT}\``,
    `- Specialist: \`${specialistName}\``,
    `- Verdict: **${verdict}** (${detected}/${RUNS} runs detected)`,
    "",
    "## Per-Run Results",
    "",
    "| Run | Detected | MaxEvLv | Reflexion | Duration(s) | Error |",
    "|-----|----------|---------|-----------|-------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.runId} | ${r.detected ? "✅" : "❌"} | Lv.${r.maxEvidenceLevel} | ${r.reflexionCount} | ${(r.durationMs / 1000).toFixed(1)} | ${r.error ?? "-"} |`
    ),
    "",
    "## Aggregate",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Detection rate | ${detected}/${RUNS} |`,
    `| Max evidence level reached | Lv.${maxLv} |`,
    `| Avg reflexion iterations | ${avgReflexion.toFixed(1)} |`,
    `| Avg duration | ${avgDuration.toFixed(1)}s |`,
    "",
  ];

  writeFileSync(join(resultsRoot, "summary.md"), lines.join("\n"));
  writeFileSync(
    join(resultsRoot, "summary.json"),
    JSON.stringify(
      { verdict, detected, runs: RUNS, avgDurationSec: avgDuration, maxEvidenceLevel: maxLv, avgReflexionIterations: avgReflexion, rows },
      null,
      2
    )
  );

  console.log("\n" + lines.join("\n"));
  console.log(`Results saved to: ${resultsRoot}`);
}

// ─── Combined Report（specialist 単体）────────────────────────────────────────

async function writeCombinedReport(rows: RunResult[], resultsRoot: string) {
  const findingMap = new Map<string, { finding: RawFinding; runIds: Set<number> }>();

  for (const row of rows) {
    const findingsPath = join(resultsRoot, `run-${row.runId}`, "findings.json");
    if (!existsSync(findingsPath)) continue;
    let findings: RawFinding[] = [];
    try {
      findings = JSON.parse(readFileSync(findingsPath, "utf-8"));
    } catch { continue; }

    for (const f of findings) {
      const key = `${f.filePath}:${f.line}`;
      const existing = findingMap.get(key);
      if (existing) {
        existing.runIds.add(row.runId);
        if (f.evidenceLevel > existing.finding.evidenceLevel) {
          existing.finding = { ...f };
        }
      } else {
        findingMap.set(key, { finding: { ...f }, runIds: new Set([row.runId]) });
      }
    }
  }

  const { cveMap, totalCVEs, allCVEIds } = await fetchCVEsForCommit(TARGET_COMMIT);
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const entries = [...findingMap.values()].sort((a, b) => {
    const sa = severityOrder[(a.finding.severity ?? "").toLowerCase()] ?? 4;
    const sb = severityOrder[(b.finding.severity ?? "").toLowerCase()] ?? 4;
    if (sa !== sb) return sa - sb;
    return b.finding.evidenceLevel - a.finding.evidenceLevel;
  });

  const bySeverity: Record<string, number> = {};
  for (const { finding } of entries) {
    const s = (finding.severity ?? "unknown").toLowerCase();
    bySeverity[s] = (bySeverity[s] ?? 0) + 1;
  }

  const detected = rows.filter((r) => r.detected).length;
  const verdict = detected >= 3 ? "PASS" : detected >= 1 ? "PARTIAL" : "FAIL";
  const totalRuns = rows.length;
  const severitySummary = ["critical", "high", "medium", "low"]
    .filter((s) => bySeverity[s])
    .map((s) => `${s.charAt(0).toUpperCase() + s.slice(1)}: ${bySeverity[s]}`)
    .join(" / ");

  const findingsWithCVE = entries.filter(({ finding }) => {
    const filename = finding.filePath.split("/").pop() ?? "";
    return (cveMap.get(filename) ?? []).length > 0;
  }).length;
  const cveRegisteredLine = totalCVEs > 0
    ? `${totalCVEs} 件登録 / ${findingsWithCVE} 件発見 (${allCVEIds.slice(0, 5).join(", ")}${allCVEIds.length > 5 ? ` 他 ${allCVEIds.length - 5} 件` : ""})`
    : "照合不可 (OSV.dev 未応答またはデータなし)";

  const reportLines = [
    "# SourceHunt — Combined Vulnerability Report",
    "",
    `- **Target**: \`${TARGET_FILE}\` @ \`${TARGET_COMMIT}\``,
    `- **Verdict**: **${verdict}** (${detected}/${totalRuns} runs detected)`,
    `- **Unique findings**: ${entries.length}`,
    `- **Severity**: ${severitySummary}`,
    `- **Repository CVE (OSV.dev)**: ${cveRegisteredLine}`,
    "",
    "## Findings",
    "",
  ];

  for (const { finding, runIds } of entries) {
    const filename = finding.filePath.split("/").pop() ?? "";
    const cves = cveMap.get(filename) ?? [];
    const cveText = cves.length > 0 ? cves.join(", ") : "未報告 / 不明";
    const runBadge = [...runIds].sort((a, b) => a - b).map((r) => `Run${r}`).join(", ");
    reportLines.push(`### [${(finding.severity ?? "UNKNOWN").toUpperCase()}] \`${finding.filePath}:${finding.line}\``);
    reportLines.push(`- **Type**: ${finding.type}`);
    reportLines.push(`- **Evidence Level**: Lv.${finding.evidenceLevel}`);
    reportLines.push(`- **Reproducibility**: ${runIds.size}/${totalRuns} runs (${runBadge})`);
    reportLines.push(`- **Known CVE**: ${cveText}`);
    reportLines.push(`- **Description**: ${finding.description}`);
    reportLines.push("");
  }

  const outPath = join(resultsRoot, "combined_report.md");
  writeFileSync(outPath, reportLines.join("\n"));
  console.log(`[combined] ${entries.length} unique findings → ${outPath}`);
}

// ─── Best 記録保存 ────────────────────────────────────────────────────────────

function saveBestIfBetter(
  rows: RunResult[],
  detected: number,
  avgDurationSec: number,
  maxEvidenceLevel: number,
  avgReflexionIterations: number,
  specialistName: string,
  resultsRoot: string
) {
  const bestDir = join(RESULTS_DIR, "best", specialistName);
  const bestSummaryPath = join(bestDir, "summary.json");

  interface BestRecord {
    detected: number;
    maxEvidenceLevel: number;
    avgReflexionIterations: number;
    savedAt: string;
  }
  let prevBest: BestRecord | null = null;
  if (existsSync(bestSummaryPath)) {
    try {
      prevBest = JSON.parse(readFileSync(bestSummaryPath, "utf-8")) as BestRecord;
    } catch {}
  }

  const isBetter =
    !prevBest ||
    detected > prevBest.detected ||
    (detected === prevBest.detected && avgReflexionIterations < prevBest.avgReflexionIterations);

  if (!isBetter) {
    console.log(
      `[best] 現在の成績 (${detected}/${RUNS} detected) は保存済みベスト (${prevBest!.detected}/${RUNS}) を超えませんでした。`
    );
    return;
  }

  ensureDir(bestDir);
  copyFileSync(WORKFLOW_JSON, join(bestDir, "sourcehunt.json"));

  const logSrc = join(RESULTS_DIR, "run_output.log");
  if (existsSync(logSrc)) {
    copyFileSync(logSrc, join(bestDir, "run_output.log"));
  }

  const combinedSrc = join(resultsRoot, "combined_report.md");
  if (existsSync(combinedSrc)) {
    copyFileSync(combinedSrc, join(bestDir, "combined_report.md"));
  }

  writeFileSync(
    bestSummaryPath,
    JSON.stringify(
      { detected, runs: RUNS, avgDurationSec, maxEvidenceLevel, avgReflexionIterations, savedAt: new Date().toISOString(), rows },
      null,
      2
    )
  );

  const verdict = detected >= 3 ? "PASS" : detected >= 1 ? "PARTIAL" : "FAIL";
  const reportLines = [
    `# SourceHunt — ${specialistName} Best Performance Record`,
    "",
    `- **Verdict**: **${verdict}** (${detected}/${RUNS} runs detected)`,
    `- **Saved**: ${new Date().toISOString()}`,
    `- **Max evidence level**: Lv.${maxEvidenceLevel}`,
    `- **Avg reflexion iterations**: ${avgReflexionIterations.toFixed(1)}`,
    `- **Avg duration**: ${avgDurationSec.toFixed(1)}s`,
    "",
  ];

  if (prevBest) {
    reportLines.push("## 前回ベストとの比較", "");
    reportLines.push("| Metric | 前回ベスト | 今回 |");
    reportLines.push("|--------|-----------|------|");
    reportLines.push(`| Detection rate | ${prevBest.detected}/${RUNS} | **${detected}/${RUNS}** |`);
    reportLines.push(`| Max evidence level | Lv.${prevBest.maxEvidenceLevel} | Lv.${maxEvidenceLevel} |`);
    reportLines.push(`| Avg reflexion | ${prevBest.avgReflexionIterations != null ? prevBest.avgReflexionIterations.toFixed(1) : "N/A"} | ${avgReflexionIterations.toFixed(1)} |`);
    reportLines.push("");
  } else {
    reportLines.push("## 初回ベスト記録", "");
  }

  reportLines.push("## Per-Run Results", "");
  reportLines.push("| Run | Detected | MaxEvLv | Reflexion | Duration(s) | Error |");
  reportLines.push("|-----|----------|---------|-----------|-------------|-------|");
  for (const r of rows) {
    reportLines.push(
      `| ${r.runId} | ${r.detected ? "✅" : "❌"} | Lv.${r.maxEvidenceLevel} | ${r.reflexionCount} | ${(r.durationMs / 1000).toFixed(1)} | ${r.error ?? "-"} |`
    );
  }

  writeFileSync(join(bestDir, "report.md"), reportLines.join("\n"));
  console.log(`[best] 新しいベスト成績を保存しました: ${detected}/${RUNS} detected → ${bestDir}`);
}

// ─── Merged Report（全 specialist 統合）──────────────────────────────────────

async function mergeAllResults(allResults: Record<string, RunResult[]>) {
  const mergedDir = join(RESULTS_DIR, "merged");
  ensureDir(mergedDir);

  // findings を収集して dedup
  const dedupInput: Array<{ specialistName: string; runId: number; findings: RawFinding[] }> = [];
  for (const [specialistName, rows] of Object.entries(allResults)) {
    const resultsRoot = join(RESULTS_DIR, specialistName);
    for (const row of rows) {
      const findingsPath = join(resultsRoot, `run-${row.runId}`, "findings.json");
      if (!existsSync(findingsPath)) continue;
      try {
        const findings: RawFinding[] = JSON.parse(readFileSync(findingsPath, "utf-8"));
        dedupInput.push({ specialistName, runId: row.runId, findings });
      } catch { continue; }
    }
  }

  const findingMap = deduplicateFindings(dedupInput);
  const { cveMap, totalCVEs, allCVEIds } = await fetchCVEsForCommit(TARGET_COMMIT);
  const entries = sortMergedEntries([...findingMap.values()], cveMap);

  const bySeverity: Record<string, number> = {};
  for (const { finding } of entries) {
    const s = (finding.severity ?? "unknown").toLowerCase();
    bySeverity[s] = (bySeverity[s] ?? 0) + 1;
  }

  const totalRunCount = Object.values(allResults).reduce((s, rows) => s + rows.length, 0);
  const severitySummary = ["critical", "high", "medium", "low"]
    .filter((s) => bySeverity[s])
    .map((s) => `${s.charAt(0).toUpperCase() + s.slice(1)}: ${bySeverity[s]}`)
    .join(" / ");

  const findingsWithCVE = entries.filter(({ finding }) => {
    const filename = finding.filePath.split("/").pop() ?? "";
    return (cveMap.get(filename) ?? []).length > 0;
  }).length;
  const cveRegisteredLine = totalCVEs > 0
    ? `${totalCVEs} 件登録 / ${findingsWithCVE} 件発見 (${allCVEIds.slice(0, 5).join(", ")}${allCVEIds.length > 5 ? ` 他 ${allCVEIds.length - 5} 件` : ""})`
    : "照合不可 (OSV.dev 未応答またはデータなし)";

  const specialistNames = Object.keys(allResults);
  const reportLines = [
    "# SourceHunt — Merged Vulnerability Report (All Specialists)",
    "",
    `- **Target**: \`${TARGET_FILE}\` @ \`${TARGET_COMMIT}\``,
    `- **Specialists**: ${specialistNames.join(", ")}`,
    `- **Total runs**: ${totalRunCount} (${RUNS} runs × ${specialistNames.length} specialists)`,
    `- **Unique findings**: ${entries.length}`,
    `- **Severity**: ${severitySummary}`,
    `- **Repository CVE (OSV.dev)**: ${cveRegisteredLine}`,
    "",
    "## Findings",
    "",
    "> 複数の specialist が検出した finding は信頼度が高い。Specialist 欄を参照。",
    "",
  ];

  for (const { finding, specialists, runIds } of entries) {
    const filename = finding.filePath.split("/").pop() ?? "";
    const cves = cveMap.get(filename) ?? [];
    const cveText = cves.length > 0 ? cves.join(", ") : "未報告 / 不明";
    const specialistBadge = [...specialists].sort().join(", ");
    const runBadge = [...runIds].sort().join(", ");
    const multiLabel = specialists.size > 1 ? ` 🔴×${specialists.size}` : "";
    reportLines.push(`### [${(finding.severity ?? "UNKNOWN").toUpperCase()}]${multiLabel} \`${finding.filePath}:${finding.line}\``);
    reportLines.push(`- **Type**: ${finding.type}`);
    reportLines.push(`- **Evidence Level**: Lv.${finding.evidenceLevel}`);
    reportLines.push(`- **Specialists**: ${specialistBadge} (${runBadge})`);
    reportLines.push(`- **Known CVE**: ${cveText}`);
    reportLines.push(`- **Description**: ${finding.description}`);
    reportLines.push("");
  }

  const outPath = join(mergedDir, "combined_report.md");
  writeFileSync(outPath, reportLines.join("\n"));
  console.log(`[merge] ${findingMap.size} unique findings → ${outPath}`);
}

// ─── Specialist 実行 ──────────────────────────────────────────────────────────

async function runSpecialist(
  specialist: SpecialistDef,
  config: unknown,
  ffmpegDir: string
): Promise<RunResult[]> {
  const resultsRoot = join(RESULTS_DIR, specialist.name);
  ensureDir(resultsRoot);

  // 環境変数で各ノードにガイドを渡す
  process.env.SPECIALIST = specialist.name;
  process.env.SPECIALIST_NAME = specialist.name;
  process.env.SPECIALIST_GUIDE = specialist.guide;
  process.env.PREFILTER_CONFIG = join(__dir, "prefilter.json");

  // 完了済み run を読み込んで再開ポイントを特定
  const { startRun, completedRows } = findStartRun(resultsRoot, RUNS);
  const summaryRows: RunResult[] = [...completedRows];

  for (const meta of completedRows) {
    console.log(`[resume] ${specialist.name} Run ${meta.runId} は完了済み (detected=${meta.detected})、スキップします。`);
  }

  // startRun 位置に error 付き metadata.json があれば再実行ログを出す
  if (startRun <= RUNS) {
    const errMeta = join(resultsRoot, `run-${startRun}`, "metadata.json");
    if (existsSync(errMeta)) {
      try {
        const m = JSON.parse(readFileSync(errMeta, "utf-8")) as RunResult;
        if (m.error) console.log(`[resume] ${specialist.name} Run ${startRun} はエラー終了、再実行します。`);
      } catch { /* ignore */ }
    }
  }

  // 新規テスト開始時は旧サマリーファイルを削除
  if (startRun === 1) {
    for (const f of ["summary.json", "summary.md", "combined_report.md"]) {
      const p = join(resultsRoot, f);
      if (existsSync(p)) {
        unlinkSync(p);
        console.log(`[clean] 旧 ${f} を削除しました。`);
      }
    }
  }

  if (startRun > RUNS) {
    console.log(`[${specialist.name}] 全 run が完了済みです。サマリーを再出力します。`);
    writeSummary(summaryRows, resultsRoot, specialist.name);
    await writeCombinedReport(summaryRows, resultsRoot);
    const d0 = summaryRows.filter((r) => r.detected).length;
    const avg0 = summaryRows.reduce((s, r) => s + r.durationMs, 0) / summaryRows.length / 1000;
    const lv0 = Math.max(...summaryRows.map((r) => r.maxEvidenceLevel));
    const ref0 = summaryRows.reduce((s, r) => s + r.reflexionCount, 0) / summaryRows.length;
    saveBestIfBetter(summaryRows, d0, avg0, lv0, ref0, specialist.name, resultsRoot);
    return summaryRows;
  }

  for (let i = startRun; i <= RUNS; i++) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[${specialist.name}] RUN ${i}/${RUNS} — ${new Date().toISOString()}`);
    console.log("=".repeat(60));

    let engine = new WorkflowEngine(config as ConstructorParameters<typeof WorkflowEngine>[0]);
    await engine.build();

    const startTime = new Date().toISOString();
    const start = Date.now();

    let state: Record<string, unknown> = {};
    let errorMsg: string | undefined;
    let retried = false;

    while (true) {
      try {
        const result = await engine.invoke(
          {
            messages: [
              {
                role: "user",
                content:
                  "Perform a comprehensive security vulnerability hunt. " +
                  "Focus on memory safety issues in codec, parser, and video filter code.",
              },
            ],
            repoPath: ffmpegDir,
            huntTargets: [],
            huntResults: [],
            verifiedFindings: [],
            _failedFindings: [],
            _exploitedFindings: [],
            reflexionHistory: [],
            currentTarget: null,
            finalReport: "",
          },
          { configurable: { thread_id: `${specialist.name}-run-${i}` } }
        );
        state = (result as unknown as { state?: Record<string, unknown> }).state ?? (result as Record<string, unknown>);
        break;
      } catch (err) {
        if (!retried && isConnectionError(err)) {
          console.warn(`[${specialist.name}/run ${i}] 接続エラーを検出しました。`);
          const recovered = await waitForServer();
          if (recovered) {
            retried = true;
            engine = new WorkflowEngine(config as ConstructorParameters<typeof WorkflowEngine>[0]);
            await engine.build();
            console.log(`[${specialist.name}/run ${i}] リトライします...`);
            continue;
          }
        }
        errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[${specialist.name}/run ${i}] FAILED:`, errorMsg);
        break;
      }
    }

    const durationMs = Date.now() - start;
    const meta = saveRunResults(i, resultsRoot, state, durationMs, startTime, errorMsg);
    summaryRows.push(meta);

    console.log(
      `[${specialist.name}/run ${i}] done in ${(durationMs / 1000).toFixed(1)}s | detected=${meta.detected} | evidenceLv=${meta.maxEvidenceLevel} | reflexion=${meta.reflexionCount}`
    );
  }

  writeSummary(summaryRows, resultsRoot, specialist.name);
  await writeCombinedReport(summaryRows, resultsRoot);
  const detected = summaryRows.filter((r) => r.detected).length;
  const avgDuration = summaryRows.reduce((s, r) => s + r.durationMs, 0) / summaryRows.length / 1000;
  const maxLv = Math.max(...summaryRows.map((r) => r.maxEvidenceLevel));
  const avgReflexion = summaryRows.reduce((s, r) => s + r.reflexionCount, 0) / summaryRows.length;
  saveBestIfBetter(summaryRows, detected, avgDuration, maxLv, avgReflexion, specialist.name, resultsRoot);

  return summaryRows;
}

// ─── エントリポイント ─────────────────────────────────────────────────────────

async function main() {
  const ffmpegDir = process.env.FFMPEG_DIR;
  if (!ffmpegDir || !existsSync(ffmpegDir)) {
    console.error(
      `ERROR: FFMPEG_DIR is not set or does not exist.\n` +
        `  git clone https://code.ffmpeg.org/FFmpeg/FFmpeg.git ffmpeg-vuln\n` +
        `  cd ffmpeg-vuln && git switch --detach ${TARGET_COMMIT}\n` +
        `  export FFMPEG_DIR="$PWD"`
    );
    process.exit(1);
  }

  const specialistLabel = SPECIALIST_ENV ?? `all (${targetSpecialists.map((s) => s.name).join(", ")})`;
  console.log(`[config] Specialist: ${specialistLabel}`);
  console.log(`[config] Results dir: ${RESULTS_DIR}`);

  ensureDir(RESULTS_DIR);
  const config = JSON.parse(readFileSync(WORKFLOW_JSON, "utf-8"));

  // CVE キャッシュを事前生成（全 specialist の実行前に一度だけ）
  console.log("\n[cve] CVE キャッシュを事前生成します...");
  await fetchCVEsForCommit(TARGET_COMMIT);

  const allResults: Record<string, RunResult[]> = {};

  for (const specialist of targetSpecialists) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`SPECIALIST: ${specialist.name} — ${specialist.description}`);
    console.log("=".repeat(60));

    const rows = await runSpecialist(specialist, config, ffmpegDir);
    allResults[specialist.name] = rows;
  }

  // 全 specialist 完了後にマージ（単一 specialist 実行時もマージ可能）
  if (Object.keys(allResults).length > 0) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("MERGING ALL SPECIALIST RESULTS");
    console.log("=".repeat(60));
    await mergeAllResults(allResults);
  }
}

// テスト環境では main() を実行しない
if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
