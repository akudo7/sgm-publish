try {
  console.log('🔍 Generating advice based on occupation...');
  console.log('👤 Name:', state.userName);
  console.log('💼 Occupation:', state.userJob);

  if (!state.userJob || state.userJob === '') {
    return {
      messages: ['Cannot generate advice because occupation is not set'],
      advice: ''
    };
  }

  const prompt = `Provide practical advice within 100 characters for ${state.userName} working as a ${state.userJob} to help with career advancement and improving work quality.`;

  const response = await model.invoke([{ role: 'user', content: prompt }]);

  const adviceText = response.content || 'Failed to generate advice';

  console.log('📋 Generated advice:', adviceText);

  return {
    messages: [`Advice generated`],
    advice: adviceText
  };
} catch (error) {
  console.error('❌ Error:', error);
  return {
    messages: [`An error occurred: ${error.message}`],
    advice: ''
  };
}