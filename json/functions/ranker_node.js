const repoPath = state.repoPath;
if (!repoPath) {
  console.error('[ranker] repoPath is not set');
  return { huntTargets: [] };
}

const { readdirSync, readFileSync, statSync } = await import('node:fs');
const { join, relative } = await import('node:path');

// Load prefilter config
const configPath = process.env.PREFILTER_CONFIG;
if (!configPath) {
  console.error('[ranker] PREFILTER_CONFIG is not set');
  return { huntTargets: [] };
}

let prefilterConfig;
try {
  prefilterConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch (e) {
  console.error('[ranker] Failed to load prefilter config:', e.message);
  return { huntTargets: [] };
}

const { chunkSize = 50, topN = 5, subsystems = [] } = prefilterConfig;

const SCAN_DIRS = ['libavcodec', 'libavformat', 'libavfilter'];

function collectCFiles(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) { return files; }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCFiles(full, files);
    } else if (entry.name.endsWith('.c')) {
      files.push(full);
    }
  }
  return files;
}

// Collect all .c files
const allCFiles = [];
for (const dir of SCAN_DIRS) {
  collectCFiles(join(repoPath, dir), allCFiles);
}
console.log(`[ranker] Collected ${allCFiles.length} .c files from ${SCAN_DIRS.join(', ')}`);

// Group by top-level directory
const filesByDir = new Map();
for (const f of allCFiles) {
  const rel = relative(repoPath, f);
  const topDir = rel.split('/')[0];
  if (!filesByDir.has(topDir)) filesByDir.set(topDir, []);
  filesByDir.get(topDir).push(f);
}

// Apply subsystem quotas — sort by file size within each subsystem (neutral complexity proxy)
const selected = [];
const assignedDirs = new Set();

for (const { dir, quota } of subsystems) {
  if (dir === '*') continue;
  const files = filesByDir.get(dir) || [];
  assignedDirs.add(dir);
  const bySize = files
    .map(f => ({ f, size: statSync(f).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, quota)
    .map(x => x.f);
  selected.push(...bySize);
  const top1 = bySize.length > 0 ? relative(repoPath, bySize[0]) : 'none';
  console.log(`[ranker] ${dir}: ${bySize.length}/${files.length} (quota=${quota}, largest=${top1})`);
}

// Handle catch-all (*) for remaining dirs
const catchAll = subsystems.find(s => s.dir === '*');
if (catchAll) {
  const remainingFiles = [];
  for (const [dir, files] of filesByDir) {
    if (!assignedDirs.has(dir)) remainingFiles.push(...files);
  }
  const bySize = remainingFiles
    .map(f => ({ f, size: statSync(f).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, catchAll.quota)
    .map(x => x.f);
  selected.push(...bySize);
  if (bySize.length > 0) {
    console.log(`[ranker] * (others): ${bySize.length}/${remainingFiles.length} (quota=${catchAll.quota})`);
  }
}

console.log(`[ranker] Pre-filter → ${selected.length} candidates (subsystem quota)`);

// LLM ranking
const chunks = [];
for (let i = 0; i < selected.length; i += chunkSize) {
  chunks.push(selected.slice(i, i + chunkSize));
}

const allTargets = [];
const specialistGuide = process.env.SPECIALIST_GUIDE || 'Focus on: general security vulnerabilities.';

for (let ci = 0; ci < chunks.length; ci++) {
  const chunk = chunks[ci];
  const relFiles = chunk.map(c => relative(repoPath, c));
  console.log(`[ranker] LLM chunk ${ci + 1}/${chunks.length} (${relFiles.length} files)`);

  const prompt = [
    'You are a security researcher ranking C files for vulnerability hunting.',
    `Specialist focus: ${specialistGuide}`,
    '',
    `Repository: ${repoPath}`,
    '',
    'Rate each file (0.0-1.0) on how likely it contains vulnerabilities matching the specialist focus:',
    '- surface: Complexity of input parsing or the targeted vulnerability class',
    '- influence: Pipeline reach — how many code paths pass through this file',
    '- reachability: Whether attacker-controlled input reaches this code',
    '',
    'Priority = surface*0.5 + influence*0.2 + reachability*0.3',
    '',
    'Files:',
    relFiles.map((f, i) => `${i + 1}. ${f}`).join('\n'),
    '',
    'Return ONLY a JSON array:',
    '[{"filePath":"relative/path","surface":0.8,"influence":0.5,"reachability":0.7,"reason":"brief"},...]'
  ].join('\n');

  const response = await model.invoke([{ role: 'user', content: prompt }]);
  const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { console.error('[ranker] No JSON in chunk', ci + 1); continue; }
    const scored = JSON.parse(jsonMatch[0]);
    for (const item of scored) {
      const surface = Math.min(Math.max(Number(item.surface) || 0, 0), 1);
      const influence = Math.min(Math.max(Number(item.influence) || 0, 0), 1);
      const reachability = Math.min(Math.max(Number(item.reachability) || 0, 0), 1);
      const score = surface * 0.5 + influence * 0.2 + reachability * 0.3;
      allTargets.push({ filePath: item.filePath, score: Math.round(score * 1000) / 1000, reason: item.reason || '' });
    }
  } catch (e) {
    console.error('[ranker] Parse error chunk', ci + 1, ':', e.message);
  }
}

const llmTop = allTargets.sort((a, b) => b.score - a.score).slice(0, topN);

console.log(`[ranker] Final: top ${llmTop.length} from ${allTargets.length} LLM-ranked`);
if (llmTop.length > 0) console.log(`[ranker] #1: ${llmTop[0].filePath} (score=${llmTop[0].score})`);
return { huntTargets: llmTop };