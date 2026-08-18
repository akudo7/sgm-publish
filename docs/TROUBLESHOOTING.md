# Troubleshooting

## Common Issues

### "Cycle detected in graph"

**Cause**: Edges form a circular dependency

**Solution**: Review edge definitions, ensure acyclic structure

```typescript
// Bad: A → B → C → A
{ from: "A", to: "B" },
{ from: "B", to: "C" },
{ from: "C", to: "A" }  // Creates cycle

// Good: A → B → C → END
{ from: "A", to: "B" },
{ from: "B", to: "C" },
{ from: "C", to: "__end__" }
```

### "Model factory not found"

**Cause**: Invalid model type in configuration

**Solution**: Use supported types:
`'anthropic'`, `'openai'`, `'azure_openai'`, `'ollama'`, `'llamacpp'`

### "Node not found"

**Cause**: Edge references non-existent node

**Solution**: Verify all edge `from`/`to` values match node IDs

### "Recursion limit exceeded"

**Cause**: Workflow has more than 25 steps (or configured limit)

**Solution**: Increase `config.recursionLimit` or simplify workflow

### "MCP server failed to start"

**Cause**: Invalid command, missing dependencies, or permission issues

**Solution**:

- Verify command is in PATH
- Check server package is installed
- Ensure execute permissions

### API key not recognized

**Cause**: SceneGraphManager does **not** auto-load `.env` / `dotenv`. Passing `process.env.ANTHROPIC_API_KEY` in the workflow config will be `undefined` if `.env` has not been loaded beforehand.

**Solution**: Set `apiKey` directly in the workflow config object or JSON file.

```json
{
  "models": [
    {
      "id": "claude",
      "type": "anthropic",
      "config": {
        "model": "claude-3-5-sonnet-20241022",
        "apiKey": "sk-ant-..."
      }
    }
  ]
}
```

