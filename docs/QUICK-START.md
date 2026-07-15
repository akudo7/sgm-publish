# Quick Start

## Installation

```bash
yarn add @kudos/scene-graph-manager
```

**Requirements:** Node.js 16+, TypeScript 5.9.2+

**Dependencies:** `@langchain/langgraph`, `@langchain/core`, `@a2a-js/sdk`, `@langchain/mcp-adapters`

---

## Minimal Example

```typescript
import { WorkflowEngine } from 'scenegraphmanager';

const config = {
  config: { name: "Chat Workflow", description: "A basic chat workflow" },
  stateAnnotation: { name: "WorkflowState", type: "Annotation.Root" },
  annotation: {
    messages: { type: "BaseMessage[]", reducer: "(x, y) => x.concat(y)", default: "[]" }
  },
  models: [{ id: "claude", type: "anthropic", config: { model: "claude-3-5-sonnet-20241022", apiKey: "sk-ant-..." } }],
  nodes: [{ id: "chat", type: "model", modelRef: "claude" }],
  edges: [{ from: "__start__", to: "chat" }, { from: "chat", to: "__end__" }],
  stateGraph: { annotationRef: "WorkflowState" }
};

const engine = new WorkflowEngine(config);
await engine.build();

const result = await engine.invoke({ messages: [{ role: "user", content: "Hello!" }] });
console.log(result.messages);
```

> **Note:** `apiKey` is set directly in the workflow config object (or JSON file).
> SceneGraphManager does **not** auto-load `.env` / `dotenv`.
> For production API key management, use `SecretsProvider` (OS-native secret store).
> See [API Key Setup](#api-key-setup) below or the "Security & Privacy" section in [docs/FEATURES.md](FEATURES.md).

---

## API Key Setup

Instead of `.env`, register API keys in the OS-native secret store. Call `loadSecrets()` once before constructing `WorkflowEngine` — it populates `process.env` from the store.

```typescript
import { loadSecrets } from 'scenegraphmanager';
loadSecrets();  // reads from OS keychain into process.env

const engine = new WorkflowEngine(config);  // picks up process.env.ANTHROPIC_API_KEY
await engine.build();
```

### Registering Keys by OS

**macOS — Keychain**

```bash
# Register
security add-generic-password -a scenegraphmanager -s ANTHROPIC_API_KEY -w "sk-ant-..."

# Verify
security find-generic-password -a scenegraphmanager -s ANTHROPIC_API_KEY -w

# Delete
security delete-generic-password -a scenegraphmanager -s ANTHROPIC_API_KEY
```

**Linux — libsecret (`secret-tool`)**

```bash
# Install (if needed)
sudo apt install libsecret-tools   # Debian/Ubuntu
sudo dnf install libsecret         # Fedora

# Register
secret-tool store --label="SGM ANTHROPIC_API_KEY" \
  service scenegraphmanager key ANTHROPIC_API_KEY
# (prompted for the secret value)

# Verify
secret-tool lookup service scenegraphmanager key ANTHROPIC_API_KEY

# Delete
secret-tool clear service scenegraphmanager key ANTHROPIC_API_KEY
```

**Windows — Credential Manager (PowerShell)**

```powershell
# Install helper module (once)
Install-Module -Name CredentialManager -Scope CurrentUser

# Register
New-StoredCredential -Target "scenegraphmanager/ANTHROPIC_API_KEY" `
  -UserName "scenegraphmanager" -Password "sk-ant-..." -Persist LocalMachine

# Verify
(Get-StoredCredential -Target "scenegraphmanager/ANTHROPIC_API_KEY").GetNetworkCredential().Password

# Delete
Remove-StoredCredential -Target "scenegraphmanager/ANTHROPIC_API_KEY"
```

### Supported Keys

| Environment Variable | Provider |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) |
| `OPENAI_API_KEY` | OpenAI |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI |
| `AZURE_OPENAI_EMBEDDINGS_API_KEY` | Azure OpenAI Embeddings |
| `GOOGLE_API_KEY` | Google |

`loadSecrets()` skips any key already present in `process.env`, so deployment-injected values always take precedence.

---

## License Secret Store

SGM loads its license from the OS-native secret store only (no file, no env var, no dev mode in production).
The license JSON is stored under `service=scenegraphmanager`, `key=sgm-license`.

### Issuing a License

```bash
cd ~/Desktop/Work/sgm-license-gen
yarn install
node src/cli.js gen \
  --key keys/master.key \
  --sub "user@example.com" \
  --exp "2027-12-31" \
  --level unlimited \
  --maxConcurrent 0 \
  --maxDurationMin 0
```

The tool outputs compact JSON to stdout and metadata to stderr.
Pipe the JSON into the OS secret store:

**macOS — Keychain**

```bash
# Issue and store in one pipeline
cd ~/Desktop/Work/sgm-license-gen
node src/cli.js gen \
  --key keys/master.key \
  --sub "akudo@localhost" \
  --exp "2027-12-31" \
  --level unlimited \
  --maxConcurrent 0 2>/dev/null \
  | security add-generic-password -a scenegraphmanager -s sgm-license -w

# Verify
security find-generic-password -a scenegraphmanager -s sgm-license -w

# Delete
security delete-generic-password -a scenegraphmanager -s sgm-license
```

**Linux — libsecret (`secret-tool`)**

```bash
# Issue and store (compact JSON on one line)
cd ~/Desktop/Work/sgm-license-gen
node src/cli.js gen \
  --key keys/master.key \
  --sub "akudo@localhost" \
  --exp "2027-12-31" \
  --level unlimited \
  --maxConcurrent 0 2>/dev/null \
  | tr -d '\n' \
  | secret-tool store --label="SGM-License" service scenegraphmanager key sgm-license

# Verify
secret-tool lookup service scenegraphmanager key sgm-license

# Delete
secret-tool clear service scenegraphmanager key sgm-license
```

**Windows — Credential Manager (PowerShell)**

```powershell
# Install helper module (once)
Install-Module -Name CredentialManager -Scope CurrentUser

# Issue and store
cd ~/Desktop/Work/sgm-license-gen
$license = node src/cli.js gen --key keys/master.key --sub "akudo@localhost" --exp "2027-12-31" --level unlimited --maxConcurrent 0 2>$null
$license | Set-StoredCredential -Target "scenegraphmanager/sgm-license"

# Verify
(Get-StoredCredential -Target "scenegraphmanager/sgm-license").GetNetworkCredential().Password

# Delete
Remove-StoredCredential -Target "scenegraphmanager/sgm-license"
```

### Access Levels

| Level | Concurrent Instances | Features |
|---|---|---|
| `development` | 1 | Core workflow only |
| `professional` | 5 | + A2A, MCP |
| `enterprise` | 20 | + management features |
| `unlimited` | 0 (unlimited) | All features |

### How SGM Reads the License

On startup, SGM's injected `license.cjs` calls the OS secret store command:

- **macOS**: `security find-generic-password -a scenegraphmanager -s sgm-license -w`
- **Linux**: `secret-tool lookup service scenegraphmanager key sgm-license`
- **Windows**: `powershell -NoProfile -Command (Get-StoredCredential -Target "scenegraphmanager/sgm-license").GetNetworkCredential().Password`

If the secret is not found, SGM throws a `LicenseError` and refuses to start.

---

## Next Steps

- [docs/WORKFLOW.md](WORKFLOW.md) — JSON workflow structure, node types, custom function nodes
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — Component overview and key source files
- [docs/FEATURES.md](FEATURES.md) — Full feature reference
- [docs/API.md](API.md) — WorkflowEngine API methods and config types
