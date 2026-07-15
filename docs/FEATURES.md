# Features

## Core Capabilities

### JSON-Driven Workflows
- Complete workflow definition in JSON format
- Automatic dependency resolution and execution order
- Directed Acyclic Graph (DAG) engine with cycle detection
- OpenAgentJson compatible JSON format

### Multi-Model AI Support

Supported AI providers:

| Provider | `type` value | Notes |
|---|---|---|
| Anthropic (Claude) | `anthropic` | Requires `ANTHROPIC_API_KEY` |
| OpenAI (GPT) | `openai` | Requires `OPENAI_API_KEY` |
| Azure OpenAI | `azure_openai` | Requires `AZURE_OPENAI_API_KEY` |
| Ollama | `ollama` | Local server, no API key |
| llama.cpp (GGUF) | `LlamaCpp` | Local server via llama.cpp |

**llama.cpp (GGUF) Configuration**

Start a llama.cpp server (`llama-server --model model.gguf --port 8001`), then reference it in the workflow JSON:

```json
{
  "id": "qwen",
  "type": "LlamaCpp",
  "config": {
    "model": "unsloth/Qwen3.6-35B-A3B",
    "serverUrl": "http://localhost:8001",
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

| Field | Default | Description |
|---|---|---|
| `serverUrl` | `http://localhost:8001` | llama.cpp server URL |
| `model` | — | Model name (informational, sent to server) |
| `temperature` | — | Sampling temperature |
| `maxTokens` | — | Max tokens to generate |

### Advanced Tool Integration

**MCP (Model Context Protocol)**
- Automatic tool binding to AI models
- Multiple MCP server support
- Dynamic tool configuration per node

**A2A (Agent-to-Agent Protocol)**
- Multi-agent communication capabilities
- Streaming and non-streaming messages
- Task lifecycle management
- Automatic tool generation from agent cards

**A2A Bearer Authentication**

Set credentials in `a2aClients` to connect to agents that require authentication.

```json
{
  "a2aClients": {
    "secure_agent": {
      "cardUrl": "https://agent.example.com/.well-known/agent.json",
      "bearerTokenEnvVar": "AGENT_API_KEY"
    }
  }
}
```

| Field | Description |
|---|---|
| `bearerToken` | Token inline (development use) |
| `bearerTokenEnvVar` | Environment variable name (recommended for production) |

**`useDiscoveredAgents` — Dynamic Agent Card Routing**

Set `useDiscoveredAgents: true` on a ToolNode to dynamically generate A2A tools at runtime from `state.availableAgents` (collected by `discovery_node`), instead of using static `a2aClients`. Tool definitions are auto-generated from the agent card's `name` / `description` / `skills`.

```
discovery_node (batch-fetch Agent Cards)
    ↓
planner_node (skill matching — select best agent)
    ↓
worker_node (useDiscoveredAgents: true — execute with dynamic A2A tools)
```

**`__registerA2AAgent` — Runtime A2A Agent Registration**

`__registerA2AAgent` is injected into the function node execution scope. It allows registering a newly discovered external agent dynamically during workflow execution.

```javascript
// Usage inside a function node
await __registerA2AAgent('dynamic_researcher', {
  cardUrl: 'https://researcher.example.com/.well-known/agent.json',
  timeout: 30000
});
// The agent is now available as an A2A tool for this node
```

The static methods `ModelFactoryManager.registerA2AAgent` / `unregisterA2AAgent` / `getA2AToolForAgent` manage the agent lifecycle.

**Skills System**
- Dynamic loading of external skills from SKILL.md files
- Claude Code-style tools integration (read_file, write_file, edit_file, glob_files, grep_search, bash_command, web_fetch)
- TODO management tools (`write_todos`, `read_todos`) — persistent TODO lists via `InMemoryStore`
- Automatic skill discovery and prompt injection
- Model-level and node-level tool binding
- Filesystem-based skill backend with virtual mode support

**ClaudeCode Tools — Reference**

All 7 tools are available to agents when `useSystemSkills: true` is set on a node.

| Tool | Key Arguments | Notes |
|---|---|---|
| `read_file` | `file_path`, `offset?`, `limit?` | Default 2000 lines. Supports text, image, PDF, Jupyter |
| `write_file` | `file_path`, `content` | Creates or overwrites. Prefer `edit_file` for existing files |
| `edit_file` | `file_path`, `old_string`, `new_string`, `replace_all?` | Exact-match replacement. `old_string` must match file content precisely |
| `glob_files` | `pattern`, `search_path?` | Glob search sorted by mtime. Max 200 results. Excludes `node_modules`, `.git`, `dist` by default; configurable via `excludeDirs` |
| `grep_search` | `pattern`, `search_path?`, `glob_pattern?`, `case_insensitive?` | Regex search. Shell injection prevented via `execFileSync`. Excludes `node_modules`, `.git`, `dist` by default; configurable via `excludeDirs` |
| `bash_command` | `command`, `description?`, `timeout?` | For git, build tools, etc. File ops should use dedicated tools above |
| `web_fetch` | `url` | HTTPS only. Blocks localhost, private IPs, IPv6 loopback |

