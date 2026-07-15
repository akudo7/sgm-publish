const messages = state.messages;
const lastMessage = messages[messages.length - 1];
const resultMessage = lastMessage.content || 'No result';

console.log('🔍 Final result:', resultMessage);

return {
  messages: [{ role: 'assistant', content: resultMessage }]
};