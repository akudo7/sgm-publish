const MAX_REFLEXION = 2;
const CONFIDENCE_THRESHOLD = 0.7;
const failedFindings = state._failedFindings || [];
const huntResults = state.huntResults || [];
const reflexionHistory = state.reflexionHistory || [];

// findings=0 または低 confidence のファイル（Reflexion の機会が必要）
const needsRetryFiles = huntResults.filter(r =>
  r.findings.length === 0 || r.confidence < CONFIDENCE_THRESHOLD
);

const hasRetryableFailures = failedFindings.some(f => {
  const attempts = reflexionHistory.filter(h => h.target === f.finding.filePath).length;
  return attempts < MAX_REFLEXION;
});

const hasRetryableNoFindings = needsRetryFiles.some(r => {
  const attempts = reflexionHistory.filter(h => h.target === r.filePath).length;
  return attempts < MAX_REFLEXION;
});

if (!hasRetryableFailures && !hasRetryableNoFindings) {
  if (failedFindings.length === 0 && needsRetryFiles.length === 0) {
    console.log('[reflexion] No failures — proceeding to exploiter');
  } else {
    console.log(`[reflexion] MAX_REFLEXION (${MAX_REFLEXION}) reached for all targets — proceeding to exploiter`);
  }
  return 'exploiter_node';
}

const pendingFailed = failedFindings.filter(f => {
  const attempts = reflexionHistory.filter(h => h.target === f.finding.filePath).length;
  return attempts < MAX_REFLEXION;
});
const pendingNoFindings = needsRetryFiles.filter(r => {
  const attempts = reflexionHistory.filter(h => h.target === r.filePath).length;
  return attempts < MAX_REFLEXION;
});

console.log(`[reflexion] ${pendingFailed.length} failed + ${pendingNoFindings.length} no-findings/low-confidence eligible for retry — routing to failure_analyst`);
return 'failure_analyst_node';