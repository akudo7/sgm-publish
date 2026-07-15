const rawMessages = state.messages || [];
const inputMessages = rawMessages.length > 0 ? rawMessages.map((m) => new HumanMessage(m)) : [new HumanMessage('Hello, respond briefly.')];
const resA = await modelA.invoke(inputMessages);
const resB = await modelB.invoke(inputMessages);
const resC = await modelC.invoke(inputMessages);
return { 
    result: 'A:' + (resA.content || '') + ',B:' + (resB.content || '') + ',C:' + (resC.content || '')
};