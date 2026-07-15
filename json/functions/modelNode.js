try {
  await model.invoke([{ role: 'user', content: 'test' }]);
  return { messages: ['done'] };
} catch (e) {
  return { messages: ['error: ' + e.message] };
}