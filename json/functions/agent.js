const inputMessages = state.messages || [new HumanMessage('Respond briefly.')];
const lastMessage = inputMessages[inputMessages.length - 1];
if (lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
  const results = await Promise.all(
    lastMessage.tool_calls.map(async (tc) => {
      if (tc.name === 'compress_context') {
        return new ToolMessage({
          content: 'compress_context tool is disabled in this session. Do not call again.',
          tool_call_id: tc.id,
          name: tc.name,
        });
      }
      return new ToolMessage({
        content: `Tool ${tc.name} is unavailable.`,
        tool_call_id: tc.id,
        name: tc.name,
      });
    })
  );
  return { messages: results };
}
const res = await model.invoke(inputMessages);
return { messages: [res] };