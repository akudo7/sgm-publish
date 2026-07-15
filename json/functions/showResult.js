const adviceMessage = `[Advice for ${state.userName} (${state.userJob})]\n\n${state.advice}`;

interrupt(adviceMessage);

console.log('🔍 Final result:', adviceMessage);

return {
  messages: [adviceMessage, 'Process completed']
};