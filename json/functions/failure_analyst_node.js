const failed = state._failedFindings || [];
const CONFIDENCE_THRESHOLD = 0.7;

// findings=0 または低 confidence のファイル — _failedFindings には入らないが Reflexion が必要
const noFindingsFiles = (state.huntResults || []).filter(r =>
  r.findings.length === 0 || r.confidence < CONFIDENCE_THRESHOLD
).filter(r => !failed.some(f => f.finding.filePath === r.filePath));

console.log(`[analyst] Generating verbal gradients for ${failed.length} failed findings + ${noFindingsFiles.length} no-findings/low-confidence files`);

const reflexionEntries = [];

for (const { finding, reason } of failed) {
  const analysisPrompt = `A vulnerability hypothesis was rejected by an independent verifier.

File: ${finding.filePath}
Vulnerability type: ${finding.type}
Original hypothesis: ${finding.hypothesis}
Rejection reason: ${reason}

Analyze WHY this hypothesis failed and generate a corrected hypothesis direction (verbal gradient).
Be specific:
- What assumption was wrong?
- What should be investigated differently?
- What additional context or code path should be examined?

Respond with a concrete, actionable verbal gradient (2-4 sentences).`;

  const localMessages = [{ role: 'user', content: analysisPrompt }];
  const response = await model.invoke(localMessages);
  const verbalGradient = typeof response.content === 'string' ? response.content.trim() : JSON.stringify(response.content);

  const attempt = (state.reflexionHistory || []).filter(h => h.target === finding.filePath).length + 1;
  reflexionEntries.push({
    target: finding.filePath,
    attempt,
    failureReason: reason,
    verbalGradient,
    timestamp: new Date().toISOString()
  });
  console.log(`[analyst] Gradient for ${finding.filePath} attempt ${attempt}: ${verbalGradient.slice(0, 80)}...`);
}

for (const result of noFindingsFiles) {
  const reasonLabel = result.findings.length === 0 ? 'no_findings' : `low_confidence_${result.confidence}`;

  const analysisPrompt = `A security scanner found no confirmed vulnerabilities in the following file.

File: ${result.filePath}
Previous scan: ${result.findings.length === 0
  ? 'No findings generated at all.'
  : `${result.findings.length} finding(s) discarded due to low confidence (${result.confidence}).`
}

Generate a verbal gradient (2-4 sentences) for a focused re-investigation:
- What specific patterns should be re-examined?
- What corner cases might hide real vulnerabilities?

Respond with a concrete, actionable verbal gradient.`;

  const localMessages = [{ role: 'user', content: analysisPrompt }];
  const response = await model.invoke(localMessages);
  const verbalGradient = typeof response.content === 'string' ? response.content.trim() : JSON.stringify(response.content);

  const attempt = (state.reflexionHistory || []).filter(h => h.target === result.filePath).length + 1;
  reflexionEntries.push({
    target: result.filePath,
    attempt,
    failureReason: reasonLabel,
    verbalGradient,
    timestamp: new Date().toISOString()
  });
  console.log(`[analyst] Gradient for ${result.filePath} (${reasonLabel}) attempt ${attempt}: ${verbalGradient.slice(0, 80)}...`);
}

const MAX_RETRY_FILES = 5;
const failedFilePaths = new Set(failed.map(f => f.finding.filePath));
const noFindingsFilePaths = new Set(noFindingsFiles.map(r => r.filePath));

const retryTargets = (state.huntTargets || []).filter(t =>
  failedFilePaths.has(t.filePath) || noFindingsFilePaths.has(t.filePath)
).slice(0, MAX_RETRY_FILES);

console.log(`[analyst] Scheduling retry for ${retryTargets.length} targets`);
return {
  reflexionHistory: reflexionEntries,
  huntTargets: retryTargets,
  huntResults: []
};