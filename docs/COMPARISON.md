# Platform Comparison: SGM vs Google ADK vs Cloudflare Agents

## 1. Platform Positioning

| Axis | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **What it is** | JSON workflow engine on LangGraph (middleware) | Multi-language agent development framework | Persistent agent runtime on Cloudflare Durable Objects |
| **Language** | TypeScript | Python, TypeScript, Go, Java, Kotlin | TypeScript (on Workers) |
| **Base** | LangGraph 1.4.x + LangChain 1.4.x | Proprietary framework | Cloudflare Workers + Durable Objects |
| **Deploy target** | Any Node.js environment | Local / Cloud Run / GKE | Cloudflare Global Network |

---

## 2. Agent Definition

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **Definition method** | JSON `nodes[]` array | `Agent(name, model, instruction)` | `class MyAgent extends Agent<Env, State>` |
| **Type safety** | TypeScript State definition; JSON validated at runtime | Depends on Python/TS types | `Agent<Env, CounterState>` fully typed |
| **Instructions** | System message in JSON | `Agent(instruction: string)` | Class properties / methods |
| **Multi-agent** | A2A protocol + `a2aClients` | Multiple Agents connected via `Workflow` | `@callable()` for RPC; nested agents |

**SGM:** JSON-first means "define agents as data". No recompilation needed to swap models or rewire workflows. The trade-off: function nodes use `AsyncFunction` (eval-equivalent), which bypasses static type checking and is inherently risky.

**ADK:** Code-first means IDE support, compile-time checks, and version control friendly. But changing a workflow requires code review and redeploy.

**Cloudflare:** "Agent = persistent service" philosophy. Agents are long-running services with identity, not one-shot execution units.

---

## 3. Workflow & Orchestration

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **Graph engine** | LangGraph `StateGraph` | Proprietary graph engine | Single agent (graphs not primary unit) |
| **Conditional routing** | JSON `type: "conditional"` + condition string | Code `edges` with condition functions | Branching in `@callable()` methods |
| **Fan-out / Fan-in** | `Send` objects from function nodes | `Workflow` edges | Nested agent calls |
| **Loops** | Conditional edges (recursionLimit=25 default) | Workflow-level loops | `setInterval` / cron |
| **Retry** | `retryPolicy` per-node | Workflow-level | Implementation-dependent |
| **Timeout** | `timeout` per-node (`{ runTimeout, idleTimeout, refreshOn }`) | — | Durable Objects fiber timeout |
| **Cache** | `cachePolicy: { ttl }` per-node (LangGraph 1.4.0+) | — | AI Gateway response cache |
| **Tags** | `tags: string[]` per-node (LangSmith) | — | — |
| **Node defaults** | `Graph.setNodeDefaults()` for `retryPolicy`/`timeout`/`cachePolicy` on all nodes | — | — |
| **Nested workflows** | Not supported | Supported | Nested agents supported |

---

## 4. Model Management

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **Supported models** | Anthropic, OpenAI, Azure, Ollama, llama.cpp (GGUF) | Gemini, Gemma, Claude, Ollama, vLLM, LiteLLM | Workers AI (81 models) + OpenAI/Anthropic/Gemini |
| **Model swapping** | Rewrite `models[]` in JSON | Change `model` parameter in code | Change config file |
| **Per-model tools** | `models[N].skills` independent binding | Tools bound per Agent | Tools bound per Agent |
| **Per-model skills** | Independent skills/tools per model in workflow | — | — |
| **Model fallback** | — | — | AI Gateway retry/fallback definition |
| **Local models** | Ollama / llama.cpp (GGUF) | Ollama / vLLM | Workers AI (serverless GPU on Cloudflare) |

---

