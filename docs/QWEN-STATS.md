# Qwen Token Stats (Claude Code)

Monitor token usage of the Qwen llama-server when running Claude Code.

## Overview

`qwen-stats` tracks cumulative token consumption by reading the llama-server's `/metrics` endpoint and maintaining a local baseline file. It shows both the all-time total and the delta for the current request.

**Important:** The context window indicator shown in Claude Code's status bar (`ctx:[##--------] 23%`) is **not accurate** when using an external model like Qwen via llama-server. Claude Code estimates context usage based on its own token counting, which does not match the llama-server's actual token consumption. Use `qwen-stats` for the real numbers.

## Usage

```bash
qwen-stats              # Display current statistics
qwen-stats --reset      # Reset local baseline + restart llama-server (clears server-side counters)
```

### Claude Code Slash Command

Create `~/.claude/commands/qwen-stats.md`:

```markdown
# qwen-stats

Display Qwen llama-server token usage.

Execute `qwen-stats` in the terminal and show the output to the user.
```

Then type `/qwen-stats` in any Claude Code session. The command executes and displays token usage inline.

## Output

```
=== Qwen Token Stats ===
Context window: 204800 tokens

Total (all time):
  Prompt:  98574
  Output:  4327
  Sum:     102901 / 204800  (50.2%)

This request:
  Prompt:  +13227
  Output:  +1005
  Sum:     +14232

Reset: qwen-stats --reset
```

## Fields

| Field | Description |
|---|---|
| **Total (all time)** | Cumulative tokens since the llama-server process started. Reset by `qwen-stats --reset` (which restarts the server). |
| **This request** | Delta since the last `qwen-stats` invocation. Reset by `qwen-stats --reset`. |
| **Context window** | Hardcoded constant (`204800`). Must match the server's `--ctx-size` flag. |

## How It Works

1. Reads `/metrics` from the llama-server (`http://localhost:8001/metrics`) to get `llamacpp:prompt_tokens_total` and `llamacpp:tokens_predicted_total`.
2. Loads the previous baseline from `~/.local/share/qwen-stats.json`.
3. Computes the delta (`NEW - OLD`) as "This request".
4. Saves the new cumulative values as the baseline for next time.

## Reset Behavior

`qwen-stats --reset` does two things:

1. **`systemctl restart qwen-server`** — restarts the llama-server, which clears its in-memory `/metrics` counters to zero.
2. **`rm -f "$STATS_FILE"`** — deletes the local baseline file.

The next `qwen-stats` invocation reads fresh zeros from the server, creates a new baseline, and shows the tokens consumed by that first read as "This request".

## Script Source

The script is installed at `~/.local/bin/qwen-stats` and is **not** tracked in this repository.

