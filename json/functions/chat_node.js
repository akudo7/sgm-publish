const response = await model.invoke(state.messages);
return { messages: [response] };