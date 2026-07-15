# SGM Consulting Bot v2 — Integration

SGM コンサルティングボット v2 の本番統合環境。  
`works/sgm-consulting-v2/training/` で改善された `consult_prompt.txt` を使い、Slack 運用を強化。

---

## v1 からの変更点

| 項目 | v1 | v2 |
|------|----|----|
| エスカレーショントリガー | turn_count ≥ 3 | **turn_count ≥ 6** |
| エスカレーション後の動作 | 後続メッセージにも回答し続ける | **回答停止・「エスカレーション済み」通知** |
| 3日自動クローズ | なし | **最終活動から 72h で自動クローズ** |
| クローズ後の再開 | なし | **次メッセージで自動再オープン** |
| consult_prompt | v1 固定 | **training の訓練済みプロンプト（自動改善）** |
| スレッド状態管理 | なし | **SQLite threads テーブルで永続化** |
| 対話履歴 | なし | **conversation 履歴で多ターン対応** |
| 検証ステップ | なし | **回答生成のみ（検証は行わない）** |

---

## アーキテクチャ

```
Slack メッセージ
    ↓
slack-dispatch-bot-v2.ts
    ↓ POST /message/send + webhookUrl
dispatch-server-v2.ts
    ├─ threads テーブル確認
    │   ├─ escalated_at あり  → 「エスカレーション済み」通知のみ（invoke なし）
    │   ├─ 72h 超過          → クローズ通知のみ（invoke なし）
    │   └─ closed_at あり    → 再オープン通知 → invoke
    ├─ last_activity_at 更新
    └─ WorkflowEngine.invoke()
            ↓
    sgm-chat-guard-v2.json
    └─ respond_node → guard_node → [rewrite] → evaluate_node → decide_node
                                                                    ├─ close   → __end__
                                                                    ├─ turn≥6  → escalate_node
                                                                    └─ continue → respond_node
            ↓ webhook callback
dispatch-server-v2.ts /slack-webhook/:channel/:ts
    ├─ escalated=true → threads.escalated_at 記録 → Slack 通知
    └─ 通常回答       → Slack 投稿
```

---

## ワークフロー詳細（sgm-chat-guard-v2.json）

| ノード | モデル | 役割 |
|--------|--------|------|
| `respond_node` | Qwen3.6-35B-A3B (temp=0.3) | 訓練済み consult_prompt で回答生成（ツール呼び出し対応） |
| `guard_node` | ルールベース | PATH_LEAK / INTERNAL_SYMBOL / INTERNAL_SYMBOLS / IMPLEMENTATION_DETAIL / CODE_STRUCTURE を検出 |
| `rewrite_node` | Qwen3.6-35B-A3B (temp=0.1) | guard 違反を修正（最大3回） |
| `evaluate_node` | Qwen3.6-35B-A3B (temp=0.1) | accuracy / usefulness / clarity / leak_score を評価、close フラグ設定 |
| `decide_node` | ルールベース | close → __end__ / turn≥6 → escalate / otherwise → respond |
| `escalate_node` | ルールベース | escalated=true を返す |

**ルーティング（decide_node）:**

```
leak_score >= 1               → escalate_node  （LLM審査で漏洩検出）
guard.safe == false           → escalate_node
close == true                 → __end__  （正常クローズ）
turn_count >= 6               → escalate_node
otherwise                     → respond_node（次ターン）
```

**guard → evaluate フロー:**

```
guard safe  → evaluate_node → leak_score=0 → decide_node
guard unsafe → rewrite → guard → ...（最大3回）
              → evaluate_node → leak_score=1 → escalate_node
                              → leak_score=0 → decide_node
```

---

## スレッド状態管理（dispatch-server-v2.ts）

`dispatch-tasks-v2.db` 内の `threads` テーブルで管理:

| カラム | 型 | 説明 |
|--------|-----|------|
| `threadId` | TEXT PK | `slack-{channel}-{rootTs}` |
| `escalated_at` | INTEGER | エスカレーション発生時刻（unix ms） |
| `last_activity_at` | INTEGER | 最終メッセージ受信時刻（unix ms） |
| `closed_at` | INTEGER | タイムアウトクローズ時刻（unix ms） |

