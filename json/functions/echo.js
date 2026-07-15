const last = state.messages[state.messages.length - 1];
const content = typeof last === 'string' ? last : (last?.content ?? '');
return { filtered: content };