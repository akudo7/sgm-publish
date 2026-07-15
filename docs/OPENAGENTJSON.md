# OpenAgentJSON

> Visual, production-ready AI workflows — portable as JSON

## Overview

OpenAgentJSON is a declarative JSON format for defining AI agent workflows powered by [LangGraph.js](https://langchain-ai.github.io/langgraphjs/). It enables meta-programming of complex agent systems through configuration rather than code, supporting multi-agent orchestration, model integration, and interactive workflows.

SceneGraphManager v2.x fully compiles OpenAgentJSON files at runtime — workflows designed in the kudosflow2 VSCode extension can be deployed to any execution environment without modification.

---

## Key Features

- **Declarative Workflow Definition** — Define nodes, edges, and state transitions in pure JSON
- **Multi-Model Support** — Seamlessly integrate OpenAI, Anthropic, and Ollama models
- **A2A Protocol** — Enable agent-to-agent communication for complex multi-agent systems
- **MCP Integration** — Connect external tools via Model Context Protocol servers
- **Skills Integration** — System Skills (built-in) and Custom Skills (user-defined)
- **State Management** — Flexible state annotations with custom reducers
- **Interactive Flows** — Built-in support for user interrupts and approval gates

---

## Quick Example

```json
{
  "config": {
    "info": {
      "version": "1.0.0",
      "description": "Simple greeting workflow"
    }
  },
  "stateAnnotation": {
    "name": "GreetingState",
    "type": "Annotation.Root"
  },
  "annotation": {
    "messages": {
      "type": "string[]",
      "reducer": "(x, y) => x.concat(y)",
      "default": []
    }
  },
  "models": [],
  "nodes": [
    {
      "id": "greet",
      "handler": {
        "parameters": [
          {
            "name": "state",
            "parameterType": "state",
            "stateType": "typeof GreetingState.State"
          }
        ],
        "function": "const name = interrupt('What is your name?');\nreturn { messages: [`Hello ${name}!`] };"
      }
    }
  ],
  "edges": [
    { "from": "__start__", "to": "greet" },
    { "from": "greet", "to": "__end__" }
  ],
  "stateGraph": {
    "annotationRef": "GreetingState",
    "config": {
      "checkpointer": { "type": "MemorySaver" }
    }
  }
}
```

---

## File Format Reference

An OpenAgentJSON file consists of eight top-level sections:

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

### 1. Config Section

Global configuration for the workflow execution environment.

#### Schema

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
    "store": {
      "type": "InMemoryStore"
    }
  }
}
```

#### Fields

- **info** — Metadata about the workflow
  - **version** — Semantic version (e.g., `"1.0.0"`)
  - **description** — Human-readable workflow description
  - **copyright** — Copyright notice
  - **author** — Author name
- **recursionLimit** — Maximum depth for recursive workflow execution (default: `25`)
- **eventEmitter** — EventEmitter configuration
  - **defaultMaxListeners** — Max concurrent event listeners (default: `10`)
- **skills** (optional) — Skills integration configuration
  - **enabled** — Enable skills support (default: `false`)
  - **skillsPath** — Path to skills directory (e.g., `"skills"`). Relative paths resolve against `backend.rootDir`; absolute paths are used as-is
  - **backend** — Filesystem backend configuration
    - **virtualMode** — Enable virtual filesystem mode (default: `true`)
    - **rootDir** — Root directory for filesystem operations (default: `"."`)
- **store** (optional) — Key-value store configuration
  - **type** — Store implementation (`"InMemoryStore"`)

#### Example

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
    "store": {
      "type": "InMemoryStore"
    }
  }
}
```

---

### 2. State Annotation Section

Defines the root state annotation name used throughout the workflow.

#### Schema

```typescript
{
  "stateAnnotation": {
    "name": string,
    "type": "Annotation.Root"
  }
}
```

#### Fields

- **name** — Identifier for the state annotation (referenced by nodes)
- **type** — Must be `"Annotation.Root"` (fixed value)

#### Example

```json
{
  "stateAnnotation": {
    "name": "TestWorkflowState",
    "type": "Annotation.Root"
  }
}
```

---

### 3. Annotation Section

Defines state fields with types, reducers, and default values.

#### Schema

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

#### Fields