All tools resolve paths relative to `rootDir` (default: project root). Paths that escape `rootDir` via `../` traversal are rejected.

**bash_command — Deny-by-Default Allowlist**

`config.bashCommandAllowedCommands` in the workflow JSON controls which commands `bash_command` may execute. `undefined` or `[]` rejects every command; only commands explicitly listed are allowed. All `bindSystemSkills: true` JSON configs embed the same 26-command allowlist (`git`, `yarn`, `npm`, `npx`, `node`, `tsx`, `docker`, `ls`, `cat`, `echo`, `pwd`, `mkdir`, `rm`, `mv`, `cp`, `chmod`, `find`, `head`, `tail`, `wc`, `grep`, `sed`, `awk`, `sort`, `uniq`, `tee`).

**RTK Integration — bash_command Token Reduction**

When the `rtk` CLI is installed, `bash_command` transparently routes through it to reduce output token consumption (60–90% savings on verbose commands like `git log`, `ls`).

- **Auto-detected**: RTK is used automatically when the `rtk` binary is found in `PATH`
- **Disable**: Set `useRtk: false` in `SkillsConfig` to bypass RTK even if installed

```json
{
  "models": [
    {
      "id": "agent",
      "type": "anthropic",
      "config": { "model": "claude-sonnet-4-5-20250929" },
      "bindSystemSkills": true,
      "skills": {
        "enabled": true,
        "skillsPath": "skills/my-skill",
        "backend": { "virtualMode": true, "rootDir": "." }
      }
    }
  ]
}
```

**`injectSkillsPrompt` — Per-Node Skills Prompt Control**

Set `injectSkillsPrompt: false` on a node to skip Skills prompt injection for that node only, even in a workflow with `useSystemSkills: true`. Useful for reducing token consumption on security evaluation nodes or rewrite nodes that do not need the Skills context.

```json
{
  "id": "guard_node",
  "type": "model",
  "modelRef": "qwen",
  "useSystemSkills": true,
  "injectSkillsPrompt": false
}
```

**`excludeTools` — Per-Node Tool Exclusion**

Use the `excludeTools` field on a ToolNodeConfig to forbid specific tools on a particular node. Useful when you bind a large set of tools via MCP or Skills but want to restrict dangerous operations on specific nodes.

```json
{
  "id": "safe_node",
  "type": "tool",
  "excludeTools": ["bash_command", "write_file"]
}
```

**`glob_files` Limits**

- **200-entry cap**: When results exceed 200, the first 200 are returned with a message indicating the overflow count.
- **Symlink support**: The `follow: true` option correctly traverses symlinks under `skills/`.

For projects with many files, narrow the search with a specific pattern (e.g., `src/**/*.ts`).

**Structured Output**
- Per-node JSON Schema enforcement via `structuredOutput` field
- LLM responses automatically validated and typed against the schema
- Works with all supported AI providers

### State Management
- LangGraph Annotation-based state definitions
- Custom reducers for complex state updates
- InMemoryStore for cross-conversation persistence
- MemorySaver for checkpointing

**MemorySaver — Conversation Checkpointing**

`MemorySaver` persists workflow state across `invoke()` calls using a `thread_id`. This enables multi-turn conversations where each call resumes from the previous state.

Enable it in the workflow config:

```json
{
  "config": {
    "store": { "type": "InMemoryStore" }
  }
}
```

Then pass `thread_id` in the `configurable` option:

```typescript
const result = await engine.invoke(
  { messages: [{ role: "user", content: "Hello" }] },
  { configurable: { thread_id: "user-123" } }
);

// Second call resumes from the same thread
const result2 = await engine.invoke(
  { messages: [{ role: "user", content: "Continue..." }] },
  { configurable: { thread_id: "user-123" } }
);
```

Each unique `thread_id` maintains independent conversation history. Use `getInMemoryStore()` to inspect stored state.

### Context Compression
- Automatic context compression to reduce token consumption in long conversations:
  - **Threshold mode** — triggers compression when `messages` and `tokens` conditions are met, summarizing and removing old messages before node execution
  - **Autonomous mode** — injects a `compress_context` tool into the model so it can decide when to compress
  - Summary is attached to the final result as the `summary` field
  - Configured via `config.config.contextCompression` in workflow JSON

