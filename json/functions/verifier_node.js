const { readFileSync } = await import('node:fs');
const { join, isAbsolute } = await import('node:path');

const CONFIDENCE_THRESHOLD = 0.7;
const allFindings = state.huntResults.flatMap(r => {
  if (r.confidence < CONFIDENCE_THRESHOLD) {
    if (r.findings.length > 0) {
      console.log(`[verifier] Skipping ${r.filePath} (confidence=${r.confidence} < ${CONFIDENCE_THRESHOLD}, ${r.findings.length} findings discarded)`);
    }
    return [];
  }
  return r.findings.map(f => ({ ...f, filePath: r.filePath, specialist: r.specialist }));
});

const alreadyVerified = new Set((state.verifiedFindings || []).map(f => `${f.filePath}:${f.line}`));
const pendingFindings = allFindings.filter(f => !alreadyVerified.has(`${f.filePath}:${f.line}`));
console.log(`[verifier] Verifying ${pendingFindings.length} pending findings (${allFindings.length - pendingFindings.length} already verified) from ${state.huntResults.length} files`);

const verified = [];
const failed = [];

for (const finding of pendingFindings) {
  let fileContext = '';
  try {
    const fullPath = isAbsolute(finding.filePath)
      ? finding.filePath
      : join(state.repoPath, finding.filePath);
    const lines = readFileSync(fullPath, 'utf-8').split('\n');
    const start = Math.max(0, (finding.line || 1) - 40);
    const end = Math.min(lines.length, (finding.line || 1) + 40);
    fileContext = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
  } catch (e) {
    fileContext = '(file not readable)';
  }

  const verifyPrompt = `You are an independent security auditor. Verify the following vulnerability finding.

File: ${finding.filePath}
Vulnerability type: ${finding.type}
Severity: ${finding.severity}
Description: ${finding.description}
Line: ${finding.line}${finding.column != null ? ':' + finding.column : ''}
Exploit hypothesis: ${finding.hypothesis}
Claimed evidence level: ${finding.evidenceLevel}

Code context:
\`\`\`
${fileContext}
\`\`\`

Independently assess:
1. Is this a real vulnerability or a false positive?
2. If valid, what evidence level is appropriate? (1=theoretical, 2=plausible exploit path with clear mechanism)
3. If invalid, state the exact reason.

CRITICAL PRINCIPLE: Base your assessment ONLY on what is directly visible in the code context above. If a validation, bounds check, or safety mechanism is claimed to exist but is NOT visible in the provided context, do NOT assume it provides protection — it may be absent or insufficient. When the relevant caller logic, allocation size, or constraint enforcement is outside the visible window, acknowledge that uncertainty rather than asserting correctness.

Return ONLY a JSON object (no explanation):
{"valid":true,"evidenceLevel":1,"reason":"brief assessment"}`;

  const localMessages = [{ role: 'user', content: verifyPrompt }];
  const response = await model.invoke(localMessages);
  const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const result = JSON.parse(jsonMatch[0]);
    if (result.valid) {
      verified.push({ ...finding, evidenceLevel: result.evidenceLevel || finding.evidenceLevel, verifiedAt: new Date().toISOString() });
      console.log(`[verifier] PASS: ${finding.type} in ${finding.filePath}:${finding.line} (Lv${result.evidenceLevel})`);
    } else {
      failed.push({ finding, reason: result.reason || 'Rejected by verifier' });
      console.log(`[verifier] FAIL: ${finding.type} in ${finding.filePath}:${finding.line} — ${result.reason}`);
    }
  } catch (e) {
    console.error(`[verifier] Parse error for ${finding.filePath}:${finding.line}:`, e.message);
    failed.push({ finding, reason: 'Verifier response parse error' });
  }
}

console.log(`[verifier] Results: ${verified.length} verified, ${failed.length} failed`);
return { verifiedFindings: verified, _failedFindings: failed };