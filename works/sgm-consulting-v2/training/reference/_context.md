# SceneGraphManager Project Context for Q&A Generation

## Product Overview
**SceneGraphManager (SGM)** v2.3.0 — JSON-Driven AI Workflow Engine for LangGraph.
Published as `@kudos/scene-graph-manager` on npm.
GitHub: akudo7/SceneGraphManager

### Key Features
- JSON-driven workflows with DAG execution
- Multi-model AI support: Anthropic Claude, OpenAI, Azure OpenAI, Ollama, llama.cpp (GGUF)
- MCP (Model Context Protocol) tool binding
- A2A (Agent-to-Agent) protocol with dynamic Agent Card discovery and Swarms Fan-out/Fan-in
- Skills system (SKILL.md files)
- Context Compression (threshold / autonomous modes)
- Context Guard (automatic reset when context exceeds threshold)
- Sprint Contract pattern (Generator-Evaluator iterative loop)
- Hooks & Event System with HookFeedback
- Security: PII filtering, secret redaction, tool sandboxing
- SourceHunt: AI-driven multi-specialist vulnerability discovery pipeline
- AutoResearch: autonomous SKILL.md improvement loop with holdout validation
- Dispatch: Remote task execution via HTTP / Slack / Telegram
- Memento-Skills: Self-improving workflows (reflect_node writes lessons to SKILL.md)
- Structured Output (JSON Schema)
- write_todos/read_todos

## Architecture

### Core Files
- `src/lib/workflow.ts` — WorkflowEngine (~1,160 lines)
- `src/lib/graph.ts` — Graph wrapper with validation (~432 lines)
- `src/lib/context-compression/index.ts` — ContextCompressionManager (~200 lines)
- `src/lib/context-guard/index.ts` — ContextGuard (~150 lines)
- `src/lib/models/factory.ts` — ModelFactoryManager (~212 lines)
- `src/lib/models/llamacpp.ts` — llama.cpp / GGUF model support
- `src/a2a/A2AEndpoint.ts` — A2A server (~287 lines)
- `src/a2a/A2AToolGenerator.ts` — A2A tool generation + dynamic discovery (~540 lines)
- `src/lib/dispatch/` — Dispatch system: DispatchTaskStore, AsyncTaskQueue, WebhookNotifier

### WorkflowEngine API
- `new WorkflowEngine(config: WorkflowConfig)` — Constructor
- `build(): Promise<void>` — Build workflow
- `invoke(input: WorkflowState, options?: InvokeOptions): Promise<WorkflowResult>` — Execute
- `stream(input: WorkflowState, options?: StreamOptions): Promise<AsyncIterable<any>>` — Stream execute
- `drawGraph(filename: string): Promise<string>` — Output graph as image
- `getCompiledGraph(): CompiledStateGraph` — Get compiled graph
- `addEventListener(handler: WorkflowEventHandler): void` — Register event handler
- `getUsageStats(): WorkflowUsageStats` — Get token usage stats
- `resetUsage(): void` — Reset usage stats
- `close(): void` — Release resources

### WorkflowConfig
- `config: Record<string, any>` — Free-form config (info, recursionLimit, contextGuard, etc.)
- `stateAnnotation: StateDefinition` — State type definition
- `annotation: Record<string, AnnotationSpec>` — State field specs
- `models: ModelConfig[]` — Model configurations
- `nodes: Node[]` — Node definitions
- `edges: Edge[]` — Edge definitions
- `stateGraph: StateGraphConfig` — Graph settings
- `mcpServers?: Record<string, McpServerConfig>` — MCP server configs
- `a2aServers?: Record<string, A2AServerConfig>` — A2A server configs

### Node Types
- `model` — LLM call (modelRef, useSystemSkills)
- `tool` — Tool execution (MCP, A2A, filesystem)
- `conditional` — Routing logic (conditions array)
- `custom` / `function` — Arbitrary JS function via AsyncFunction constructor

### Node Configuration
```json
{
  "id": "node_id",
  "type": "function",
  "handler": {
    "parameters": [
      { "name": "state", "parameterType": "state", "stateType": "typeof MyState.State" },
      { "name": "model", "parameterType": "model", "modelRef": "modelId" }
    ],
    "output": {},
    "function": "return { messages: [response] };"
  }
}
```

### Model Types
- `LlamaCpp` — llama.cpp server (GGUF models)
- `Ollama` — Ollama server
- `OpenAI` — OpenAI API
- `Anthropic` — Anthropic Claude API
- `AzureOpenAI` — Azure OpenAI

