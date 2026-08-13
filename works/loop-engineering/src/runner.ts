/**
 * Loop Engineering — Runner
 *
 * JSON ワークフローをロードし、LoopEngine で反復実行。
 *
 * ループフロー（JSON ワークフロー内で定義）:
 *   1. Plan:   エージェントに実行計画(JSON)を生成させる
 *   2. Execute: 計画に従ってエージェントがタスク実行 (agent → tools → agent)
 *   3. Verify: エージェントに計画と結果のギャップを検出させる
 *   4. Decide: ギャップがあれば Plan に戻る、なければ __end__
 *
 * Runner は JSON ワークフローをロードし、invoke するだけ。
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { WorkflowEngine } from '@kudos/scene-graph-manager';

// ESM polyfill: __filename / __dirname to be available in ALL modules
const _moduleDirname = path.dirname(fileURLToPath(import.meta.url));
(globalThis as any).__filename = _moduleDirname + '/runner.ts';
(globalThis as any).__dirname = _moduleDirname;

// ─── Runner Config ─────────────────────────────────────────────────────

interface RunnerConfig {
  /** JSON ワークフローファイルのパス */
  workflowFile: string;
  /** ユーザプロンプト */
  taskPrompt: string;
  /** 出力ディレクトリ（エージェントの作業用） */
  outputDir: string;
  /** メタデータ保存先（固定: json/metadata.json） */
  metaPath: string;
}

function loadConfig(): RunnerConfig {
  const root = path.join(__dirname, '..');
  const workflowFile = process.env.WORKFLOW_FILE
    ? path.resolve(process.env.WORKFLOW_FILE)
    : path.join(root, 'json', 'loop-task.json');
  const metaPath = path.join(root, 'json', 'metadata.json');

  const taskPrompt = process.env.TASK ?? '';

  return {
    workflowFile,
    taskPrompt,
    outputDir: process.env.OUTPUT_DIR ?? path.join(root, 'results'),
    metaPath,
  };
}

// ─── Metadata types ────────────────────────────────────────────────────

interface RunEntry {
  /** runner 実行のユニーク ID */
  runId: string;
  /** 開始時刻 */
  startedAt: string;
  /** 終了時刻 */
  completedAt: string | null;
  /** 状態 */
  status: 'running' | 'completed' | 'failed';
  /** 全 plan の履歴 */
  plan: any[];
  /** 最終的な gaps */
  gaps: any;
  /** 所要時間 (ms) */
  durationMs: number | null;
  /** エラーメッセージ */
  error: string | null;
}

interface MetaData {
  /** 全 run の履歴（追記） */
  runs: RunEntry[];
  /** 最新の run のインデックス */
  latestRunIndex: number;
}

/** 既存の metadata.json を読み込み、なければ作成 */
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

