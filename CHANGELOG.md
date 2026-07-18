# Change Log

All notable changes to SceneGraphManager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.9.0] - 2026-07-18

### Added

- **File edit constraint rules in SkillsManager** — New rule 6 in `getSkillsPrompt()`: prefer `edit_file` (partial replacement) over `write_file` (full rewrite), with sed/Python fallback procedures for ambiguous `old_string` matches.

## [Unreleased]

---

## [2.8.0] - 2026-07-11

### Added

- **License secret store integration (Phase 7)** — `inject-lock.js` generates `license.cjs` that reads license from OS-native secret store (macOS Keychain / Linux libsecret / Windows Credential Manager) instead of file or environment variable. Added `readFromSecretStore()` method and `os` import.
- **Integrity manifest regeneration in `obfuscate.js`** — Obfuscation changes file hashes; the manifest is now regenerated after obfuscation to keep hash verification accurate.
- **License registration documentation** — `docs/QUICK-START.md` added License Secret Store section with macOS/Linux/Windows commands for issuing and storing licenses.

### Changed

- **`license.cjs` license loading** — Replaced `SGM_LICENSE_PATH` env var + file fallback + dev mode with OS secret store only. `_verifyLicense(licensePath)` split into `_verifyLicenseData(rawJson)` for pure JSON verification.
- **E2E tests** — `SGM_LICENSE_PATH` replaced with `SGM_LICENSE_RAW` test override. Fixed shell escaping bug in `runSgmImport` env var passing.
- **Removed unused `.env` variables** — `AZURE_OPENAI_API_*` ×6 and `LANGCHAIN_VERBOSE` were not referenced anywhere in code; removed from `.env` and `.env.example`.

### Removed

- **`dotenv` dependency** — Unused (never imported in `src/` or `scripts/`); removed from `package.json`.
- **`SGM_LICENSE_PATH` support** — Removed from `license.cjs` and `.env.example`.

### Fixed

- **`obfuscate.js` stale integrity manifest** — After obfuscation, file hashes changed but manifest was not regenerated, causing integrity check failures. Now regenerated automatically.
- **`gen.js` stdout/stderr separation** — `[gen]` metadata logs were written to stdout, contaminating license JSON when piping to `secret-tool store`. Moved logs to stderr; JSON output uses `process.stdout.write`.

---

## [2.7.0] - 2026-07-10

### Added

- **LangSmith metadata tags — JSON configuration** — `config.langsmith` in workflow JSON replaces hardcoded `["sgm-workflow", workflowId]` tags and `{ workflowId, threadId }` metadata literals in `invoke()` / `stream()`:
  - `config.langsmith.tags` — custom tags array (default: `["sgm-workflow", workflowId]`)
  - `config.langsmith.metadata` — additional metadata key-value pairs (default: `{ workflowId, threadId }` always injected)
  - `RuntimeMetadata` (invoke/stream time) `configurable.metadata` merges on top of `config.langsmith.metadata`
  - Type added: `LangSmithConfig` (`src/types/index.ts`), helper method: `_buildLangSmithOptions()` (`src/lib/workflow.ts`)
  - Docs: `docs/FILE_FORMAT.md` Section 10, `docs/FEATURES.md` LangSmith Integration
  - Config example: `json/langsmith-qwen.json`
  - Plans: [plans/langsmith-tags-config/](plans/langsmith-tags-config/)

---

## [2.6.0] - 2026-07-09

### Added

- **LangGraph 1.4.x integration — Zod state validation, per-node control options, dynamic structured output** — Upgraded `@langchain/langgraph` / `@langchain/core` / `langchain` to 1.4.x across the engine:
  - All graph builders now validate state with Zod schemas
  - `useSystemSkills` node-level flag binds skills/tools per node instead of globally
  - `createPerModelTools()` — per-model tool binding, replacing the single shared tool set
  - Per-node control options on `NodeBase` — `retryPolicy` (`maxAttempts`/`backoffFactor`/`initialInterval`/`maxInterval`), `timeout` (`number` or `TimeoutPolicyConfig` with `runTimeout`/`idleTimeout`/`refreshOn`), `cachePolicy` (`ttl`), `tags` (custom LangSmith tags) — plus `Graph.setNodeDefaults()` to set defaults for all nodes at once
  - `structuredOutput.strict` / `structuredOutput.fallbackToText` — dynamic structured-output options for GPT models
  - `Overwrite` class re-exported from `@langchain/langgraph` for explicit state-channel overwrite semantics
  - `stream()` gains `"tools"` / `"messages"` / `"tokens"` as valid `streamMode` values (alongside existing `"values"` / `"updates"`)
  - `e2e-failure-report.md` root-cause analysis and fixes for the resulting 58 failing E2E tests (skills/tools not created for models without a `skills` config, `import.meta.url` eval failures in bootstrap function nodes, unbounded `max_tokens:-1` generation on qwen configs causing "hung" runs, schema-blind structured-output fallback defaults, `console.*` log noise in Jest)
  - Plans: [plans/COMPLETED/langchain-langgraph-upgrade/](plans/COMPLETED/langchain-langgraph-upgrade/)