## 5. Tool Integration

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **MCP** | `@langchain/mcp-adapters`. JSON `mcpServers` config. Auto-binding at build | `adk run --mcp` | MCP client/server support |
| **A2A** | **Implemented**: A2AToolGenerator, A2AEndpoint, dynamic discovery | A2A protocol support | Nested agents |
| **A2A dynamic discovery** | `useDiscoveredAgents: true` — discovery_node batches Agent Cards, planner_node does skill matching, worker_node executes | — | — |
| **A2A runtime registration** | `__registerA2AAgent()` injected into function node scope | — | — |
| **A2A bearer auth** | `bearerTokenEnvVar` per client | — | — |
| **Browser automation** | — | — | Supported |
| **API calls** | `web_fetch` (with SSRF prevention) | tools extras | Server-side tools |
| **File operations** | 7 Claude Code Tools (read/write/edit/glob/grep/bash/web_fetch) | toolbox extras | Sandboxed execution |
| **Skills system** | SKILL.md-based dynamic loading. Filesystem/Virtual backend. Per-node control | — | — |
| **TODO management** | `write_todos` / `read_todos` tools | — | — |
| **Structured output** | `structuredOutput` JSON Schema per-node (`strict` / `fallbackToText`) | — | — |
| **Tool exclusion** | `excludeTools` per-node | — | — |
| **Skills prompt control** | `injectSkillsPrompt: false` per-node | — | — |
| **bash allowlist** | Deny-by-default. 26 commands only | — | — |
| **RTK integration** | `bash_command` routes through RTK for 60-90% token reduction | — | — |

---

## 6. State Management & Memory

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **State definition** | `annotation` fields (type + reducer string + default) | Workflow state | `this.setState()` + `this.state` |
| **Reducer** | Function string: `(x, y) => x.concat(y)` | — | Built-in (setState merges) |
| **Persistent store** | InMemoryStore (**unbounded** — add cleanup for long-running apps) | Session state | **Durable Objects** (SQL + state persistence) |
| **Checkpointing** | MemorySaver with `thread_id` | Session rewinding | Durable Objects auto-persistence |
| **Distributed state** | — | — | **Durable Objects** (global strong consistency) |
| **Vector database** | — | — | **Vectorize** (embedding search) |
| **KV store** | — | — | **KV** (fast key-value) |
| **File storage** | — | — | **R2** (object storage, zero egress fees) |
| **SQL database** | — | — | **D1** (serverless SQLite) |
| **State overwrite** | `Overwrite` class (LangGraph passthrough) for explicit reducer semantics | — | — |
| **Thread management** | `thread_id` for multi-turn conversations | — | Durable Objects auto-managed |

**Critical difference:** Cloudflare's Durable Objects provide globally-distributed, strongly-consistent state that survives restarts. SGM's InMemoryStore is exactly what the name says — in memory, unbounded, and gone on restart. For production persistence, Cloudflare wins. For simplicity and control, SGM's approach is transparent.

---

## 7. Session & Streaming

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **Sync execution** | `engine.invoke()` | — | `@callable()` call |
| **Streaming** | `stream()` — 5 modes: `values`, `updates`, `tools`, `messages`, `tokens` | Streaming agents | Native WebSocket |
| **Session management** | `thread_id` + MemorySaver | Session handling | Durable Objects auto-managed |
| **Real-time notification** | — | — | State changes broadcast to all WebSocket connections |
| **Gemini Live API** | — | Supported | — |

---

## 8. Context Management

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **Context compression** | Threshold mode (message count + token AND) + Autonomous mode (LLM decides) | Context compression | — |
| **Context guard** | 70% threshold auto-reset via `activeMessages` field. Preserves sprint state for loop continuation | — | — |
| **Token tracking** | `UsageTracker` — per-node/per-model aggregation + estimated cost | — | AI Gateway (request count / tokens / cost) |
| **Built-in pricing** | `claude-opus-4-6` / `claude-sonnet-4-6` / `claude-haiku-4-5` / `gpt-4o` | — | — |
| **Context caching** | — | Supported | — |

**SGM only:** Context Guard is a unique implementation. It monitors estimated token usage from `state.messages` and when it exceeds `modelContextLimit * thresholdRatio` (default 70%), it replaces all messages with a single summary containing critical state fields (`taskSpec`, `sprintContract`, `sprintResult`, `retryCount`). This prevents "Context Anxiety" — the phenomenon where the agent gives up mid-task because the context window is full.

---

