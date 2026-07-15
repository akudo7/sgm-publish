# Scripts

This directory contains utility and CLI scripts for SceneGraphManager.

## start-a2a-server.ts

A2A サーバーを起動する。

```
npx tsx scripts/start-a2a-server.ts --config <config.json> --port <port> [--name <name>]
```

| 引数 | 必須 | 説明 |
|------|------|------|
| `--config` | はい | ワークフロー設定ファイルのパス |
| `--port` | はい | 起動ポート番号 |
| `--name` | いいえ | エージェント名の上書き |

### 起動例（全6サーバー）

e2eテストはポート3001,3002,3003でサーバを起動する事を期待

**Qwen ベース（外部モデル）**

```bash
# Task Creation Agent (port 3001)
npx tsx scripts/start-a2a-server.ts --config ./json/a2a/servers/task-creation-qwen.json --port 3001

# Research Execution Agent (port 3002)
npx tsx scripts/start-a2a-server.ts --config ./json/a2a/servers/research-execution-qwen.json --port 3002

# Quality Evaluation Agent (port 3003)
npx tsx scripts/start-a2a-server.ts --config ./json/a2a/servers/quality-evaluation-qwen.json --port 3003
```

**ローカルモデル版**

```bash
# Task Creation Agent (port 3001)
npx tsx scripts/start-a2a-server.ts --config ./json/a2a/servers/task-creation.json --port 3001

# Research Execution Agent (port 3002)
npx tsx scripts/start-a2a-server.ts --config ./json/a2a/servers/research-execution.json --port 3002

# Quality Evaluation Agent (port 3003)
npx tsx scripts/start-a2a-server.ts --config ./json/a2a/servers/quality-evaluation.json --port 3003
```

名前の上書き例：

```bash
npx tsx scripts/start-a2a-server.ts --config ./json/a2a/servers/task-creation-qwen.json --port 3011 --name MyTaskAgent
```

### 起動後エンドポイント

| エンドポイント | 説明 |
|---------------|------|
| `http://localhost:<port>/.well-known/agent.json` | Agent Card |
| `http://localhost:<port>/` | JSON-RPC エンドポイント |
| `http://localhost:<port>/message/send` | メッセージ送信（`webhookUrl` 指定で非同期） |
| `http://localhost:<port>/tasks` | タスク一覧（`?limit=50&offset=0&status=`） |
| `http://localhost:<port>/tasks/<taskId>` | 単一タスク取得 |
| `http://localhost:<port>/tasks/<taskId>/cancel` | タスクキャンセル |
| `http://localhost:<port>/health` | ヘルスチェック |

> SQLite 永続化により、再起動後もタスク履歴が保持される。`webhookUrl` を指定するとタスク完了時に Webhook 通知が送信される。

## dispatch-server.ts

Dispatch サーバーを起動する。SQLite によるタスク永続化と非同期キュー管理に対応。

```
npx tsx scripts/dispatch-server.ts --config <config.json> --port <port> --db <db-path> [--concurrency 3] [--name <name>]
```

| 引数 | 必須 | 説明 |
|------|------|------|
| `--config` | はい | ワークフロー設定ファイルのパス |
| `--port` | はい | 起動ポート番号 |
| `--db` | いいえ | SQLite DB パス（デフォルト: `./data/dispatch-tasks.db`） |
| `--concurrency` | いいえ | 並列実行数（デフォルト: 3） |
| `--name` | いいえ | エージェント名の上書き |

### 起動例

```bash
npx tsx scripts/dispatch-server.ts --config ./json/your-workflow.json --port 3011
```

### 起動後エンドポイント

| エンドポイント | 説明 |
|---------------|------|
| `http://localhost:<port>/.well-known/agent.json` | Agent Card |
| `http://localhost:<port>/` | JSON-RPC エンドポイント |
| `http://localhost:<port>/message/send` | REST メッセージ送信 |
| `http://localhost:<port>/tasks` | タスク一覧（`?limit=50&offset=0&status=completed`） |
| `http://localhost:<port>/tasks/<taskId>` | 単一タスク取得 |
| `http://localhost:<port>/tasks/<taskId>/cancel` | タスクキャンセル |
| `http://localhost:<port>/slack-webhook/<channel>/<ts>` | Slack 完了通知（内部用） |
| `http://localhost:<port>/telegram-webhook/<chatId>/<messageId>` | Telegram 完了通知（内部用） |
| `http://localhost:<port>/health` | ヘルスチェック |

## slack-dispatch-bot.ts

