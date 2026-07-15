/**
 * dispatch-server-v2.ts
 *
 * v1 をベースに以下を追加:
 *   3-1: エスカレーション済みスレッドへの後続メッセージを無視
 *   3-3: 最終活動から72時間経過でスレッドをクローズ、再メッセージで再オープン
 *
 * Usage:
 *   npx tsx scripts/dispatch-server-v2.ts \
 *     --config ./works/sgm-consulting-v2/integration/json/sgm-chat-guard-v2.json \
 *     --port 3012 \
 *     --db ./data/dispatch-tasks-v2.db
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;
const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

function parseArgs(argv: string[]): { config: string; port: number; db: string; concurrency: number; name?: string } {
  const args = argv.slice(2);
  let config = '';
  let port = 0;
  let db = './data/dispatch-tasks-v2.db';
  let concurrency = 3;
  let name: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) config = args[++i];
    else if (args[i] === '--port' && args[i + 1]) port = parseInt(args[++i], 10);
    else if (args[i] === '--db' && args[i + 1]) db = args[++i];
    else if (args[i] === '--concurrency' && args[i + 1]) concurrency = parseInt(args[++i], 10);
    else if (args[i] === '--name' && args[i + 1]) name = args[++i];
  }

  if (!config) { console.error('Error: --config is required'); process.exit(1); }
  if (!port || isNaN(port)) { console.error('Error: --port is required and must be a number'); process.exit(1); }

  return { config, port, db, concurrency, name };
}

// ─── ThreadStateStore ────────────────────────────────────────────────────────
// スレッドレベルの状態（タスクとは別テーブル）
// threads テーブルは tasks DB と同じファイルに作成する

class ThreadStateStore {
  private db: any;

  constructor(dbPath: string, Database: any) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        threadId       TEXT PRIMARY KEY,
        escalated_at   INTEGER,
        last_activity_at INTEGER,
        closed_at      INTEGER
      )
    `);
  }

  get(threadId: string): { escalated_at?: number; last_activity_at?: number; closed_at?: number } | null {
    return this.db.prepare('SELECT * FROM threads WHERE threadId = ?').get(threadId) ?? null;
  }

  upsertActivity(threadId: string, now: number): void {
    this.db.prepare(`
      INSERT INTO threads (threadId, last_activity_at) VALUES (?, ?)
      ON CONFLICT(threadId) DO UPDATE SET last_activity_at = excluded.last_activity_at
    `).run(threadId, now);
  }

  setEscalated(threadId: string, now: number): void {
    this.db.prepare(`
      INSERT INTO threads (threadId, escalated_at, last_activity_at) VALUES (?, ?, ?)
      ON CONFLICT(threadId) DO UPDATE SET escalated_at = excluded.escalated_at
    `).run(threadId, now, now);
  }

  close(threadId: string, now: number): void {
    this.db.prepare(`
      INSERT INTO threads (threadId, closed_at, last_activity_at) VALUES (?, ?, ?)
      ON CONFLICT(threadId) DO UPDATE SET closed_at = excluded.closed_at
    `).run(threadId, now, now);
  }

  reopen(threadId: string, now: number): void {
    this.db.prepare(`
      UPDATE threads SET closed_at = NULL, last_activity_at = ? WHERE threadId = ?
    `).run(now, threadId);
  }

  closeDb(): void { this.db.close(); }
}

// ─── Slack 投稿ヘルパー ──────────────────────────────────────────────────────

async function postSlack(channel: string, threadTs: string, text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error('[Slack] postMessage skipped: SLACK_BOT_TOKEN is not set');
    return;
  }
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, thread_ts: threadTs, text }),
    });
    const data = await res.json() as any;
    if (!data.ok) {
      console.error(`[Slack] postMessage API error: ${data.error} (channel=${channel}, ts=${threadTs})`);
    } else {
      console.log(`[Slack] postMessage ok (channel=${channel}, ts=${threadTs}, chars=${text.length})`);
    }
  } catch (err: any) {
    console.error('[Slack] postMessage failed:', err.message);
  }
}

// Webhook へ非同期通知（エスカレーション済み / タイムアウトクローズ時の代替レスポンス）
function fireWebhook(webhookUrl: string, body: object): void {
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => console.error('[webhook] fire failed:', err.message));
}

async function main() {
  const { config: configArg, port, db, concurrency, name } = parseArgs(process.argv);

  const configPath = path.isAbsolute(configArg) ? configArg : path.resolve(process.cwd(), configArg);
  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exit(1);
  }

  let workflowConfig: any;
  try {
    workflowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err: any) {
    console.error(`Error: Failed to parse config JSON: ${err.message}`);
    process.exit(1);
  }

  if (name) workflowConfig.name = name;

  console.log(`\nStarting Dispatch Server v2...`);
  console.log(`  Config:      ${configPath}`);
  console.log(`  Port:        ${port}`);
  console.log(`  Database:    ${db}`);
  console.log(`  Concurrency: ${concurrency}\n`);

  const { WorkflowEngine } = await import('../dist/index.js');
  const { DispatchTaskStore } = await import('../src/lib/dispatch/DispatchTaskStore.js');
  const { AsyncTaskQueue } = await import('../src/lib/dispatch/AsyncTaskQueue.js');
  const Database = (await import('better-sqlite3')).default;

  const taskStore = new DispatchTaskStore(db);
  const threadStore = new ThreadStateStore(db, Database);

  const engine = new WorkflowEngine(workflowConfig);
  await engine.build();
  console.log('Workflow engine built successfully');

  const interrupted = taskStore.getInterruptedTasks();
  if (interrupted.length > 0) {
    console.warn(`\n[Dispatch] ${interrupted.length} interrupted task(s) found:`);
    interrupted.forEach((t: any) => {
      console.warn(`  - ${t.taskId} (${t.status}) created at ${t.createdAt}`);
      taskStore.updateTask(t.taskId, { status: 'failed', error: 'Server restarted' });
    });
  }

  class AgentExecutor {
    async execute(message: any, taskId: string, threadId?: string): Promise<any> {
      const effectiveThreadId = threadId || taskId;
      let input = '';
      if (typeof message === 'string') input = message;
      else if (message?.parts && Array.isArray(message.parts)) {
        const p = message.parts.find((p: any) => p.type === 'text' || p.kind === 'text' || (p.text && !p.type && !p.kind));
        input = p?.text || '';
      } else if (message?.content) input = typeof message.content === 'string' ? message.content : '';
      else if (message?.text) input = typeof message.text === 'string' ? message.text : '';
      else input = JSON.stringify(message);

      if (!input.trim()) throw new Error('No valid input text found in message');

      taskStore.createTask({
        taskId, threadId: effectiveThreadId, status: 'running',
        input: JSON.stringify(message), result: null, webhookUrl: null,
        error: null, createdAt: new Date().toISOString(), completedAt: null,
      });

      let result;
      try {
        result = await engine.invoke(
          { messages: [{ role: 'user', content: input }] },
          { recursionLimit: workflowConfig.recursionLimit || 100, configurable: { thread_id: effectiveThreadId } }
        );
      } catch (err: any) {
        console.error(`[executor.execute] taskId=${taskId} FAILED:`, err.message);
        throw err;
      }

      taskStore.updateTask(taskId, { status: 'completed', result: JSON.stringify(result), completedAt: new Date().toISOString() });
      return { taskId, result, thread_id: effectiveThreadId };
    }

    async cancelTask(taskId: string) {
      taskStore.updateTask(taskId, { status: 'cancelled', completedAt: new Date().toISOString() });
    }
  }

  const executor = new AgentExecutor();

  const queue = new AsyncTaskQueue({
    maxConcurrent: concurrency,
    store: taskStore,
    executeTask: async (message: any, taskId: string, threadId: string) => {
      let input = '';
      if (typeof message === 'string') input = message;
      else if (message?.parts && Array.isArray(message.parts)) {
        const p = message.parts.find((p: any) => p.type === 'text' || p.kind === 'text' || (p.text && !p.type && !p.kind));
        input = p?.text || '';
      } else if (message?.content) input = typeof message.content === 'string' ? message.content : '';
      else if (message?.text) input = typeof message.text === 'string' ? message.text : '';
      else input = JSON.stringify(message);

      if (!input.trim()) throw new Error('No valid input text found in message');

      console.log(`[executeTask] taskId=${taskId} input=${input.substring(0, 60)}`);
      const result = await engine.invoke(
        { messages: [{ role: 'user', content: input }] },
        { recursionLimit: workflowConfig.recursionLimit || 100, configurable: { thread_id: threadId } }
      );
      console.log(`[executeTask] taskId=${taskId} completed`);
      return result;
    },
  });

  // ─── スレッド状態チェック共通処理 ─────────────────────────────────────────
  // 戻り値: 'proceed' | 'already_escalated' | 'timeout_closed' | 'reopened'
  function checkThreadState(effectiveThreadId: string, now: number): string {
    const thread = threadStore.get(effectiveThreadId);

    if (thread?.escalated_at) {
      console.log(`[thread] ${effectiveThreadId} already escalated — skipping invoke`);
      return 'already_escalated';
    }

    if (thread?.closed_at) {
      threadStore.reopen(effectiveThreadId, now);
      console.log(`[thread] ${effectiveThreadId} reopened`);
      return 'reopened';
    }

    if (thread?.last_activity_at && (now - thread.last_activity_at) > THREE_DAYS_MS) {
      threadStore.close(effectiveThreadId, now);
      console.log(`[thread] ${effectiveThreadId} closed by 72h timeout`);
      return 'timeout_closed';
    }

    threadStore.upsertActivity(effectiveThreadId, now);
    return 'proceed';
  }

  const express = (await import('express')).default;
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') res.sendStatus(200); else next();
  });

  app.get('/.well-known/agent.json', (_req: any, res: any) => {
    const configCard = workflowConfig.config?.a2aEndpoint?.agentCard;
    const agentCard = configCard
      ? { ...configCard, url: `http://localhost:${port}/`, endpoints: { messageSend: `http://localhost:${port}/message/send` } }
      : { name: workflowConfig.name || 'WorkflowAgent v2', description: workflowConfig.description || 'A workflow execution agent v2', protocolVersion: '0.3.0', version: '2.0.0', url: `http://localhost:${port}/`, capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true } };
    res.json(agentCard);
  });

  // JSON-RPC
  app.post('/', async (req: any, res: any) => {
    const { id, method, params } = req.body;
    if (method === 'message/send') {
      try {
        const message = params?.message;
        const thread_id = params?.thread_id;
        const webhookUrl = params?.webhookUrl;
        if (!message) return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'message is required' } });

        const effectiveThreadId = thread_id || `thread-${Date.now()}`;
        const now = Date.now();
        const taskId = `task-${now}-${Math.random().toString(36).substring(2, 9)}`;
        const state = checkThreadState(effectiveThreadId, now);

        if (state === 'already_escalated') {
          if (webhookUrl) { fireWebhook(webhookUrl, { status: 'completed', result: { _already_escalated: true } }); }
          return res.json({ jsonrpc: '2.0', id, result: { taskId: `notice-${now}`, thread_id: effectiveThreadId, status: 'accepted', _already_escalated: true } });
        }
        if (state === 'timeout_closed') {
          if (webhookUrl) { fireWebhook(webhookUrl, { status: 'completed', result: { _timeout_closed: true } }); }
          return res.json({ jsonrpc: '2.0', id, result: { taskId: `notice-${now}`, thread_id: effectiveThreadId, status: 'accepted' } });
        }

        taskStore.createTask({ taskId, threadId: effectiveThreadId, status: 'pending', input: JSON.stringify(message), result: null, webhookUrl: webhookUrl || null, error: null, createdAt: new Date().toISOString(), completedAt: null });

        if (webhookUrl) {
          res.json({ jsonrpc: '2.0', id, result: { taskId, thread_id: effectiveThreadId, status: 'accepted' } });
          queue.enqueue({ taskId, message, threadId: effectiveThreadId, webhookUrl });
        } else {
          const result = await executor.execute(message, taskId, effectiveThreadId);
          res.json({ jsonrpc: '2.0', id, result: { ...result, taskId, thread_id: effectiveThreadId } });
        }
      } catch (err: any) {
        res.json({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
      }
    } else {
      res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  });

  // REST message/send
  app.post('/message/send', async (req: any, res: any) => {
    try {
      const { message, thread_id, webhookUrl } = req.body;
      if (!message) return res.status(400).json({ error: 'message is required' });

      const effectiveThreadId = thread_id || `thread-${Date.now()}`;
      const now = Date.now();
      const taskId = `task-${now}-${Math.random().toString(36).substring(2, 9)}`;
      const state = checkThreadState(effectiveThreadId, now);

      if (state === 'already_escalated') {
        return res.json({ taskId: `notice-${now}`, thread_id: effectiveThreadId, status: 'accepted', _already_escalated: true });
      }
      if (state === 'timeout_closed') {
        if (webhookUrl) { fireWebhook(webhookUrl, { status: 'completed', result: { _timeout_closed: true } }); }
        return res.json({ taskId: `notice-${now}`, thread_id: effectiveThreadId, status: 'accepted' });
      }
      if (state === 'reopened' && webhookUrl) {
        // 再オープン通知を Slack に送ってから通常実行へ
        const match = webhookUrl.match(/\/slack-webhook\/([^/]+)\/([^/?]+)/);
        if (match) {
          postSlack(match[1], match[2], 'スレッドを再オープンしました。改めてご質問をどうぞ。');
        }
      }

      if (webhookUrl) {
        taskStore.createTask({ taskId, threadId: effectiveThreadId, status: 'pending', input: JSON.stringify(req.body), result: null, webhookUrl, error: null, createdAt: new Date().toISOString(), completedAt: null });
        res.json({ taskId, thread_id: effectiveThreadId, status: 'accepted' });
        queue.enqueue({ taskId, message, threadId: effectiveThreadId, webhookUrl });
      } else {
        const result = await executor.execute(message, taskId, effectiveThreadId);
        res.json({ ...result, taskId, thread_id: effectiveThreadId });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/health', (_req: any, res: any) => {
    res.json({ status: 'healthy', port, agentName: workflowConfig.name || 'Unnamed Workflow v2', uptime: process.uptime() });
  });

  app.get('/tasks/:taskId', async (req: any, res: any) => {
    const task = taskStore.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.get('/tasks', async (req: any, res: any) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as any;
    res.json({ count: 0, limit, offset, tasks: taskStore.listTasks({ status, limit, offset }) });
  });

  app.post('/tasks/:taskId/cancel', async (req: any, res: any) => {
    const task = taskStore.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await executor.cancelTask(req.params.taskId);
    res.json({ taskId: req.params.taskId, status: 'cancelled' });
  });

  // スレッド状態確認エンドポイント（デバッグ用）
  app.get('/threads/:threadId', (req: any, res: any) => {
    const state = threadStore.get(req.params.threadId);
    res.json(state ?? { threadId: req.params.threadId, note: 'not found' });
  });

  // Slack webhook: Dispatch Server → Slack 完了通知
  app.post('/slack-webhook/:channel/:ts', async (req: any, res: any) => {
    res.sendStatus(200);

    const { channel, ts } = req.params;
    const { status, result } = req.body;
    const threadId = `slack-${channel}-${ts}`;
    console.log(`[slack-webhook] received: status=${status} thread=${threadId}`);

    if (status === 'failed') {
      threadStore.setEscalated(threadId, Date.now());
      await postSlack(channel, ts, [
        ':warning: エスカレーションしました',
        '処理中にエラーが発生しました。担当者が確認します。',
      ].join('\n'));
      return;
    }

    // 特殊通知（スレッド状態起因）
    if (result?._already_escalated) {
      return; // エスカレーション済み — BOTは完全沈黙
    }
    if (result?._timeout_closed) {
      await postSlack(channel, ts, ':zzz: 最後の回答から3日が経過したため、このスレッドをクローズしました。\n再度ご質問の場合はこのスレッドにメッセージをお送りください（再オープンされます）。');
      return;
    }

    let guardResult: { safe?: boolean; issues?: string[]; score?: number } | undefined;
    let turnCount = 0;
    let escalated = false;

    if (result) {
      guardResult = result.guard_result as typeof guardResult;
      turnCount = Number(result.turn_count) || 0;
      escalated = Boolean(result.escalated);
    }

    // 3-1: エスカレーション発生 → DB に記録
    if (escalated) {
      threadStore.setEscalated(threadId, Date.now());
      const reason = guardResult?.issues?.length ? `（検出: ${guardResult.issues.join(', ')}）` : '';
      const body = turnCount >= 6
        ? `${turnCount}ターンに達したため担当者に引き継ぎます。`
        : `${turnCount}ターン試行しましたが回答できませんでした${reason}`;
      await postSlack(channel, ts, [
        ':warning: エスカレーションしました',
        body,
      ].join('\n'));
      return;
    }

    // result.answer を優先（respond/rewrite ノードが設定する確定済みテキスト）
    // fallback: messages の末尾メッセージの content
    let fullText: string;
    if (typeof result?.answer === 'string' && result.answer.length > 0) {
      fullText = result.answer;
    } else {
      const lastMsg = result?.messages?.slice(-1)?.[0];
      const aiContent = lastMsg?.content ?? lastMsg?.kwargs?.content;
      fullText = typeof aiContent === 'string' ? aiContent : JSON.stringify(aiContent ?? result, null, 2);
    }
    console.log(`[slack-webhook] content source=${typeof result?.answer === 'string' && result.answer.length > 0 ? 'answer' : 'messages'} length=${fullText.length}`);
    const CHUNK = 2900;
    if (fullText.length <= CHUNK) {
      await postSlack(channel, ts, fullText);
    } else {
      const parts: string[] = [];
      let rem = fullText;
      while (rem.length > 0) {
        const breakAt = rem.length <= CHUNK ? rem.length
          : (rem.lastIndexOf('\n', CHUNK) > CHUNK / 2 ? rem.lastIndexOf('\n', CHUNK) : CHUNK);
        parts.push(rem.slice(0, breakAt));
        rem = rem.slice(breakAt).replace(/^\n/, '');
      }
      for (let i = 0; i < parts.length; i++) {
        await postSlack(channel, ts, parts.length > 1 ? `(${i + 1}/${parts.length})\n${parts[i]}` : parts[i]);
      }
    }
  });

  // Telegram webhook
  app.post('/telegram-webhook/:chatId/:messageId', async (req: any, res: any) => {
    res.sendStatus(200);
    const { chatId, messageId } = req.params;
    const { status, result, error } = req.body;
    const content = status === 'completed'
      ? JSON.stringify(result?.messages?.slice(-1)?.[0]?.content ?? result, null, 2).slice(0, 3000)
      : error;
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: status === 'completed' ? `✅ 完了\n${content}` : `❌ 失敗: ${error}`, reply_to_message_id: Number(messageId) }),
    }).catch((err) => console.error('[Telegram webhook] send failed:', err.message));
  });

  const server = app.listen(port, () => {
    console.log(`\nDispatch Server v2 ready on port ${port}`);
    console.log(`  Agent Card:   http://localhost:${port}/.well-known/agent.json`);
    console.log(`  Message Send: http://localhost:${port}/message/send`);
    console.log(`  Tasks:        http://localhost:${port}/tasks`);
    console.log(`  Health:       http://localhost:${port}/health`);
    console.log(`  Thread State: http://localhost:${port}/threads/:threadId`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${port} is already in use. Stop the existing process first.`);
    } else {
      console.error(`Server error:`, err.message);
    }
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => {
      taskStore.close();
      threadStore.closeDb();
      console.log('\nServer stopped');
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  setInterval(() => {
    const removed = taskStore.purgeOldTasks(7);
    if (removed > 0) console.log(`[Dispatch] Purged ${removed} old task(s)`);
  }, 60 * 60 * 1000);

  process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); process.exit(1); });
  process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason); });
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