## 9. Security & Privacy

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **PII filtering** | 7 patterns (email, ip, credit_card, phone, address, full_name) + custom regex. 4 strategies: redact, mask, hash, block | — | — |
| **Secret redaction** | Automatic API key masking in logs | — | — |
| **OS-native secrets** | `loadSecrets()` — macOS Keychain / Linux libsecret / Windows Credential Manager | — | Workers environment variables |
| **Path traversal prevention** | `rootDir` boundary check. URL-encoded normalization | — | Sandboxed execution |
| **SSRF prevention** | Blocks localhost, private IPs (10.x, 172.16.x, 192.168.x), link-local (169.254.x), IPv6 loopback `[::1]`. HTTPS only | — | — |
| **Shell injection prevention** | `execFileSync` — no shell expansion, semicolons/pipes cannot escape | — | Sandboxed execution |
| **bash allowlist** | Deny-by-default. 26 commands: git, yarn, npm, npx, node, tsx, docker, ls, cat, echo, pwd, mkdir, rm, mv, cp, chmod, find, head, tail, wc, grep, sed, awk, sort, uniq, tee | — | — |
| **protectedPaths** | Block writes to sensitive files/directories. Throws before model call | — | — |
| **Rate limiting** | — | — | AI Gateway rate limiting |

---

## 10. Observability & Monitoring

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **Lifecycle events** | 9 events: `sessionStart`, `nodeStart`, `nodeComplete`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `userPromptSubmit`, `complete`, `error` | Event logging | — |
| **HookFeedback** | Handlers can return `HookFeedback` to block tool calls, rewrite inputs, inject context | — | — |
| **Multiple handlers** | `addEventListener()` — all handlers receive all events | — | — |
| **LangSmith integration** | Automatic tags/metadata injection on every `invoke()`/`stream()` | — | — |
| **Token usage stats** | `getUsageStats()` — per-node/per-model + estimated cost in USD | — | AI Gateway: requests, tokens, cost |
| **Graph visualization** | Mermaid PNG export via `engine.drawGraph()` | Visual builder | — |
| **AI Gateway** | — | — | Request tracking / error analysis / caching / rate limiting |

---

## 11. Deployment

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **Local execution** | `new WorkflowEngine(config).build()` | `adk run` | `npm run dev` |
| **Web UI** | — | `adk web` | React hooks (`useAgent`) |
| **HTTP API** | Dispatch server (REST on `:3011`) | API Server | `routeAgentRequest` (auto-routing) |
| **Slack Bot** | `slack-dispatch-bot.ts` (Socket Mode) | extras | — |
| **Telegram Bot** | `telegram-dispatch-bot.ts` (long-polling) | — | — |
| **Scale** | Single Node.js process | Cloud Run / GKE | **Cloudflare Global Network** (auto-scale) |
| **Offline capable** | Yes (Ollama/llama.cpp + local execution) | — | — |
| **Deploy command** | None (library) | `adk deploy` | `wrangler deploy` |
| **Ambient agents** | — | Supported | — |
| **Task resumption** | — | Supported | Durable Objects persistence |
| **Cancellation** | — | Supported | — |

---

## 12. Scheduling

| Feature | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **Periodic execution** | — | — | `setInterval` / cron triggers |
| **Delayed execution** | — | — | Task queue |
| **Webhook reception** | Dispatch server | — | `routeAgentRequest` |

---

## 13. Unique Implementation Patterns

### SGM Only

| Pattern | Description | Implementation |
|---|---|---|
| **Sprint Contract** | Generator-Evaluator iterative loop with dynamically negotiated success criteria. Planner → Negotiator → Generator → Evaluator → Router | `json/sprint-contract-qwen.json` |
| **Memento-Skills** | `reflect_node` writes lessons to SKILL.md after each execution. Read → Execute → Write self-improvement loop | `src/lib/skills/` + `skills/` |
| **AutoResearch** | Autonomous SKILL.md improvement loop. Train/holdout split validation. Reward hacking detection (train/holdout divergence > 0.2, >50 lines/iteration bloat) | `scripts/autoresearch.ts` + `eval/` |
| **SourceHunt** | 4-phase vulnerability pipeline (ranker → hunter → verifier → reporter). Reflexion loop. OSV.dev integration with JSON cache | `works/sourcehunt/` |
| **Dispatch** | SQLite persistence (WAL mode, 7-day auto-cleanup). AsyncTaskQueue (parallel execution control). WebhookNotifier (up to 3 retries) | `src/lib/dispatch/` |
| **Context Guard** | 70% threshold auto-reset via `activeMessages`. Preserves sprint state for loop continuation | `src/lib/context-guard/` (~150 lines) |
| **Context Compression** | Threshold mode + Autonomous mode | `src/lib/context-compression/` (~200 lines) |
| **A2A Tool Generator** | Auto-generates tools from Agent Card. Dynamic discovery | `src/a2a/A2AToolGenerator.ts` (~540 lines) |
| **A2A Endpoint** | A2A server implementation | `src/a2a/A2AEndpoint.ts` (~287 lines) |
| **PII Filter** | 7 patterns + custom regex. 4 strategies (redact/mask/hash/block) | `src/lib/pii/PiiFilter.ts` |
| **Usage Tracker** | Per-node/per-model token aggregation + estimated cost | `src/lib/usage/UsageTracker.ts` |
| **Secrets Provider** | OS-native secret store integration | `src/lib/secrets/SecretsProvider.ts` |
| **Graph Visualization** | Mermaid PNG export | `engine.drawGraph()` |
| **External Function Files** | `functionFile` extracts node logic to separate `.js` files | JSON config |

