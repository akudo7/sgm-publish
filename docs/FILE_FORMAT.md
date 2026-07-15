# Open Agent JSON File Format Specification

> Visual, production-ready AI workflows — portable as JSON

## Overview

Open Agent JSON is a declarative JSON format for defining AI agent workflows powered by LangGraph.js. It enables meta-programming of complex agent systems through configuration rather than code, supporting multi-agent orchestration, model integration, and interactive workflows.

## File Structure

An Open Agent JSON file consists of the following top-level sections:

```json
{
  "config": { },
  "stateAnnotation": { },
  "annotation": { },
  "models": [ ],
  "mcpServers": { },
  "nodes": [ ],
  "edges": [ ],
  "stateGraph": { }
}
```

---

## 1. Config Section

Global configuration for the workflow execution environment.

### Schema

```typescript
{
  "config": {
    "info": {
      "version": string,
      "description": string,
      "copyright": string,
      "author": string
    },
    "recursionLimit": number,
    "eventEmitter": {
      "defaultMaxListeners": number
    },
    "contextCompression": {
      "enabled": boolean,
      "mode": "autonomous" | "threshold",
      "trigger": { "messages": number, "tokens": number } | { "messages": number, "tokens": number }[],
      "keep": { "messages": number },
      "modelRef": string,
      "summaryPrompt": string,
      "summaryPrefix": string
    },
    "store": {
      "type": "InMemoryStore"
    },
    "bashCommandAllowedCommands": string[],
    "tokenCounting": {
      "enabled": boolean,
      "pricing": { [modelId: string]: { input: number, output: number } }
    },
    "contextGuard": {
      "enabled": boolean,
      "modelContextLimit": number,
      "thresholdRatio": number
    },
    "langsmith": {
      "tags": string[],
      "metadata": Record<string, any>
    }
  }
}
```

### Fields

- **info**: Metadata about the workflow
  - **version**: Semantic version (e.g., "1.0.0")
  - **description**: Human-readable workflow description
  - **copyright**: Copyright notice
  - **author**: Author name

- **recursionLimit**: Maximum depth for recursive workflow execution (default: 25)

- **eventEmitter**: EventEmitter configuration
  - **defaultMaxListeners**: Max concurrent event listeners (default: 10)

- **contextCompression** (optional): Automatic context window compression to prevent token limit errors
  - **enabled**: Enable context compression (default: false)
  - **mode**: Compression mode — `"threshold"` (Engine auto-compresses on trigger) or `"autonomous"` (Model self-calls `compress_context` tool, default: `"threshold"`)
  - **trigger**: Activation condition(s) — OR semantics when array
    - **messages**: Trigger when message count exceeds this number
    - **tokens**: Trigger when approximate token count exceeds this number
  - **keep**: What to retain after compression
    - **messages**: Number of recent messages to keep
  - **modelRef** (optional): Model ID reference for summary generation
  - **summaryPrompt** (optional): Prompt template for summary, `{messages}` placeholder supported
  - **summaryPrefix** (optional): Prefix prepended to summary (default: `"Previous conversation summary:\n\n"`)

- **store** (optional): Key-value store configuration
  - **type**: Store implementation (`"InMemoryStore"`)

- **bashCommandAllowedCommands** (optional): Command allowlist for `bash_command` tool. Deny-by-default: `undefined` or `[]` rejects all commands. Only listed commands are permitted.
  - **type**: `string[]`
  - **example**: `["git", "yarn", "npm", "ls", "cat", "echo"]`

- **tokenCounting** (optional): Token usage & cost tracking configuration
  - **enabled**: Enable token counting (default: false)
  - **pricing**: Per-model pricing map `{ modelId: { input: number, output: number } }`

- **contextGuard** (optional): Context window usage monitoring
  - **enabled**: Enable context guard (default: false)
  - **modelContextLimit**: Model context window size in tokens (default: 200000)
  - **thresholdRatio**: Reset trigger ratio (0.0–1.0, default: 0.70)

- **langsmith** (optional): LangSmith trace tags and metadata configuration
  - **tags**: Custom tags for LangSmith runs. When omitted, defaults to `["sgm-workflow", workflowId]`
  - **metadata**: Additional metadata key-value pairs. `workflowId` and `threadId` are always injected automatically

### Example

```json
{
  "config": {
    "info": {
      "version": "1.0.0",
      "description": "Career counselor workflow",
      "copyright": "Copyright 2026",
      "author": "Akira Kudo"
    },
    "recursionLimit": 25,
    "eventEmitter": {
      "defaultMaxListeners": 10
    },
    "contextCompression": {
      "enabled": true,
      "mode": "threshold",
      "trigger": { "messages": 8, "tokens": 32768 },
      "keep": { "messages": 4 }
    },
    "store": {
      "type": "InMemoryStore"
    }
  }
}
```

### Runtime Features

Some features are configured at runtime via the `WorkflowEngine` constructor or dispatch scripts, not in the JSON file:

