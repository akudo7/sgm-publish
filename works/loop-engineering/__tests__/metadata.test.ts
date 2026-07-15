/**
 * Loop Engineering — metadata.json 更新ユニットテスト
 *
 * loadMeta / saveMeta / startRun / completeRun / failRun の動作を検証。
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── 対象関数をテスト用にエクスポート ──────────────────────────────────
// runner.ts の関数を直接テストするには helper モジュールに切り出すのが理想だが、
// 現状は runner.ts の関数を inline で再実装してテストする。
// ※ runner.ts の関数を export している場合は直接 import する。

interface RunEntry {
  runId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  plan: any;
  gaps: any;
  durationMs: number | null;
  error: string | null;
}

interface MetaData {
  runs: RunEntry[];
  latestRunIndex: number;
}

function loadMeta(metaPath: string): MetaData {
  if (fs.existsSync(metaPath)) {
    try {
      const raw = fs.readFileSync(metaPath, 'utf-8');
      const meta: MetaData = JSON.parse(raw);
      if (Array.isArray(meta.runs)) {
        return meta;
      }
    } catch {
      // 破損ファイルは再生成
    }
  }
  return { runs: [], latestRunIndex: -1 };
}

function saveMeta(metaPath: string, meta: MetaData): void {
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

function startRun(meta: MetaData): string {
  // 最新の run が running なら failed に戻す（中断クリーンアップ）
  if (meta.latestRunIndex >= 0 && meta.latestRunIndex < meta.runs.length) {
    const latest = meta.runs[meta.latestRunIndex];
    if (latest.status === 'running') {
      latest.status = 'failed';
      latest.error = 'Interrupted by new run (previous run was still running)';
      latest.completedAt = new Date().toISOString();
    }
  }

  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  meta.runs.push({
    runId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'running',
    plan: null,
    gaps: null,
    durationMs: null,
    error: null,
  });
  meta.latestRunIndex = meta.runs.length - 1;
  return runId;
}

function completeRun(meta: MetaData, plan: any, gaps: any, durationMs: number): void {
  const idx = meta.latestRunIndex;
  if (idx < 0 || idx >= meta.runs.length) return;
  const run = meta.runs[idx];
  run.status = 'completed';
  run.plan = plan;
  run.gaps = gaps;
  run.durationMs = durationMs;
  run.completedAt = new Date().toISOString();
}

function failRun(meta: MetaData, errorMessage: string): void {
  const idx = meta.latestRunIndex;
  if (idx < 0 || idx >= meta.runs.length) return;
  const run = meta.runs[idx];
  run.status = 'failed';
  run.error = errorMessage;
  run.completedAt = new Date().toISOString();
}

// ─── テストヘルパー ────────────────────────────────────────────────────

const TEST_DIR = path.join(__dirname, '__fixtures__');

function setupTestDir(): void {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function cleanupTestDir(): void {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

function metaPath(name: string): string {
  return path.join(TEST_DIR, name);
}

// ─── テスト ────────────────────────────────────────────────────────────

describe('metadata.json', () => {
  beforeAll(() => setupTestDir());
  afterAll(() => cleanupTestDir());

  describe('loadMeta', () => {
    test('存在しないファイル → 空の runs', () => {
      const meta = loadMeta(metaPath('nonexistent.json'));
      expect(meta.runs).toEqual([]);
      expect(meta.latestRunIndex).toBe(-1);
    });

    test('破損ファイル → 空の runs', () => {
      fs.writeFileSync(metaPath('corrupt.json'), 'not json {');
      const meta = loadMeta(metaPath('corrupt.json'));
      expect(meta.runs).toEqual([]);
      expect(meta.latestRunIndex).toBe(-1);
    });

    test('正しい JSON → 内容が返る', () => {
      const sample: MetaData = {
        runs: [
          {
            runId: 'run-1',
            startedAt: '2026-01-01T00:00:00.000Z',
            completedAt: null,
            status: 'running',
            plan: null,
            gaps: null,
            durationMs: null,
            error: null,
          },
        ],
        latestRunIndex: 0,
      };
      fs.writeFileSync(metaPath('valid.json'), JSON.stringify(sample, null, 2));
      const meta = loadMeta(metaPath('valid.json'));
      expect(meta.runs).toHaveLength(1);
      expect(meta.runs[0].runId).toBe('run-1');
      expect(meta.latestRunIndex).toBe(0);
    });
  });

  describe('saveMeta / loadMeta 整合性', () => {
    test('save → load で同じ内容が戻る', () => {
      const meta: MetaData = {
        runs: [
          {
            runId: 'run-1',
            startedAt: '2026-01-01T00:00:00.000Z',
            completedAt: null,
            status: 'running',
            plan: { steps: ['a', 'b'] },
            gaps: ['missing c'],
            durationMs: null,
            error: null,
          },
        ],
        latestRunIndex: 0,
      };
      saveMeta(metaPath('roundtrip.json'), meta);
      const loaded = loadMeta(metaPath('roundtrip.json'));
      expect(loaded.runs).toHaveLength(1);
      expect(loaded.runs[0].plan).toEqual({ steps: ['a', 'b'] });
      expect(loaded.runs[0].gaps).toEqual(['missing c']);
      expect(loaded.latestRunIndex).toBe(0);
    });
  });

  describe('startRun', () => {
    test('空の meta に startRun → run が 1 つ追記される', () => {
      const meta: MetaData = { runs: [], latestRunIndex: -1 };
      const runId = startRun(meta);
      expect(meta.runs).toHaveLength(1);
      expect(meta.runs[0].runId).toBe(runId);
      expect(meta.runs[0].status).toBe('running');
      expect(meta.runs[0].plan).toBeNull();
      expect(meta.runs[0].gaps).toBeNull();
      expect(meta.latestRunIndex).toBe(0);
    });

    test('既存の completed run に startRun → 追記される（上書きされない）', () => {
      const existingPlan = { steps: ['x', 'y'] };
      const meta: MetaData = {
        runs: [
          {
            runId: 'run-1',
            startedAt: '2026-01-01T00:00:00.000Z',
            completedAt: '2026-01-01T00:01:00.000Z',
            status: 'completed',
            plan: existingPlan,
            gaps: [],
            durationMs: 60000,
            error: null,
          },
        ],
        latestRunIndex: 0,
      };
      const runId = startRun(meta);
      expect(meta.runs).toHaveLength(2);
      // 既存の run は上書きされていない
      expect(meta.runs[0].runId).toBe('run-1');
      expect(meta.runs[0].plan).toBe(existingPlan);
      expect(meta.runs[0].status).toBe('completed');
      // 新しい run が追記されている
      expect(meta.runs[1].status).toBe('running');
      expect(meta.runs[1].runId).toBe(runId);
      expect(meta.latestRunIndex).toBe(1);
    });

    test('running 状態の run がある startRun → 既存 run が failed に戻る', () => {
      const meta: MetaData = {
        runs: [
          {
            runId: 'run-1',
            startedAt: '2026-01-01T00:00:00.000Z',
            completedAt: null,
            status: 'running',
            plan: null,
            gaps: null,
            durationMs: null,
            error: null,
          },
        ],
        latestRunIndex: 0,
      };
      const runId = startRun(meta);
      expect(meta.runs).toHaveLength(2);
      // 既存の run が failed に
      expect(meta.runs[0].status).toBe('failed');
      expect(meta.runs[0].error).toContain('Interrupted');
      expect(meta.runs[0].completedAt).not.toBeNull();
      // 新しい run が running
      expect(meta.runs[1].status).toBe('running');
      expect(meta.runs[1].runId).toBe(runId);
      expect(meta.latestRunIndex).toBe(1);
    });
  });

  describe('completeRun', () => {
    test('running run を completed に更新', () => {
      const meta: MetaData = {
        runs: [
          {
            runId: 'run-1',
            startedAt: '2026-01-01T00:00:00.000Z',
            completedAt: null,
            status: 'running',
            plan: null,
            gaps: null,
            durationMs: null,
            error: null,
          },
        ],
        latestRunIndex: 0,
      };
      const plan = { steps: ['a', 'b', 'c'] };
      const gaps = ['missing d'];
      completeRun(meta, plan, gaps, 42000);

      expect(meta.runs[0].status).toBe('completed');
      expect(meta.runs[0].plan).toEqual(plan);
      expect(meta.runs[0].gaps).toEqual(gaps);
      expect(meta.runs[0].durationMs).toBe(42000);
      expect(meta.runs[0].completedAt).not.toBeNull();
    });

    test('既存の run を上書きしない（latestRunIndex のみが対象）', () => {
      const meta: MetaData = {
        runs: [
          {
            runId: 'run-1',
            startedAt: '2026-01-01T00:00:00.000Z',
            completedAt: '2026-01-01T00:01:00.000Z',
            status: 'completed',
            plan: { old: true },
            gaps: ['old gap'],
            durationMs: 1000,
            error: null,
          },
          {
            runId: 'run-2',
            startedAt: '2026-01-01T00:02:00.000Z',
            completedAt: null,
            status: 'running',
            plan: null,
            gaps: null,
            durationMs: null,
            error: null,
          },
        ],
        latestRunIndex: 1,
      };
      completeRun(meta, { new: true }, [], 2000);

      // run-1 は untouched
      expect(meta.runs[0].plan).toEqual({ old: true });
      expect(meta.runs[0].gaps).toEqual(['old gap']);
      expect(meta.runs[0].status).toBe('completed');

      // run-2 のみが更新
      expect(meta.runs[1].status).toBe('completed');
      expect(meta.runs[1].plan).toEqual({ new: true });
      expect(meta.runs[1].gaps).toEqual([]);
    });
  });

  describe('failRun', () => {
    test('running run を failed に更新', () => {
      const meta: MetaData = {
        runs: [
          {
            runId: 'run-1',
            startedAt: '2026-01-01T00:00:00.000Z',
            completedAt: null,
            status: 'running',
            plan: null,
            gaps: null,
            durationMs: null,
            error: null,
          },
        ],
        latestRunIndex: 0,
      };
      failRun(meta, 'Test error message');

      expect(meta.runs[0].status).toBe('failed');
      expect(meta.runs[0].error).toBe('Test error message');
      expect(meta.runs[0].completedAt).not.toBeNull();
    });
  });

  describe('end-to-end: saveMeta → loadMeta での追記確認', () => {
    test('2 回実行 → 2 つの run が保持される', () => {
      const fpath = metaPath('e2e-trace.json');

      // 1 回目の run
      let meta = loadMeta(fpath);
      startRun(meta);
      completeRun(meta, { run: 1 }, [], 100);
      saveMeta(fpath, meta);

      // ファイルから再読込（ディスク上の状態を確認）
      meta = loadMeta(fpath);
      expect(meta.runs).toHaveLength(1);
      expect(meta.runs[0].plan).toEqual({ run: 1 });
      expect(meta.runs[0].status).toBe('completed');

      // 2 回目の run
      startRun(meta);
      completeRun(meta, { run: 2 }, ['gap'], 200);
      saveMeta(fpath, meta);

      // ファイルから再読込
      meta = loadMeta(fpath);
      expect(meta.runs).toHaveLength(2);

      // 1 回目の run は残っている
      expect(meta.runs[0].runId).toBeDefined();
      expect(meta.runs[0].plan).toEqual({ run: 1 });
      expect(meta.runs[0].status).toBe('completed');

      // 2 回目の run が追記されている
      expect(meta.runs[1].plan).toEqual({ run: 2 });
      expect(meta.runs[1].gaps).toEqual(['gap']);
      expect(meta.runs[1].durationMs).toBe(200);
      expect(meta.runs[1].status).toBe('completed');
      expect(meta.latestRunIndex).toBe(1);
    });
  });
});