- **Per-model skills — `models[N].skills`** — Skills/tools configuration moved from a single global `config.skills` to per-model `models[N].skills`, so each model in a workflow can have independent skills:
  - `skillsManager` / `claudeCodeTools` are now `Map<string, SkillsManager>` / `Map<string, Tool[]>` keyed by model ID
  - `initializeSkills()` → `initializePerModelSkills()`, `createClaudeCodeTools()` → `createPerModelTools()`
  - `config.skills` still works for backward compatibility, stored under a `'default'` entry
  - `ToolNode` merges tools across all models in use

- **`bashCommandAllowedCommands` — deny-by-default bash command allowlist** — `config.bashCommandAllowedCommands` in workflow JSON config controls which commands `bash_command` tool is permitted to execute. `undefined` or `[]` rejects all commands (deny-by-default). Only explicitly listed commands are allowed.
  - Type added to `WorkflowGlobalConfig` (`src/types/index.ts`) and `ClaudeCodeToolsConfig` (`src/lib/tools/types.ts`)
  - `ClaudeCodeToolsFactory` reads `allowedCommands` from config and enforces deny-by-default in `bash_command` tool
  - `WorkflowEngine` passes `bashCommandAllowedCommands` from config to factory in `createPerModelTools()` / `setToolRootDir()`
  - The same 26-command allowlist is embedded in every `bindSystemSkills: true` JSON config

- **`works/loop-engineering/` — JSON-driven autonomous loop workflow** — Example workflow implementing a plan → execute → verify loop (Generator/Evaluator pattern) entirely via LangGraph JSON, replacing an earlier standalone TypeScript loop engine prototype:
  - Deterministic gap detection in `verify.js` (extracts `write_file`/`bash_command` calls from messages) merged with LLM judgment
  - Context compression, `LOOP_DEBUG_*` env vars, loop-iteration cap (`MAX_ITERATIONS`) to prevent infinite execute→tools loops
  - Resilient structured output (`_createResilientStructuredModel`, `unbindTools()` fallback) for models that return XML tool calls instead of JSON
  - `loop-execute` skill localized under `works/loop-engineering/skills/`

### Changed

- **`sgm-consulting-v2` guard hardening** — `referenced_files` tracking across tool-call phases, `leak_score` evaluation added to the close decision, `CODE_BLOCK` check removed from the production guard (sample code is now allowed), guard-unsafe routes to `rewrite_node` instead of escalating directly

### Fixed

- **ESM `import.meta.url` eval error** — `_findProjectRoot()` used `eval('import.meta.url')` inside bootstrap function nodes (executed via `AsyncFunction`), which fails to resolve at runtime; replaced with `__dirname`/`__filename`

---

## [2.5.0] - 2026-06-09

### Added

- **SGM Consulting Bot v2 integration — Handler externalization + file cache** — Refactored the consulting bot v2 integration layer to extract inline handlers into external `.js` files under `works/sgm-consulting-v2/integration/handlers/`, and added a file-based cache for document responses:
  - Phase 1: Handler extraction — Moved handler logic from inline JSON to `works/sgm-consulting-v2/integration/handlers/`
  - Phase 2: Document cache — Added file-based caching for `read_file` tool responses to reduce redundant I/O
  - Plans: [plans/COMPLETED/sgm-consulting-v2-integration/](plans/COMPLETED/sgm-consulting-v2-integration/)

### Changed