**Threshold mode example** (`json/context-compression-threshold.json`):
```json
{
  "config": {
    "contextCompression": {
      "enabled": true,
      "mode": "threshold",
      "trigger": { "messages": 10, "tokens": 102400 },
      "keep": { "messages": 4 }
    }
  },
  "annotation": {
    "messages": { "type": "string[]", "reducer": "(x, y) => x.concat(y)", "default": [] },
    "summary": { "type": "string", "reducer": "(_, y) => y", "default": "" }
  }
}
```

**Autonomous mode example** (`json/context-compression-autonomous.json`):
```json
{
  "config": {
    "contextCompression": {
      "enabled": true,
      "mode": "autonomous",
      "keep": { "messages": 4 }
    }
  },
  "annotation": {
    "messages": { "type": "string[]", "reducer": "(x, y) => x.concat(y)", "default": [] },
    "summary": { "type": "string", "reducer": "(_, y) => y", "default": "" }
  }
}
```

**Configuration fields:**

| Field | Type | Description |
|---|---|---|
| `contextCompression.enabled` | `boolean` | Enable compression |
| `contextCompression.mode` | `"threshold"` \| `"autonomous"` | Compression mode |
| `contextCompression.trigger.messages` | `number` | (threshold) Message count threshold |
| `contextCompression.trigger.tokens` | `number` | (threshold) Token threshold. AND condition with `messages` |
| `contextCompression.keep.messages` | `number` | Number of tail messages to keep after compression |

### Sprint Contract Pattern

Iterative Generator-Evaluator loop with dynamically negotiated success criteria. The Planner generates a task specification, the Negotiator defines goals and success criteria, the Generator implements, and the Evaluator assesses quality. If the result fails, the loop returns to Negotiate for a retry (up to `MAX_RETRIES`).

```
planner → negotiate → generator → evaluator → router
                                     ↓          ↓
                              retry (max 3)   end
```

**State fields:**

| Field | Type | Description |
|---|---|---|
| `taskSpec` | `string` | Detailed specification generated by Planner |
| `sprintContract` | `{ goals, successCriteria, sprintNumber }` | Dynamically negotiated success criteria (overwrite reducer) |
| `sprintResult` | `{ passed, feedback, score }` | Evaluator result (overwrite reducer) |
| `retryCount` | `number` | Accumulated retry count (additive reducer) |

Configured via `nodes` and `edges` in workflow JSON. See `json/sprint-contract-qwen.json` for a complete example.

### Context Guard (Context Reset)

Prevents "Context Anxiety" — the phenomenon where the agent gives up mid-task because the context window is full. Monitors estimated token usage and, when it exceeds a threshold (default 70%), replaces all messages with a single summary containing critical state fields.

**How it works:**

1. `context_guard_node` (function node) estimates tokens from `state.messages`
2. If `estimatedTokens >= modelContextLimit * thresholdRatio`, a reset is triggered
3. A summary message (`=== Context Reset ===`) containing `taskSpec`, `sprintContract`, `sprintResult`, `retryCount` is written to a separate `activeMessages` field
4. The `activeMessages` reducer detects the reset marker and replaces (instead of concatenates) the message history
5. The workflow continues from `negotiate_node` with the reset context

**Configuration:**

| Field | Type | Default | Description |
|---|---|---|---|
| `contextGuard.enabled` | `boolean` | `false` | Enable context guard |
| `contextGuard.modelContextLimit` | `number` | `200000` | Model context window size |
| `contextGuard.thresholdRatio` | `number` | `0.70` | Trigger ratio (70% of context window) |

**Reducer design for `activeMessages`:**

```json
"activeMessages": {
  "type": "BaseMessage[]",
  "reducer": "(x, y) => { const isReset = y.length === 1 && typeof y[0].content === 'string' && y[0].content.startsWith('=== Context Reset'); return isReset ? y : x.concat(y); }",
  "default": "[]"
}
```

Designed to work with Sprint Contract — the reset preserves all sprint state so the loop can continue seamlessly. See `json/sprint-contract-qwen.json` for the integrated example.

### LangSmith Integration

Every `invoke()` and `stream()` call automatically injects LangSmith tags and metadata for trace observability. Configurable via `config.langsmith` in the workflow JSON.

**Default behavior (no config):**

| Field | Value |
|---|---|
| `tags` | `["sgm-workflow", <workflow name>]` |
| `metadata` | `{ workflowId, threadId }` |

**Custom configuration:**

```json
{
  "config": {
    "langsmith": {
      "tags": ["my-app", "production"],
      "metadata": {
        "environment": "production",
        "version": "2.6.0"
      }
    }
  }
}
```

- `tags`: When omitted, defaults to `["sgm-workflow", workflowId]`. When set, completely replaces the default.
- `metadata`: `workflowId` and `threadId` are always injected. Additional keys from `langsmith.metadata` are merged in. Runtime `configurable.metadata` overrides at invoke/stream time.

