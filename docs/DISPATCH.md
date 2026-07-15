# Dispatch — Remote Task Execution

Submit tasks from smartphones, Slack, Telegram, or any HTTP client. The local WorkflowEngine executes them asynchronously and delivers results via webhook.

---

## Architecture

```
Slack (user)
  │ mention / DM
  ▼
slack-dispatch-bot.ts  (Socket Mode)
  │ POST /message/send  (with webhookUrl)
  ▼
dispatch-server.ts  (:3011)
  │ engine.invoke(slack-chat-qwen.json)
  ▼
llama.cpp server  (:8001)  ← Qwen3.6-35B-A3B
  │ POST result to webhookUrl
  ▼
Reply to Slack thread
```

---

## Startup (Slack Bot)

```bash
# 1. Set environment variables in .env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

# 2. Start Dispatch Server
npx tsx scripts/dispatch-server.ts \
  --config ./json/slack-chat-qwen.json \
  --port 3011

# 3. Start Slack Bot (separate terminal)
npx tsx scripts/slack-dispatch-bot.ts
```

### Ending a Session

Send any of the following keywords (Japanese or English): `終了`, `exit`, `quit`, `やめる`, `done` — the bot responds immediately and exits without dispatching a task. The Japanese keywords are intentional exit triggers, not documentation text.

### Implementation Notes

See the "Slack Bot Implementation Notes" section in [plans/COMPLETED/slack-chat-setup/PLAN.md](../plans/COMPLETED/slack-chat-setup/PLAN.md) for common pitfalls and solutions.

---

## HTTP API Quick Start

```bash
# Start the Dispatch Server
npx tsx scripts/dispatch-server.ts --config ./json/your-workflow.json --port 3011

# Submit a task via HTTP
curl -X POST http://localhost:3011/message/send \
  -H "Content-Type: application/json" \
  -d '{"message": {"parts": [{"text": "Analyze this repo"}]}, "webhookUrl": "https://your-webhook/url"}'
```

---

## Slack Integration

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_SIGNING_SECRET=...
export SLACK_APP_TOKEN=xapp-...
export DISPATCH_SERVER_URL=http://localhost:3011

npx tsx scripts/slack-dispatch-bot.ts
```

Send a DM or mention the bot in a channel. Results are posted in the same thread.

---

## Telegram Integration

```bash
export TELEGRAM_BOT_TOKEN=123456789:AABBcc...
export DISPATCH_SERVER_URL=http://localhost:3011

npx tsx scripts/telegram-dispatch-bot.ts
```

Send a DM to the bot. Results are returned as a reply message.

---

## A2A Compatibility

The Dispatch Server exposes an A2A-compatible Agent Card, but Slack/Telegram bots do not use A2A internally.

| Client | Communication with Dispatch Server |
|---|---|
| `slack-dispatch-bot.ts` | plain HTTP POST `/message/send` (no A2A) |
| `telegram-dispatch-bot.ts` | plain HTTP POST `/message/send` (no A2A) |
| Other A2A agents | `/.well-known/agent.json` → Agent Card → A2A protocol |

To call the Dispatch Server from another A2A workflow, register it as an `a2aClients` entry:

```json
{
  "a2aClients": {
    "dispatch": {
      "cardUrl": "http://localhost:3011/.well-known/agent.json"
    }
  }
}
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/.well-known/agent.json` | GET | Agent Card (for A2A clients) |
| `/message/send` | POST | Submit task (optional `webhookUrl`) |
| `/tasks` | GET | List tasks (`?limit=50&offset=0&status=completed`) |
| `/tasks/:taskId` | GET | Get single task |
| `/tasks/:taskId/cancel` | POST | Cancel task |
| `/health` | GET | Health check |

---

## Loading a Workflow

```typescript
import { WorkflowEngine } from 'scenegraphmanager';
import workflowConfig from './my-workflow.json';

const engine = new WorkflowEngine(workflowConfig);
await engine.build();

const result = await engine.invoke({
  messages: [{ role: "user", content: "Your task here" }]
});
```

---

## Implementation Files

| File | Description |
|---|---|
| `src/lib/dispatch/DispatchTaskStore.ts` | SQLite task persistence (WAL mode, auto-cleanup after 7 days) |
| `src/lib/dispatch/AsyncTaskQueue.ts` | Parallel execution control (adjustable via `--concurrency`) |
| `src/lib/dispatch/WebhookNotifier.ts` | Webhook completion notification (up to 3 retries) |
| `scripts/dispatch-server.ts` | HTTP server |
| `scripts/slack-dispatch-bot.ts` | Slack Socket Mode Bot |
| `scripts/telegram-dispatch-bot.ts` | Telegram long-polling Bot |
| `json/slack-chat-qwen.json` | Slack chat workflow with Qwen (MemorySaver for conversation history) |
