/**
 * telegram-dispatch-bot.ts
 *
 * Telegram Bot を介して Dispatch Server にタスクを投入する Bot。
 * long polling でメッセージを監視し、完了結果を返信する。
 *
 * 環境変数:
 *   TELEGRAM_BOT_TOKEN=123456789:AABBcc...
 *   DISPATCH_SERVER_URL=http://localhost:3011
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DISPATCH_URL = process.env.DISPATCH_SERVER_URL || 'http://localhost:3011';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

if (!BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

let lastUpdateId = 0;

async function poll(): Promise<void> {
  while (true) {
    try {
      const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
      const data = await res.json() as any;
      for (const update of data.result ?? []) {
        lastUpdateId = update.update_id;
        await handleUpdate(update);
      }
    } catch (err: any) {
      console.error('[Telegram] poll error:', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function sendMessage(chatId: number, text: string, replyToMessageId?: number): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
    }),
  });
}

async function handleUpdate(update: any): Promise<void> {
  const msg = update.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const taskId = `tg-${Date.now()}`;
  const webhookUrl = `${DISPATCH_URL}/telegram-webhook/${chatId}/${messageId}`;

  await sendMessage(chatId, `タスクを受け付けました...\nID: \`${taskId}\``, messageId);

  try {
    const res = await fetch(`${DISPATCH_URL}/message/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { parts: [{ type: 'text', text: msg.text }] },
        thread_id: `tg-${chatId}-${messageId}`,
        webhookUrl,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err: any) {
    await sendMessage(chatId, `送信失敗: ${err.message}`, messageId);
  }
}

console.log('Telegram Dispatch Bot is running');
poll();
