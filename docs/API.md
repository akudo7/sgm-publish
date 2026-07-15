# API Reference

## WorkflowEngine

The main class for managing workflow execution.

### Constructor

```typescript
constructor(config: WorkflowConfig)
```

**API Key Setup:** SceneGraphManager does **not** auto-load `.env`. Set `apiKey` directly in the config, or use `loadSecrets()` to populate `process.env` from the OS-native secret store (macOS Keychain / Linux libsecret / Windows Credential Manager) before constructing the engine.

```typescript
import { loadSecrets } from 'scenegraphmanager';
loadSecrets();  // reads OS keychain → process.env
const engine = new WorkflowEngine(config);
await engine.build();
```

See [docs/QUICK-START.md — API Key Setup](QUICK-START.md#api-key-setup) for per-OS registration commands.

### Methods

- `async build()` - Build and compile the workflow graph
- `async invoke(input, options?)` - Execute workflow once and return result
- `async stream(input, options?)` - Execute workflow with streaming updates. `options.streamMode` accepts `"values"` (default) / `"updates"` / `"tools"` / `"messages"` / `"tokens"`
- `addEventListener(handler)` - Register event handler; handler may return `HookFeedback` to block/modify tool calls
- `async drawGraph(filename)` - Export graph visualization as PNG (Mermaid-based)
- `getCompiledGraph()` - Access underlying LangGraph
- `getInMemoryStore()` - Access persistent store
- `getUsageStats()` - Return `WorkflowUsageStats` — aggregated token counts and estimated cost for the session

`Graph.setNodeDefaults(defaults)` — sets default `retryPolicy` / `timeout` / `cachePolicy` applied to every node; per-node values in `NodeBase` override these. Must be called after `initialize()`.

`Overwrite` is re-exported from `scenegraphmanager` (passthrough of `@langchain/langgraph`'s `Overwrite`) for explicit state-channel overwrite semantics in custom reducers.

```typescript
// Export workflow graph as PNG for debugging
await engine.drawGraph('workflow.png');
// Generates workflow.png in the current directory using Mermaid rendering
```

### Configuration Structure

```typescript
interface WorkflowConfig {
  config?: {
    name?: string;
    description?: string;
    recursionLimit?: number;
    mcpServers?: { config: MCPClientConfig };
    store?: { type: 'InMemoryStore' };
    a2aEndpoint?: A2AEndpointConfig;
    bashCommandAllowedCommands?: string[];  // deny-by-default; undefined/[] rejects all bash_command calls
  };
  stateAnnotation: { name: string; type: "Annotation.Root" };
  annotation: Record<string, AnnotationField>;
  models: ModelConfig[];
  mcpServers?: Record<string, MCPServerConfig>;
  a2aClients?: Record<string, A2AClientConfig>;
  nodes: NodeConfig[];
  edges: EdgeConfig[];
  stateGraph: { annotationRef: string; config?: any };
}
```

---

### NodeBase Common Fields

Fields available on all node types (`model` / `tool` / `custom`).

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | — | Node identifier (required) |
| `type` | `string` | — | Node type: `model` / `tool` / `custom` |
| `useSystemSkills` | `boolean` | `false` | Inject Skills prompt into the system message |
| `injectSkillsPrompt` | `boolean` | `true` | Set `false` to skip Skills prompt injection for this node only (overrides workflow-level `useSystemSkills: true`) |
| `structuredOutput` | `object` | — | JSON Schema to enforce structured model output. `strict?: boolean` / `fallbackToText?: boolean` (GPT models, LangGraph 1.4.0+) |
| `retryPolicy` | `RetryPolicyConfig` | — | `{ maxAttempts?, backoffFactor?, initialInterval?, maxInterval? }` — retry behavior on transient node errors (LangGraph 1.1.0+) |
| `timeout` | `number \| TimeoutPolicyConfig` | — | Milliseconds, or `{ runTimeout?, idleTimeout?, refreshOn? }` for fine-grained control (LangGraph 1.4.0+) |
| `cachePolicy` | `CachePolicyConfig` | — | `{ ttl? }` in seconds; `undefined` never expires (LangGraph 1.4.0+) |
| `tags` | `string[]` | — | Custom LangSmith tags attached to this node's runs (LangGraph 1.4.0+) |

### ToolNodeConfig Fields

Fields specific to `type: "tool"` nodes.

| Field | Type | Description |
|---|---|---|
| `tools` | `string[]` | Array of tool names to bind |
| `excludeTools` | `string[]` | Array of tool names to exclude from this node. Use when you want to bind a large toolset globally but restrict dangerous operations on specific nodes |
| `useDiscoveredAgents` | `boolean` | When `true`, generates A2A tools at runtime from `state.availableAgents` (populated by `discovery_node`) instead of static `a2aClients` |

### A2AClientConfig Fields

Fields available on each entry in `a2aClients`.

| Field | Type | Description |
|---|---|---|
| `cardUrl` | `string` | Agent Card URL (`/.well-known/agent.json`) |
| `bearerToken` | `string` | Bearer token inline (development / testing) |
| `bearerTokenEnvVar` | `string` | Environment variable name to read the Bearer token from (recommended for production) |

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

---

### WorkflowUsageStats Type

Return type of `getUsageStats()`.

```typescript
interface WorkflowUsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd?: number;        // undefined if model has no pricing data
  byNode: Record<string, NodeUsageSummary>;
  byModel: Record<string, ModelUsageSummary>;
}

interface NodeUsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface ModelUsageSummary {
  calls: number;
  totalTokens: number;
}
```

Built-in pricing table (used for `totalEstimatedCostUsd`): `claude-opus-4-6` / `claude-sonnet-4-6` / `claude-haiku-4-5` / `gpt-4o`
