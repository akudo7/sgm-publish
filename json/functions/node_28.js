async (state) => {
  const MAX_RETRIES = 3;
  if (!state.sprintResult) {
    return 'generator_node';
  }
  if (state.sprintResult.passed) {
    return '__end__';
  }
  if (state.retryCount >= MAX_RETRIES) {
    console.warn(`Sprint Contract: MAX_RETRIES(${MAX_RETRIES})に到達。強制終了します。`);
    return '__end__';
  }
  return 'bootstrap_feedback_node';
}