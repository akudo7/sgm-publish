const target = state.currentTarget;
if (!target) {
  console.warn('[hunter] No currentTarget in state');
  return { huntResults: [] };
}

const { readFileSync } = await import('node:fs');
const { join, isAbsolute } = await import('node:path');

let fileContent = '';
try {
  const fullPath = isAbsolute(target.filePath)
    ? target.filePath
    : join(state.repoPath, target.filePath);
  fileContent = readFileSync(fullPath, 'utf-8');
} catch (e) {
  console.error(`[hunter] Failed to read ${target.filePath}:`, e.message);
  return { huntResults: [{ filePath: target.filePath, specialist: 'generic', findings: [], confidence: 0 }] };
}

// SPECIALIST 環境変数でオーバーライド（ローテーション方式）
const envSpecialist = process.env.SPECIALIST;
const ext = (target.filePath.split('.').pop() || '').toLowerCase();
const lowerPath = target.filePath.toLowerCase();
const autoSpecialist = ['c', 'cpp', 'h', 'hpp'].includes(ext) ? 'memory_safety'
  : ['go', 'rs'].includes(ext) ? 'concurrency'
  : ['py', 'js', 'ts', 'jsx', 'tsx'].includes(ext) ? 'injection'
  : lowerPath.includes('crypto') || lowerPath.includes('ssl') || lowerPath.includes('tls') ? 'cryptography'
  : 'generic';
const specialist = envSpecialist || autoSpecialist;

const priorAttempts = (state.reflexionHistory || []).filter(h => h.target === target.filePath);
const gradientHint = priorAttempts.length > 0
  ? '\n\nPREVIOUS ATTEMPTS FAILED. Adjust your hypothesis based on these gradients:\n' + priorAttempts.map(h => `Attempt ${h.attempt}: ${h.verbalGradient}`).join('\n')
  : '';

const guide = process.env.SPECIALIST_GUIDE || 'Focus on: general security vulnerabilities.';

const hunterPrompt = `You are a security researcher specializing in ${specialist.replace(/_/g, ' ')} vulnerabilities.

File: ${target.filePath}
Priority score: ${target.score} — ${target.reason}

${guide}${gradientHint}

Analyze the following source code and identify ALL potential security vulnerabilities.
For each finding, assign evidence level: 1=theoretical possibility, 2=plausible exploit path with clear mechanism.

Source code:
\`\`\`
${fileContent.slice(0, 8000)}
\`\`\`

IMPORTANT — Accuracy requirements:
- Line numbers must be EXACT. Quote the actual vulnerable source line in your hypothesis. Do NOT estimate.
- If you cannot identify the exact line, set evidenceLevel to 0 and omit the finding.

Return ONLY a JSON object (no explanation, no markdown):
{"specialist":"${specialist}","confidence":0.0,"findings":[{"type":"vulnerability type","severity":"low|medium|high|critical","description":"what the vulnerability is","line":1,"column":null,"hypothesis":"how this could be exploited","evidenceLevel":1}]}`;

const localMessages = [{ role: 'user', content: hunterPrompt }];
const response = await model.invoke(localMessages);
const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

let findings = [];
let confidence = 0;
let specialistResult = specialist;

try {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    findings = Array.isArray(parsed.findings) ? parsed.findings : [];
    confidence = Math.min(Math.max(Number(parsed.confidence) || 0, 0), 1);
    specialistResult = parsed.specialist || specialist;
  }
} catch (e) {
  console.error(`[hunter] Failed to parse findings for ${target.filePath}:`, e.message);
}

console.log(`[hunter:${specialist}] ${target.filePath} → ${findings.length} findings (confidence=${confidence})`);
return { huntResults: [{ filePath: target.filePath, specialist: specialistResult, findings, confidence }] };