- **`plans/sgm-consulting-v2-integration/` moved to `plans/COMPLETED/`** — Integration refactoring marked as completed

---

## [2.4.0] - 2026-06-08

### Added

- **External function files (`functionFile`)** — Node functions and conditional edge functions can now be loaded from external `.js` files instead of inline strings. This keeps JSON workflow files readable and enables code reuse across workflows:
  - `NodeFunction.functionFile` — relative path to external `.js` file for node handlers
  - `ConditionalEdgeFunction.functionFile` — relative path to external `.js` file for conditional edge evaluators
  - `function` and `functionFile` are mutually exclusive — specifying both raises `WorkflowError`
  - Path is resolved relative to the project root (the directory containing `node_modules`)
  - Migration script `scripts/migrate-function-to-file.cjs` — automatically extracts inline `function` strings from JSON files into `json/functions/*.js` and updates references
  - Files: `src/__tests__/workflow/function-external-reference.test.ts`, `scripts/migrate-function-to-file.cjs`

---

## [2.3.1] - 2026-05-30

### Added

- **`docs/FILE_FORMAT.md` — OpenAgentJSON format specification updated to v2.3.1** — Local copy of the OpenAgentJSON spec aligned with the latest format version; covers all fields, node types, and configuration options supported in v2.3.1

- **`excludeDirs` — grep/glob directory exclusion** — New `SkillsConfig.excludeDirs` field prevents `grep_search` and `glob_files` from scanning specified directories. `node_modules`, `.git`, and `dist` are always excluded by default. Configured via `config.skills.excludeDirs` in the workflow JSON.

### Fixed

- **`dispatch-server-v2` — Slack API silent failure** — `postSlack` now logs Slack API-level errors (`{"ok": false}`) that were previously swallowed. Missing `SLACK_BOT_TOKEN` is detected at call time.
- **`dispatch-server-v2` — webhook content extraction** — `/slack-webhook` handler now prefers `result.answer` over `result.messages[-1].content`, preventing truncated or garbled Slack replies.
- **`sgm-consulting-v2` — rewrite truncation and escalation loop** — Guard issues (`PATH_LEAK`, `INTERNAL_SYMBOLS`, `INTERNAL_SYMBOL`, `IMPLEMENTATION_DETAIL`, `CODE_STRUCTURE`) are now fixed deterministically without LLM, eliminating escalations caused by the rewrite model returning empty content.

## [2.3.0] - 2026-05-30

### Added

- **Dispatch — Async task execution system for remote clients** — Submit tasks via HTTP from smartphones / Slack / Telegram / external clients; the local WorkflowEngine executes them and notifies on completion:
  - **Webhook completion notification** — POST results to `webhookUrl` on task completion. Up to 3 retries
  - **SQLite persistence** — Task storage via `better-sqlite3` (WAL mode). Incomplete tasks are restored after server restart, with paginated listing via `GET /tasks` and scheduled cleanup (over 7 days)
  - **Async queue** — Parallel execution control via `AsyncTaskQueue` (adjustable via `--concurrency`)
  - **Slack notifications** — `slack-dispatch-bot.ts` (Socket Mode). Submit tasks via DM / channel mention, reply results to threads. Immediate session exit on exit keywords ("終了", "exit", "quit", "やめる", "done")
  - **Telegram notifications** — `telegram-dispatch-bot.ts` (long polling). Submit tasks by sending messages in DM, results are replied
  - **Slack chat workflow** — `json/slack-chat-qwen.json`. llama.cpp (Qwen) with MemorySaver maintains per-thread conversation history in Slack threads. Flow: `__start__` → `chat_node` → `__end__` (1 invoke = 1 turn design)
  - Files: `src/lib/dispatch/DispatchTaskStore.ts`, `AsyncTaskQueue.ts`, `WebhookNotifier.ts`, `src/types/dispatch.ts`, `scripts/dispatch-server.ts`, `scripts/slack-dispatch-bot.ts`, `scripts/telegram-dispatch-bot.ts`, `json/slack-chat-qwen.json`
  - Implementation notes: See "Slack Bot Implementation Notes" section in `plans/COMPLETED/slack-chat-setup/PLAN.md`
