# Skills Feature User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Creating Skills](#creating-skills)
4. [Using Skills in Workflows](#using-skills-in-workflows)
5. [Claude Code Tools Reference](#claude-code-tools-reference)
6. [Advanced Topics](#advanced-topics)
7. [Examples](#examples)
8. [FAQ](#faq)

## Introduction

The Skills feature transforms SceneGraphManager into a modular, extensible AI workflow system. Skills are reusable, declarative instructions that AI agents can discover and execute dynamically.

### What Are Skills?

Skills are:

- **Declarative**: Defined as markdown files with YAML metadata
- **Discoverable**: Automatically found in the skills directory
- **Reusable**: Shared across workflows and projects
- **Extensible**: Easy to create custom skills

### Why Use Skills?

- **Modularity**: Break complex tasks into manageable skills
- **Shareability**: Distribute skills as directories
- **Consistency**: Standardize common operations
- **Maintainability**: Update skills independently

## Quick Start

### Step 1: Enable Skills per Model

Add `skills` configuration to the model that should have access to skills:

```json
{
  "models": [
    {
      "id": "agent_model",
      "type": "anthropic",
      "config": {
        "model": "claude-sonnet-4-5-20250929",
        "apiKey": "${ANTHROPIC_API_KEY}"
      },
      "bindSystemSkills": true,
      "skills": {
        "enabled": true,
        "skillsPath": "skills"
      }
    }
  ]
}
```

### Step 2: Bind Claude Code Tools

`bindSystemSkills: true` binds the built-in Claude Code-style tools (`read_file`/`write_file`/`bash_command`/etc.) to a model, but it has no effect on its own — it also requires `skills.enabled: true` on that same model (the `skills` block doubles as the shared filesystem config the tools use):

```json
{
  "models": [
    {
      "id": "claude",
      "type": "anthropic",
      "config": {
        "model": "claude-3-5-sonnet-20241022",
        "apiKey": "${ANTHROPIC_API_KEY}"
      },
      "bindSystemSkills": true,
      "skills": {
        "enabled": true,
        "skillsPath": "skills"
      }
    }
  ]
}
```

### Step 3: Create a Skill

```bash
mkdir -p skills/my-skill
```

Create `skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: My first custom skill
---

# My Skill

This skill demonstrates basic functionality.

## Instructions

1. Use the read_file tool to read a file
2. Process the content
3. Return results to user
```

### Step 4: Run Workflow

```typescript
import { WorkflowEngine } from '@kudos/scene-graph-manager';

const config = {
  // ... your config with skills enabled
};

const engine = new WorkflowEngine(config);
await engine.build();

const result = await engine.invoke({
  messages: [{ role: "user", content: "Use my-skill to process data.txt" }]
});
```

## Creating Skills

### Skill Anatomy

```
skills/
  └── skill-name/
      ├── SKILL.md           # Required: Skill definition
      ├── implementation.ts  # Optional: Script
      ├── test.ts           # Optional: Tests
      └── README.md         # Optional: Extra docs
```

### SKILL.md Structure

#### Frontmatter (Required)

```yaml
---
name: skill-identifier
description: One-line description shown to agent
---
```

**Rules**:

- `name`: Lowercase, kebab-case (e.g., `arxiv-search`)
- `description`: Max 100 characters, concise

#### Content Sections (Recommended)

1. **Title and Overview**: What the skill does
2. **When to Use**: Specific use cases
3. **Instructions**: Step-by-step agent guidance
4. **Examples**: Concrete invocations
5. **Notes**: Limitations, tips, warnings

### Example: Weather Skill

```markdown
---
name: weather-lookup
description: Get current weather for a location using wttr.in
---

# Weather Lookup Skill

Retrieve current weather information for any location.

## When to Use This Skill

Use when users ask about:

- Current weather conditions
- Temperature in a city
- Weather forecasts

## Instructions

1. Extract location from user query
2. Use web_fetch tool to get weather:
   ```
   web_fetch("https://wttr.in/<location>?format=j1")
   ```
3. Parse JSON response
4. Present weather data to user

## Examples

### Example 1: Tokyo weather

```
web_fetch("https://wttr.in/Tokyo?format=j1")
```

### Example 2: New York weather

```
web_fetch("https://wttr.in/New_York?format=j1")
```

## Notes

- wttr.in is a free service, no API key required
- Location names should use underscores for spaces
- Returns JSON when format=j1 parameter is used
```

### Skill Best Practices

#### Do's

✅ **Be Specific**: Provide exact commands and tool names
✅ **Include Examples**: Show concrete usage
✅ **Handle Errors**: Describe failure scenarios
✅ **Test Thoroughly**: Verify instructions work
✅ **Document Limitations**: Note edge cases

#### Don'ts

❌ **Vague Instructions**: "Search for something online"
❌ **Assume Knowledge**: Explain all parameters
❌ **Skip Examples**: Always include at least one
❌ **Ignore Errors**: Address what can go wrong
❌ **Overcomplicate**: Keep instructions simple

## Using Skills in Workflows

### Model-Level Tool Binding

All nodes using this model get Claude Code tools:

```json
{
  "models": [
    {
      "id": "claude",
      "type": "anthropic",
      "bindSystemSkills": true,
      "skills": { "enabled": true, "skillsPath": "skills" },
      "config": { ... }
    }
  ],
  "nodes": [
    { "id": "agent1", "modelRef": "claude" },
    { "id": "agent2", "modelRef": "claude" }
  ]
}
```

Both `agent1` and `agent2` have tools.

### Node-Level Tool Binding

Only specific nodes get tools:

```json
{
  "models": [
    {
      "id": "claude",
      "type": "anthropic",
      "skills": { "enabled": true, "skillsPath": "skills" },
      "config": { ... }
    }
  ],
  "nodes": [
    {
      "id": "agent1",
      "modelRef": "claude",
      "useSystemSkills": true
    },
    {
      "id": "agent2",
      "modelRef": "claude"
    }
  ]
}
```

`skills.enabled` on the model makes its tools available to bind; leaving model-level `bindSystemSkills` unset (or `false`) and setting node-level `useSystemSkills: true` only on `agent1` binds tools to that node's model instance specifically — `agent2` shares the same underlying model but is unaffected. If `bindSystemSkills: true` were also set on the model, tools would bind once at the model level and every node referencing it (including `agent2`) would get them. Only `agent1` has tools.

### Combining with MCP and A2A

Skills work alongside existing tool systems:

```json
{
  "models": [
    {
      "id": "claude",
      "type": "anthropic",
      "bindMcpServers": ["filesystem"],
      "bindA2AClients": ["research-agent"],
      "bindSystemSkills": true,
      "skills": { "enabled": true, "skillsPath": "skills" },
      "config": { ... }
    }
  ]
}
```

Agent has access to:

- MCP filesystem tools
- A2A research agent
- Claude Code tools
- Skills

### Disabling Skills Prompt Injection per Node

By default, the Skills prompt is injected into the first message of every node
that processes it. To skip injection for a specific node, set
`injectSkillsPrompt: false`:

```json
{
  "nodes": [
    {
      "id": "leader_node",
      "modelRef": "claude",
      "injectSkillsPrompt": false
    },
    {
      "id": "worker_node",
      "modelRef": "claude"
    }
  ]
}
```

`leader_node` will not receive the Skills prompt; `worker_node` will receive it
as normal. This is useful when a node acts as an orchestrator that delegates
skill execution to downstream nodes.

## Claude Code Tools Reference

### 1. read_file

**Purpose**: Read file contents with line numbers

**Parameters**:

- `file_path` (string): File path (absolute or relative)
- `offset` (number, optional): Start line
- `limit` (number, optional): Number of lines (default: 2000)

**Example**:

```json
{
  "file_path": "src/index.ts",
  "offset": 10,
  "limit": 50
}
```

**Output**:

```
11→import { WorkflowEngine } from './lib/workflow.js';
12→import { WorkflowConfig } from './types/index.js';
...
```

### 2. write_file

**Purpose**: Create or overwrite files

**Parameters**:

- `file_path` (string): File path
- `content` (string): File content

**Example**:

```json
{
  "file_path": "output.txt",
  "content": "Hello, World!"
}
```

**Output**: `"ファイルを書き込みました: output.txt"`

### 3. edit_file

**Purpose**: Replace strings in files

**Parameters**:

- `file_path` (string): File path
- `old_string` (string): String to replace (must be unique)
- `new_string` (string): Replacement string
- `replace_all` (boolean, optional): Replace all occurrences

**Example**:

```json
{
  "file_path": "config.json",
  "old_string": "\"enabled\": false",
  "new_string": "\"enabled\": true"
}
```

**Output**: `"ファイルを編集しました: config.json"`

### 4. glob_files

**Purpose**: Find files by pattern

**Parameters**:

- `pattern` (string): Glob pattern (e.g., `**/*.ts`)
- `search_path` (string, optional): Directory to search

**Example**:

```json
{
  "pattern": "src/**/*.ts"
}
```

**Output**:

```
/path/to/src/index.ts
/path/to/src/lib/workflow.ts
...
```

### 5. grep_search

**Purpose**: Search file contents

**Parameters**:

- `pattern` (string): Regex pattern
- `search_path` (string, optional): File or directory
- `glob_pattern` (string, optional): File filter
- `case_insensitive` (boolean, optional): Ignore case

**Example**:

```json
{
  "pattern": "SkillsManager",
  "glob_pattern": "*.ts"
}
```

**Output**:

```
src/lib/skills/SkillsManager.ts:export class SkillsManager {
src/lib/workflow.ts:import { SkillsManager } from './skills/SkillsManager.js';
```

### 6. bash_command

**Purpose**: Execute shell commands

**Parameters**:

- `command` (string): Bash command
- `description` (string, optional): Command description
- `timeout` (number, optional): Timeout in ms (default: 120000)

**Example**:

```json
{
  "command": "git status",
  "description": "Check git status"
}
```

**Output**: Git status output

**Safety Notes**:

- Avoid destructive commands (rm -rf, etc.)
- Use dedicated tools for file operations
- Set appropriate timeouts

### 7. web_fetch

**Purpose**: Fetch content from URLs

**Parameters**:

- `url` (string): URL to fetch
- `maxLength` (number, optional): Max characters (default: 50000)

**Example**:

```json
{
  "url": "https://api.example.com/data",
  "maxLength": 10000
}
```

**Output**: Response content (truncated if too large)

**Notes**:

- HTTP auto-upgraded to HTTPS
- Does not handle authentication
- Returns HTML as-is (no conversion)

## Advanced Topics

### Custom FilesystemBackend

Configure backend behavior per model:

```json
{
  "models": [
    {
      "id": "agent_model",
      "type": "anthropic",
      "config": { "model": "claude-sonnet-4-5-20250929" },
      "bindSystemSkills": true,
      "skills": {
        "enabled": true,
        "skillsPath": "skills",
        "backend": {
          "virtualMode": false,
          "rootDir": "/custom/root"
        }
      }
    }
  ]
}
```

### Programmatic Skills Access

Access skills from code. Use `getSkillsManager(modelId)` for per-model access:

```typescript
const engine = new WorkflowEngine(config);
await engine.build();

// Get skills for a specific model
const skillsManager = engine.getSkillsManager('agent_model');
const skills = skillsManager?.getSkills();

console.log(`Discovered ${skills?.length} skills`);
skills?.forEach(skill => {
  console.log(`- ${skill.name}: ${skill.description}`);
});

const arxivSkill = skillsManager?.getSkillByName('arxiv-search');
console.log(arxivSkill?.instructions);
```

### Testing Skills

Create tests for your skills:

```typescript
// skills/my-skill/test.ts
import { describe, it, expect } from '@jest/globals';
import { execSync } from 'child_process';

describe('my-skill', () => {
  it('should execute correctly', () => {
    const result = execSync('npx tsx skills/my-skill/script.ts "test"', {
      encoding: 'utf-8'
    });
    expect(result).toContain('Success');
  });
});
```

## Examples

### Example 1: arXiv Search

**SKILL.md**: [skills/arxiv-search/SKILL.md](../skills/arxiv-search/SKILL.md)

**Usage**:

```
User: Search arXiv for papers about transformers

Agent:
1. Recognizes "arxiv-search" skill
2. Reads skills/arxiv-search/SKILL.md
3. Executes: bash_command("npx tsx skills/arxiv-search/arxiv_search.ts 'transformers' --max-papers 5")
4. Returns results to user
```

### Example 2: LangGraph Docs

**SKILL.md**: [skills/langgraph-docs/SKILL.md](../skills/langgraph-docs/SKILL.md)

**Usage**:

```
User: How do I create a StateGraph in LangGraph?

Agent:
1. Recognizes "langgraph-docs" skill
2. Reads skills/langgraph-docs/SKILL.md
3. Executes: web_fetch("https://langchain-ai.github.io/langgraphjs/concepts/low_level/#stategraph")
4. Parses documentation
5. Explains StateGraph creation to user
```

### Example 3: Custom Workflow Skill

Create a skill for your specific workflow:

```markdown
---
name: deploy-app
description: Deploy application to production
---

# Deploy Application Skill

Deploy the current application to production environment.

## Instructions

1. Run tests:
   ```
   bash_command("yarn test")
   ```

2. Build application:
   ```
   bash_command("yarn build")
   ```

3. Deploy:
   ```
   bash_command("yarn deploy --env production")
   ```

4. Verify deployment:
   ```
   web_fetch("https://app.example.com/health")
   ```

5. Report status to user

## Safety

- Always run tests before deploy
- Verify health endpoint after deploy
- Rollback if health check fails
```

## FAQ

### Q: Can I use skills without Claude Code tools?

**A**: Skills are designed to work with Claude Code tools. However, you can create skills that only use MCP or A2A tools if those are bound instead.

### Q: How many skills can I have?

**A**: No hard limit, but keep it reasonable. Large numbers of skills increase prompt size.

### Q: Can skills call other skills?

**A**: Yes! Skills can instruct the agent to use other skills.

### Q: Are skills cached?

**A**: Yes, skills are discovered once during `build()` and cached.

### Q: Can I hot-reload skills?

**A**: Not currently. Rebuild the workflow to pick up changes.

### Q: Do skills work with streaming?

**A**: Yes, skills work with both `invoke()` and `stream()` modes.

### Q: Can I version skills?

**A**: Yes! Commit skills to git or distribute as packages.

### Q: Are skills sandboxed?

**A**: Skills execute through tools, which have some safety checks. Review bash_command usage carefully.

---

**Need Help?**

- Report issues: [GitHub Issues](https://github.com/your-org/scene-graph-manager/issues)
- Documentation: [CLAUDE.md](../CLAUDE.md)
- Examples: [json/skills.json](../json/skills.json)
