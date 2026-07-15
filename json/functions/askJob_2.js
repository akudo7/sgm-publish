const userInput = interrupt('What is your occupation?');

if (!userInput) {
  return {
    messages: ['Occupation was not entered'],
    lastUserInput: '',
    userApproval: null
  };
}

const userJob = String(userInput).trim();
const result = {
  messages: [`Occupation: ${userJob}`, 'Process completed'],
  lastUserInput: userJob,
  userApproval: null
};

return result;