- **fieldName** — State field identifier
  - **type** — TypeScript type expression (e.g., `"string"`, `"string[]"`, `"BaseMessage[]"`)
  - **reducer** — Function expression for merging state updates (e.g., `"(x, y) => x.concat(y)"`)
  - **default** — Initial value for the field

#### Common Reducer Patterns

| Pattern | Reducer | Use Case |
|---------|---------|----------|
| Concatenate | `(x, y) => x.concat(y)` | Arrays (messages, logs) |
| Replace | `(x, y) => y \|\| x` | Single values (status, counters) |
| Merge | `(x, y) => ({ ...x, ...y })` | Objects |
| Override | `(x, y) => y !== undefined ? y : x` | Nullable values |

#### Example

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

### 4. Models Section

Defines LLM models used by workflow nodes.

#### Schema

```typescript
{
  "models": [
    {
      "id": string,
      "type": "OpenAI" | "Anthropic" | "Ollama",
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
        "backend": {
          "virtualMode": boolean,
          "rootDir": string
        }
      }
    }
  ]
}
```

#### Fields

- **id** — Unique identifier for referencing in nodes
- **type** — Model provider (`"OpenAI"`, `"Anthropic"`, `"Ollama"`)
- **config** — Provider-specific configuration
  - **model** — Model name (e.g., `"gpt-4o-mini"`, `"claude-sonnet-3-5-20241022"`)
  - **temperature** — Sampling temperature (0.0–2.0)
  - Additional provider-specific options
- **systemPrompt** (optional) — Default system message
- **bindA2AServers** (optional) — Enable Agent-to-Agent (A2A) tool binding
- **bindMcpServers** (optional) — Enable MCP server tool binding
- **bindSystemSkills** (optional) — Bind **System Skills** (built-in ClaudeCode-style tools) to this model. Requires `skills.enabled: true` on the same model
- **skills** (optional) — Per-model skills configuration. Governs **Custom Skills** discovery (SKILL.md-based) and is also the shared prerequisite for `bindSystemSkills`'s System Skills tools
  - **enabled** — Enable skills for this model — master switch for both Custom Skills discovery and System Skills tool creation
  - **skillsPath** — Path to the Custom Skills directory. Relative paths resolve against `backend.rootDir`; absolute paths pointing at an existing directory with zero skills cause initialization to throw (misconfiguration guard)
  - **backend** (optional) — FilesystemBackend configuration
    - **virtualMode** — Use virtual paths (default: true)
    - **rootDir** — Root directory for filesystem operations

#### Example

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
    }
  ]
}
```

---

### 5. MCP Servers Section

Configuration for Model Context Protocol (MCP) servers providing external tools.

#### Schema

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

#### Fields

- **serverName** — Identifier for the MCP server
  - **command** — Executable command (e.g., `"npx"`, `"node"`)
  - **args** — Command arguments array

#### Example

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

### 6. Nodes Section

Defines executable workflow nodes (states in the graph).

#### Schema

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
        "function": string
      },
      "useA2AServers": boolean,
      "useMcpServers": boolean,
      "useSystemSkills": boolean,
      "excludeTools": string[],
      "injectSkillsPrompt": boolean,
      "retryPolicy": { "maxAttempts": number, "backoffFactor": number, "initialInterval": number, "maxInterval": number },
      "timeout": number,           // or { "runTimeout": number, "idleTimeout": number, "refreshOn": "auto" | "heartbeat" }
      "cachePolicy": { "ttl": number },
      "tags": string[]
    }
  ]
}
```

`retryPolicy` / `timeout` / `cachePolicy` / `tags` are LangGraph 1.4.0+ per-node control options (`retryPolicy` since 1.1.0+). Node-level values override workflow-wide defaults set via `Graph.setNodeDefaults()` — see [docs/API.md](API.md).

#### Node Types