- **Dynamic agent selection via Agent Cards** — Auto-discover A2A agents at runtime and select the optimal agent via skill matching:
  - `discovery_node` — Batch-fetch `/.well-known/agent.json` at workflow start, store `availableAgents` / `agentRegistry` in state
  - `planner_node` skill matching — Dynamically determine the responsible agent by similarity score between agent card `skills` / `description` and the task
  - `useDiscoveredAgents: true` ToolNode — Dynamically generate A2A tools from `state.availableAgents` at runtime (`A2AToolGenerator.generateToolsFromDiscovered()`)
  - Added `availableAgents` / `agentRegistry` state fields to `WorkflowConfig`
  - Implemented the above configuration in `json/a2a/client.json` and `json/a2a/client-qwen.json`
  - E2E test `07-a2a-workflow/a2a-qwen.test.ts` — Validates with 12 tests across Build / Invoke (LlamaCpp) / Validation
- **Memento-Skills: Self-improving agent workflows** — Implemented the Write phase of the paper "Memento-Skills: Let Agents Design Agents". A loop where execution experience accumulates in SKILL.md:
  - `reflect_node` — Analyzes workerPlans / workerResults after task completion, appends improvement patterns to SKILL.md `## Learned Patterns` (via `edit_file`)
  - Domain-based skill routing — `planner_node` classifies tasks into `research` / `coding` / `writing` / `analysis` / `general` and injects only relevant skills into workers
  - `domainSkillsMap` — Maps skills to be used per domain (e.g., research → arxiv-search, langgraph-docs)
  - `worker_node` incorporates domain hints and relevantSkills into the prompt, suppressing unnecessary skill usage
  - Implemented reflect_node and domain classification logic in `json/teams/leader.json` / `json/teams/leader-qwen.json`
  - Added `## Learned Patterns` section to `skills/teams/SKILL.md` (target for reflect_node append)
  - Plans: [plans/memento-skills/PLAN.md](plans/memento-skills/PLAN.md), [phase1-reflect-node.md](plans/memento-skills/phase1-reflect-node.md), [phase2-skill-router.md](plans/memento-skills/phase2-skill-router.md)
- **Context Compression** — Reduces token consumption via automatic long-context compression:
  - `ContextCompressionManager` — Supports threshold mode and autonomous mode
  - **Threshold mode**: When both `trigger.messages` / `trigger.tokens` conditions are met, summarizes and removes messages before node execution
  - **Autonomous mode**: Injects `compress_context` tool into the model. The model autonomously decides when to summarize and compress
  - Summary results are attached to the `summary` field of the final result
  - Implemented in `src/lib/context-compression/index.ts`
  - Workflow JSON configuration example: `config.config.contextCompression = { mode: "threshold", trigger: { messages: 10, tokens: 102400 }, keep: { messages: 4 } }`
- **Hooks event system** — Extended `WorkflowEventHandler` to return `HookFeedback`:
  - `preToolUse` — Fires before tool invocation. Can interrupt execution with `block: true`, replace arguments with `updatedInput`
  - `postToolUse` — Fires after successful tool execution. Includes `toolResult` / `durationMs`
  - `postToolUseFailure` — Fires on tool execution error. Includes `toolError` / `durationMs`
  - `sessionStart` — Fires at start of `invoke()` / `stream()`
  - `userPromptSubmit` — Fires when user input is received. Can block input with `block: true`
- **`HookFeedback` interface** (`block`, `blockReason`, `updatedInput`, `additionalContext`)
- **RTK (Rust Token Killer) integration** — `bash_command` uses the `rtk` CLI as a transparent proxy to reduce token consumption:
  - Automatically routes through `rtk` when installed
  - Can be disabled with `SkillsConfig.useRtk: false`
- **`glob_files` symlink support** — Added `follow: true` to correctly discover files under symlinks in `skills/`, etc.
- **PII Filter** — Automatically detects and removes PII before `invoke()` input:
  - Supported patterns: `email`, `ip`, `credit_card`, `phone_number`, `address`, `full_name`, custom regex
  - Four strategies: `redact` (replace), `mask` (partial masking), `hash` (pseudonymization), `block` (throws `PiiBlockedError`)
  - Configurable as `piiFilter` within Ollama model definitions in workflow JSON
