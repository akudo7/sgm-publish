# SceneGraphManager v2.8.0

<p align="center">
  <strong>JSON-Driven AI Workflow Engine for LangGraph</strong>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="https://github.com/akudo7/kudosflow/issues">Support</a>
</p>

---

## Overview

**SceneGraphManager** is a powerful TypeScript library that enables JSON-driven execution of AI workflows built on LangGraph and LangChain. Design complex AI workflows once as JSON and run them anywhere—desktop, embedded systems, or IoT devices—without code changes.

### Why SceneGraphManager?

- **JSON-First Design** — Define complete AI workflows in portable JSON format
- **Multi-Model Support** — Anthropic Claude, OpenAI, Azure OpenAI, Ollama, llama.cpp (GGUF)
- **LangGraph 1.4.x** — Zod state validation, per-node control options (`retryPolicy`/`timeout`/`cachePolicy`/`tags`, `setNodeDefaults()`), per-model tool binding
- **Agent Communication** — Built-in A2A (Agent-to-Agent) protocol with dynamic Agent Card discovery and Swarms Fan-out/Fan-in workflows
- **Tool Integration** — MCP (Model Context Protocol) for automatic tool binding
- **Visual Design** — Compatible with OpenAgentJson and kudosflow2 VSCode extension
- **Production Ready** — Type-safe, error handling, streaming support
- **Offline Capable** — Run in network-isolated environments
- **SourceHunt** — AI-driven multi-specialist vulnerability discovery pipeline
- **Memento-Skills** — Self-improving workflows: `reflect_node` writes lessons to SKILL.md after each execution; domain-aware skill routing filters relevant skills per task
- **AutoResearch** — Autonomous SKILL.md improvement loop: iteratively trains on train tasks, validates on holdout tasks, auto-commits or rollbacks based on holdout score
- **Dispatch** — Remote task execution system: submit tasks via HTTP / Slack / Telegram, execute locally with WorkflowEngine, receive completion via webhook

---

## Features

See [docs/FEATURES.md](docs/FEATURES.md) for the complete feature list including:

- JSON-driven workflows with DAG execution
- Multi-model AI support (Anthropic, OpenAI, Azure, Ollama, llama.cpp/GGUF)
- MCP, A2A (static + dynamic Agent Card discovery), Swarms Fan-out/Fan-in workflows, Skills system, Structured Output, write_todos/read_todos
- Per-model skills (`models[N].skills`) — independent skills/tools per model in a workflow
- `bashCommandAllowedCommands` — deny-by-default allowlist for the `bash_command` tool
- Context Compression (threshold / autonomous modes)
- Sprint Contract pattern (Generator-Evaluator iterative loop)
- Context Guard (automatic reset when context exceeds threshold)
- Hooks & Event System with `HookFeedback`
- Security: PII filtering, secret redaction, tool sandboxing
- SourceHunt AI-driven vulnerability discovery pipeline
- AutoResearch: autonomous SKILL.md improvement loop with holdout validation and reward hacking detection
- **External Function Files** — Extract node and conditional edge logic to separate `.js` files via `functionFile`, keeping JSON workflows clean and enabling code reuse

---

## Installation

```bash
yarn add @kudos/scene-graph-manager
```

**Requirements:** Node.js 16+, TypeScript 5.9.2+

See [docs/QUICK-START.md](docs/QUICK-START.md) for full installation details and a minimal working example.

---

## Quick Start

```typescript
import { WorkflowEngine } from 'scenegraphmanager';

const engine = new WorkflowEngine(config);
await engine.build();
const result = await engine.invoke({ messages: [{ role: "user", content: "Hello!" }] });
```

See [docs/QUICK-START.md](docs/QUICK-START.md) for the complete example.

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for component overview and project structure.

---

## Dispatch & Slack Bot

See [docs/DISPATCH.md](docs/DISPATCH.md) for setup and API reference.

---

## Agent Workflow Implementation

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for JSON structure, node types, and custom function nodes.

---

## Memento-Skills & AutoResearch

See [docs/MEMENTO-SKILLS.md](docs/MEMENTO-SKILLS.md) for the self-improving workflow pattern and autonomous training loop.

---

## Integration

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for kudosflow2 VSCode extension and OpenAgentJson compatibility.

---

## Documentation

- **[docs/QUICK-START.md](docs/QUICK-START.md)** — Installation and minimal working example
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Component overview and project structure
- **[docs/WORKFLOW.md](docs/WORKFLOW.md)** — JSON workflow structure, node types, custom function nodes
- **[docs/DISPATCH.md](docs/DISPATCH.md)** — Slack/Telegram Bot, HTTP API, startup guide
- **[docs/MEMENTO-SKILLS.md](docs/MEMENTO-SKILLS.md)** — reflect_node and AutoResearch autonomous improvement loop
- **[docs/FILE_FORMAT.md](docs/FILE_FORMAT.md)** — OpenAgentJSON file format specification (local copy)
- **[docs/OPENAGENTJSON.md](docs/OPENAGENTJSON.md)** — OpenAgentJSON format specification and SceneGraphManager compatibility
- **[docs/INTEGRATION.md](docs/INTEGRATION.md)** — kudosflow2 VSCode extension and OpenAgentJSON compatibility
- **[docs/FEATURES.md](docs/FEATURES.md)** — Full feature reference (Context Compression, Hooks, Security, etc.)
- **[docs/COMPARISON.md](docs/COMPARISON.md)** — SGM vs Google ADK vs Cloudflare Agents platform comparison
- **[docs/EXAMPLES.md](docs/EXAMPLES.md)** — Conditional routing, multi-agent, custom state, PII filtering
- **[docs/API.md](docs/API.md)** — WorkflowEngine API reference and configuration types
- **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** — Common issues and solutions
- **[docs/QWEN-STATS.md](docs/QWEN-STATS.md)** — llama-server token usage monitor
- **[docs/TESTING.md](docs/TESTING.md)** — Test suite and coverage info
- **[CLAUDE.md](CLAUDE.md)** — Technical docs, gotchas, commit guidelines
- **[CHANGELOG.md](CHANGELOG.md)** — Version history
- **[docs/SKILLS-GUIDE.md](docs/SKILLS-GUIDE.md)** — Skills feature user guide
- **[docs/SKILL.md](docs/SKILL.md)** — Skills directory index and discovery guide
- **[scripts/README.md](scripts/README.md)** — A2A server, Dispatch server, Slack/Telegram bots, and utility scripts

---

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

## License

This project is licensed under the MIT License with subscription requirements for team features.
See [LICENSE](LICENSE) for details.

---

## Author

**Hand-crafted by [Akira Kudo](https://www.linkedin.com/in/akira-kudo-4b04163/) in Tokyo, Japan**

<p align="center">Copyright and Reserved © 2023-present Akira Kudo</p>
