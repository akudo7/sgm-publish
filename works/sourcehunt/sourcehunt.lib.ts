/**
 * sourcehunt.lib.ts — テスト可能な純粋関数・型定義
 *
 * run.ts からインポートされ、ユニットテストからも直接インポートされる。
 * ファイルシステム・ネットワーク・process.exit に依存しない関数のみを配置する。
 */

import { readFileSync, existsSync } from "fs";

// ─── 型定義 ───────────────────────────────────────────────────────────────────

export interface SpecialistDef {
  name: string;
  description: string;
  guide: string;
}

export interface RunResult {
  runId: number;
  startTime: string;
  durationMs: number;
  detected: boolean;
  targetFile: string;
  targetRank: number | null;
  targetScore: number | null;
  maxEvidenceLevel: number;
  reflexionCount: number;
  stats: Record<string, unknown>;
  error?: string;
}

export interface RawFinding {
  type: string;
  severity: string;
  description: string;
  line: number;
  filePath: string;
  evidenceLevel: number;
  hypothesis?: string;
}

export interface MergedFindingEntry {
  finding: RawFinding;
  specialists: Set<string>;
  runIds: Set<string>;
}

export interface CVEResult {
  cveMap: Map<string, string[]>;
  totalCVEs: number;
  allCVEIds: string[];
}

export interface CVECache {
  commit: string;
  totalCVEs: number;
  allCVEIds: string[];
  fileIndex: Record<string, string[]>;
}

// ─── specialists.json 読み込み ────────────────────────────────────────────────

/**
 * specialists.json を読み込んで SpecialistDef[] を返す。
 * 不正なフォーマットの場合は例外を投げる。
 */
export function loadSpecialists(filePath: string): SpecialistDef[] {
  if (!existsSync(filePath)) {
    throw new Error(`specialists.json が見つかりません: ${filePath}`);
  }
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("specialists.json は配列である必要があります");
  }
  if (parsed.length === 0) {
    throw new Error("specialists.json にエントリが1件もありません");
  }
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) {
      throw new Error(`specialists.json の要素がオブジェクトではありません: ${JSON.stringify(item)}`);
    }
    const s = item as Record<string, unknown>;
    if (typeof s.name !== "string" || typeof s.description !== "string" || typeof s.guide !== "string") {
      throw new Error(`specialists.json の要素に name/description/guide が必要です: ${JSON.stringify(item)}`);
    }
  }
  return parsed as SpecialistDef[];
}

/**
 * SPECIALIST 環境変数で対象 specialist を絞り込む。
 * 未指定時は全 specialist を返す。
 * 指定された名前が見つからない場合は null を返す。
 */
export function filterSpecialists(
  specialists: SpecialistDef[],
  specialistEnv: string | undefined
): SpecialistDef[] | null {
  if (!specialistEnv) return specialists;
  const filtered = specialists.filter((s) => s.name === specialistEnv);
  return filtered.length > 0 ? filtered : null;
}

// ─── findings dedup ───────────────────────────────────────────────────────────

/**
 * 複数 specialist・複数 run の findings を filePath:line でデdup する。
 * 同一キーで evidenceLevel が高い方を残す。
 */
export function deduplicateFindings(
  input: Array<{ specialistName: string; runId: number; findings: RawFinding[] }>
): Map<string, MergedFindingEntry> {
  const findingMap = new Map<string, MergedFindingEntry>();

  for (const { specialistName, runId, findings } of input) {
    for (const f of findings) {
      const key = `${f.filePath}:${f.line}`;
      const existing = findingMap.get(key);
      if (existing) {
        existing.specialists.add(specialistName);
        existing.runIds.add(`${specialistName}/run-${runId}`);
        if (f.evidenceLevel > existing.finding.evidenceLevel) {
          existing.finding = { ...f };
        }
      } else {
        findingMap.set(key, {
          finding: { ...f },
          specialists: new Set([specialistName]),
          runIds: new Set([`${specialistName}/run-${runId}`]),
        });
      }
    }
  }

  return findingMap;
}

// ─── ソート ───────────────────────────────────────────────────────────────────

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * merged findings をソートする。
 * 優先順位: severity → 複数 specialist 検出数 → CVE 既知 → evidenceLevel
 *
 * cveMap: filename → CVE-ID[] （run.ts から渡す）。未指定時は CVE 基準をスキップ。
 */
export function sortMergedEntries(
  entries: MergedFindingEntry[],
  cveMap?: Map<string, string[]>
): MergedFindingEntry[] {
  return [...entries].sort((a, b) => {
    const sa = SEVERITY_ORDER[(a.finding.severity ?? "").toLowerCase()] ?? 4;
    const sb = SEVERITY_ORDER[(b.finding.severity ?? "").toLowerCase()] ?? 4;
    if (sa !== sb) return sa - sb;
    if (b.specialists.size !== a.specialists.size) return b.specialists.size - a.specialists.size;
    if (cveMap) {
      const fnA = a.finding.filePath.split("/").pop() ?? "";
      const fnB = b.finding.filePath.split("/").pop() ?? "";
      const cveA = (cveMap.get(fnA) ?? []).length > 0 ? 1 : 0;
      const cveB = (cveMap.get(fnB) ?? []).length > 0 ? 1 : 0;
      if (cveA !== cveB) return cveB - cveA;
    }
    return b.finding.evidenceLevel - a.finding.evidenceLevel;
  });
}

// ─── Resume ───────────────────────────────────────────────────────────────────

/**
 * resultsRoot の run-N/metadata.json を検索し、
 * 次に実行すべき run 番号（startRun）と完了済み rows を返す。
 *
 * - metadata.json が存在して error なし → 完了済み（スキップ）
 * - metadata.json が存在して error あり → 再実行
 * - metadata.json が存在しない → 新規実行
 */
export function findStartRun(
  resultsRoot: string,
  runs: number
): { startRun: number; completedRows: RunResult[] } {
  const completedRows: RunResult[] = [];
  let startRun = 1;

  for (let i = 1; i <= runs; i++) {
    const metaPath = `${resultsRoot}/run-${i}/metadata.json`;
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as RunResult;
        if (!meta.error) {
          completedRows.push(meta);
          startRun = i + 1;
        } else {
          break;
        }
      } catch {
        break;
      }
    } else {
      break;
    }
  }

  return { startRun, completedRows };
}
