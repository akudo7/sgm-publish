const MAX_RETRIES = 3;
if (!state.sprintResult) { return 'generator_node'; }
if (state.sprintResult.passed) { return '__end__'; }
if (state.retryCount >= MAX_RETRIES) { return '__end__'; }
return 'bootstrap_feedback_node';