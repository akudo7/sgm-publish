# Memento-Skills & AutoResearch

---

## Memento-Skills Pattern (Self-Improving Workflows)

Implements the Write phase of "Memento-Skills: Let Agents Design Agents". Each execution appends lessons to SKILL.md, forming a Read → Execute → Write loop.

```
Task Input
    ↓
[Read] injectSkillsPromptIfNeeded() → SKILL.md injected into system prompt
    ↓
[Execute] planner_node → worker_node(s) → finalize_node
    ↓
[Write] reflect_node → analyze results → edit_file appends to SKILL.md
    ↓
Next run uses the updated SKILL.md (continuous improvement)
```

### Key Nodes

1. **`planner_node`** — Classifies task domain and generates worker plans with domain-aware skill routing
2. **`worker_node`** — Executes tasks with domain context and relevant skill constraints
3. **`reflect_node`** — Post-execution reflection: analyzes `workerPlans` + `workerResults`, appends lessons to SKILL.md `## Learned Patterns` via `edit_file`

### Domain Classification

`planner_node` classifies tasks into `research` / `coding` / `writing` / `analysis` / `general` and uses `domainSkillsMap` to inject only the relevant skills into `worker_node`, suppressing unrelated skill prompts.

**Reference:** [`json/teams/leader.json`](../json/teams/leader.json)

---

## AutoResearch (Autonomous Skill Improvement Loop)

Applies Karpathy's autoresearch philosophy to SceneGraphManager: iteratively improves SKILL.md on a training loop, validates generalization on a separate holdout set, then auto-commits or rolls back.

```
[Iterative loop]
  planner_node → generate SKILL.md → registerSkill()
       ↓ Send fan-out
  worker_node × N (parallel execution)
       ↓ fan-in
  aggregator → finalize → reflect_node (update SKILL.md)
       ↓
  eval harness measures successRate
       ↓
  accept (score improves) / rollback (score degrades)
       ↓
[After N iterations]
  holdout validation → commit if improved / rollback if not
```

### Reward Hacking Detection

| Condition | Warning |
|---|---|
| train/holdout score divergence > 0.2 | Possible overfitting |
| SKILL.md bloat > 50 lines/iteration | Possible meaningless padding |
| Repeated diff patterns | Possible copy-paste inflation |

### Commands

```bash
# Run autoresearch (50 iterations)
tsx scripts/autoresearch.ts --iterations 50

# Custom workflow and directories
tsx scripts/autoresearch.ts --workflow json/teams/leader-qwen.json \
  --eval-dir eval/train --holdout-eval-dir eval/holdout

# Dry run (no SKILL.md changes)
tsx scripts/autoresearch.ts --dry-run --iterations 3
```

### Directory Structure

| Path | Description |
|---|---|
| `eval/train/` | Training tasks (5 per skill, used by reflect_node) |
| `eval/holdout/` | Holdout tasks (3 per skill, different phrasing, final validation only) |
| `logs/autoresearch/` | Per-iteration logs (`summary.jsonl`, `holdout_result.json`) |

**Reference:** [`scripts/autoresearch.ts`](../scripts/autoresearch.ts), [`eval/harness.ts`](../eval/harness.ts)
