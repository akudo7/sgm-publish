const inputMessages = state.messages || [new HumanMessage('Respond briefly.')];
const res = await model.invoke(inputMessages);
return { messages: [res] };