- **SecretsProvider** — Retrieves API keys etc. from OS-native secret stores
- **Logger module** — Replaces `console.log`. Automatically redacts sensitive information (API keys, etc.)
- **Expanded unit test suite to 248 tests / 17 suites**:
  - `WorkflowEngine Hooks` — preToolUse block / postToolUse observation / sessionStart / userPromptSubmit all branches
  - `RTK bridge` — useRtk flag and ClaudeCodeToolsFactory bridge validation
  - Added tests for existing modules (BaseModelWrapper / ModelFactoryManager / Graph / A2AToolGenerator, etc.)
  - `Context Guard` — threshold判定とリセットロジックのユニットテスト（404 tests）
  - `Sprint Contract` — state field reducers / conditional routing / planner→negotiate→generate→evaluate→router loop（18 tests）
- **Added E2E test scenarios**:
  - `09-hooks-workflow` — E2E validation of Hooks events
  - `10-rtk-integration` — E2E validation of RTK integration
  - `11-structured-output` — E2E validation of per-node structuredOutput
  - `12-multi-model-workflow` — E2E validation of multi-model coordination
  - `15-sprint-contract` — Sprint Contract Qwen e2e test (Build/Invoke/Validation)
  - Added `Skill Discovery (no external dependencies)` describe to `05-skills-workflow` — Validates arxiv-search without API keys
  - Qwen e2e tests for all scenarios (01-14) — `qwen-*.test.ts` naming convention across 15 files
- **LlamaCpp E2E healthcheck** — Polls `http://localhost:8001/health` in `beforeAll`; shows startup command and aborts on failure
- **SourceHunt — AI-driven vulnerability scanning pipeline** (`works/sourcehunt/`):
  - Multi-Specialist approach: `ranker_node` → `hunter_node` → `verifier_node` → `reporter_node` across 4 phases + Reflexion loop
  - CVE matching via OSV.dev API, `results/cve_cache.json` cache, adds repository CVE registration count / discovery count to combined_report
  - CVE-aware sorting: `sortMergedEntries` prioritizes by vulnerability type (memory_safety / integer_overflow / input_validation)
  - Automatic backup of best results (`results/best/`) and generation / copy of integrated report (`combined_report.md`)
  - Specialist rotation and serial execution (`mergeAllResults`)
  - Replaced ranker heuristic with subsystem-proportional quota approach
  - 23 unit tests (jest + `sourcehunt.lib.ts` extraction)
- **Added `write_todos` / `read_todos` tools** — Persist TODO lists to `InMemoryStore`:
  - `write_todos`: Saves TODO array. Each item has `content` (required), `status` (pending/in_progress/completed), `priority` (high/medium/low)
  - `read_todos`: Retrieves saved TODOs. Supports filtering by `status` / `priority`
  - Injects `store` / `threadId` into `ClaudeCodeToolsFactory`, saves to `InMemoryStore` under `['todos', threadId]` namespace
  - Auto-injects tool descriptions and usage guides into Skills system prompts
  - E2E test `13-todos-workflow` — Validates JSON workflow execution, model tool calls, and store persistence across 21 tests
- **Added llama.cpp model support** (`src/lib/models/llamacpp.ts`):
  - Run GGUF format models via llama.cpp server
  - Registered `LlamaCppModelFactory` in `ModelFactoryManager`
- `structuredOutput` field on `NodeBase` — per-node JSON Schema enforcement via
  `withStructuredOutput()`. Nodes can now declare `{ structuredOutput: { schema: {...} } }`
  to constrain LLM responses to a strict JSON structure.
- `BaseModelWrapper._rawModel` getter — exposes the underlying LangChain model
  for structured output passthrough.
- **Multi-model support in function nodes** — A single node can now reference multiple AI models via `modelRef`. Injects `models` object and individual `modelRef` key variables into handler scope
- **Dynamic A2A agent registration at runtime** — `__registerA2AAgent` injected into node function scope; `ModelFactoryManager` gains `registerA2AAgent`, `unregisterA2AAgent`, `getA2AToolForAgent` static methods for runtime agent lifecycle management
- **`getUsageStats()` — Per-node / per-model token usage tracking** — `WorkflowEngine.getUsageStats()` returns `WorkflowUsageStats` with aggregated token counts and estimated cost across all model calls in the session:
  - `totalInputTokens`, `totalOutputTokens`, `totalTokens` — aggregate totals
  - `totalEstimatedCostUsd` — estimated cost based on built-in pricing (Claude Opus/Sonnet/Haiku, GPT-4o). `undefined` if no pricing data is available
  - `byNode` — `Record<nodeId, NodeUsageSummary>` — per-node call count and token breakdown
  - `byModel` — `Record<modelId, ModelUsageSummary>` — per-model call count and total tokens
  - Implemented in `src/lib/usage/UsageTracker.ts`