/** metadata.json に書き込み */
function saveMeta(metaPath: string, meta: MetaData): void {
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

/** 新 run を開始（追記）。既に running の run があったら failed にしてクリーンアップ */
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

/** 最新 run を完了状態で更新 */
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

/** 最新 run を失敗状態で更新 */
function failRun(meta: MetaData, errorMessage: string): void {
  const idx = meta.latestRunIndex;
  if (idx < 0 || idx >= meta.runs.length) return;
  const run = meta.runs[idx];
  run.status = 'failed';
  run.error = errorMessage;
  run.completedAt = new Date().toISOString();
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * LlamaCpp thinking + assistant prefill 競合回避ラッパー
 *
 * llama.cpp は会話の最後の assistant メッセージを prefill として扱う。
 * enable_thinking が有効な場合、prefill と thinking は排他なので
 * 最後の assistant メッセージ（ツール呼び出し結果の後に来るもの）を
 * 除去する。
 *
 * withStructuredOutput 化で JSON パース問題は解消したが、
 * prefill+thinking 競合は依然として発生するのでこのフィルタは維持。
 */
function wrapAssistantFilter(engine: WorkflowEngine): void {
  for (const [id, instance] of engine['modelInstances'].entries()) {
    const rawModel = (instance as any)._rawModel;
    if (rawModel?.invoke && typeof rawModel.invoke === 'function') {
      const originalInvoke = rawModel.invoke.bind(rawModel);
      rawModel.invoke = async (messages: any[], options?: any) => {
        // ── DEBUG: 入力メッセージの統計 ──
        const typeCounts: Record<string, number> = {};
        for (const m of messages) {
          const t = m?._getType?.() || m?.type || m?.role || 'unknown';
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        }
        console.error(`[Runner:${id}] INPUT: ${messages.length} msgs, types=${JSON.stringify(typeCounts)}`);
        console.error(`[Runner:${id}] LAST msg type=${messages[messages.length-1]?._getType?.() || messages[messages.length-1]?.type || messages[messages.length-1]?.role}`);

        // messages 配列の最後から assistant メッセージを削除
        const filtered = [...messages];
        let strippedCount = 0;
        while (filtered.length > 0) {
          const last = filtered[filtered.length - 1];
          const lastType = last?._getType?.() || last?.type || last?.role || '';
          if (lastType === 'ai' || lastType === 'assistant') {
            filtered.pop();
            strippedCount++;
            console.error(`[Runner:${id}] STRIPPED: ${lastType} (content preview: ${(last?.content || '').toString().slice(0, 120)}...)`);
          } else {
            break;
          }
        }
        if (strippedCount > 0) {
          console.error(`[Runner:${id}] OUTPUT: ${filtered.length} msgs after stripping ${strippedCount} assistant msg(s)`);
        }

        const result = await originalInvoke(filtered, options);
        console.error(`[Runner:${id}] RESULT: type=${result?.type || result?._getType?.() || (Array.isArray(result) ? 'array' : typeof result)}`);
        return result;
      };
      console.log(`[Runner] Model ${id}: assistant filter enabled (strips trailing assistant messages)`);
    }
  }
}

// ─── Run ───────────────────────────────────────────────────────────────

async function run(config: RunnerConfig): Promise<void> {
  const startTime = Date.now();
  const metaPath = config.metaPath;

  // 0. メタデータを読み込み、新 run を追記
  const meta = loadMeta(metaPath);
  const runId = startRun(meta);
  saveMeta(metaPath, meta);
  console.log(`[Runner] Started run: ${runId} (${meta.runs.length} total runs)`);

  // 1. JSON ワークフローファイルを読み込む
  if (!fs.existsSync(config.workflowFile)) {
    throw new Error(`Workflow file not found: ${config.workflowFile}`);
  }

  const workflowJson = JSON.parse(fs.readFileSync(config.workflowFile, 'utf-8'));

  console.log(`[Runner] Loaded workflow: ${config.workflowFile}`);
  console.log(`[Runner] Nodes: ${workflowJson.nodes?.map((n: any) => n.id).join(', ')}`);

  // 2. エージェントの write_file/bash_command の rootDir を outputDir に固定する。
  //    skills.backend.rootDir が未設定だと workflow.ts は process.cwd() をデフォルトに
  //    使い、それが model.bindTools() 時点（build() 内）のクロージャに焼き付く。
  //    setToolRootDir() は build() 後に Map を更新するだけで、既に束縛済みの
  //    モデルには反映されないため、build() より前に JSON 設定へ直接注入する。
  //    （chdir 自体は _findProjectRoot() の handler functionFile 解決が
  //    process.cwd() に依存し得るため build() より後で行う — 順序を変えない）
  if (config.outputDir) {
    process.env.OUTPUT_DIR = config.outputDir;
    fs.mkdirSync(config.outputDir, { recursive: true });
    for (const m of workflowJson.models || []) {
      if (m.skills) {
        m.skills.backend = { ...(m.skills.backend || {}), rootDir: config.outputDir };
      }
    }
  }

  // 3. SGM WorkflowEngine でビルド
  const engine = new WorkflowEngine(workflowJson);
  await engine.build();

  // 4. LlamaCpp thinking + assistant prefill 競合回避
  wrapAssistantFilter(engine);

  console.log(`\n[Runner] ===== Loop Engineering Runner =====`);
  console.log(`[Runner] Task:    ${config.taskPrompt.slice(0, 200)}...`);
  console.log(`[Runner] Output:  ${config.outputDir}`);
  console.log(`[Runner] Run ID:  ${runId}`);
  console.log(`[Runner] ===========================\n`);

  // 5. エージェントの bash_command が動く作業ディレクトリを指定（build() 後 — chdir 自体は
  //    _findProjectRoot() の handler functionFile 解決に影響しうるため元の順序を維持）
  if (config.outputDir) {
    process.chdir(config.outputDir);
    console.log(`[Runner] Working directory changed to: ${process.cwd()}`);
  }

  // 6. ワークフロー実行
  const result = await engine.invoke(
    { messages: [{ role: 'user' as const, content: config.taskPrompt }] },
    { configurable: { thread_id: `loop-${Date.now()}` } },
  );

  // 6. 結果出力
  const durationMs = Date.now() - startTime;
  console.log(`\n[Runner] --- Result ---`);
  console.log(`[Runner] Duration:  ${durationMs}ms`);
  console.log(`[Runner] Plan:      ${JSON.stringify(result.plan, null, 2) || '(none)'}`);
  console.log(`[Runner] Gaps:      ${JSON.stringify(result.gaps, null, 2) || '(none)'}`);

  // 7. 結果をメタデータに追記（既存 runs を上書きしない）
  completeRun(meta, result.plan, result.gaps, durationMs);
  saveMeta(metaPath, meta);
  console.log(`\n[Runner] Run saved to metadata.json: ${runId}`);
  console.log(`[Runner] Total runs in metadata: ${meta.runs.length}`);
  console.log(`[Runner] Done.\n`);
}

// ─── Signal Handler ────────────────────────────────────────────────────

/** メタデータを failed に更新して安全に終了 */
function handleShutdown(metaPath: string, reason: string): void {
  try {
    const meta = loadMeta(metaPath);
    if (meta.latestRunIndex >= 0 && meta.latestRunIndex < meta.runs.length) {
      const latest = meta.runs[meta.latestRunIndex];
      if (latest.status === 'running') {
        failRun(meta, reason);
        saveMeta(metaPath, meta);
        console.log(`[Runner] Metadata updated: status=failed (${reason})`);
      }
    }
  } catch {
    // metadata の更新に失敗してもプロセスを落とさない
  }
  process.exit(1);
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();
  const metaPath = config.metaPath;

  // シグナルハンドラー: pkill / Ctrl+C で metadata.json を failed に更新
  process.on('SIGTERM', () => handleShutdown(metaPath, 'SIGTERM received'));
  process.on('SIGINT', () => handleShutdown(metaPath, 'SIGINT received'));

  try {
    await run(config);
  } catch (e) {
    const errorMessage = (e as Error).message;
    console.error(`[Runner] Fatal: ${errorMessage}`);
    console.error(e);

    // 失敗: 既存の meta を読み込んで最新 run を failed に
    const meta = loadMeta(metaPath);
    failRun(meta, errorMessage);
    saveMeta(metaPath, meta);
    process.exit(1);
  }
}

main();