### Google ADK Only

| Pattern | Description |
|---|---|
| **Multi-language support** | Python, TypeScript, Go, Java, Kotlin |
| **Visual builder** | Browser-based agent composition |
| **Human-in-the-loop** | Oversight capabilities |
| **Grounding** | Google Search integration |
| **Artifact management** | — |

### Cloudflare Agents Only

| Pattern | Description |
|---|---|
| **Durable identity** | Agents have persistent identity across restarts |
| **Durable Objects** | Globally distributed coordination API with strong consistency |
| **Native WebSocket** | Two-way messaging with lifecycle management |
| **State broadcast** | Internal data changes push to all active frontend connections |
| **Recoverable execution** | Fibers with automatic recovery |
| **Email handling** | — |
| **Voice pipelines** | — |
| **Workflow approvals** | Human-in-the-loop |

---

## 14. Technical Stack

| Axis | SGM | Google ADK | Cloudflare Agents |
|---|---|---|---|
| **Base** | LangGraph + LangChainJS | Proprietary framework | Cloudflare Workers + Durable Objects |
| **Key dependencies** | 15+ packages (langchain, zod, a2a-js, mcp-adapters, better-sqlite3, deepagents) | google-adk + extras | agents + wrangler |
| **Testing** | 18 suites / 269+ unit tests, 25 E2E scenarios | eval extras | — |
| **Sub-exports** | `./types`, `./a2a`, `./skills`, `./tools` | extras: `mcp`, `toolbox`, `slack`, `eval` | `agents`, `agents/react` |
| **Package name** | `@kudos/scene-graph-manager` | `google-adk` | `agents` |
| **Module format** | ESM | — | ESM (Workers) |
| **License** | MIT (team features subscription) | Apache 2.0 | — |

---

## 15. Comparison Summary Matrix

### Where SGM Wins

| Category | Reason |
|---|---|
| **Workflow portability** | Same JSON workflow runs on desktop, embedded, IoT — zero code change |
| **Security features** | PII filtering, bash allowlist, protectedPaths, SSRF prevention — all built-in |
| **Context management** | Context Guard + Context Compression (2 modes) — unique implementations |
| **Self-improving patterns** | Memento-Skills, AutoResearch, Sprint Contract — production-ready implementations |
| **Per-node control** | `retryPolicy`, `timeout`, `cachePolicy`, `tags`, `excludeTools`, `injectSkillsPrompt` |
| **Multi-model local** | Ollama + llama.cpp (GGUF) — true offline capability |
| **Observability** | LangSmith integration + per-node/per-model usage tracking with cost estimation |
| **Hook system** | 9 lifecycle events + HookFeedback for tool call interception |
| **VSCode integration** | kudosflow2 extension with ReactFlow-based visual designer |

### Where Google ADK Wins

| Category | Reason |
|---|---|
| **Multi-language** | 5 languages vs SGM's TypeScript-only |
| **Enterprise deployment** | Cloud Run, GKE, Agent Runtime |
| **Visual development** | Visual builder for agent composition |
| **Google ecosystem** | Gemini native, Google Search grounding, GCP integration |
| **Code-first safety** | No eval/AsyncFunction — compile-time checks work |
| **Multi-language team** | Python, Go, Java, Kotlin teams can all use the same framework |

### Where Cloudflare Agents Wins

| Category | Reason |
|---|---|
| **State persistence** | Durable Objects — globally distributed, strongly consistent, survives restarts |
| **Global scale** | Deploy once, runs on Cloudflare's network in 300+ locations |
| **Real-time** | Native WebSocket + state broadcast to all connected clients |
| **Zero infra** | No servers to manage, no sessions to reconstruct, no state to externalize |
| **AI Gateway** | Built-in caching, rate limiting, model fallback, observability |
| **Serverless GPU** | Workers AI with 81 models on global edge |
| **Full storage stack** | D1 (SQL), KV, R2 (files), Vectorize (vectors) |
| **Scheduling** | Cron triggers, delayed execution, periodic tasks built-in |