- **Completed and organized Harness features** — Marked harness-improvements flow as COMPLETED:
  - Added completion notification and usage tracking for `harness-improvements` flow
  - Added full-hassle workflow and lightweight bootstrap node via external script
- **AutoResearch — SKILL.md autonomous improvement loop**:
  - **Dynamic SKILL.md generation** — `planner_node` generates `skills/dynamic/{role}/SKILL.md` via `write_file`, updates cache via `registerSkill()`
  - **Evaluation harness** — `eval/harness.ts` computes `successRate` (0.0-1.0). Three evaluation types: `completion` / `count` / `keyword`
  - **Orchestrator** — `scripts/autoresearch.ts` runs an N-iteration learning loop. Random trigger tasks → workflow execution → evaluation → adopt on score improvement / git rollback on degradation
  - **Reward Hacking mitigation** — Holdout task sets in `eval/holdout/` (3 per skill). Same domain as train but different phrasing to detect overfitting. Detects score divergence > 0.2 / SKILL.md bloat / repetition patterns. On holdout improvement: `git commit`; on no improvement: `git checkout -- skills/` to revert all changes
  - E2E tests `21-autoresearch/` — 8 suites, 61 tests
- **Full-harness workflow** — `json/full-harness-workflow-qwen.json` — Sprint Contract loop (planner→negotiate→generator→evaluator→router) with Context Guard
- **Token-counting workflow** — `json/token-counting-qwen.json` — Token usage tracking E2E test workflow
- **Extended Swarms A2A workflows** — Updated `json/swarms/leader.json` and `json/swarms/leader-qwen.json`:
  - Added `worker_result_node` — Stores agent responses after `worker_node` execution in `workerResults` state
  - Changed `worker_node` from `ToolNode` to custom handler — Directly calls `currentPlan.agentUrl` to communicate with A2A agents
  - Added error handlers to `start-a2a-server.ts` — Handles `uncaughtException`, `unhandledRejection`, `EADDRINUSE`
  - Unified A2A server port from `3011` to `3001`
  - Updated E2E test `19-swarms-a2a/swarms-qwen.test.ts` — Validates presence of `worker_result_node` and custom handler
  - Added new E2E test `19-swarms-a2a/swarms-leader-qwen.test.ts` — All 14 tests across Build / Invoke / Validation
  - Fixed `expect.fail` → `throw new Error` in E2E test `07-a2a-workflow/a2a-qwen.test.ts`
  - Added `forceExit: true` to Jest config

### Fixed

