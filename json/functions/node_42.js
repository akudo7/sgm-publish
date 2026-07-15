const messages = state.messages;
const lastMessage = messages[messages.length - 1];
if (lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
  return 'tools';
}
return 'showResult';