For production, register keys in the OS-native secret store and call `loadSecrets()` before constructing `WorkflowEngine`. See [docs/QUICK-START.md — API Key Setup](QUICK-START.md#api-key-setup) for per-OS registration commands (macOS Keychain, Linux libsecret, Windows Credential Manager).

---

### "A2A agent connection timeout"

**Cause**: Agent not responding or unreachable

**Solution**:

- Verify agent URL is accessible
- Increase `timeout` value in client config
- Check agent is running and healthy
- Workflow continues with graceful fallback

---

## Debugging the Documentation Setup

How to verify that the consulting agent (`works/sgm-consulting-v2/`) is fetching `docs/` files correctly.

### 1. Run a Local Test

```bash
# Run from the project root with a specific question
INITIAL_QUESTION="How do I configure Context Compression?" \
  node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts
```

### 2. Check read_file Paths in the Log

A healthy run shows project-root-relative paths:

```
[respond] [Phase:tool] 3 source tool call(s)
[respond] tool read_file [docs/FEATURES.md] result length: 12190   ← OK
[respond] [Phase:answer] answer generated, length: 1596
```

**Failure pattern (path misinterpretation):**

```
[respond] tool read_file [skills/sgm-docs/docs/FEATURES.md] result length: 122  ← BAD
```

A `result length` of 100–200 bytes means the file was not found and an error response was returned.

### 3. Causes and Fixes

| Symptom | Cause | Fix |
|---|---|---|
| Path is prefixed with `skills/sgm-docs/docs/` | Skills prompt says `path starts with "skills/sgm-docs/"`, which the model misapplies to all paths | Add an explicit path note to the document map in `skills/sgm-docs/SKILL.md` |
| `result length` is very short | File not found at the constructed path | Same as above |
| Agent answers "not in public documentation" | `read_file` failed and no document content was retrieved | Check paths in the log and fix SKILL.md |

### 4. Path Convention in SKILL.md

Always keep the following note in the document map of `skills/sgm-docs/SKILL.md`:

```markdown
**Important**: Paths are relative to the project root. Use `read_file("docs/FEATURES.md")`.
The form `skills/sgm-docs/docs/FEATURES.md` is **incorrect**.
```

### 5. Verification Queries

After any Phase 3 change, verify all three patterns (check path and `result length` in `[respond] tool read_file` log lines):

```bash
# Feature / A2A question → expect docs/FEATURES.md
INITIAL_QUESTION="How do I configure A2A protocol?" \
  node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts

# Dispatch / Slack question → expect docs/DISPATCH.md
INITIAL_QUESTION="How do I start the Slack Bot?" \
  node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts

# API question → expect docs/API.md
INITIAL_QUESTION="How do I use WorkflowEngine.stream?" \
  node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts
```

---

### Tool-calling agents produce HTTP 400 errors after context compression

**Cause**: Context compression with a small `keep.messages` value cuts through AIMessage → ToolMessage pairs, leaving orphaned ToolMessages at the start of the retained window. llama-server (and other OpenAI-compatible endpoints) reject message sequences where a `tool` role message has no preceding `assistant` message with `tool_calls`, returning HTTP 400.

This happens when:

1. The execute agent makes tool calls (write_file, bash_command, etc.) — each call adds an `AIMessage(tool_calls)` + `ToolMessage` pair.
2. Context compression fires and keeps the last N messages.
3. N is small enough that a cut lands between a `ToolMessage` and its parent `AIMessage(tool_calls)`.

```
Before compression (30 messages, keep=4):
  ... [AI_tc_12, T_12, AI_tc_13, T_13]  ← kept
  cut lands here ↑ on T_12

After compression:
  [T_12, AI_tc_13, T_13, AI_final]
   ^── orphaned: no parent AI_tc_12
```

**Solution**: Set `keep.messages` large enough to always retain complete AI/Tool pairs. A safe lower bound is:

```
keep.messages ≥ (max tool calls per execute step) × 2 × (pairs to retain)
```

For single-tool-per-step workflows (the common case), `keep.messages: 10` is a reasonable minimum; `keep.messages: 20` is conservative.

```json
{
  "config": {
    "contextCompression": {
      "enabled": true,
      "mode": "threshold",
      "trigger": { "messages": 30 },
      "keep": { "messages": 20 }
    }
  }
}
```

**Note**: The `ContextCompressionManager._guardToolPair` method provides a best-effort guard at the cut boundary, but it only protects the single pair adjacent to the cut point. It cannot compensate for a `keep` value that is fundamentally too small to contain intact pairs.

**Trade-off**: Larger `keep` values mean more tokens are sent to the model on each call, increasing latency. Tune `keep.messages` to the smallest value that eliminates 400 errors in practice.

---

### Structured output returns `<tool_call>` XML instead of JSON (non-GPT models)

**Cause**: When a node uses `structuredOutput` and the conversation history contains `ToolMessage` objects, some local models (e.g. Qwen3 via llama-server) interpret the context as an ongoing tool-calling session and output XML tool-call syntax instead of the requested JSON.

This commonly affects `plan` and `verify` nodes that have `bindSystemSkills: false` but receive `state.messages` populated by an execute agent that used tools.

**Solution**: The built-in `_createResilientStructuredModel` fallback chain handles this automatically:

- **Level 1**: `withStructuredOutput` — fails on `<tool_call>` output.
- **Level 2**: raw model call + `extractJson` — may still output `<tool_call>` if tool messages remain in context.
- **Level 3**: `invokeStrictJson` — strips all `ToolMessage` and `AIMessage(tool_calls)` from the input before retrying with an explicit JSON-only prompt. If no user message survives stripping (context was compressed), synthesizes a minimal `[system + user]` pair.

No configuration is required. If Level 3 fails, the node handler's own auto-detection (e.g. the file-based gap check in `verify.js`) acts as a final fallback.

For llama-server + Qwen3 models, also ensure the server is started with `--jinja` so the model's embedded chat template is used:

```bash
llama-server --model Qwen3.6-35B-A3B-UD-Q4_K_M.gguf --jinja ...
```

Without `--jinja`, Qwen3 falls back to a heuristic parser that leaks XML tool-call syntax in all responses.

---

## Debug Mode

```typescript
process.env.DEBUG = 'scenegraphmanager:*';
```

Logs include: graph construction steps, node execution timing, tool binding,
MCP/A2A communication, state transitions.

### `enable_thinking: false` / `thinking: false` ignored by llama.cpp

**Symptom**: Setting `enable_thinking: false` and `thinking: false` in `llamacpp` model config has no effect — Qwen3.6 models continue to output `reasoning_content` (thinking blocks).

**Cause**: llama.cpp v10327 regression ([PR #26398](https://github.com/ggml-org/llama.cpp/pull/26398), [Issue #26781](https://github.com/ggml-org/llama.cpp/issues/26781)). A universal capability probe added for DeepSeek templates sets `enable_thinking = true` unconditionally, and this leaks into non-DeepSeek templates (Qwen, etc.). All API request body overrides are ignored.

**Measured results** (2026-08-14):

| API parameter | reasoning_content length | Effect |
|---|---|---|
| None (baseline) | 419 chars | — |
| `enable_thinking: false` + `thinking: false` | 419 chars | ❌ Ignored |
| `reasoning_budget: 0` | 419 chars | ❌ Ignored |
| `reasoning: "off"` | 404 chars | ❌ Ignored |
| `thinking: false` | 400 chars | ❌ Ignored |

**Proposed workaround (unverified)**: The llama.cpp server supports CLI flags that may control reasoning at startup:

```bash
# End thinking immediately (unverified)
llama-server --model ... --reasoning-budget 0

# Disable thinking entirely (unverified)
llama-server --model ... --reasoning off
```

**Limitations**:
- Requires llama-server restart (no dynamic change via API)
- Parallel instances on separate ports are unverifiable due to GPU memory exhaustion (2x24GB, 11GB per model instance)
- Root fix requires a llama.cpp PR merge
- **CLI workaround is unverified** — could not test due to GPU memory constraints

**Impact**:
- SGM's `llamacpp.ts` sends both `enable_thinking` and `thinking` via `modelKwargs` (Phase 2 result)
- However, llama.cpp ignores these parameters, so the fix has no practical effect
- Workflows using Qwen3.6 as a reasoning model waste `max_completion_tokens` on thinking blocks

---

## Validation Errors

Common validation failures:

1. **Missing required fields**: `stateAnnotation`, `annotation`, `nodes`, `edges`
2. **Invalid annotation types**: Must be valid TypeScript type strings
3. **Invalid reducer syntax**: Must be valid JavaScript function body
4. **Missing model references**: `modelRef` must point to defined model
5. **Invalid edge structure**: Must have `from`, conditional edges need `condition`