- **Hooks**: Register `WorkflowEventHandler` callbacks for events (`nodeStart`, `nodeComplete`, `preToolUse`, `postToolUse`, `tokenUsage`, etc.). See [Section 11 — Hooks Event System](#11-hooks-event-system) for details.
- **Dispatch**: Use `AsyncTaskQueue` with `DispatchTaskStore` and `WebhookNotifier` for asynchronous task execution with SQLite persistence and webhook notifications. See [Section 12 — Dispatch Configuration](#12-dispatch-configuration) for details.

These features complement the JSON configuration but are not declarable within the JSON file itself.

---

## 2. State Annotation Section

Defines the root state annotation name used throughout the workflow.

### Schema

```typescript
{
  "stateAnnotation": {
    "name": string,
    "type": "Annotation.Root"
  }
}
```

### Fields

- **name**: Identifier for the state annotation (referenced by nodes)
- **type**: Must be `"Annotation.Root"` (fixed value)

### Example

```json
{
  "stateAnnotation": {
    "name": "TestWorkflowState",
    "type": "Annotation.Root"
  }
}
```

---

## 3. Annotation Section

Defines state fields with types, reducers, and default values.

### Schema

```typescript
{
  "annotation": {
    "<fieldName>": {
      "type": string,
      "reducer": string,
      "default": any
    }
  }
}
```

### Fields

- **fieldName**: State field identifier
  - **type**: TypeScript type expression (e.g., `"string"`, `"string[]"`, `"BaseMessage[]"`)
  - **reducer**: Function expression for merging state updates (e.g., `"(x, y) => x.concat(y)"`)
  - **default**: Initial value for the field

### Common Reducer Patterns

| Pattern | Reducer | Use Case |
|---------|---------|----------|
| Concatenate | `(x, y) => x.concat(y)` | Arrays (messages, logs) |
| Replace | `(x, y) => y || x` | Single values (status, counters) |
| Merge | `(x, y) => ({ ...x, ...y })` | Objects |
| Override | `(x, y) => y !== undefined ? y : x` | Nullable values |

### Example

```json
{
  "annotation": {
    "messages": {
      "type": "string[]",
      "reducer": "(x, y) => x.concat(y)",
      "default": []
    },
    "userName": {
      "type": "string",
      "reducer": "(x, y) => y || x",
      "default": ""
    },
    "userApproval": {
      "type": "boolean | null",
      "reducer": "(x, y) => y !== undefined ? y : x",
      "default": null
    }
  }
}
```

---

## 4. Models Section

Defines LLM models used by workflow nodes.

### Schema

```typescript
{
  "models": [
    {
      "id": string,
      "type": "OpenAI" | "Anthropic" | "Ollama" | "LlamaCpp",
      "config": {
        "model": string,
        "temperature": number,
        ...
      },
      "systemPrompt": string,
      "bindA2AServers": boolean,
      "bindMcpServers": boolean,
      "bindSystemSkills": boolean,
      "skills": {
        "enabled": boolean,
        "skillsPath": string,
        "useRtk": boolean,
        "excludeDirs": string[],
        "backend": {
          "virtualMode": boolean,
          "rootDir": string
        }
      }
    }
  ]
}
```

### Fields

- **id**: Unique identifier for referencing in nodes
- **type**: Model provider (`"OpenAI"`, `"Anthropic"`, `"Ollama"`, `"LlamaCpp"`)
  - **LlamaCpp**: Local model server (llama.cpp HTTP API) — requires `serverUrl` in config
  - **Ollama**: Ollama local server — requires `baseUrl` in config
- **config**: Provider-specific configuration
  - **model**: Model name (e.g., `"gpt-4o-mini"`, `"claude-sonnet-3-5-20241022"`, `"unsloth/Qwen3.6-35B-A3B"`)
  - **temperature**: Sampling temperature (0.0-2.0)
  - **serverUrl** (LlamaCpp): URL of the llama.cpp server (e.g., `"http://localhost:8001"`)
  - **baseUrl** (Ollama): URL of the Ollama server (e.g., `"http://localhost:11434"`)
  - Additional provider-specific options
  - **piiFilter** (optional): Personally Identifiable Information filter configuration
    - **enabled**: Enable PII filtering (default: false)
    - **rules**: Array of PII detection rules
      - **type**: PII type — `"email"`, `"ip"`, `"credit_card"`, `"employee_id"`, `"phone_number"`, etc.
      - **strategy**: Action — `"redact"` (replace with `[REDACTED]`), `"mask"` (partial hide), `"block"` (stop execution)
      - **pattern** (optional): Custom regex pattern for `employee_id` type rules

- **systemPrompt** (optional): Default system message
- **bindA2AServers** (optional): Enable Agent-to-Agent (A2A) tool binding
- **bindMcpServers** (optional): Enable MCP server tool binding
- **bindSystemSkills** (optional): Bind **System Skills** (the built-in ClaudeCode-style tools — `read_file`/`write_file`/`bash_command`/etc.) to this model. Requires `skills.enabled: true` on the same model; `bindSystemSkills: true` alone with `skills` unset/disabled binds no tools
- **skills** (optional): Per-model skills configuration. `enabled`/`skillsPath`/`backend` govern **Custom Skills** discovery (SKILL.md-based) and double as the shared filesystem config (`rootDir`, `skillsPath` as a protected path) consumed by `bindSystemSkills`'s System Skills tools
  - **enabled**: Enable skills for this model — master switch for both Custom Skills discovery and (combined with `bindSystemSkills`) System Skills tool creation
  - **skillsPath**: Path to the Custom Skills directory. Relative paths are resolved against `backend.rootDir` (default: `process.cwd()`); absolute paths are used as-is. If `skillsPath` is absolute and points to an existing directory that contains no skills, initialization throws — this catches a misconfigured `enabled: true`. A relative path or a not-yet-created directory is tolerated (no skills loaded, no error)
  - **useRtk** (optional): Enable RTK proxy for bash commands
  - **excludeDirs** (optional): Directories to exclude from grep_search
  - **backend** (optional): FilesystemBackend configuration
    - **virtualMode**: Use virtual paths (default: true)
    - **rootDir**: Root directory for filesystem operations

### Example

```json
{
  "models": [
    {
      "id": "adviceModel",
      "type": "OpenAI",
      "config": {
        "model": "gpt-4o-mini",
        "temperature": 0.7
      },
      "systemPrompt": "You are a career counselor."
    },
    {
      "id": "orchestrator",
      "type": "Anthropic",
      "config": {
        "model": "claude-sonnet-3-5-20241022",
        "temperature": 0.3
      },
      "bindA2AServers": true
    },
    {
      "id": "localModel",
      "type": "LlamaCpp",
      "config": {
        "model": "unsloth/Qwen3.6-35B-A3B",
        "temperature": 0.2,
        "serverUrl": "http://localhost:8001",
        "piiFilter": {
          "enabled": true,
          "rules": [
            { "type": "email",       "strategy": "redact" },
            { "type": "ip",          "strategy": "mask"   },
            { "type": "credit_card", "strategy": "block"  }
          ]
        }
      }
    }
  ]
}
```

---

## 5. PII Filter

Per-message Personally Identifiable Information (PII) filtering applied at model invocation time. Configured per-model in `models[].config.piiFilter`.

### Schema

```typescript
{
  "models": [
    {
      "config": {
        "piiFilter": {
          "enabled": boolean,
          "rules": [
            {
              "type": "email" | "ip" | "credit_card" | "employee_id" | "phone_number" | string,
              "strategy": "redact" | "mask" | "block",
              "pattern": string   // optional, for custom types
            }
          ]
        }
      }
    }
  ]
}
```

### Fields

- **enabled**: Enable PII filtering for this model (default: false)
- **rules**: Array of detection rules evaluated in order
  - **type**: PII category to detect. Built-in types: `"email"`, `"ip"`, `"credit_card"`, `"employee_id"`, `"phone_number"`. Custom types supported via `pattern`.
  - **strategy**: Action on detection
    - `"redact"`: Replace matched text with `[REDACTED]`
    - `"mask"`: Partially hide (e.g., `a***@example.com`)
    - `"block"`: Stop execution and raise an error
  - **pattern** (optional): Custom regex pattern for non-built-in PII types

### Example

```json
{
  "models": [
    {
      "id": "secureModel",
      "type": "LlamaCpp",
      "config": {
        "model": "qwen3.6:35b-a3b",
        "baseUrl": "http://localhost:11434",
        "temperature": 0.0,
        "piiFilter": {
          "enabled": true,
          "rules": [
            { "type": "email",       "strategy": "redact" },
            { "type": "ip",          "strategy": "mask"   },
            { "type": "credit_card", "strategy": "block"  },
            {
              "type": "employee_id",
              "strategy": "redact",
              "pattern": "EMP-\\\\d{6}"
            },
            { "type": "phone_number","strategy": "redact" }
          ]
        }
      }
    }
  ]
}
```

---

## 6. MCP Servers Section

Configuration for Model Context Protocol (MCP) servers providing external tools.

### Schema

```typescript
{
  "mcpServers": {
    "<serverName>": {
      "command": string,
      "args": string[]
    }
  }
}
```

### Fields

- **serverName**: Identifier for the MCP server
  - **command**: Executable command (e.g., `"npx"`, `"node"`)
  - **args**: Command arguments array

### Example

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
    }
  }
}
```

---

## 7. Nodes Section

Defines executable workflow nodes (states in the graph).

### Schema

```typescript
{
  "nodes": [
    {
      "id": string,
      "type": "ToolNode" | undefined,
      "handler": {
        "parameters": [
          {
            "name": string,
            "parameterType": "state" | "model",
            "stateType": string,      // for parameterType: "state"
            "modelRef": string         // for parameterType: "model"
          }
        ],
        "output": { },             // State update keys (for function nodes)
        "function": string,        // Optional: inline JS function body (legacy)
        "functionFile": string     // Optional: relative path to external .js file
      },
      "structuredOutput": {        // Optional structured output schema
        "schema": { },              // JSON Schema object
        "strict": boolean,          // Optional, LangGraph 1.4.0+: strict schema mode (GPT models)
        "fallbackToText": boolean   // Optional, LangGraph 1.4.0+: fall back to text on validation failure (GPT models)
      },
      "useA2AServers": boolean,
      "useMcpServers": boolean,
      "useSystemSkills": boolean,
      "excludeTools": string[],
      "injectSkillsPrompt": boolean,
      "retryPolicy": {             // Optional, LangGraph 1.1.0+: retry on transient node errors
        "maxAttempts": number,     // default: 3
        "backoffFactor": number,   // default: 2
        "initialInterval": number, // ms, default: 500
        "maxInterval": number      // ms, default: 128000
      },
      "timeout": number,           // Optional, LangGraph 1.4.0+: ms, or a TimeoutPolicyConfig object below
      "cachePolicy": { "ttl": number },  // Optional, LangGraph 1.4.0+: seconds; undefined = never expires
      "tags": string[]             // Optional, LangGraph 1.4.0+: custom LangSmith tags for this node's runs
    }
  ]
}
```

`timeout` may also be a `TimeoutPolicyConfig` object instead of a plain number: `{ "runTimeout": number, "idleTimeout": number, "refreshOn": "auto" | "heartbeat" }`.

Node-level `retryPolicy` / `timeout` / `cachePolicy` override the workflow-wide defaults set via `Graph.setNodeDefaults()` (see [docs/API.md](API.md)).

### Node Types

#### Function Node

Standard node executing custom JavaScript logic.

**Fields:**
- **id**: Unique node identifier
- **handler**: Node execution configuration
  - **parameters**: Array of parameter definitions
    - **name**: Parameter variable name
    - **parameterType**: `"state"` or `"model"`
    - **stateType**: State annotation type (for state params)
    - **modelRef**: Model ID reference (for model params)
  - **function**: JavaScript function body as string (inline, legacy)
  - **functionFile** (optional): Relative path to an external `.js` file containing the function body. Mutually exclusive with `function` — specifying both raises an error. When omitted, `function` must be present.
  - **output** (optional): Object mapping state field names to update targets. For function nodes returning state updates.
- **structuredOutput** (optional): JSON Schema for structured model output
  - **schema**: JSON Schema object — when set, the model is invoked via `withStructuredOutput` and returns a parsed object matching the schema
  - **strict** (optional, LangGraph 1.4.0+): Enables strict schema mode (GPT models)
  - **fallbackToText** (optional, LangGraph 1.4.0+): Falls back to plain text instead of throwing when schema validation fails (GPT models)
- **injectSkillsPrompt** (optional): Set to `false` to skip Skills prompt injection for this node (default: `true`)
- **retryPolicy** (optional, LangGraph 1.1.0+): `{ maxAttempts?, backoffFactor?, initialInterval?, maxInterval? }` — retries the node on transient errors
- **timeout** (optional, LangGraph 1.4.0+): Milliseconds, or `{ runTimeout?, idleTimeout?, refreshOn? }` for fine-grained control
- **cachePolicy** (optional, LangGraph 1.4.0+): `{ ttl? }` in seconds — caches node results; `undefined` never expires
- **tags** (optional, LangGraph 1.4.0+): `string[]` of custom LangSmith tags attached to this node's runs

#### Tool Node

Special node for handling tool calls (A2A/MCP/Skills).

**Fields:**
- **id**: Unique node identifier
- **type**: Must be `"ToolNode"`
- **useA2AServers**: Enable A2A server tools
- **useMcpServers**: Enable MCP server tools
- **useSystemSkills**: Enable skills tools
- **excludeTools** (optional): Array of tool names to exclude from this node

### Special Functions

- **interrupt(message)**: Pauses workflow execution and prompts user input
- **Overwrite(value)** (LangGraph 1.4.0+): Wraps a value passed to a reducer to force an explicit overwrite of the state channel, bypassing the reducer's normal merge logic. Re-exported from `scenegraphmanager` (passthrough of `@langchain/langgraph`'s `Overwrite`); available to inline `function` / `functionFile` node bodies via the injected `globalScope`.

### Examples

#### Function Node

```json
{
  "id": "askName",
  "handler": {
    "parameters": [
      {
        "name": "state",
        "parameterType": "state",
        "stateType": "typeof TestWorkflowState.State"
      }
    ],
    "function": "const userInput = interrupt('What is your name?');\nconst userName = String(userInput).trim();\nreturn { messages: [`Hello ${userName}!`], userName: userName };"
  }
}
```

#### Function Node with Model

```json
{
  "id": "generateAdvice",
  "handler": {
    "parameters": [
      {
        "name": "state",
        "parameterType": "state",
        "stateType": "typeof AgentState.State"
      },
      {
        "name": "model",
        "parameterType": "model",
        "modelRef": "adviceModel"
      }
    ],
    "function": "const response = await model.invoke([{ role: 'user', content: `Advice for ${state.userJob}` }]);\nreturn { advice: response.content };"
  }
}
```

#### Function Node with Structured Output

Uses `structuredOutput` to enforce a JSON Schema on the model response.

```json
{
  "id": "analyze",
  "handler": {
    "parameters": [
      {
        "name": "state",
        "parameterType": "state",
        "stateType": "typeof StructuredOutputState.State"
      },
      {
        "name": "model",
        "parameterType": "model",
        "modelRef": "analyzer"
      }
    ],
    "function": "const inputText = state.messages?.[0] || 'The weather is nice today.';\nconst response = await model.invoke([{ role: 'user', content: 'Analyze this text: ' + inputText }]);\nreturn { analysis: response };"
  },
  "structuredOutput": {
    "schema": {
      "type": "object",
      "properties": {
        "summary": { "type": "string" },
        "sentiment": { "type": "string", "enum": ["positive", "neutral", "negative"] },
        "keyPoints": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["summary", "sentiment", "keyPoints"]
    }
  }
}
```

#### Function Node with External File

Large or reusable function logic can be extracted to a separate `.js` file using `functionFile`. This keeps the JSON file clean and enables code reuse across workflows.

**`json/functions/askName.js`:**

```javascript
const userInput = interrupt('What is your name?');

if (!userInput) {
  return {
    messages: ['Name was not entered'],
    userName: ''
  };
}

const userName = String(userInput).trim();
const result = {
  messages: [`Hello ${userName}!`],
  userName: userName
};

return result;
```

**JSON:**

```json
{
  "id": "askName",
  "handler": {
    "parameters": [
      {
        "name": "state",
        "parameterType": "state",
        "stateType": "typeof TestWorkflowState.State"
      }
    ],
    "functionFile": "json/functions/askName.js"
  }
}
```

**Rules:**

- `functionFile` and `function` are mutually exclusive — specifying both raises `WorkflowError`.
- The path is resolved relative to the project root (the directory containing `node_modules`).
- The external file must export valid JavaScript function body code (same as inline `function`).

#### Tool Node

```json
{
  "id": "tools",
  "type": "ToolNode",
  "useA2AServers": true,
  "useSystemSkills": true
}
```

---

## 8. Edges Section

Defines workflow transitions between nodes.

### Schema

```typescript
{
  "edges": [
    {
      "from": string,
      "to": string,
      "type": "normal" | "conditional",
      "condition": {
        "name": string,
        "handler": {
          "parameters": [ ],
          "function": string,        // Optional: inline JS function body (legacy)
          "functionFile": string     // Optional: relative path to external .js file
        },
        "possibleTargets": string[]   // optional
      }
    }
  ]
}
```

### Edge Types

#### Normal Edge

Direct transition from one node to another.

**Fields:**
- **from**: Source node ID (or `"__start__"` for entry)
- **to**: Target node ID (or `"__end__"` for exit)

#### Conditional Edge

Dynamic routing based on runtime logic.

**Fields:**
- **from**: Source node ID
- **type**: Must be `"conditional"`
- **condition**: Condition configuration
  - **name**: Condition identifier
  - **handler**: Evaluation logic
    - **parameters**: Parameter definitions (same as node parameters)
    - **function**: JavaScript function body (inline, legacy)
    - **functionFile** (optional): Relative path to an external `.js` file. Mutually exclusive with `function`.
  - **possibleTargets** (optional): Array of possible target node IDs for validation

### Examples

#### Normal Edge

```json
{
  "from": "__start__",
  "to": "askName"
}
```

#### Conditional Edge

```json
{
  "from": "orchestrator",
  "type": "conditional",
  "condition": {
    "name": "routeBasedOnPhase",
    "handler": {
      "parameters": [
        {
          "name": "state",
          "parameterType": "state",
          "stateType": "typeof AgentState.State"
        }
      ],
      "function": "if (state.currentPhase === 'research') return 'researchNode';\nreturn 'evaluationNode';"
    },
    "possibleTargets": ["researchNode", "evaluationNode"]
  }
}
```

---

## 9. Context Compression

Automatic context window compression to prevent token limit errors during long conversations. Configured at the workflow level in `config.contextCompression`.

### Schema

```typescript
{
  "config": {
    "contextCompression": {
      "enabled": boolean,
      "mode": "autonomous" | "threshold",
      "trigger": { "messages": number, "tokens": number } | { "messages": number, "tokens": number }[],
      "keep": { "messages": number },
      "modelRef": string,
      "summaryPrompt": string,
      "summaryPrefix": string
    }
  }
}
```

### Fields

- **enabled**: Enable automatic context compression (default: false)
- **mode**: Compression strategy
  - `"threshold"`: WorkflowEngine automatically compresses when triggers fire
  - `"autonomous"`: Model self-calls a `compress_context` tool to trigger compression
- **trigger**: Activation condition(s) — OR semantics when array (fires when ANY condition is met)
  - **messages**: Trigger when message count exceeds this number
  - **tokens**: Trigger when approximate token count exceeds this number
  - **fraction** (optional): Ratio (0.0–1.0) of model context window
- **keep**: What to retain after compression
  - **messages**: Number of recent messages to keep
  - **fraction** (optional): Ratio (0.0–1.0) of messages to keep
- **modelRef** (optional): Model ID reference into `models[]` for summary generation. If omitted, uses the primary model.
- **summaryPrompt** (optional): Prompt template for generating the summary. The string `{messages}` is replaced with the messages to compress.
- **summaryPrefix** (optional): Prefix prepended to the generated summary (default: `"Previous conversation summary:\n\n"`)

### Examples

#### Threshold Mode (Engine-driven)

```json
{
  "config": {
    "contextCompression": {
      "enabled": true,
      "mode": "threshold",
      "trigger": { "messages": 8, "tokens": 32768 },
      "keep": { "messages": 4 }
    }
  },
  "models": [
    {
      "id": "compressor",
      "type": "LlamaCpp",
      "config": {
        "model": "unsloth/Qwen3.6-35B-A3B",
        "temperature": 0.2,
        "serverUrl": "http://localhost:8001"
      }
    }
  ]
}
```

#### Autonomous Mode (Model-driven)

```json
{
  "config": {
    "contextCompression": {
      "enabled": true,
      "mode": "autonomous",
      "trigger": { "tokens": 65536 }
    }
  }
}
```

In autonomous mode, the model receives a `compress_context` tool. When the model calls it, the engine compresses the conversation and injects the summary back.

---

## 10. LangSmith Metadata Tags

Configure LangSmith tags and metadata for workflow invoke/stream operations. Set at the workflow level in `config.langsmith`.

### Schema

```typescript
{
  "config": {
    "langsmith": {
      "tags": string[],
      "metadata": Record<string, any>
    }
  }
}
```

### Fields

- **tags** (optional): LangSmith tags applied to every invoke/stream call. When omitted, defaults to `["sgm-workflow", workflowId]`.
- **metadata** (optional): Additional metadata key-value pairs. `workflowId` and `threadId` are **always** injected automatically — they cannot be removed via JSON configuration.

### Default behavior (no JSON config)

When `langsmith` is not configured, SGM applies:

| Field | Value |
|---|---|
| `tags` | `["sgm-workflow", <workflow config name>]` |
| `metadata` | `{ workflowId, threadId }` |

### Merge behavior

| Configured | Result `tags` | Result `metadata` |
|---|---|---|
| none | `["sgm-workflow", workflowId]` | `{ workflowId, threadId }` |
| `tags` only | configured value | `{ workflowId, threadId }` |
| `metadata` only | `["sgm-workflow", workflowId]` | `{ workflowId, threadId, ...user }` |
| both | configured value | `{ workflowId, threadId, ...user }` |

`configurable.metadata` (passed at invoke/stream time) is merged **on top of** `config.langsmith.metadata` — runtime values win.

### Examples

#### Default (no langsmith config)

```json
{
  "config": {
    "name": "my-workflow"
  }
}
```

Result: `tags = ["sgm-workflow", "my-workflow"]`, `metadata = { workflowId: "my-workflow", threadId: <from configurable> }`

#### Custom tags

```json
{
  "config": {
    "langsmith": {
      "tags": ["my-app", "production"]
    }
  }
}
```

Result: `tags = ["my-app", "production"]`, `metadata = { workflowId, threadId }`

#### Custom metadata

```json
{
  "config": {
    "langsmith": {
      "metadata": {
        "environment": "production",
        "version": "2.6.0"
      }
    }
  }
}
```

Result: `tags = ["sgm-workflow", workflowId]`, `metadata = { workflowId, threadId, environment: "production", version: "2.6.0" }`

#### Full customization

```json
{
  "config": {
    "langsmith": {
      "tags": ["sgm-demo", "qwen"],
      "metadata": {
        "environment": "development",
        "model": "unsloth/Qwen3.6-35B-A3B"
      }
    }
  }
}
```

### Node-level tags

Individual nodes can also have `tags` (defined in `nodes[]` entries). These are stored in node metadata under the key `sgmTags` and are separate from the workflow-level `config.langsmith.tags`.

---

## 11. Hooks Event System

The Hooks Event System allows external observers to monitor and control workflow execution in real time. Handlers are registered via `WorkflowEngine.addEventListener(handler)` at runtime — they are **not** declared in the JSON file.

### Registration

```typescript
engine.addEventListener((event: WorkflowEvent) => {
  // Handle event
});
```

Multiple handlers can be registered. All handlers are called concurrently via `Promise.all` — a rejection in one handler does not affect others.

### Type Definitions

```typescript
// src/types/index.ts

interface WorkflowEvent {
  type: 'nodeStart' | 'nodeComplete' | 'error' | 'complete'
     | 'preToolUse' | 'postToolUse' | 'postToolUseFailure'
     | 'sessionStart' | 'userPromptSubmit' | 'tokenUsage';
  nodeId?: string;
  modelId?: string;
  data?: any;
  timestamp: number;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolResult?: string | object;
  toolError?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

interface HookFeedback {
  block?: boolean;
  blockReason?: string;
  updatedInput?: Record<string, any>;    // Reserved for future use
  additionalContext?: string;             // Reserved for future use
}

type WorkflowEventHandler = (
  event: WorkflowEvent
) => void | Promise<void> | HookFeedback | Promise<HookFeedback | void>;
```

### Event Catalog

| Event | Can Block? | Fired When | Key Fields |
|-------|-----------|------------|------------|
| `sessionStart` | Yes | At end of `build()`, after graph compilation | `data.nodeCount` (number) |
| `userPromptSubmit` | Yes | At start of `invoke()`/`stream()`, before execution | `data.input` (WorkflowState) |
| `nodeStart` | No | Before each node function executes | `nodeId` (string) |
| `nodeComplete` | No | After each node returns successfully | `nodeId` (string) |
| `preToolUse` | Yes | Before each tool call inside a ToolNode | `nodeId`, `toolName`, `toolInput` |
| `postToolUse` | No | After a tool call succeeds | `nodeId`, `toolName`, `toolInput`, `toolResult`, `durationMs` |
| `postToolUseFailure` | No | When a ToolNode throws an exception | `nodeId`, `toolName`, `toolError`, `durationMs` |
| `complete` | No | At end of `build()` and after each `invoke()`/`stream()` | `data` (formatted result, invoke only) |
| `error` | No | On build/invoke/stream failure (except GraphInterrupt) | `data` (error object) |
| `tokenUsage` | No | After each model invocation with `usage_metadata` | `nodeId`, `modelId`, `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCostUsd` |

### Blocking Behavior

Three events support blocking via `HookFeedback`:

| Event | Block Effect |
|-------|-------------|
| `userPromptSubmit` | `invoke()`/`stream()` throws `WorkflowError("Input blocked by hook: <reason>")` |
| `preToolUse` | All remaining tool calls in that ToolNode return `ToolMessage` with `"Tool blocked by hook: <reason>"` |
| `sessionStart` | Registered as blockable but not currently checked in `build()` (reserved for future) |

When `emitHookEvent` is called, it returns the first `HookFeedback` with `block: true` (in registration order). All handlers run concurrently; the blocking decision is based on whichever handler responds first.

### Event Flow

```
build()
  ├─ emitHookEvent(sessionStart)          ← graph compiled, before first invoke
  ├─ emitEvent(complete)                  ← build succeeded
  └─ emitEvent(error)                     ← build failed

invoke() / stream()
  ├─ emitHookEvent(userPromptSubmit)      ← can block input
  ├─ emitEvent(nodeStart)                 ← for each node
  │   ├─ emitEvent(preToolUse)            ← for each tool call (ToolNode only)
  │   │   └─ emitEvent(postToolUse)       ← on success
  │   │   └─ emitEvent(postToolUseFailure) ← on failure
  ├─ emitEvent(nodeComplete)              ← node succeeded
  ├─ emitEvent(tokenUsage)                ← after model invocation (if enabled)
  ├─ emitEvent(complete)                  ← workflow finished
  └─ emitEvent(error)                     ← on failure (except GraphInterrupt)
```

**Note**: `nodeComplete` does NOT fire if a node throws an error. `GraphInterrupt` errors are re-thrown without emitting an error event.

### Example: Token Usage Logger

```typescript
const engine = await WorkflowEngine.fromFile('workflow.json').build();

engine.addEventListener((event: WorkflowEvent) => {
  if (event.type === 'tokenUsage') {
    console.log(
      `[${event.nodeId}] ${event.modelId}: ` +
      `${event.inputTokens}in + ${event.outputTokens}out = ${event.totalTokens} tokens ` +
      `($${event.estimatedCostUsd?.toFixed(6) ?? 'N/A'})`
    );
  }
  if (event.type === 'error') {
    console.error(`[workflow] Error:`, event.data);
  }
});

await engine.invoke({ messages: [] });
```

---

## 12. Dispatch Configuration

The Dispatch system enables asynchronous, long-running workflow execution via a REST server. It decouples message submission from execution using a task queue with SQLite persistence and webhook notifications.

### Architecture

```
Client → Dispatch Server → AsyncTaskQueue → WorkflowEngine
                ↓                              ↓
        DispatchTaskStore              WebhookNotifier
        (SQLite, WAL mode)             (POST with retry)
```

### Components

#### DispatchTaskStore (SQLite)

Persistent task storage using `better-sqlite3` with WAL journal mode.

```typescript
// src/lib/dispatch/DispatchTaskStore.ts

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface DispatchTask {
  taskId: string;
  threadId: string;
  status: TaskStatus;
  input: string;
  result: string | null;
  webhookUrl: string | null;
  error: string | null;
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
  completedAt: string | null;
}
```

**Constructor**: `new DispatchTaskStore(dbPath?: string)` — default: `'./dispatch-tasks.db'`

**Key methods:**

| Method | Description |
|--------|------------|
| `createTask(task)` | Insert a new task. Auto-sets `updatedAt`. |
| `updateTask(taskId, update)` | Partial update of status/result/error. Auto-sets `updatedAt`. |
| `getTask(taskId)` | Lookup by ID. Returns `undefined` if not found. |
| `listTasks(options?)` | Paginated list. Default: `limit=50, offset=0`. Ordered by `createdAt DESC`. |
| `getInterruptedTasks()` | Returns `pending` or `running` tasks (for server restart recovery). |
| `purgeOldTasks(days?)` | Deletes completed/failed/cancelled tasks older than N days. Default: **7 days**. Returns deleted count. |
| `close()` | Close SQLite connection. |

**SQLite schema:**

```sql
CREATE TABLE tasks (
  taskId      TEXT PRIMARY KEY,
  threadId    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  input       TEXT NOT NULL,
  result      TEXT,
  webhookUrl  TEXT,
  error       TEXT,
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL,
  completedAt TEXT
);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_createdAt ON tasks(createdAt);
```

#### AsyncTaskQueue (Concurrency Control)

Bounded concurrency pool for task execution.

```typescript
// src/lib/dispatch/AsyncTaskQueue.ts

interface QueuedTask {
  taskId: string;
  message: any;
  threadId: string;
  webhookUrl?: string;
}
```

**Constructor**: `new AsyncTaskQueue({ maxConcurrent?, store, executeTask })`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxConcurrent` | number | **3** | Max concurrent task executions |
| `store` | DispatchTaskStore | required | SQLite task store |
| `executeTask` | function | required | `(message, taskId, threadId) => Promise<any>` |

**Methods:**

| Method | Description |
|--------|------------|
| `enqueue(task)` | Push task to queue, triggers drain |

Tasks are pulled from the queue as slots free up. On completion/failure, the slot is released and draining continues.

#### WebhookNotifier (Retry Logic)

POSTs completion notifications to webhook URLs.

| Setting | Value |
|---------|-------|
| Max retries | **3** |
| Base delay | **1,000 ms** |
| Backoff | Exponential: 1s, 2s |
| Timeout per attempt | **10 seconds** (AbortSignal) |
| Payload trimming | Last 1 message element per attempt |

### Dispatch Server

**CLI**: `scripts/dispatch-server.ts`

```bash
npx tsx scripts/dispatch-server.ts \
  --config ./json/workflow.json \
  --port 3011 \
  --db ./data/dispatch-tasks.db \
  --concurrency 3 \
  --name "MyAgent"
```

| Flag | Type | Required | Default |
|------|------|----------|---------|
| `--config` | string | **Yes** | — |
| `--port` | number | **Yes** | — |
| `--db` | string | No | `./data/dispatch-tasks.db` |
| `--concurrency` | number | No | 3 |
| `--name` | string | No | Uses `workflowConfig.name` |

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/.well-known/agent.json` | A2A agent card (merged from `workflowConfig.config.a2aEndpoint.agentCard`) |
| `POST` | `/` | JSON-RPC 2.0 endpoint (`message/send`, `agent/getAuthenticatedExtendedCard`) |
| `POST` | `/message/send` | REST endpoint — `{ message, thread_id?, webhookUrl? }` |
| `GET` | `/health` | Health check — `{ status, port, agentName, uptime }` |
| `GET` | `/tasks` | List tasks — query: `limit`, `offset`, `status` |
| `GET` | `/tasks/:taskId` | Get single task |
| `POST` | `/tasks/:taskId/cancel` | Cancel task |
| `POST` | `/slack-webhook/:channel/:ts` | Incoming webhook from Slack bot |
| `POST` | `/telegram-webhook/:chatId/:messageId` | Incoming webhook from Telegram bot |

**REST `/message/send` behavior:**
- With `webhookUrl`: Returns `{ taskId, thread_id, status: 'accepted' }` immediately, processes asynchronously.
- Without `webhookUrl`: Executes synchronously, returns `{ taskId, result, thread_id }`.

### Channel Bots

#### Slack Dispatch Bot

**CLI**: `scripts/slack-dispatch-bot.ts`

**Environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | Yes | `xoxb-...` bot token |
| `SLACK_SIGNING_SECRET` | Yes | Signing secret |
| `SLACK_APP_TOKEN` | Yes | `xapp-...` app token (Socket Mode) |
| `DISPATCH_SERVER_URL` | No | Default: `http://localhost:3011` |

**Configuration:**
- Uses **Socket Mode** (not HTTP receiving)
- **Exit keywords**: `['終了', 'exit', 'quit', 'やめる', 'done']` (case-insensitive)
- Thread ID format: `slack-{channel}-{rootTimestamp}`
- Task ID format: `slack-{Date.now()}`

#### Telegram Dispatch Bot

**CLI**: `scripts/telegram-dispatch-bot.ts`

**Environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot API token |
| `DISPATCH_SERVER_URL` | No | Default: `http://localhost:3011` |

**Configuration:**
- Uses **long polling** (`timeout=30`)
- Retry interval on poll error: **5 seconds**
- Thread ID format: `tg-{chatId}-{messageId}`
- Task ID format: `tg-{Date.now()}`

### JSON Workflow Integration

The workflow JSON itself does not declare dispatch settings. The dispatch server reads the JSON to build the `WorkflowEngine`, then wraps it with `AsyncTaskQueue`. Relevant JSON fields:

| JSON Path | Dispatch Usage |
|-----------|---------------|
| `config.info` | Populates A2A agent card name/description |
| `config.recursionLimit` | Overridden to `100` by dispatch server |
| `config.a2aEndpoint.agentCard` | Merged into `/.well-known/agent.json` |
| `models[N].skills` | Per-model skills configuration (used for agent card) |

**Example** (`json/slack-chat-qwen.json`):

```json
{
  "config": {
    "info": {
      "version": "1.0.0",
      "description": "Simple chat workflow with Qwen via LlamaCpp - for Slack Dispatch",
      "author": "Akira Kudo"
    },
    "recursionLimit": 25
  },
  "stateAnnotation": {
    "name": "ChatState",
    "type": "Annotation.Root"
  },
  "annotation": {
    "messages": {
      "type": "BaseMessage[]",
      "reducer": "(x, y) => x.concat(y)",
      "default": []
    }
  },
  "models": [
    {
      "id": "qwen",
      "type": "LlamaCpp",
      "config": {
        "model": "unsloth/Qwen3.6-35B-A3B",
        "temperature": 0.7,
        "serverUrl": "http://localhost:8001"
      },
      "systemPrompt": "あなたは親切なアシスタントです。ユーザーの質問に日本語で答えてください。"
    }
  ],
  "nodes": [
    {
      "id": "chat_node",
      "handler": {
        "parameters": [
          { "name": "state", "parameterType": "state", "stateType": "typeof ChatState.State" },
          { "name": "model", "parameterType": "model", "modelRef": "qwen" }
        ],
        "function": "const response = await model.invoke(state.messages);\nreturn { messages: [response] };"
      }
    }
  ],
  "edges": [
    { "from": "__start__", "to": "chat_node" },
    { "from": "chat_node", "to": "__end__" }
  ],
  "stateGraph": {
    "annotationRef": "ChatState",
    "config": {
      "checkpointer": { "type": "MemorySaver" }
    }
  }
}
```

---

## 13. State Graph Section

Configures the LangGraph StateGraph instance.

### Schema

```typescript
{
  "stateGraph": {
    "annotationRef": string,
    "config": {
      "checkpointer": {
        "type": "MemorySaver" | "SqliteSaver"
      },
      "store": {
        "type": "InMemoryStore"
      }
    }
  }
}
```

### Fields

- **annotationRef**: Reference to `stateAnnotation.name`
- **config**: Graph configuration
  - **checkpointer**: State persistence backend
    - **type**: `"MemorySaver"` (in-memory) or `"SqliteSaver"` (persistent)
  - **store**: Key-value store configuration
    - **type**: `"InMemoryStore"`

### Example

```json
{
  "stateGraph": {
    "annotationRef": "TestWorkflowState",
    "config": {
      "checkpointer": {
        "type": "MemorySaver"
      }
    }
  }
}
```

---

## 14. Complete Examples

### Simple Interactive Workflow

```json
{
  "config": {
    "info": {
      "version": "1.0.0",
      "description": "Name and job collector",
      "copyright": "Copyright 2026",
      "author": "Akira Kudo"
    },
    "recursionLimit": 25,
    "eventEmitter": {
      "defaultMaxListeners": 10
    }
  },
  "stateAnnotation": {
    "name": "InterruptWorkflowState",
    "type": "Annotation.Root"
  },
  "annotation": {
    "messages": {
      "type": "string[]",
      "reducer": "(x, y) => x.concat(y)",
      "default": []
    },
    "userName": {
      "type": "string",
      "reducer": "(x, y) => y || x",
      "default": ""
    }
  },
  "models": [],
  "nodes": [
    {
      "id": "askName",
      "handler": {
        "parameters": [
          {
            "name": "state",
            "parameterType": "state",
            "stateType": "typeof InterruptWorkflowState.State"
          }
        ],
        "function": "const userInput = interrupt('What is your name?');\nreturn { messages: [`Hello ${userInput}!`], userName: String(userInput) };"
      }
    }
  ],
  "edges": [
    {
      "from": "__start__",
      "to": "askName"
    },
    {
      "from": "askName",
      "to": "__end__"
    }
  ],
  "stateGraph": {
    "annotationRef": "InterruptWorkflowState",
    "config": {
      "checkpointer": {
        "type": "MemorySaver"
      }
    }
  }
}
```

### Model Integration Workflow

```json
{
  "config": {
    "info": {
      "version": "1.0.0",
      "description": "Career counselor with AI advice",
      "copyright": "Copyright 2026",
      "author": "Akira Kudo"
    },
    "recursionLimit": 25,
    "eventEmitter": {
      "defaultMaxListeners": 10
    }
  },
  "stateAnnotation": {
    "name": "CounselorState",
    "type": "Annotation.Root"
  },
  "annotation": {
    "messages": {
      "type": "string[]",
      "reducer": "(x, y) => x.concat(y)",
      "default": []
    },
    "userJob": {
      "type": "string",
      "reducer": "(x, y) => y || x",
      "default": ""
    },
    "advice": {
      "type": "string",
      "reducer": "(x, y) => y || x",
      "default": ""
    }
  },
  "models": [
    {
      "id": "adviceModel",
      "type": "OpenAI",
      "config": {
        "model": "gpt-4o-mini",
        "temperature": 0.7
      },
      "systemPrompt": "You are a career counselor."
    }
  ],
  "nodes": [
    {
      "id": "askJob",
      "handler": {
        "parameters": [
          {
            "name": "state",
            "parameterType": "state",
            "stateType": "typeof CounselorState.State"
          }
        ],
        "function": "const userJob = interrupt('What is your occupation?');\nreturn { messages: ['Generating advice...'], userJob: String(userJob) };"
      }
    },
    {
      "id": "generateAdvice",
      "handler": {
        "parameters": [
          {
            "name": "state",
            "parameterType": "state",
            "stateType": "typeof CounselorState.State"
          },
          {
            "name": "model",
            "parameterType": "model",
            "modelRef": "adviceModel"
          }
        ],
        "function": "const response = await model.invoke([{ role: 'user', content: `Advice for ${state.userJob}` }]);\nreturn { advice: response.content, messages: ['Advice generated'] };"
      }
    }
  ],
  "edges": [
    {
      "from": "__start__",
      "to": "askJob"
    },
    {
      "from": "askJob",
      "to": "generateAdvice"
    },
    {
      "from": "generateAdvice",
      "to": "__end__"
    }
  ],
  "stateGraph": {
    "annotationRef": "CounselorState",
    "config": {
      "checkpointer": {
        "type": "MemorySaver"
      }
    }
  }
}
```

---

## 15. Advanced Features

### Agent-to-Agent (A2A) Communication

Open Agent JSON supports multi-agent orchestration where agents communicate via A2A protocol.

**Client Workflow:**
- Uses `"bindA2AServers": true` in model config
- Accesses remote agent tools via model invocation
- Tool node with `"useA2AServers": true` handles responses

**Server Workflow:**
- Exposed as A2A endpoint
- Receives messages from client workflows
- Returns structured responses

See [kudosflow](https://github.com/akudo7/kudosflow) and [a2a-server](https://github.com/akudo7/a2a-server) for examples.

### Skills Integration

Open Agent JSON supports skills that provide file system operations through a virtual or real filesystem backend. Skills come in two types: **System Skills** (built-in) and **Custom Skills** (user-defined).

**Configuration:**

- Enable skills per-model in `models[N].skills` with `enabled: true`
- Set `skillsPath` to the directory containing skill definitions
- Configure `backend.virtualMode` for virtual filesystem simulation
- Set `backend.rootDir` for the root directory of filesystem operations
- Set `excludeDirs` to exclude directories from `grep_search` (defaults: `["node_modules", ".git", "dist"]`)
- Set `useRtk` to enable RTK proxy for bash commands (60–90% token reduction)
- Custom skill directories can be symlinks — the engine resolves them at discovery time

**Model Integration:**

- Use `"bindSystemSkills": true` in model config to bind skills as tools
- Skills are automatically available to the model as callable tools

**Tool Node Integration:**

- Use `"useSystemSkills": true` in ToolNode to handle skill tool calls
- Skills execute filesystem operations and return results to the workflow

#### System Skills (Built-in)

SceneGraphManager provides the following 9 core built-in skills:

| Skill Name | Description | Key Features |
| ------------ | ------------- | ---------- |
| `read_file` | Read file contents from the filesystem | Supports offset/limit for large files, line-by-line reading |
| `write_file` | Write content to a file | Overwrite protection, creates parent directories |
| `edit_file` | String replacement in files | Uniqueness validation, replace_all option |
| `glob_files` | Pattern-based file search | Supports glob patterns (e.g., `**/*.ts`), recursive search |
| `grep_search` | Content search with regex support | Regex patterns, context lines (-A/-B/-C), file filtering. Respects `skills.excludeDirs` |
| `bash_command` | Shell command execution | Safety checks, timeout support, environment variables. Respects `skills.useRtk` |
| `web_fetch` | HTTP content fetching | GET/POST requests, header support, JSON/text responses |
| `write_todos` | Write TODO items to the store | Create/update task items with priority and status |
| `read_todos` | Read TODO items from the store | Query tasks by status and priority |

**Tool Details:**

1. **read_file**
   - Read file contents with optional offset and limit
   - Supports reading specific line ranges for large files
   - Returns content with line numbers for easy navigation
   - Example: `read_file({ file_path: "config.json", offset: 0, limit: 100 })`

2. **write_file**
   - Write or overwrite file contents
   - Automatically creates parent directories if needed
   - Includes overwrite protection for existing files
   - Example: `write_file({ file_path: "output.txt", content: "data" })`

3. **edit_file**
   - Perform exact string replacement in files
   - Validates uniqueness to prevent unintended replacements
   - Supports `replace_all` option for multiple occurrences
   - Example: `edit_file({ file_path: "app.ts", old_string: "old", new_string: "new" })`

4. **glob_files**
   - Search for files using glob patterns
   - Supports recursive patterns like `**/*.ts` or `src/**/*.json`
   - Returns sorted list of matching file paths
   - Example: `glob_files({ pattern: "**/*.md", path: "." })`

5. **grep_search**
   - Search file contents using regex patterns
   - Supports context lines (-A, -B, -C) and case-insensitive search
   - Filter by file type or glob pattern
   - Example: `grep_search({ pattern: "function.*test", glob: "**/*.ts" })`

6. **bash_command**
   - Execute shell commands with safety checks
   - Supports timeout configuration and environment variables
   - Captures stdout and stderr output
   - Example: `bash_command({ command: "npm test", timeout: 30000 })`

7. **web_fetch**
   - Fetch content from HTTP/HTTPS URLs
   - Supports custom headers and POST data
   - Returns JSON or text responses
   - Example: `web_fetch({ url: "https://api.example.com/data", method: "GET" })`

8. **write_todos**
   - Write TODO items to the InMemoryStore
   - Accepts an array of TodoItem objects with `content`, `status`, `priority` fields
   - Requires `store` and optionally `threadId` in `ClaudeCodeToolsConfig`
   - Example: `write_todos([{ content: "Fix bug", status: "pending", priority: "high" }])`

9. **read_todos**
   - Read TODO items from the InMemoryStore
   - Returns filtered TodoItem array by status and/or priority
   - Requires `store` and optionally `threadId` in `ClaudeCodeToolsConfig`
   - Example: `read_todos({ status: "pending", priority: "high" })`

#### Custom Skills

Custom skills extend functionality beyond filesystem operations. They are defined in the `skillsPath` directory with the following structure:

**Directory Structure:**

```text
skills/
├── skill-name/
│   ├── SKILL.md          # Skill metadata and instructions
│   └── implementation.ts # Skill implementation (optional)
```

**SKILL.md Format:**

```markdown
---
name: skill-name
description: Brief description of what the skill does
---

# Skill Title

## Overview
Detailed description of the skill's purpose and capabilities.

## Instructions
Step-by-step instructions for the AI agent to use this skill.

## Examples
Usage examples with expected inputs and outputs.
```

**Custom Skill Examples:**

For example implementations, see the [kudosflow](https://github.com/akudo7/kudosflow) repository:

- **arxiv-search**: Search arXiv preprint repository for research papers
- **langgraph-docs**: Fetch and use LangGraph.js documentation

**Example Configuration:**

```json
{
  "config": {
    "store": {
      "type": "InMemoryStore"
    }
  },
  "models": [
    {
      "id": "skillsModel",
      "type": "anthropic",
      "config": { "model": "claude-sonnet-4-5-20250929" },
      "bindSystemSkills": true,
      "skills": {
        "enabled": true,
        "skillsPath": "skills",
        "backend": {
          "virtualMode": true,
          "rootDir": "."
        }
      }
    }
  ]
}
```

**Example Workflow with Skills:**
    {
      "id": "agent",
      "handler": {
        "parameters": [
          {
            "name": "state",
            "parameterType": "state",
            "stateType": "typeof StateAnnotation.State"
          },
          {
            "name": "model",
            "parameterType": "model",
            "modelRef": "skillsModel"
          }
        ],
        "function": "const messages = state.messages;\nconst response = await model.invoke(messages);\nreturn { messages: [response] };"
      }
    },
    {
      "id": "tools",
      "type": "ToolNode",
      "useSystemSkills": true
    }
  ]
}
```

---

## 16. Best Practices

1. **State Design**: Keep state flat and minimal; use reducers to manage updates
2. **Node Granularity**: One node per logical step; avoid monolithic handlers
3. **Error Handling**: Wrap async operations in try-catch blocks
4. **Interrupts**: Use sparingly; prefer state-driven flows
5. **Model Selection**: Match model capability to task complexity
6. **Versioning**: Update `config.info.version` on breaking changes
7. **Structured Output**: Use `structuredOutput` with `LlamaCpp`/`Ollama` models to enforce JSON Schema responses — avoids manual parsing in handler functions
8. **Context Compression**: Enable `contextCompression` for long-running conversations; prefer `"threshold"` mode for reliability, `"autonomous"` for model-driven control
9. **PII Filtering**: Enable `piiFilter` on models handling user data; use `"block"` strategy for sensitive types (credit cards), `"redact"` for identifiers (emails, phone numbers)
10. **excludeDirs**: Set `skills.excludeDirs` to exclude `node_modules`, `.git`, `dist` (hardcoded defaults) and other build artifacts from `grep_search` to improve performance
11. **RTK Proxy**: Set `skills.useRtk: true` to enable RTK proxy for bash commands, reducing token usage by 60–90%

---

## 17. See Also

- [kudosflow Examples](https://github.com/akudo7/kudosflow)
- [a2a-server Implementation](https://github.com/akudo7/a2a-server)
- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)

**Note:** This specification is based on the SceneGraphManager v2.3.1 library (kudos-scene-graph-manager), which is a private component. For licensing and access inquiries, please contact Akira Kudo.
