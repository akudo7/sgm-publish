/**
 * slack-dispatch-bot.ts
 *
 * Slack App を介して Dispatch Server にタスクを投入する Bot。
 * DM またはチャンネルでのメンションでタスクを受け付け、
 * 完了結果を元のメッセージのスレッドに返信する。
 *
 * 環境変数:
 *   SLACK_BOT_TOKEN=xoxb-...
 *   SLACK_SIGNING_SECRET=...
 *   SLACK_APP_TOKEN=xapp-...
 *   DISPATCH_SERVER_URL=http://localhost:3011
 */

import { App, LogLevel } from '@slack/bolt';
import * as dotenv from 'dotenv';

dotenv.config();

const DISPATCH_SERVER_URL = process.env.DISPATCH_SERVER_URL || 'http://localhost:3011';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET || !SLACK_APP_TOKEN) {
  console.error('Error: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, and SLACK_APP_TOKEN are required');
  process.exit(1);
}

const app = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: SLACK_APP_TOKEN,
  logLevel: LogLevel.DEBUG,
});

const EXIT_KEYWORDS = ['終了', 'exit', 'quit', 'やめる', 'done'];

/** メッセージ受信: Bot にメンション (チャンネル) または DM */
const handleBotMessage = async (msg: any, say: Function) => {
  if (!msg.text || msg.subtype) return;

  // Bot mention のプレフィックスを除去
  const text = msg.text.replace(/<@[\w]+>\s*/g, '').trim();
  if (!text) return;

  if (EXIT_KEYWORDS.some(kw => text.toLowerCase().includes(kw.toLowerCase()))) {
    await say({ thread_ts: msg.ts, text: '会話を終了します。またいつでもどうぞ :wave:' });
    return;
  }

  // スレッド根のtsで会話履歴を統一する
  const rootTs = msg.thread_ts || msg.ts;
  const taskId = `slack-${Date.now()}`;
  const webhookUrl = `${DISPATCH_SERVER_URL}/slack-webhook/${msg.channel}/${rootTs}`;

  await say({
    thread_ts: msg.ts,
    text: `タスクを受け付けました :hourglass:\n\`${taskId}\``,
  });

  try {
    const res = await fetch(`${DISPATCH_SERVER_URL}/message/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { parts: [{ text }] },
        thread_id: `slack-${msg.channel}-${rootTs}`,
        webhookUrl,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err: any) {
    await say({ thread_ts: msg.ts, text: `:warning: 送信失敗: ${err.message}` });
  }
};

app.message(async ({ message, say }) => {
  console.log('[app.message] received:', message.text?.substring(0, 80));
  handleBotMessage(message as any, say);
});

app.event('app_mention', async ({ event, say }) => {
  console.log('[app_mention] received:', (event as any).text?.substring(0, 80));
  handleBotMessage(event as any, say);
});

app.start().then(() => {
  console.log('Slack Dispatch Bot is running');
});
