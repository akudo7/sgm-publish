async (state) => {
  const contract = state.sprintContract;
  const fallbackContract = contract || {
    goals: ['implement: ' + (state.taskSpec || 'unknown task')],
    successCriteria: ['task is complete'],
    sprintNumber: (state.sprintContract?.sprintNumber || 1)
  };
  const bootstrapMsg = (state.activeMessages || []).find(
    m => typeof m.content === 'string' && m.content.startsWith('=== Generator Bootstrap')
  );
  const systemPrompt = bootstrapMsg
    ? bootstrapMsg.content + '\n\n=== Sprint Contract ===\n' + JSON.stringify(fallbackContract, null, 2)
    : 'Sprint Contract: ' + JSON.stringify(fallbackContract);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '上記のcontractに基づき、実装を行ってください。実装ファイルはwrite_fileツールでディスクに書き出してください。' }
  ];

  // Tool-calling loop
  let response;
  let toolCallCount = 0;
  const maxToolCalls = 20;
  while (toolCallCount < maxToolCalls) {
    response = await model.invoke(messages);
    
    // Check if response has tool_calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      toolCallCount += response.tool_calls.length;
      
      // Execute each tool call
      for (const tc of response.tool_calls) {
        const tool = tools.find(t => t.name === tc.name);
        if (tool) {
          try {
            const result = await tool._call(tc.args);
            messages.push({
              role: 'tool',
              content: typeof result === 'string' ? result : JSON.stringify(result),
              tool_call_id: tc.id
            });
          } catch (e) {
            messages.push({
              role: 'tool',
              content: 'Error: ' + e.message,
              tool_call_id: tc.id
            });
          }
        } else {
          messages.push({
            role: 'tool',
            content: 'Tool not found: ' + tc.name,
            tool_call_id: tc.id
          });
        }
      }
      continue;
    }
    break;
  }

  const content = (response.reasoning_content && response.reasoning_content.trim()) || 
                  (typeof response.content === 'string' ? response.content : JSON.stringify(response.content));
  
  console.warn('[Generator] Tool calls made: ' + toolCallCount);
  return { messages: [{ role: 'assistant', content }] };
}