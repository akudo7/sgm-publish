# SceneGraphManager 公式ドキュメント ナビゲーション

## ドキュメントマップ

質問のカテゴリに応じて以下のファイルを read_file で取得すること。

**重要 — パス指定ルール**: 上記テーブルのパスはすべてプロジェクトルート基準。
- 正しい例: `read_file("docs/FEATURES.md")` / `read_file("docs/QUICK-START.md")` / `read_file("docs/API.md")`
- 誤った例: `read_file("skills/sgm-docs/docs/FEATURES.md")` ← `skills/sgm-docs/` プレフィックスは **絶対に付けない**
このルールは `docs/` 以下の **全ファイル** に適用される。

| カテゴリ | 参照ファイル | 主なトピック |
|---|---|---|
| インストール・初期設定・インスタンス作成 | docs/QUICK-START.md | yarn add, 最小構成サンプル, 必須依存, WorkflowEngine インスタンス作成, apiKey 設定, loadSecrets, OSキーチェーン, macOS Keychain, Linux libsecret, Windows Credential Manager, .env 非対応 |
| アーキテクチャ・主要ファイル・フォルダ構成 | docs/ARCHITECTURE.md | コンポーネント図, Key Files 一覧, プロジェクト構造, eval/, json/, scripts/, works/, test/e2e/, src/ |
| ワークフロー JSON 設計・ノード・エッジ | docs/WORKFLOW.md | ノード型, 状態定義, カスタム関数ノード, スコープ変数, Send, ファンアウト, fan-out, 並列実行, __send__, __registerA2AAgent, multi-model, 複数モデル |
| 全機能リファレンス | docs/FEATURES.md | Context Compression, Context Guard, Sprint Contract, Skills, MCP, A2A, PII, Hooks, addEventListener, HookFeedback, preToolUse, postToolUse, postToolUseFailure, sessionStart, userPromptSubmit, イベント, SourceHunt, Memento-Skills, AutoResearch, Dispatch, read_file, write_file, edit_file, glob_files, grep_search, bash_command, web_fetch, write_todos, read_todos, llama.cpp, GGUF, RTK, protectedPaths, excludeDirs, excludeTools, injectSkillsPrompt, bearerToken, useDiscoveredAgents, structured output, セキュリティ, MemorySaver, チェックポイント, 会話履歴, thread_id |
| API リファレンス | docs/API.md | WorkflowEngine メソッド, Config 型定義, NodeBase フィールド, ToolNodeConfig, A2AClientConfig, getUsageStats, WorkflowUsageStats, drawGraph, excludeTools, injectSkillsPrompt, useDiscoveredAgents, bearerToken, bearerTokenEnvVar |
| コード例 | docs/EXAMPLES.md | 条件分岐, マルチエージェント, カスタム state, PII 設定例 |
| Dispatch・Slack・Telegram・リモート実行 | docs/DISPATCH.md | HTTP API, 起動手順, エンドポイント一覧, dispatch-server, slack-dispatch-bot, telegram-dispatch-bot, webhook, SQLite, AsyncTaskQueue, A2A互換, Agent Card |
| Memento-Skills・AutoResearch・自己改善 | docs/MEMENTO-SKILLS.md | reflect_node, ドメイン分類, 自律改善ループ, eval/train, eval/holdout, autoresearch.ts, eval/harness.ts, Reward Hacking |
| kudosflow2・OpenAgentJson 連携 | docs/INTEGRATION.md | VSCode 拡張, JSON インポート手順 |
| テスト実行 | docs/TESTING.md | yarn test, yarn test:e2e, E2E テスト, シナリオ一覧, invoke try/catch |
| エラー対処・デバッグ | docs/TROUBLESHOOTING.md | よくある問題と解決策, API キー認識されない, read_file パス誤解釈, docデバッグ |

## 公開 API クイックリファレンス

### WorkflowEngine

```typescript
const engine = new WorkflowEngine(config);
await engine.build();
const result = await engine.invoke(input, options?);
for await (const update of engine.stream(input)) { ... }
engine.addEventListener(handler);  // HookFeedback を返すことで tool 呼び出しを制御
const stats = engine.getUsageStats();  // WorkflowUsageStats — トークン使用量集計
```

### 設定 JSON 最小構造

```jsonc
{
  "config": { "name": "...", "recursionLimit": 25 },
  "stateAnnotation": { "name": "WorkflowState", "type": "Annotation.Root" },
  "annotation": {
    "messages": { "type": "BaseMessage[]", "reducer": "(x, y) => x.concat(y)", "default": "[]" }
  },
  "models": [{ "id": "claude", "type": "anthropic", "config": { "model": "...", "apiKey": "..." } }],
  "nodes": [...],
  "edges": [...],
  "stateGraph": { "annotationRef": "WorkflowState" }
}
```

### ノード型

| type | 用途 |
|---|---|
| `model` | LLM 呼び出し（`modelRef`, `useSystemSkills`, `injectSkillsPrompt`） |
| `tool` | MCP/A2A ツール実行（`excludeTools`, `useDiscoveredAgents`） |
| `custom` | JavaScript 関数（`handler.function`） |

## 使用上の注意

- **ソースコードが最優先**: docs と src/ で矛盾がある場合は src/ の実装を信頼すること
- **docs/ に記載がない場合**: src/ の該当ファイルを read_file / grep_search で確認し、見つからなければ「公開ドキュメントに記載がありません」と回答すること
