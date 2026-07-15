const findings = state._exploitedFindings && state._exploitedFindings.length > 0
  ? state._exploitedFindings
  : state.verifiedFindings || [];
const repoPath = state.repoPath || '(unknown)';
const reflexionCount = (state.reflexionHistory || []).length;

console.log(`[reporter] Generating report for ${findings.length} findings (${reflexionCount} reflexion iterations)`);

const reportPrompt = [
  'Generate a security vulnerability report in Markdown format.',
  `Repository: ${repoPath}`,
  `Total findings: ${findings.length}`,
  `Reflexion iterations applied: ${reflexionCount}`,
  '',
  'Findings:',
  JSON.stringify(findings, null, 2),
  '',
  'Required report structure:',
  '# Security Audit Report',
  '## Executive Summary',
  '- Scan target, total findings count, breakdown by severity',
  '## Findings',
  '### [SEVERITY] filename:line',
  '- Description, evidence level, PoC (if available), remediation recommendation',
  '## Methodology',
  '- Reflexion loop iterations, specialist modes used',
  '## Appendix',
  '- reflexionHistory summary'
].join('\n');

const localMessages = [{ role: 'user', content: reportPrompt }];
const response = await model.invoke(localMessages);
const markdownReport = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

const sarifReport = {
  version: '2.1.0',
  $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
  runs: [{
    tool: {
      driver: {
        name: 'SGM-SourceHunt',
        version: '1.0.0',
        informationUri: 'https://github.com/akudo7/SceneGraphManager'
      }
    },
    results: findings.map((f, idx) => ({
      ruleId: f.type || 'unknown',
      level: f.severity === 'critical' ? 'error'
        : f.severity === 'high' ? 'warning'
        : 'note',
      message: { text: f.description || '' },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: f.filePath || '' },
          region: { startLine: f.line || 1 }
        }
      }]
    }))
  }]
};

const byEvidenceLevel = findings.reduce((acc, f) => {
  const lv = String(f.evidenceLevel || 'unknown');
  acc[lv] = (acc[lv] || 0) + 1;
  return acc;
}, {});

const bySeverity = findings.reduce((acc, f) => {
  const sev = f.severity || 'unknown';
  acc[sev] = (acc[sev] || 0) + 1;
  return acc;
}, {});

const pocGenerated = findings.filter(f => f.exploitStatus === 'generated').length;

const finalReport = JSON.stringify({
  markdown: markdownReport,
  sarif: sarifReport,
  json: findings,
  stats: {
    totalFindings: findings.length,
    byEvidenceLevel,
    bySeverity,
    pocGenerated,
    reflexionIterations: reflexionCount,
    repoPath
  }
}, null, 2);

console.log(`[reporter] Report generated (${markdownReport.length} chars markdown, ${findings.length} findings, ${pocGenerated} PoCs)`);
return {
  finalReport,
  messages: [{ role: 'assistant', content: markdownReport }]
};