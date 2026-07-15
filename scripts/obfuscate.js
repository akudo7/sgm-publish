#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import JavaScriptObfuscator from 'javascript-obfuscator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Obfuscation settings
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

// Files to exclude from obfuscation
const excludePatterns = [
  /\.d\.ts$/,     // TypeScript declaration files
  /\.map$/,       // Source maps
  /node_modules/, // Dependencies
  /bootstrap\.cjs$/, // Bootstrap — CJS require paths break if obfuscated
];

// Check if file should be excluded
function shouldExclude(filePath) {
  return excludePatterns.some(pattern => pattern.test(filePath));
}

// Remove source map files
function removeSourceMaps(dirPath) {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      removeSourceMaps(fullPath);
    } else if (stat.isFile() && fullPath.endsWith('.map')) {
      try {
        unlinkSync(fullPath);
        console.log(`✓ Removed source map: ${fullPath}`);
      } catch (error) {
        console.error(`✗ Failed to remove ${fullPath}:`, error.message);
      }
    }
  }
}

// Recursively process all JS files in directory
function obfuscateDirectory(dirPath) {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      obfuscateDirectory(fullPath);
    } else if (stat.isFile() && fullPath.endsWith('.js') && !shouldExclude(fullPath)) {
      try {
        console.log(`Obfuscating: ${fullPath}`);
        const code = readFileSync(fullPath, 'utf8');
        const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, obfuscationOptions).getObfuscatedCode();
        writeFileSync(fullPath, obfuscatedCode, 'utf8');
        console.log(`✓ Successfully obfuscated: ${fullPath}`);
      } catch (error) {
        console.error(`✗ Failed to obfuscate ${fullPath}:`, error.message);
      }
    }
  }
}

// Main execution
const distPath = join(__dirname, '..', 'dist');

console.log('Starting obfuscation process...');
console.log(`Target directory: ${distPath}\n`);

try {
  obfuscateDirectory(distPath);
  console.log('\n✓ Obfuscation completed successfully!');

  console.log('\nRemoving source maps...');
  removeSourceMaps(distPath);
  console.log('\n✓ Source maps removed successfully!');

  // Regenerate integrity manifest after obfuscation (file hashes changed)
  const manifestPath = join(distPath, '.integrity-manifest.json');
  if (existsSync(manifestPath)) {
    const files = {};
    function walk(dir) {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full);
        } else if (entry.endsWith('.js') || entry.endsWith('.cjs')) {
          const rel = full.replace(distPath + '/', '');
          files[rel] = createHash('sha256').update(readFileSync(full)).digest('hex');
        }
      }
    }
    walk(distPath);

    // Two-pass self-hash (must match lock.cjs verifyIntegrity logic)
    const manifestNoSelf = { version: 1, generatedAt: new Date().toISOString(), files };
    const sortedKeys = Object.keys(manifestNoSelf).sort();
    const sorted = {};
    for (const k of sortedKeys) { sorted[k] = manifestNoSelf[k]; }
    const selfHash = createHash('sha256').update(JSON.stringify(sorted, null, 2)).digest('hex');
    const finalManifest = { version: 1, generatedAt: manifestNoSelf.generatedAt, selfHash, files };

    writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2), 'utf8');
    console.log(`\n✓ Integrity manifest regenerated (${Object.keys(files).length} files)`);
  }
} catch (error) {
  console.error('\n✗ Process failed:', error.message);
  process.exit(1);
}
