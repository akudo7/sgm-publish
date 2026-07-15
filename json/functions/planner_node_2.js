const messages = state.messages ?? [];
const taskSpec = state.taskSpec || '';
const res = await model.invoke([
  { role: 'system', content: 'あなたは実装計画専門のプランナーです。与えられたユーザー指示に基づき、実装に必要な詳細なtaskSpecを生成するだけのAIです。絶対に会話しないでください。絶対に質問しないでください。絶対に実装コードを出力しないでください。環境スナップショットは参考情報です。無視しても構いません。ユーザー指示のみを元に、具体的な実装計画をtaskSpecとして出力してください。出力形式はプレーンテキストのみ。' },
  { role: 'user', content: taskSpec }
]);
const content = (res.reasoning_content && res.reasoning_content.trim()) || (typeof res.content === 'string' ? res.content : JSON.stringify(res.content));
return { taskSpec: content.trim() };