**Function Node** — Standard node executing custom JavaScript logic.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique node identifier |
| handler | object | Node execution configuration |
| handler.parameters | array[] | Parameter definitions |
| handler.parameters[].name | string | Parameter variable name |
| handler.parameters[].parameterType | `"state"` \| `"model"` | Parameter kind |
| handler.parameters[].stateType | string | State annotation type (for `state` params) |
| handler.parameters[].modelRef | string | Model ID reference (for `model` params) |
| handler.function | string | JavaScript function body |
| injectSkillsPrompt | boolean | Skip Skills prompt injection (default: `true`) |
| retryPolicy | object | `{ maxAttempts?, backoffFactor?, initialInterval?, maxInterval? }` — retry on transient node errors (LangGraph 1.1.0+) |
| timeout | number \| object | Milliseconds, or `{ runTimeout?, idleTimeout?, refreshOn? }` (LangGraph 1.4.0+) |
| cachePolicy | object | `{ ttl? }` in seconds; `undefined` never expires (LangGraph 1.4.0+) |
| tags | string[] | Custom LangSmith tags for this node's runs (LangGraph 1.4.0+) |

**Tool Node** — Special node for handling tool calls (A2A/MCP/Skills).

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique node identifier |
| type | `"ToolNode"` | Must be `"ToolNode"` |
| useA2AServers | boolean | Enable A2A server tools |
| useMcpServers | boolean | Enable MCP server tools |
| useSystemSkills | boolean | Enable skills tools |
| excludeTools | string[] | Tool names to exclude from this node |

#### Special Functions

- **interrupt(message)** — Pauses workflow execution and prompts user input
- **Overwrite(value)** (LangGraph 1.4.0+) — Forces an explicit overwrite of a state channel, bypassing the reducer's normal merge logic; available in function node bodies

#### Examples

**Function Node**

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

**Function Node with Model**

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

**Tool Node**

```json
{
  "id": "tools",
  "type": "ToolNode",
  "useA2AServers": true,
  "useSystemSkills": true
}
```

---

### 7. Edges Section

Defines workflow transitions between nodes.

#### Schema

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
          "function": string
        },
        "possibleTargets": string[]   // optional
      }
    }
  ]
}
```

#### Edge Types

**Normal Edge** — Direct transition from one node to another.

| Field | Type | Description |
|-------|------|-------------|
| from | string | Source node ID (or `"__start__"` for entry) |
| to | string | Target node ID (or `"__end__"` for exit) |

**Conditional Edge** — Dynamic routing based on runtime logic.

| Field | Type | Description |
|-------|------|-------------|
| from | string | Source node ID |
| type | `"conditional"` | Must be `"conditional"` |
| condition | object | Condition configuration |
| condition.name | string | Condition identifier |
| condition.handler | object | Evaluation logic |
| condition.handler.parameters | array[] | Parameter definitions |
| condition.handler.function | string | JavaScript function body |
| condition.possibleTargets | string[] | Possible target node IDs for validation |

#### Examples

**Normal Edge**

```json
{
  "from": "__start__",
  "to": "askName"
}
```

**Conditional Edge**

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

### 8. State Graph Section

Configures the LangGraph StateGraph instance.

#### Schema

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

#### Fields

- **annotationRef** — Reference to `stateAnnotation.name`
- **config** — Graph configuration
  - **checkpointer** — State persistence backend
    - **type** — `"MemorySaver"` (in-memory) or `"SqliteSaver"` (persistent)
  - **store** — Key-value store configuration
    - **type** — `"InMemoryStore"`

#### Example

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

## Complete Examples

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
    { "from": "__start__", "to": "askName" },
    { "from": "askName", "to": "__end__" }
  ],
  "stateGraph": {
    "annotationRef": "InterruptWorkflowState",
    "config": {
      "checkpointer": { "type": "MemorySaver" }
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
    { "from": "__start__", "to": "askJob" },
    { "from": "askJob", "to": "generateAdvice" },
    { "from": "generateAdvice", "to": "__end__" }
  ],
  "stateGraph": {
    "annotationRef": "CounselorState",
    "config": {
      "checkpointer": { "type": "MemorySaver" }
    }
  }
}
```

---

## Advanced Features

### Agent-to-Agent (A2A) Communication

OpenAgentJSON supports multi-agent orchestration where agents communicate via A2A protocol.

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

OpenAgentJSON supports skills that provide file system operations through a virtual or real filesystem backend. Skills come in two types: **System Skills** (built-in) and **Custom Skills** (user-defined).

**Configuration:**
- Enable skills per-model in `models[N].skills` with `enabled: true`
- Set `skillsPath` to the directory containing skill definitions
- Configure `backend.virtualMode` for virtual filesystem simulation
- Set `backend.rootDir` for the root directory of filesystem operations

