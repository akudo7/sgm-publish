const userInput = interrupt('What is your name?');

if (!userInput) {
  return {
    messages: ['Name was not entered'],
    lastUserInput: '',
    userApproval: null
  };
}

const userName = String(userInput).trim();
const result = {
  messages: [`Hello ${userName}!`],
  lastUserInput: userName,
  userApproval: null
};

return result;