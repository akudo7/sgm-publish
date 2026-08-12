/**
 * dispatch-server.ts
 *
 * CLI script to launch a WorkflowEngine as a Dispatch server with SQLite persistence.
 *
 * Usage:
 *   npx tsx scripts/dispatch-server.ts \
 *     --config ./json/your-workflow.json \
 *     --port 3011 \
 *     --db ./data/dispatch.db \
 *     --concurrency 3
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;

function parseArgs(argv: string[]): { config: string; port: number; db: string; concurrency: number; name?: string } {
  const args = argv.slice(2);
  let config = '';
  let port = 0;
  let db = './data/dispatch-tasks.db';
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

async function main() {
  const { config: configArg, port, db, concurrency, name } = parseArgs(process.argv);

  const configPath = path.isAbsolute(configArg) ? configArg : path.resolve(process.cwd(), configArg);
  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exit(1);
  }

  let workflowConfig: any;
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    workflowConfig = JSON.parse(content);
  } catch (err: any) {
    console.error(`Error: Failed to parse config JSON: ${err.message}`);
    process.exit(1);
  }

  if (name) workflowConfig.name = name;

  console.log(`\nStarting Dispatch Server...`);
  console.log(`  Config:    ${configPath}`);
  console.log(`  Port:      ${port}`);
  console.log(`  Database:  ${db}`);
  console.log(`  Concurrency: ${concurrency}\n`);

  const { WorkflowEngine } = await import('../dist/index.js');
  const { DispatchTaskStore } = await import('../src/lib/dispatch/DispatchTaskStore.js');
  const { AsyncTaskQueue } = await import('../src/lib/dispatch/AsyncTaskQueue.js');

  // Persistent task store
  const taskStore = new DispatchTaskStore(db);

  // Build engine
  const engine = new WorkflowEngine(workflowConfig);
  await engine.build();
  console.log('Workflow engine built successfully');

  // Detect interrupted tasks
  const interrupted = taskStore.getInterruptedTasks();
  if (interrupted.length > 0) {
    console.warn(`\n[Dispatch] ${interrupted.length} interrupted task(s) found:`);
    interrupted.forEach(t => {
      console.warn(`  - ${t.taskId} (${t.status}) created at ${t.createdAt}`);
      taskStore.updateTask(t.taskId, { status: 'failed', error: 'Server restarted' });
    });
  }

  // Agent executor
  class AgentExecutor {
    async execute(message: any, taskId: string, threadId?: string): Promise<any> {
      const effectiveThreadId = threadId || taskId;

      let input = '';
      if (typeof message === 'string') input = message;
      else if (message?.parts && Array.isArray(message.parts)) {
        const textPart = message.parts.find((p: any) => p.text);
        if (textPart) input = textPart.text;
      } else if (message?.content) input = typeof message.content === 'string' ? message.content : '';
      else if (message?.text) input = typeof message.text === 'string' ? message.text : '';
      else input = JSON.stringify(message);

      if (!input.trim()) throw new Error('No valid input text found in message');

      taskStore.createTask({
        taskId,
        threadId: effectiveThreadId,
        status: 'running',
        input: JSON.stringify(message),
        result: null,
        webhookUrl: null,
        error: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });

      let result;
      try {
        result = await engine.invoke(
          { messages: [{ role: 'user', content: input }] },
          { recursionLimit: workflowConfig.recursionLimit || 100, configurable: { thread_id: effectiveThreadId } }
        );
      } catch (err: any) {
        console.error(`[executor.execute] taskId=${taskId} FAILED:`, err.message);
        console.error(err.stack);
        throw err;
      }

      taskStore.updateTask(taskId, {
        status: 'completed',
        result: JSON.stringify(result),
        completedAt: new Date().toISOString(),
      });

      return { taskId, result, thread_id: effectiveThreadId };
    }

    async cancelTask(taskId: string) {
      taskStore.updateTask(taskId, { status: 'cancelled', completedAt: new Date().toISOString() });
    }
  }

  const executor = new AgentExecutor();

  // Async task queue
  const queue = new AsyncTaskQueue({
    maxConcurrent: concurrency,
    store: taskStore,
    executeTask: async (message: any, taskId: string, threadId: string) => {
      let input = '';
      if (typeof message === 'string') input = message;
      else if (message?.parts && Array.isArray(message.parts)) {
        const textPart = message.parts.find((p: any) => p.text);
        if (textPart) input = textPart.text;
      } else if (message?.content) input = typeof message.content === 'string' ? message.content : '';
      else if (message?.text) input = typeof message.text === 'string' ? message.text : '';
      else input = JSON.stringify(message);

      if (!input.trim()) throw new Error('No valid input text found in message');

      console.log(`[executeTask] taskId=${taskId} input=${input.substring(0, 60)}`);
      let result;
      try {
        result = await engine.invoke(
          { messages: [{ role: 'user', content: input }] },
          { recursionLimit: workflowConfig.recursionLimit || 100, configurable: { thread_id: threadId } }
        );
        console.log(`[executeTask] taskId=${taskId} completed`);
      } catch (err: any) {
        console.error(`[executeTask] taskId=${taskId} FAILED:`, err.message);
        console.error(err.stack);
        throw err;
      }
      return result;
    },
  });

  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());

  // CORS
  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') res.sendStatus(200); else next();
  });

  // Agent card
  app.get('/.well-known/agent.json', (_req: any, res: any) => {
    const configCard = workflowConfig.config?.a2aEndpoint?.agentCard;
    const si = [{ url: `http://localhost:${port}/`, protocolBinding: 'JSONRPC', protocolVersion: '1.0', tenant: '' }];
    const agentCard = configCard
      ? { ...configCard, protocolVersion: '1.0.0', preferredTransport: 'JSONRPC', url: `http://localhost:${port}/`, endpoints: { messageSend: `http://localhost:${port}/message/send`, messageStream: `http://localhost:${port}/message/stream`, taskGet: `http://localhost:${port}/tasks/{taskId}`, taskCancel: `http://localhost:${port}/tasks/{taskId}/cancel` }, supportedInterfaces: si }
      : { name: workflowConfig.name || 'WorkflowAgent', description: workflowConfig.description || 'A workflow execution agent', protocolVersion: '1.0.0', preferredTransport: 'JSONRPC', version: '1.0.0', url: `http://localhost:${port}/`, endpoints: { messageSend: `http://localhost:${port}/message/send`, messageStream: `http://localhost:${port}/message/stream`, taskGet: `http://localhost:${port}/tasks/{taskId}`, taskCancel: `http://localhost:${port}/tasks/{taskId}/cancel` }, defaultInputModes: ['text/plain'], defaultOutputModes: ['text/plain'], capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true }, skills: workflowConfig.skills || [], supportedInterfaces: si };
    res.json(agentCard);
  });

  // JSON-RPC endpoint
  app.post('/', async (req: any, res: any) => {
    const { id, method, params } = req.body;
    if (method === 'SendMessage') {
      try {
        // Native: params = { message: { messageId, role, parts }, tenant, configuration, metadata }
        const sendReq = params?.message;
        const message = sendReq;
        const thread_id = sendReq?.contextId;
        const webhookUrl = params?.webhookUrl;
        if (!message) return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'message is required' } });
        const effectiveThreadId = thread_id || `thread-${Date.now()}`;
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        taskStore.createTask({
          taskId,
          threadId: effectiveThreadId,
          status: 'pending',
          input: JSON.stringify(message),
          result: null,
          webhookUrl: webhookUrl || null,
          error: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        });

        if (webhookUrl) {
          res.json({ jsonrpc: '2.0', id, result: { taskId, thread_id: effectiveThreadId, status: 'accepted' } });
          queue.enqueue({ taskId, message, threadId: effectiveThreadId, webhookUrl });
        } else {
          const execResult = await executor.execute(message, taskId, effectiveThreadId);
          // Preserve the { result: { messages: [...] } } envelope shape that downstream
          // workflow parsers (approval_gate_* nodes) expect from the tool response content.
          const workflowResult = typeof execResult.result === 'string' ? JSON.parse(execResult.result) : execResult.result;
          const contentText = typeof workflowResult === 'string' ? workflowResult : JSON.stringify({ result: workflowResult });
          const sdkResponse = {
            message: {
              messageId: execResult.taskId || `resp-${Date.now()}`,
              role: 'ROLE_AGENT',
              parts: [{ text: contentText }],
            },
          };
          res.json({ jsonrpc: '2.0', id, result: sdkResponse });
        }
      } catch (err: any) {
        res.json({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
      }
    } else if (method === 'agent/getAuthenticatedExtendedCard') {
      res.json({ jsonrpc: '2.0', id, result: workflowConfig.config?.a2aEndpoint?.agentCard || {} });
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
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      if (webhookUrl) {
        taskStore.createTask({
          taskId,
          threadId: effectiveThreadId,
          status: 'pending',
          input: JSON.stringify(req.body),
          result: null,
          webhookUrl,
          error: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        });
        res.json({ taskId, thread_id: effectiveThreadId, status: 'accepted' });
        queue.enqueue({ taskId, message, threadId: effectiveThreadId, webhookUrl });
      } else {
        // executor.execute 内でタスク作成 + 更新を行う
        const result = await executor.execute(message, taskId, effectiveThreadId);
        res.json({ ...result, taskId, thread_id: effectiveThreadId });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Health check
  app.get('/health', (_req: any, res: any) => {
    res.json({ status: 'healthy', port, agentName: workflowConfig.name || 'Unnamed Workflow', uptime: process.uptime() });
  });

  // Task endpoints with pagination
  app.get('/tasks/:taskId', async (req: any, res: any) => {
    const task = taskStore.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.get('/tasks', async (req: any, res: any) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as any;
    const tasks = taskStore.listTasks({ status, limit, offset });
    res.json({ count: tasks.length, limit, offset, tasks });
  });

  app.post('/tasks/:taskId/cancel', async (req: any, res: any) => {
    const task = taskStore.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await executor.cancelTask(req.params.taskId);
    res.json({ taskId: req.params.taskId, status: 'cancelled' });
  });

  // Slack webhook: Dispatch Server -> Slack 完了通知
  app.post('/slack-webhook/:channel/:ts', async (req: any, res: any) => {
    res.sendStatus(200);

    const { channel, ts } = req.params;
    const { status, result, error } = req.body;

    if (status === 'failed') {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
        body: JSON.stringify({ channel, thread_ts: ts, text: `:x: タスク失敗: ${error}` }),
      }).catch((err) => console.error('[Slack webhook] send failed:', err.message));
      return;
    }

    // sgm-chat-guard.json: エスカレーション判定
    let guardResult: { safe?: boolean; issues?: string[]; score?: number } | undefined;
    let turnCount = 0;
    let rewriteCount = 0;
    let escalated = false;
    let close = false;
    let qualityScore: { accuracy?: number; usefulness?: number; clarity?: number } | undefined;

    if (result) {
      guardResult = result.guard_result as typeof guardResult;
      turnCount = Number(result.turn_count) || 0;
      rewriteCount = Number(result.rewrite_count) || 0;
      escalated = Boolean(result.escalated);
      close = Boolean(result.close);
      qualityScore = result.quality_score as typeof qualityScore;
    }

    if (escalated) {
      const reason = guardResult?.issues?.length
        ? `（検出: ${guardResult.issues.join(', ')}）`
        : '';
      const text = [
        `:warning: エスカレーションしました`,
        `回答を生成できませんでしたが、${turnCount}ターン試行しました${reason}`,
      ].join('\n');
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
        body: JSON.stringify({ channel, thread_ts: ts, text }),
      }).catch((err) => console.error('[Slack webhook] escalation send failed:', err.message));
      return;
    }

    const lastMsg = result?.messages?.slice(-1)?.[0];
    const aiContent = lastMsg?.content ?? lastMsg?.kwargs?.content;
    const content = (typeof aiContent === 'string' ? aiContent : JSON.stringify(aiContent ?? result, null, 2)).slice(0, 2000);
    const text = close ? content : `${content}\n\n※${turnCount}ターン目で回答を停止しました。品質改善が必要です。`;

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel, thread_ts: ts, text }),
    }).catch((err) => console.error('[Slack webhook] send failed:', err.message));
  });

  // Telegram webhook: Dispatch Server -> Telegram 完了通知
  app.post('/telegram-webhook/:chatId/:messageId', async (req: any, res: any) => {
    res.sendStatus(200);

    const { chatId, messageId } = req.params;
    const { status, result, error } = req.body;

    const content = status === 'completed'
      ? JSON.stringify(result?.messages?.slice(-1)?.[0]?.content ?? result, null, 2).slice(0, 3000)
      : error;
    const text = status === 'completed'
      ? `✅ 完了\n${content}`
      : `❌ 失敗: ${error}`;

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: Number(messageId) }),
    }).catch((err) => console.error('[Telegram webhook] send failed:', err.message));
  });

  // Start server
  const server = app.listen(port, () => {
    console.log(`\nDispatch Server ready on port ${port}`);
    console.log(`  Agent Card:   http://localhost:${port}/.well-known/agent.json`);
    console.log(`  Message Send: http://localhost:${port}/message/send`);
    console.log(`  Tasks:        http://localhost:${port}/tasks`);
    console.log(`  Health:       http://localhost:${port}/health`);
    console.log(`\nServer is ready to receive Dispatch requests`);
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
    server.close(() => { taskStore.close(); console.log('\nServer stopped'); process.exit(0); });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Periodic cleanup of old tasks (every 1 hour)
  setInterval(() => {
    const removed = taskStore.purgeOldTasks(7);
    if (removed > 0) console.log(`[Dispatch] Purged ${removed} old task(s)`);
  }, 60 * 60 * 1000);

  process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); process.exit(1); });
  process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason); });
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