---

## 16. Ruthless Verdict

### SGM vs ADK vs Cloudflare — The Fundamental Difference

**SGM and ADK are "run agents" frameworks.** Cloudflare Agents is "host agents as services."

| Dimension | SGM | ADK | Cloudflare |
|---|---|---|---|
| **Philosophy** | "Agents are data (JSON)" | "Agents are code" | "Agents are services" |
| **Change workflow** | Edit JSON → reload | Edit code → test → deploy | Edit code → `wrangler deploy` |
| **State lifecycle** | Process lifetime (InMemoryStore) | Session lifetime | Persistent (Durable Objects) |
| **Best for** | Portable workflows, rapid iteration, offline/local | Multi-language teams, Google ecosystem | 24/7 always-on agents, global scale |

### When to Choose Each

**Choose SGM when:**
- You need the same workflow to run anywhere without code changes
- You want self-improving agents (Memento-Skills, AutoResearch)
- You need offline/local model support (Ollama, llama.cpp)
- You need fine-grained per-node control (retry, timeout, cache, tools)
- You want JSON-driven workflow design with VSCode visual editor

**Choose ADK when:**
- Your team uses multiple languages (Python, Go, Java, Kotlin)
- You want Google Cloud native deployment
- You want code-first development with IDE support
- You need visual builder for rapid prototyping

**Choose Cloudflare Agents when:**
- You need agents running 24/7 with persistent state
- You want automatic global scaling
- You need real-time WebSocket communication
- You want zero infrastructure management
- You need serverless GPU (Workers AI) or AI Gateway features

### Can They Be Combined?

**SGM on Cloudflare Workers:** Technically possible. Workers have Node.js compatibility (fetch, Buffer, etc.), and SGM is a TypeScript library. The InMemoryStore would need to be replaced with Durable Objects or KV for persistence. The function node `AsyncFunction` (eval) concern still applies.

**ADK on Cloudflare:** ADK is Python-first with TS support. Python doesn't run on Workers directly, but the TypeScript ADK could potentially work.

**Cloudflare as SGM/ADK deployment target:** Both SGM and ADK agents could be hosted as Cloudflare services, gaining Durable Objects persistence and global distribution. This would be the most powerful combination.

---

## 17. Code Comparison: Same Workflow in 3 Platforms

### Simple Planner Agent

**SGM (JSON):**
```json
{
  "config": { "name": "planner" },
  "annotation": {
    "messages": { "type": "BaseMessage[]", "reducer": "(x, y) => x.concat(y)", "default": "[]" }
  },
  "models": [{
    "id": "claude",
    "type": "anthropic",
    "config": { "model": "claude-sonnet-4-5-20250929" }
  }],
  "nodes": [
    { "id": "planner", "type": "model", "modelRef": "claude" }
  ],
  "edges": [
    { "from": "__start__", "to": "planner" },
    { "from": "planner", "to": "__end__" }
  ]
}
```

**Google ADK (Python):**
```python
from google.adk.agents import Agent

planner = Agent(
    name="planner",
    model="claude-sonnet-4-5-20250929",
    instruction="You are a task planner."
)
```

**Cloudflare Agents (TypeScript):**
```typescript
import { Agent, routeAgentRequest, callable } from "agents";

export class PlannerAgent extends Agent<Env> {
  @callable()
  async plan(input: string): Promise<string> {
    // Implementation
    return "Planned tasks...";
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
  }
};
```

### Multi-Agent Fan-out

**SGM:** Uses `Send` objects in function nodes with `__send__` edge routing.

**ADK:** Uses `Workflow` with `edges` configuration for parallel agent execution.

**Cloudflare:** Uses nested agent calls or multiple `@callable()` methods.

---

*Generated from SGM documentation (docs/FEATURES.md, docs/WORKFLOW.md, docs/API.md, docs/ARCHITECTURE.md, docs/MEMENTO-SKILLS.md, docs/DISPATCH.md, docs/EXAMPLES.md, docs/SKILLS-GUIDE.md, docs/INTEGRATION.md) and public documentation of Google ADK (https://adk.dev/) and Cloudflare Agents (https://developers.cloudflare.com/agents/).*
