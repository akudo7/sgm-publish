# Architecture

## Component Overview

```
┌─────────────────────────────────────────────┐
│          WorkflowEngine                      │
│  ┌─────────────────────────────────────┐   │
│  │         Graph (LangGraph)            │   │
│  │  Node 1 → Node 2 → Node 3            │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │    ModelFactoryManager               │   │
│  │  Anthropic │ OpenAI │ Ollama │ ...  │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │    Tool Integration                  │   │
│  │  MCP  │  A2A  │  Swarms Workflows     │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Key Files

| File | Description |
|---|---|
| [src/lib/workflow.ts](../src/lib/workflow.ts) | WorkflowEngine core (~1,160 lines) |
| [src/lib/graph.ts](../src/lib/graph.ts) | Graph wrapper with validation (~432 lines) |
| [src/lib/models/factory.ts](../src/lib/models/factory.ts) | ModelFactoryManager — model lifecycle (~212 lines) |
| [src/lib/models/llamacpp.ts](../src/lib/models/llamacpp.ts) | llama.cpp / GGUF model support |
| [src/lib/context-compression/index.ts](../src/lib/context-compression/index.ts) | ContextCompressionManager (~200 lines) |
| [src/lib/context-guard/index.ts](../src/lib/context-guard/index.ts) | ContextGuard — automatic context reset (~150 lines) |
| [src/lib/usage/UsageTracker.ts](../src/lib/usage/UsageTracker.ts) | Per-node / per-model token usage tracking |
| [src/a2a/A2AEndpoint.ts](../src/a2a/A2AEndpoint.ts) | A2A server (~287 lines) |
| [src/a2a/A2AToolGenerator.ts](../src/a2a/A2AToolGenerator.ts) | A2A tool generation + dynamic Agent Card discovery (~540 lines) |
| [src/lib/dispatch/](../src/lib/dispatch/) | Dispatch system: `DispatchTaskStore`, `AsyncTaskQueue`, `WebhookNotifier` |
| [src/lib/skills/SkillsManager.ts](../src/lib/skills/SkillsManager.ts) | Skills system manager |
| [src/lib/pii/PiiFilter.ts](../src/lib/pii/PiiFilter.ts) | PII filtering (redact / mask / hash / block) |
| [src/lib/secrets/SecretsProvider.ts](../src/lib/secrets/SecretsProvider.ts) | OS-native secret store integration |
| [json/swarms/leader.json](../json/swarms/leader.json) | Swarms Fan-out/Fan-in + A2A workflow config |
| [json/slack-chat-qwen.json](../json/slack-chat-qwen.json) | Slack chat workflow with Qwen (MemorySaver) |

---

## Project Structure

```
SceneGraphManager/
├── src/                    # SDK source (TypeScript)
│   ├── lib/workflow.ts     # WorkflowEngine (core)
│   ├── lib/models/         # Model factories (Anthropic/OpenAI/Ollama/llama.cpp)
│   ├── lib/skills/         # Skills system
│   ├── lib/dispatch/       # Dispatch remote execution system
│   ├── lib/context-compression/ # Context Compression (threshold / autonomous modes)
│   ├── lib/context-guard/  # Context Guard (automatic reset on context overflow)
│   ├── lib/pii/            # PII filtering (redact / mask / hash / block)
│   ├── lib/secrets/        # OS-native secret store integration
│   ├── lib/usage/          # Token usage aggregation
│   ├── a2a/                # A2A protocol (server + tool generation)
│   ├── types/              # TypeScript type definitions
│   └── __tests__/          # Unit tests (18 suites / 269+ tests)
│
├── test/e2e/scenarios/     # E2E test scenarios (25 total)
│   ├── 01-basic-workflow/
│   ├── 07-a2a-workflow/
│   ├── 09-hooks-workflow/
│   ├── 14-context-compression/
│   ├── 15-sprint-contract/
│   ├── 19-swarms-a2a/
│   ├── 21-autoresearch/
│   ├── 22-dispatch-webhook/
│   └── 25-sgm-consulting-v2/
│
├── json/                   # Workflow JSON samples
│   ├── *.json              # Basic workflows (Claude / Qwen / llama.cpp variants)
│   ├── a2a/                # A2A client and server configurations
│   ├── swarms/             # Swarms Fan-out/Fan-in leader configs
│   └── teams/              # Teams multi-agent configs
│
├── scripts/                # CLI scripts (see scripts/README.md)
│   ├── dispatch-server.ts  # Dispatch HTTP server
│   ├── slack-dispatch-bot.ts    # Slack Socket Mode Bot
│   ├── telegram-dispatch-bot.ts # Telegram long-polling Bot
│   ├── autoresearch.ts     # AutoResearch autonomous improvement loop
│   └── start-a2a-server.ts # A2A agent server launcher
│
├── eval/                   # AutoResearch evaluation tasks (used by eval/harness.ts)
│   ├── harness.ts          # Evaluation harness (computes successRate)
│   ├── train/              # Training tasks (5 per skill)
│   └── holdout/            # Holdout tasks (3 per skill, generalization check)
│
├── works/                  # Production workflow implementations
│   ├── sourcehunt/         # AI-driven vulnerability scan pipeline
│   ├── sgm-consulting-v2/  # SGM SDK consulting bot (Slack integration)
│   └── full-harness/       # Sprint Contract + Context Guard integrated harness
│
├── skills/                 # Skill definitions (SKILL.md files)
│   ├── sgm-docs/SKILL.md   # Navigation index for consulting bot
│   ├── teams/SKILL.md      # Teams workflow skill
│   └── arxiv-search/SKILL.md
│
└── docs/                   # Documentation (this directory)
```

---

## Technology Stack

| Library | Version | Purpose |
|---|---|---|
| [LangGraph](https://github.com/langchain-ai/langgraph) | v1.0.1+ | Workflow orchestration |
| [LangChain Core](https://github.com/langchain-ai/langchainjs) | v1.0.1+ | AI abstraction layer |
| [A2A JS SDK](https://github.com/a2a-js/sdk) | v0.3.4+ | Agent-to-agent communication |
| TypeScript | 5.9.2+ | Type safety |