**状態遷移:**

```
[新規] ──メッセージ──→ [open] ──エスカレーション──→ [escalated]（再オープン不可）
                          │
                      72h 無活動
                          ↓
                      [closed by timeout]
                          │
                     次メッセージ受信
                          ↓
                      [open]（再オープン）
```

**スレッド状態確認:**
```bash
curl http://localhost:3012/threads/slack-{channel}-{rootTs}
```

---

## ファイル構成

```
works/sgm-consulting-v2/integration/
├── json/
│   └── sgm-chat-guard-v2.json   ← ワークフロー定義（6ターン制）
├── run.ts                        ← ローカルテスト用ランナー
└── README.md

scripts/
├── dispatch-server-v2.ts         ← HTTP サーバー（スレッド状態管理付き）
└── slack-dispatch-bot-v2.ts      ← Slack Bot（v2 サーバーに接続）

works/sgm-consulting-v2/training/
└── prompts/consult_prompt.txt    ← 訓練で継続改善されるプロンプト
```

---

## 起動

```bash
# 1. llama.cpp サーバー確認（どこからでも可）
curl http://localhost:8001/health   # → {"status":"ok"}
```

```bash
# 2. Dispatch Server v2 起動【ターミナル A】
cd ~/Desktop/Work/SceneGraphManager
node_modules/.bin/tsx scripts/dispatch-server-v2.ts \
  --config works/sgm-consulting-v2/integration/json/sgm-chat-guard-v2.json \
  --port 3012 \
  --db ./data/dispatch-tasks-v2.db
# → "Dispatch Server v2 ready on port 3012" が表示されたら起動完了
```

```bash
# 3. Slack Bot v2 起動【ターミナル B（別ターミナル）】
cd ~/Desktop/Work/SceneGraphManager
DISPATCH_SERVER_URL_V2=http://localhost:3012 \
  node_modules/.bin/tsx scripts/slack-dispatch-bot-v2.ts
# → "Slack Dispatch Bot v2 is running → http://localhost:3012" が表示されたら接続完了
```

**環境変数:**

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `DISPATCH_SERVER_URL_V2` | `http://localhost:3012` | v2 サーバー URL |
| `SLACK_BOT_TOKEN` | — | `xoxb-...` |
| `SLACK_SIGNING_SECRET` | — | Slack Signing Secret |
| `SLACK_APP_TOKEN` | — | `xapp-...`（Socket Mode） |
| `SLACK_BOT_TOKEN` | — | Slack 投稿用（dispatch-server-v2 も使用） |

---

## ローカルテスト（run.ts）

```bash
# プロジェクトルートで実行すること
cd ~/Desktop/Work/SceneGraphManager

# デフォルト質問で実行
node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts

# 質問を指定
INITIAL_QUESTION="A2A連携の設定方法を教えてください" \
  node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts

# 複数ターン（同じthreadIdで連続実行）
INITIAL_QUESTION="インスタンスの作り方
続きを表示
apiKeyの設定方法" \
  node_modules/.bin/tsx works/sgm-consulting-v2/integration/run.ts
```

正常終了時の出力例:
```
[guard] safe | score: 1.00
[evaluate] quality: {"accuracy":5,"usefulness":5,"clarity":5} | leak_score: 0 | close: true
[decide] turn_count: 1 | close: true | leak_score: 0
→ __end__（1ターンで正常クローズ）
```

漏洩検出時の出力例:
```
[guard] issues: PATH_LEAK | score: 0.75
[rewrite] rewrite_count: 1
[guard] safe | score: 1.00
[evaluate] quality: {"accuracy":4,"usefulness":4,"clarity":4} | leak_score: 1 | close: false
[decide] turn_count: 1 | close: false | leak_score: 1
→ escalate_node（LLM審査で漏洩検出）
```

---

## 注意事項

- `dispatch-server-v2.ts` は v1（port 3011）と**別ポート（3012）**で起動すること
- `consult_prompt.txt` は `training/` の訓練サイクルが完了するたびに自動更新される（holdout 改善時のみ git commit）
- `threads` テーブルは `dispatch-tasks-v2.db` に同居。`tasks` テーブルとは別テーブル
