const messages = state.messages;
const response = await model.invoke(messages);
return {
    messages: [response]
};