Slack App を介して Dispatch Server にタスクを投入する Bot。DM またはチャンネルでのメンションを受け付け、完了結果をスレッドに返信する。

```bash
npx tsx scripts/slack-dispatch-bot.ts
```

必要な環境変数:

| 変数 | 説明 |
|------|------|
| `SLACK_BOT_TOKEN` | Bot Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Signing Secret |
| `SLACK_APP_TOKEN` | App-Level Token (`xapp-...`, Socket Mode 用) |
| `DISPATCH_SERVER_URL` | Dispatch Server URL（デフォルト: `http://localhost:3011`） |

## telegram-dispatch-bot.ts

Telegram Bot を介して Dispatch Server にタスクを投入する Bot。long polling でメッセージを監視。

```bash
npx tsx scripts/telegram-dispatch-bot.ts
```

必要な環境変数:

| 変数 | 説明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Bot Token（BotFather から取得） |
| `DISPATCH_SERVER_URL` | Dispatch Server URL（デフォルト: `http://localhost:3011`） |

## send-a2a-message.ts

実行中の A2A サーバーにメッセージを送信し、レスポンスを表示する。

```
npx tsx scripts/send-a2a-message.ts --url <url> --message <message> [--timeout 60000] [--output text|json]
```

| 引数 | 必須 | 説明 |
|------|------|------|
| `--url` | はい | A2A サーバーのベース URL |
| `--message` | はい | 送信するメッセージ |
| `--timeout` | いいえ | タイムアウト（ms、デフォルト: 60000） |
| `--output` | いいえ | 出力形式 `text` または `json`（デフォルト: text） |

### 使用例

```bash
# テキスト形式で結果を表示（デフォルト）
npx tsx scripts/send-a2a-message.ts \
  --url http://localhost:3011 \
  --message "タスクリストを作成してください"

# JSON 形式でフルレスポンスを表示
npx tsx scripts/send-a2a-message.ts \
  --url http://localhost:3011 \
  --message "タスクリストを作成してください" \
  --output json

# タイムアウト延長（180秒）
npx tsx scripts/send-a2a-message.ts \
  --url http://localhost:3011 \
  --message "タスクリストを作成してください" \
  --timeout 180000

# ローカルモデル版へ送信
npx tsx scripts/send-a2a-message.ts \
  --url http://localhost:3001 \
  --message "タスクリストを作成してください"
```

## autoresearch.ts

AutoResearch orchestrator — autonomous SKILL.md improvement loop. Karpathy's autoresearch philosophy applied to SceneGraphManager.

```bash
npx tsx scripts/autoresearch.ts                          # default: 100 iterations
npx tsx scripts/autoresearch.ts --iterations 50          # custom iterations
npx tsx scripts/autoresearch.ts --dry-run --iterations 3 # dry run (no SKILL.md changes)
```

### 概要

1. ワークフローを実行 → `reflect_node` が SKILL.md を更新
2. eval harness で `successRate` を測定
3. スコアが低下 → `git checkout skills/` でロールバック
4. 差分を記録して継続

## debug-grep-tool.ts

`grep_search` ツールの動作を直接テストするデバッグスクリプト。

```bash
npx tsx scripts/debug-grep-tool.ts
```

## obfuscate.js

`dist/` 配下の JS ファイルを難読化し、配布用 tgz を生成するスクリプト。`package.json` の `"obfuscate"` / `"package"` スクリプトから呼び出される。

```bash
yarn obfuscate    # dist/ 難読化
yarn package      # 難読化 + tgz 打包
```

## Related Files

- Workflow engine: [src/lib/workflow.ts](../src/lib/workflow.ts)
- A2A protocol: [src/a2a/](../src/a2a/)
- Skills system: [src/lib/skills/](../src/lib/skills/)

## License

MIT License with team subscription requirements. See [LICENSE](../LICENSE).

---

## 移行履歴

| 変更日 | 内容 |
|--------|------|
| 2026-05-16 | `dispatch-server.ts`, `slack-dispatch-bot.ts`, `telegram-dispatch-bot.ts` の説明を追加（Phase 2/3）。`start-a2a-server.ts` に SQLite 永続化・ページネーション・Webhook 通知機能を追記 |
| 2026-05-16 | `test-model-interrupt.ts`, `test-skills-with-claude-tools.ts` を削除（E2Eで代替）。`test-skills-manager.mjs` を `test/unit/skills-manager.test.js` に移動（jest テストに書き直し）。`test:skills`, `test:skills-workflow`, `test:model-interrupt` スクリプトを削除、`test:unit` を追加 |
| 2026-04-30 | ファイル削除可否調査（E2Eテスト実装後） |