**Model Integration:**
- Use `"bindSystemSkills": true` in model config to bind skills as tools
- Skills are automatically available to the model as callable tools

**Tool Node Integration:**
- Use `"useSystemSkills": true` in ToolNode to handle skill tool calls
- Skills execute filesystem operations and return results to the workflow

#### System Skills (Built-in)

SceneGraphManager provides 7 core built-in skills:

| Skill Name | Description | Key Features |
|------------|-------------|-------------|
| `read_file` | Read file contents from the filesystem | Supports offset/limit for large files, line-by-line reading |
| `write_file` | Write content to a file | Overwrite protection, creates parent directories |
| `edit_file` | String replacement in files | Uniqueness validation, replace_all option |
| `glob_files` | Pattern-based file search | Supports glob patterns (e.g., `**/*.ts`), recursive search |
| `grep_search` | Content search with regex support | Regex patterns, context lines (-A/-B/-C), file filtering |
| `bash_command` | Shell command execution | Safety checks, timeout support, environment variables |
| `web_fetch` | HTTP content fetching | GET/POST requests, header support, JSON/text responses |

**Tool Details:**

1. **read_file** — Read file contents with optional offset and limit. Returns content with line numbers.
   `read_file({ file_path: "config.json", offset: 0, limit: 100 })`

2. **write_file** — Write or overwrite file contents. Automatically creates parent directories.
   `write_file({ file_path: "output.txt", content: "data" })`

3. **edit_file** — Perform exact string replacement in files. Validates uniqueness.
   `edit_file({ file_path: "app.ts", old_string: "old", new_string: "new" })`

4. **glob_files** — Search for files using glob patterns. Returns sorted list of matching paths.
   `glob_files({ pattern: "**/*.md", path: "." })`

5. **grep_search** — Search file contents using regex patterns. Supports context lines.
   `grep_search({ pattern: "function.*test", glob: "**/*.ts" })`

6. **bash_command** — Execute shell commands with safety checks and timeout.
   `bash_command({ command: "npm test", timeout: 30000 })`

7. **web_fetch** — Fetch content from HTTP/HTTPS URLs. Supports custom headers.
   `web_fetch({ url: "https://api.example.com/data", method: "GET" })`

#### Custom Skills

Custom skills extend functionality beyond filesystem operations. They are defined in the `skillsPath` directory:

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

For example implementations, see the [kudosflow](https://github.com/akudo7/kudosflow) repository:
- **arxiv-search** — Search arXiv preprint repository for research papers
- **langgraph-docs** — Fetch and use LangGraph.js documentation

---

## Best Practices

1. **State Design** — Keep state flat and minimal; use reducers to manage updates
2. **Node Granularity** — One node per logical step; avoid monolithic handlers
3. **Error Handling** — Wrap async operations in try-catch blocks
4. **Interrupts** — Use sparingly; prefer state-driven flows
5. **Model Selection** — Match model capability to task complexity
6. **Versioning** — Update `config.info.version` on breaking changes

---

## Integration with SceneGraphManager

Import and run OpenAgentJSON workflows directly:

```typescript
import { WorkflowEngine } from 'scenegraphmanager';
import Workflow from './your-workflow.json';

const engine = new WorkflowEngine(Workflow);
await engine.build();
const result = await engine.invoke({ messages: [{ role: "user", content: "Hello!" }] });
```

SceneGraphManager v2.x is fully compatible with the OpenAgentJSON file format. Workflows designed in the kudosflow2 VSCode extension can be deployed to any execution environment without modification.

---

## Technology Stack

This specification is powered by:
- **LangGraph.js** — Workflow orchestration framework
- **SceneGraphManager v2.x** — JSON-to-workflow compiler (private library)
- **LangChain** — LLM integration and tooling

---

## See Also

- **[FILE_FORMAT.md (original)](https://github.com/akudo7/OpenAgentJson/blob/master/FILE_FORMAT.md)** — Original file format specification from the OpenAgentJson repository
- **[kudosflow Examples](https://github.com/akudo7/kudosflow)** — Real-world workflow implementations
- **[a2a-server](https://github.com/akudo7/a2a-server)** — A2A server implementation
- **[LangGraph.js Docs](https://langchain-ai.github.io/langgraphjs/)** — Official LangGraph.js documentation