### Model Config Example
```json
{
  "id": "qwen",
  "type": "LlamaCpp",
  "config": {
    "model": "unsloth/Qwen3.6-35B-A3B",
    "temperature": 0.7,
    "serverUrl": "http://localhost:8001"
  },
  "systemPrompt": "You are a helpful assistant."
}
```

### State Annotation
```json
{
  "stateAnnotation": { "name": "MyState", "type": "Annotation.Root" },
  "annotation": {
    "messages": { "type": "BaseMessage[]", "reducer": "(x, y) => x.concat(y)", "default": "[]" },
    "customField": { "type": "string", "reducer": "(x, y) => y", "default": "" }
  }
}
```

### Edges
- Normal: `{ "from": "node1", "to": "node2" }`
- Conditional: `{ "from": "node1", "type": "conditional", "condition": { "handler": { "function": "return state.result ? 'yes' : 'no';" } } }`
- Special: `__start__`, `__end__`

### Context Compression
Two modes:
1. `threshold` — Trigger when message count or token count exceeds threshold
2. `autonomous` — Model decides when to compress
Config:
```json
"contextCompression": {
  "enabled": true,
  "mode": "threshold",
  "trigger": { "messages": 8, "tokens": 32768 },
  "keep": { "messages": 4 }
}
```

### Context Guard
Automatic reset when context exceeds threshold.
```json
"contextGuard": {
  "enabled": true,
  "modelContextLimit": 200000,
  "thresholdRatio": 0.7
}
```

### Sprint Contract Pattern
Generator-Evaluator iterative loop.
- `negotiate_node` — Define goals and success criteria
- `generator_node` — Generate implementation
- `evaluator_node` — Evaluate against criteria
- `router_node` — Conditional routing (retry or end)
Config: `max_rounds`, `max_consecutive_safe`, `min_rounds`

### Dispatch System
Remote task execution via HTTP/Slack/Telegram.
- `POST /.well-known/agent.json` — Agent Card
- `POST /message/send` — Submit task (with optional webhookUrl)
- `GET /tasks` — List tasks
- `GET /tasks/:taskId` — Get single task
- `POST /tasks/:taskId/cancel` — Cancel task
- `GET /health` — Health check

### Slack Integration
- Socket Mode bot (`slack-dispatch-bot.ts`)
- POST to dispatch-server webhook
- Results posted in Slack thread
- End commands: "終了", "exit", "quit", "やめる", "done"

### A2A Protocol
- Agent Card discovery at `/.well-known/agent.json`
- Dynamic Agent Card discovery
- Swarms Fan-out/Fan-in workflows
- Agent-to-Agent communication

### Skills System
- SKILL.md files in `skills/` directory
- Injected into system prompt via `injectSkillsPromptIfNeeded()`
- Memento-Skills: reflect_node appends lessons to SKILL.md
- Domain-aware skill routing

### AutoResearch
Autonomous SKILL.md improvement loop:
1. Iteratively trains on train tasks
2. Validates on holdout tasks
3. Auto-commits or rollbacks based on holdout score
4. Reward Hacking detection: train/holdout divergence > 0.2

### Security Features
- PII filtering
- Secret redaction
- Tool sandboxing
- Answer rules: Never include internal code, file paths, class names, implementation details

### Answer Rules (for consulting bot)
- Use public docs (SKILL.md / OpenAgentJson / a2a-server / kudosflow) to answer
- Internal code reference allowed for bug investigation
- Never include SGM internal code, file paths, class names, implementation details in answers

### Technology Stack
- LangGraph v1.0.1+
- LangChain Core v1.0.1+
- A2A JS SDK v0.3.4+
- TypeScript 5.9.2+
- Node.js 16+

### Key Workflow JSON Examples
- `json/basic-workflow-qwen.json` — Basic chat workflow
- `json/multi-model-qwen.json` — Multi-model coordination (3 models in one node)
- `json/sprint-contract-qwen.json` — Generator-Evaluator loop with Context Guard
- `json/context-compression-autonomous-qwen.json` — Context compression
- `json/structured-output-qwen.json` — JSON Schema structured output
- `json/slack-chat-qwen.json` — Slack chat workflow
- `json/hooks-qwen.json` — Hooks example
- `json/interrupt-qwen.json` — Interrupt/prompt workflow
- `json/pii.json` — PII filtering
- `json/sourcehunt-qwen.json` — SourceHunt pipeline
- `json/swarms/` — Swarms Fan-out/Fan-in workflows
- `json/teams/` — Memento-Skills workflows
- `json/todos-qwen.json` — write_todos/read_todos

### External Projects
- GitHub: akudo7/OpenAgentJson — Agent configuration JSON
- GitHub: akudo7/a2a-server — A2A server implementation
- GitHub: akudo7/kudosflow — VSCode extension (kudosflow2)