```bash
#!/bin/bash
#
# Display token usage of Qwen llama-server
#
# Usage:
#   qwen-stats          # Display current statistics
#   qwen-stats --reset  # Reset cumulative counters
#
# Note: llama.cpp v9031 does not provide real-time slot info,
#       so cumulative tokens are tracked via the /metrics endpoint.
#       "Tokens used in the current conversation" is estimated from /metrics accumulators.

SERVER="http://localhost:8001"
STATS_FILE="$HOME/.local/share/qwen-stats.json"
CTX_SIZE=204800

# Load cumulative values from file
load_stats() {
    if [ -f "$STATS_FILE" ]; then
        cat "$STATS_FILE"
    else
        echo '{"prompt_tokens":0,"completion_tokens":0}'
    fi
}

# Save cumulative values
save_stats() {
    echo "$1" > "$STATS_FILE"
}

# Fetch current values from /metrics
fetch_metrics() {
    local metrics
    metrics=$(curl -s "$SERVER/metrics" 2>/dev/null)
    local prompt predict
    prompt=$(echo "$metrics" | grep 'llamacpp:prompt_tokens_total ' | grep -oP '\d+')
    predict=$(echo "$metrics" | grep 'llamacpp:tokens_predicted_total ' | grep -oP '\d+')
    echo "${prompt:-0} ${predict:-0}"
}

# Reset (restart server to clear metrics accumulators)
if [ "$1" = "--reset" ]; then
    systemctl restart qwen-server
    rm -f "$STATS_FILE"
    echo "Qwen stats reset (qwen-server restarted)."
    # Wait a bit for restart to complete
    sleep 2
    exit 0
fi

# Fetch metrics
read -r PROMPT_TOTAL PREDICTED_TOTAL <<< "$(fetch_metrics)"
if [ -z "$PROMPT_TOTAL" ] || [ -z "$PREDICTED_TOTAL" ]; then
    echo "qwen-stats: llama-server not reachable at $SERVER"
    echo "Check: systemctl status qwen-server"
    exit 1
fi

# Load previous baseline
CURRENT=$(load_stats)
OLD_PROMPT=$(echo "$CURRENT" | grep -oP '"prompt_tokens":\K\d+')
OLD_PREDICTED=$(echo "$CURRENT" | grep -oP '"completion_tokens":\K\d+')
NEW_PROMPT=${PROMPT_TOTAL:-0}
NEW_PREDICTED=${PREDICTED_TOTAL:-0}

# Delta for this request
DELTA_PROMPT=$((NEW_PROMPT - OLD_PROMPT))
DELTA_PREDICTED=$((NEW_PREDICTED - OLD_PREDICTED))

# Update baseline
save_stats "{\"prompt_tokens\":$NEW_PROMPT,\"completion_tokens\":$NEW_PREDICTED}"

# Display
TOTAL=$((NEW_PROMPT + NEW_PREDICTED))
PCT=$(awk "BEGIN {printf \"%.1f\", ($PROMPT_TOTAL + $PREDICTED_TOTAL) / $CTX_SIZE * 100}")

echo "=== Qwen Token Stats ==="
echo "Context window: $CTX_SIZE tokens"
echo ""
echo "Total (all time):"
echo "  Prompt:  $NEW_PROMPT"
echo "  Output:  $NEW_PREDICTED"
echo "  Sum:     $TOTAL / $CTX_SIZE  ($PCT%)"
echo ""
echo "This request:"
echo "  Prompt:  +$DELTA_PROMPT"
echo "  Output:  +$DELTA_PREDICTED"
echo "  Sum:     +$((DELTA_PROMPT + DELTA_PREDICTED))"
echo ""
echo "Reset: qwen-stats --reset"
```

## Limitations

- **Context window size is hardcoded** to `204800` in the script. If the server uses a different `--ctx-size`, the percentage will be inaccurate.
- Requires the llama-server to be running and reachable at `http://localhost:8001`. If unreachable, an error is printed.

## Compact command

`/compact` is a Claude Code built-in command that compacts the conversation context and frees the KV cache on the server side.

| Aspect | Detail |
|---|---|
| What it does | Compacts the conversation history, freeing GPU VRAM used by the KV cache |
| When to use | After long conversations, before starting a new session, or when VRAM is running low |
| Server-side effect | The llama-server's KV cache counters reset — equivalent to a server restart from the cache perspective |
| qwen-stats impact | **Always run `qwen-stats --reset` AFTER `/compact`** to sync the local baseline with the server's fresh counters |

**Correct sequence:**

```bash
# 1. In Claude Code: type /compact
# 2. After compact completes:
qwen-stats --reset
```

`qwen-stats --reset` alone is also sufficient to clear both server-side counters and the local baseline — `/compact` is optional if you only want to reset token stats, not free VRAM.

## Claude CLI Integration

The `claude-qwen` alias in `~/.bashrc` connects Claude Code to the local llama-server, enabling token tracking via `qwen-stats`.