- **dispatch-server: Fixed empty `SLACK_BOT_TOKEN` due to missing `dotenv` load** — The `slack-webhook` handler called the Slack API but did not load `.env`. Added `dotenv.config()` at the top
- **slack-dispatch-bot: Fixed thread_id changing on every reply, breaking conversation history** — Using `msg.ts` (the message's own timestamp) caused a different thread_id per invoke, preventing MemorySaver from carrying over previous state. Unified to `msg.thread_ts || msg.ts` (thread root)
- **slack-webhook: Fixed AIMessage content becoming JSON dump** — LangChain AIMessage serializes as `{ lc: 1, kwargs: { content: "..." } }`, so `result.messages[-1].content` was `undefined` and all results were JSON.stringify'd. Fixed to fall back with `lastMsg?.content ?? lastMsg?.kwargs?.content`
- **Slack chat workflow: Fixed LLM being called 100 times per message** — The `check_exit` node had a loop back to `chat_node` when `exit=false`, causing continuous LLM calls up to the recursionLimit (100) on normal messages. Changed workflow to `__start__` → `chat_node` → `__end__` single-turn design, moving exit keyword detection to the Bot side
- **Fixed tool name mismatch in `useDiscoveredAgents` ToolNode** (`src/lib/workflow.ts`):
  - The model binds to static tool names (e.g., `send_message_to_task_agent`) via `bindA2AServers`, while dynamically generated tools use agent card names, causing a mismatch that led to infinite loops. Fixed by merging static A2A tools (`this.a2aTools`) with dynamic tools at ToolNode execution time and filtering name duplicates
- **Fixed `result undefined` in E2E test T-02** (`test/e2e/scenarios/07-a2a-workflow/a2a-qwen.test.ts`):
  - After `resume: 'approve'`, `approval_gate_research` threw a second `GraphInterrupt`, leaving `result` unset when assertion was reached. Fixed by retrieving state from the checkpoint via `engine.getCompiledGraph().getState()` when the second `GraphInterrupt` occurs and setting it into `result`
- Added `bearerToken` / `bearerTokenEnvVar` to `A2AServerConfig`, fixing the Bearer auth flow
- Fixed `initializePiiFilter` type comparison to be case-insensitive

---

## [2.2.0] - 2026-03-21

### Changed

- Migrate all `package.json` scripts from `npm` to `yarn`
  (`build`, `obfuscate`, `package`, `prepublishOnly`)
- `package` script now generates a versioned tarball filename
  (`kudos-scene-graph-manager-<version>.tgz`)
- Inject `tools`, `ToolMessage`, `HumanMessage`, and `AIMessage`
  into function node execution scope

### Fixed

- `bindTools` return value now correctly reassigned to `model`;
  previously the new wrapper returned by `bindTools` was discarded,
  causing Claude Code tools to not be bound to the node

---

## [2.1.3] - 2026-03-14

### Added

- `injectSkillsPrompt` flag on `NodeBase` to allow per-node opt-out of Skills
  prompt injection (default: `true`)

---

## [2.1.2] - 2026-03-14

### Added

- `excludeTools` field on `ToolNodeConfig` for per-node tool filtering
- `send-a2a-message.ts` and `start-a2a-server.ts` utility scripts for A2A testing
- Root `SKILL.md` index file for skills directory navigation

### Changed

- Truncate `glob_files` tool results to 200 entries with a user-friendly overflow message
- Improve tool execution logging: log arguments before execution, output clean success/error lines
- Re-throw conditional edge errors instead of silently swallowing them

### Fixed

- System prompt injection now correctly handles LangChain `BaseMessage` objects
- `ModelInstance` interface accepts any schema in `withStructuredOutput` (was incompatible with `ZodTypeAny`)
- `BaseModelWrapper` generic constraint correctly requires `invoke` method on `TModel`
- Skip re-conversion of existing `BaseMessage` instances in `convertMessagesToBaseMessages`

---

## [2.1.1] - 2026-03-14

### Added

- Skills feature: dynamically load and execute external skills defined as `SKILL.md` files
- Seven Claude Code-style tools for skills execution: `read_file`, `write_file`, `edit_file`, `glob_files`, `grep_search`, `bash_command`, `web_fetch`
- `bindSystemSkills` / `useSystemSkills` model and node configuration options
- `SkillsManager` and `FilesystemBackend` infrastructure
- Comprehensive Skills feature documentation ([docs/SKILLS-GUIDE.md](docs/SKILLS-GUIDE.md))
- Debug scripts for skills and tools testing

### Changed

- Renamed `bindClaudeCodeTools` → `bindSystemSkills` and `useClaudeCodeTools` → `useSystemSkills` for consistent terminology
- Skills folder excluded from TypeScript build output

---

## [2.1.0] - 2025

### Added

- Initial SceneGraphManager architecture
- JSON-driven workflow engine
- LangGraph state machine integration
- Multi-model support (Anthropic, OpenAI, Azure OpenAI, Ollama)
- MCP (Model Context Protocol) integration
- A2A (Agent-to-Agent) protocol support
- Persistent state with InMemoryStore
- Checkpointing with MemorySaver
- Event system for workflow monitoring
- Graph visualization support

### Changed

- Migrated from kudosflow2 v1.x.x deprecated architecture
- Rebranded project references from kudosflow to kudosflow2

### Deprecated

- All kudosflow2 v1.0.0 features have been deprecated

### Removed

- Legacy kudosflow2 button-based interface
- `COMPARISON.md` removed from package and docs

---

## Historical Note

SceneGraphManager v2.0.0+ represents a complete architectural redesign. All features from kudosflow2 v1.x.x are deprecated and replaced with the new JSON-driven workflow system.
