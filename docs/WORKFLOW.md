# Workflow Implementation

Workflows are defined entirely in JSON files — no TypeScript changes required. Each workflow is a DAG (Directed Acyclic Graph) of nodes connected by edges.

---

## JSON Structure

```jsonc
{
  "config": { "name": "My Workflow", "description": "..." },
  "stateAnnotation": { "name": "WorkflowState", "type": "Annotation.Root" },
  "annotation": {
    "messages": { "type": "BaseMessage[]", "reducer": "(x, y) => x.concat(y)", "default": "[]" }
  },
  "models": [
    { "id": "claude", "type": "anthropic", "config": { "model": "claude-3-5-sonnet-20241022", "apiKey": "..." } }
  ],
  "nodes": [
    // Node definitions (see below)
  ],
  "edges": [
    { "from": "__start__", "to": "planner_node" },
    { "from": "planner_node", "to": "__send__" }
  ]
}
```

---

## Node Types

| type | Purpose | Key Fields |
|---|---|---|
| `model` | LLM call | `modelRef`, `useSystemSkills`, `injectSkillsPrompt` |
| `tool` | Tool execution (MCP, A2A, filesystem) | `tools` array, `excludeTools`, `useDiscoveredAgents` |
| `conditional` | Routing logic | `conditions` array |
| `custom` | Arbitrary JS function | `handler.function` (code string) |

---

## Custom Nodes (function nodes)

Custom nodes execute JavaScript via the `AsyncFunction` constructor. State, models, and tools are automatically injected into the execution scope.

```jsonc
{
  "id": "planner_node",
  "handler": {
    "parameters": [
      { "name": "state", "parameterType": "state", "stateType": "typeof SwarmsState.State" },
      { "name": "model", "parameterType": "model", "modelRef": "leader" }
    ],
    "function": "const lastMessage = state.messages[state.messages.length - 1];\nconst userTask = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);\n// ... classify domain, generate worker plans\nreturn { workerPlans, messages: [response] };"
  }
}
```

### Function Node Scope Variables

| Variable | Type | Description |
|---|---|---|
| `state` | `State` | Current workflow state |
| `model` | `ModelInstance` | First model in `parameters` (backward-compatible) |
| `models` | `Record<string, ModelInstance>` | All `modelRef` models as a dictionary (multi-model use) |
| `tools` | `Tool[]` | Array of bound tools |
| `ToolMessage` | class | LangChain `ToolMessage` constructor |
| `HumanMessage` | class | LangChain `HumanMessage` constructor |
| `AIMessage` | class | LangChain `AIMessage` constructor |
| `__registerA2AAgent` | `async function` | Register an A2A agent dynamically at runtime |
| `require` | function | Node.js `require` (CommonJS module loading) |

### Using Multiple Models

Specify multiple `parameterType: "model"` entries in `parameters` to inject a `models` object and individual model variables.

```jsonc
{
  "id": "multi_model_node",
  "handler": {
    "parameters": [
      { "name": "state", "parameterType": "state", "stateType": "typeof State.State" },
      { "name": "modelA", "parameterType": "model", "modelRef": "claude" },
      { "name": "modelB", "parameterType": "model", "modelRef": "qwen" }
    ],
    "function": "const r1 = await modelA.invoke(msgs); const r2 = await modelB.invoke(msgs); ..."
  }
}
```

---

## External Skill Files (SKILL.md)

Skills are defined as `SKILL.md` files placed alongside workflow JSON. `injectSkillsPromptIfNeeded()` reads SKILL.md and injects it into the system prompt.

```
skills/
  teams/
    SKILL.md          # Teams workflow skill (parallel worker orchestration)
    worker-template.json
  arxiv-search/
    SKILL.md          # Arxiv search skill
  langgraph-docs/
    SKILL.md          # LangGraph docs lookup skill
```

Each SKILL.md follows this structure:

```markdown
---
name: skill-name
description: What this skill does
---

# Skill Name

## Purpose
What the skill accomplishes.

## Constraints
Rules the agent must follow.

## Steps
Step-by-step instructions for execution.

## Learned Patterns
<!-- reflect_node appends lessons here -->
```

---

## Fan-out with Send Objects

Use `Send` objects in a function node's return value to dispatch multiple nodes in parallel. Each `Send` targets a specific node with its own state payload.

```jsonc
{
  "id": "planner_node",
  "handler": {
    "parameters": [
      { "name": "state", "parameterType": "state", "stateType": "typeof State.State" }
    ],
    "function": "const plans = [{ task: 'A' }, { task: 'B' }, { task: 'C' }];\nreturn plans.map(p => new Send('worker_node', { currentPlan: p }));"
  }
}
```

The edge from `planner_node` must point to `__send__`:

```json
{ "from": "planner_node", "to": "__send__" }
```

`worker_node` is called once per `Send` object in parallel. Results are collected via a fan-in node (e.g., `aggregator_node`) connected after `worker_node`.

```
planner_node → __send__ → worker_node × N (parallel)
                                ↓
                          aggregator_node → __end__
```

`Send` is automatically available in function node scope — no import needed.

---

## See Also

- [docs/FEATURES.md](FEATURES.md) — Skills System, structuredOutput, Context Compression details
- [docs/MEMENTO-SKILLS.md](MEMENTO-SKILLS.md) — reflect_node and AutoResearch implementation
- [docs/API.md](API.md) — Full NodeBase / ToolNodeConfig field reference
