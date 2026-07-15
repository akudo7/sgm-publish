const userInput = interrupt('What is your name?');

if (!userInput) {
  return {
    messages: ['Name was not entered'],
    userName: ''
  };
}

const userName = String(userInput).trim();
const result = {
  messages: [`Hello ${userName}!`],
  userName: userName
};

return result;