```bash
# Primary: llama-server on port 8001 (unsloth/Qwen3.6-35B-A3B)
alias claude-qwen='ANTHROPIC_BASE_URL=http://localhost:8001 ANTHROPIC_API_KEY=sk-no-key-required ANTHROPIC_AUTH_TOKEN=ollama claude --model unsloth/Qwen3.6-35B-A3B'

# MTP variant (multi-token prediction)
alias claude-qwen-mtp='ANTHROPIC_BASE_URL=http://localhost:8001 ANTHROPIC_API_KEY=sk-no-key-required ANTHROPIC_AUTH_TOKEN=ollama claude --model unsloth/Qwen3.6-35B-A3B-MTP'

# Ollama variants (port 11434)
alias claude-qwen35b='ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_API_KEY=sk-no-key-required ANTHROPIC_AUTH_TOKEN=ollama claude --model qwen3.6:35b-a3b'
alias claude-qwen27b='ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_API_KEY=sk-no-key-required ANTHROPIC_AUTH_TOKEN=ollama claude --model qwen3.6:27b'

# GEMMA (for comparison)
alias claude-gemma='ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_API_KEY=sk-no-key-required ANTHROPIC_AUTH_TOKEN=ollama claude --model gemma4:26b'
```

**Which to use:**

| Alias | Backend | Model | Use case |
|---|---|---|---|
| `claude-qwen` | llama.cpp (port 8001) | Qwen3.6-35B-A3B Q4_K_M | Main model — tracked by `qwen-stats` |
| `claude-qwen-mtp` | llama.cpp (port 8001) | Qwen3.6-35B-A3B-MTP | Multi-token prediction — faster output |
| `claude-qwen35b` | Ollama (port 11434) | qwen3.6:35b-a3b | Ollama-hosted (not tracked by `qwen-stats`) |
| `claude-qwen27b` | Ollama (port 11434) | qwen3.6:27b | Ollama-hosted 27B variant |
| `claude-gemma` | Ollama (port 11434) | gemma4:26b | Gemma for comparison / fallback |

**Usage:**

```bash
# Start Claude Code with Qwen via llama-server
claude-qwen

# Token usage will be reflected in qwen-stats
# (via /metrics endpoint on port 8001)
```

**Note:** Only `claude-qwen` and `claude-qwen-mtp` hit the llama-server on port 8001, which is what `qwen-stats` monitors. Ollama-based aliases (`claude-qwen35b`, `claude-qwen27b`, `claude-gemma`) use port 11434 and are not tracked.

## Daemon Setup

### llama-server as a systemd service

The llama-server runs as a systemd service (`qwen-server.service`). The service file is located at `/etc/systemd/system/qwen-server.service`.

**Service file** (`/etc/systemd/system/qwen-server.service`):

```ini
[Unit]
Description=Qwen3.6-35B llama-server (VRAM-optimized)
After=network.target

[Service]
Type=simple
User=akudo
WorkingDirectory=/home/akudo/Desktop/Work
ExecStart=/home/akudo/Desktop/Work/run_qwen.sh

# Auto-restart on crash (exit code != 0)
Restart=on-failure
RestartSec=5
# Stop after 5 failures within 300 seconds (prevent infinite loop)
StartLimitIntervalSec=300
StartLimitBurst=5

# Kill entire process tree (OOM cleanup)
KillMode=control-group
KillSignal=SIGTERM
TimeoutStopSec=10

# Log to journald
StandardOutput=journal
StandardError=journal
SyslogIdentifier=qwen-server

# OOM killer priority
Nice=10
IOSchedulingClass=idle

[Install]
WantedBy=multi-user.target
```

**Management commands:**

```bash
# Start the server
sudo systemctl start qwen-server.service

# Stop the server
sudo systemctl stop qwen-server.service

# Restart (resets metrics counters)
sudo systemctl restart qwen-server.service

# Reload config after editing the service file
sudo systemctl daemon-reload

# Check status
systemctl status qwen-server.service

# View logs
journalctl -u qwen-server.service -f

# Enable auto-start on boot
sudo systemctl enable qwen-server.service
```

### Passwordless sudo for restart (sudoers)

If `sudo` shows `A terminal is required to authenticate`, add a NOPASSWD rule:

```bash
sudo visudo -f /etc/sudoers.d/qwen-server
```

Add one line (save with `:wq` in vim or `Ctrl+O` / `Ctrl+X` in nano):

```
akudo ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart qwen-server.service
```

