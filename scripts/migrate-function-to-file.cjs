#!/usr/bin/env node
// scripts/migrate-function-to-file.js
// Migrate inline "function" strings in JSON files to external .js files under json/functions/

const fs = require('fs');
const path = require('path');

const JSON_DIR = path.resolve(__dirname, '..', 'json');
const FUNCTIONS_DIR = path.join(JSON_DIR, 'functions');
const SKIP_DIRS = new Set(['swarms', 'a2a', 'teams']);

if (!fs.existsSync(FUNCTIONS_DIR)) {
  fs.mkdirSync(FUNCTIONS_DIR, { recursive: true });
}

const jsonFiles = [];
for (const entry of fs.readdirSync(JSON_DIR, { withFileTypes: true })) {
  if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
  if (entry.isFile() && entry.name.endsWith('.json')) {
    jsonFiles.push(path.join(JSON_DIR, entry.name));
  }
}

// Phase 1: Collect all function strings, deduplicate by content
const funcMap = new Map(); // functionCode -> filename
let funcCounter = 0;

function safeFilename(nodeId) {
  return nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
}

function collectFunc(node) {
  if (!node || typeof node !== 'object') return;
  if (node.handler && typeof node.handler === 'object' && node.handler.function != null) {
    const funcCode = node.handler.function;
    if (typeof funcCode !== 'string') return;
    if (!funcMap.has(funcCode)) {
      funcCounter++;
      const baseName = safeFilename(node.id || `node_${funcCounter}`);
      funcMap.set(funcCode, baseName);
    }
  }
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (Array.isArray(val)) val.forEach(collectFunc);
    else if (val && typeof val === 'object') collectFunc(val);
  }
}

for (const jsonFile of jsonFiles) {
  const parsed = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
  collectFunc(parsed);
}

// Phase 2: Resolve filename collisions (same baseName, different content)
const nameUsage = new Map(); // baseName -> [functionCode, ...]
for (const [code, baseName] of funcMap) {
  if (!nameUsage.has(baseName)) nameUsage.set(baseName, []);
  nameUsage.get(baseName).push(code);
}

for (const [baseName, codes] of nameUsage) {
  if (codes.length <= 1) continue;
  // Collision! Rename all but one
  const used = new Set([baseName]);
  for (let i = 1; i < codes.length; i++) {
    let suffix = 2;
    let candidate = `${baseName}_${suffix}`;
    while (used.has(candidate)) {
      suffix++;
      candidate = `${baseName}_${suffix}`;
    }
    used.add(candidate);
    funcMap.set(codes[i], candidate);
  }
}

// Phase 3: Write .js files
console.log(`Found ${funcMap.size} unique function(s) to write.`);
for (const [code, baseName] of funcMap) {
  const jsPath = path.join(FUNCTIONS_DIR, `${baseName}.js`);
  fs.writeFileSync(jsPath, code, 'utf-8');
}

// Phase 4: Update JSON files
let totalRefsMigrated = 0;
let totalFilesUpdated = 0;

function migrateNode(node) {
  if (!node || typeof node !== 'object') return;
  if (node.handler && typeof node.handler === 'object' && node.handler.function != null) {
    const funcCode = node.handler.function;
    if (typeof funcCode !== 'string') return;
    const baseName = funcMap.get(funcCode);
    if (!baseName) return;

    delete node.handler.function;
    node.handler.functionFile = `functions/${baseName}.js`;
    totalRefsMigrated++;
  }
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (Array.isArray(val)) val.forEach(migrateNode);
    else if (val && typeof val === 'object') migrateNode(val);
  }
}

for (const jsonFile of jsonFiles) {
  const content = fs.readFileSync(jsonFile, 'utf-8');
  const parsed = JSON.parse(content);
  const before = JSON.stringify(parsed);

  migrateNode(parsed);

  const after = JSON.stringify(parsed);
  if (before !== after) {
    fs.writeFileSync(jsonFile, after + '\n', 'utf-8');
    totalFilesUpdated++;
    console.log(`Updated: ${path.relative(path.resolve(__dirname, '..'), jsonFile)}`);
  }
}

// Phase 5: Summary
console.log(`\n--- Summary ---`);
console.log(`Unique .js files written: ${funcMap.size}`);
console.log(`Function references migrated: ${totalRefsMigrated}`);
console.log(`JSON files updated: ${totalFilesUpdated}`);
