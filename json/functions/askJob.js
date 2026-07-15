const userInput = interrupt('What is your occupation?');

if (!userInput) {
  return {
    messages: ['Occupation was not entered'],
    userJob: ''
  };
}

const userJob = String(userInput).trim();
const result = {
  messages: [`Occupation: ${userJob} received. Generating advice...`],
  userJob: userJob
};

return result;