This limits passwordless access to **only** the restart command. Other `systemctl` operations still require a password.

### Launch script (`run_qwen.sh`)

The systemd service delegates the actual llama-server startup to `/home/akudo/Desktop/Work/run_qwen.sh`.

```bash
#!/bin/bash
#
# llama-server startup script (for systemd)
# Restart, signal handling, and log management are all delegated to systemd
#

set -euo pipefail

MODEL_PATH="/home/akudo/Desktop/Work/unsloth/Qwen3.6-35B-A3B-GGUF/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf"
PORT=8001

# Auto-clear idle KV cache slots + --ctx-size 204800
exec /home/akudo/Desktop/Work/llama.cpp/build/bin/llama-server \
    --model "$MODEL_PATH" \
    --alias "unsloth/Qwen3.6-35B-A3B" \
    -ngl 41 --fit off \
    --temp 0.6 \
    --top-p 0.95 \
    --top-k 20 \
    --min-p 0.00 \
    --port "$PORT" \
    --kv-unified \
    --cache-type-k q8_0 --cache-type-v q8_0 \
    --cache-reuse 512 \
    --cache-idle-slots \
    --flash-attn on \
    --ctx-size 204800 \
    --parallel 3 \
    --metrics
```

**Key configuration:**

| Flag | Value | Purpose |
|---|---|---|
| `--model` | `Qwen3.6-35B-A3B-UD-Q4_K_M.gguf` | Q4_K_M quantized 35B model (3× 8B expert mixture) |
| `-ngl 41` | 41 | GPU layers (offload all layers to VRAM) |
| `--ctx-size` | `204800` | Context window size — must match `CTX_SIZE` in `qwen-stats` |
| `--port` | `8001` | HTTP API port |
| `--metrics` | (enabled) | Exposes Prometheus-style metrics on `/metrics` |
| `--cache-type-k/v` | `q8_0` | KV cache precision (higher precision for stability) |
| `--cache-reuse` | `512` | KV cache reuse interval |
| `--parallel` | `3` | Request parallelism |
| `--fit off` | off | Disable KV cache compaction (required for accurate metrics) |
| `--cache-idle-slots` | enabled | Save and clear idle slot caches on new task (requires `--kv-unified` and unified KV buffer). Works with `/compact` to free VRAM. |

### qwen-stats as a periodic monitoring daemon

To automatically track token usage at regular intervals without manual invocation, set up a systemd timer.

**Step 1 — Create the service unit:**

```bash
sudo tee /etc/systemd/system/qwen-stats.service > /dev/null << 'EOF'
[Unit]
Description=Qwen Token Stats Collector
After=network.target qwen-server.service

[Service]
Type=oneshot
User=akudo
Environment=HOME=/home/akudo
ExecStart=/home/akudo/.local/bin/qwen-stats
EOF
```

**Step 2 — Create the timer unit:**

```bash
sudo tee /etc/systemd/system/qwen-stats.timer > /dev/null << 'EOF'
[Unit]
Description=Run qwen-stats every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF
```

**Step 3 — Enable and start the timer:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now qwen-stats.timer

# Check timer status
systemctl list-timers qwen-stats.timer

# Run once immediately (without scheduling)
sudo systemctl start qwen-stats.service
```

**Step 4 — View collected stats:**

The timer runs `qwen-stats` and logs to journald. View the output:

```bash
journalctl -u qwen-stats.service --no-pager
```

The baseline file `~/.local/share/qwen-stats.json` is updated on each run, so manual `qwen-stats` invocations show the delta from the timer's last run.

### Troubleshooting

| Symptom | Check |
|---|---|
| `qwen-stats: llama-server not reachable` | `systemctl status qwen-server.service`; verify server is running on port 8001 |
| Timer not firing | `systemctl list-timers qwen-stats.timer`; check `journalctl -u qwen-stats.service` |
| Metrics percentage wrong | Verify `--ctx-size` in `run_qwen.sh` matches `CTX_SIZE=204800` in the script |
| Service won't start | `journalctl -u qwen-server.service -n 50 --no-pager` |
