const inputText = state.messages?.[0] || 'The weather is nice today.';

const prompt = [
  'Analyze the following text and return a JSON object.',
  '',
  'Text: ' + inputText,
  '',
  'Return ONLY a JSON object with this structure:',
  '{"summary":"one-sentence summary","sentiment":"positive|neutral|negative","keyPoints":["point1","point2"]}'
].join('\n');

const response = await model.invoke([{ role: 'user', content: prompt }]);

// model.invoke returns parsed object when withStructuredOutput is applied
const analysis = typeof response === 'object' ? response : null;

return { analysis };