### Conditional Routing
- Dynamic routing based on state
- Fan-out patterns with `Send` objects
- Multiple conditional paths per edge

### Execution Modes
```typescript
// Single execution
const result = await engine.invoke({ input: "Hello" });

// Streaming execution
for await (const update of engine.stream({ input: "Hello" })) {
  console.log(update);
}
```

### Hooks & Event System
- Rich lifecycle events: `sessionStart`, `nodeStart`, `nodeComplete`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `userPromptSubmit`, `complete`, `error`
- `HookFeedback` return from handlers: block tool calls, rewrite tool inputs, inject context
- Multiple handlers supported; all receive every event

### Developer Experience
- Event system for workflow monitoring
- Graph visualization (Mermaid PNG export)
- Comprehensive TypeScript types
- Detailed error messages

### Security & Privacy

**Secret Redaction in Logs**
- API keys (Anthropic, OpenAI, Google) and sensitive fields (`api_key`, `password`) are automatically masked in all log output.

**PII Filtering**
- Configurable per-rule PII filtering applied to every `invoke()` input before it reaches the AI model.
- Supports `email`, `ip`, `credit_card`, `phone_number`, `address`, `full_name`, and custom regex patterns.
- Four strategies: `redact` (replace), `mask` (partial hide), `hash` (pseudonymize), `block` (throw `PiiBlockedError`).
- Configured inside the Ollama model definition in the workflow JSON — see [`json/pii.json`](json/pii.json).

**ClaudeCode Tools Sandboxing**
- Path traversal (`../`) and URL-encoded variants are blocked.
- Write/edit to `protectedPaths` is rejected.
- SSRF prevention: `localhost`, private IPs (10.x, 172.16.x, 192.168.x), link-local (169.254.x), and IPv6 loopback `[::1]` are blocked.
- Non-HTTPS requests are rejected.
- Shell commands are executed via `execFileSync` (no shell expansion), preventing semicolon/pipe injection.

**Configuring `excludeDirs`**

Add `excludeDirs` to the skills config to prevent `grep_search` and `glob_files` from scanning specific directories. Useful for excluding binary files, large generated directories, or sensitive data folders. `node_modules`, `.git`, and `dist` are always excluded by default.

```json
{
  "models": [
    {
      "id": "agent",
      "type": "anthropic",
      "config": { "model": "claude-sonnet-4-5-20250929" },
      "bindSystemSkills": true,
      "skills": {
        "enabled": true,
        "skillsPath": "skills/my-skill",
        "excludeDirs": ["data", "coverage", "tmp"]
      }
    }
  ]
}
```

**Configuring `protectedPaths`**

Add `protectedPaths` to the skills backend config to prevent agents from writing to sensitive files or directories.

```json
{
  "models": [
    {
      "id": "agent",
      "type": "anthropic",
      "config": { "model": "claude-sonnet-4-5-20250929" },
      "bindSystemSkills": true,
      "skills": {
        "enabled": true,
        "skillsPath": "skills/my-skill",
        "backend": {
          "virtualMode": true,
          "rootDir": ".",
          "protectedPaths": ["src/", ".env", "package.json", "CHANGELOG.md"]
        }
      }
    }
  ]
}
```

Attempts to `write_file` or `edit_file` to any path under `protectedPaths` throw `Write access denied` immediately, before any model call.

**Path Traversal, SSRF, and Shell Injection**

These protections are built-in and require no configuration:

| Attack vector | Protection |
|---|---|
| `../` path traversal | All paths resolved and checked against `rootDir` boundary |
| URL-encoded traversal (`%2e%2e`) | Normalized before boundary check |
| SSRF via `web_fetch` | Blocks `localhost`, `127.x`, `10.x`, `172.16–31.x`, `192.168.x`, `169.254.x`, `[::1]`, non-HTTPS |
| Shell injection via `bash_command` | Uses `execFileSync` — no shell expansion, semicolons/pipes cannot escape the command |

### SourceHunt — AI-Driven Vulnerability Pipeline

Automated vulnerability discovery using a multi-specialist AI pipeline:

- **4-Phase Architecture** — `ranker_node` (prioritization) → `hunter_node` (exploitation) → `verifier_node` (validation) → `reporter_node` (documentation)
- **Reflexion Loop** — Verifier feedback drives iterative improvement
- **OSV.dev Integration** — Cross-references findings against known CVEs with JSON cache (`results/cve_cache.json`)
- **CVE-Aware Sorting** — `sortMergedEntries` prioritizes by vulnerability class (memory_safety, integer_overflow, input_validation)
- **Best-Result Preservation** — Automatic saving of top findings to `results/best/` with unified `combined_report.md`
- **Multi-Specialist Execution** — Specialist rotation with serial `mergeAllResults` aggregation
- Located in `works/sourcehunt/`
