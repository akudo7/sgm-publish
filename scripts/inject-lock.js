#!/usr/bin/env node
// inject-lock.js — Tamper-resistant lock + license injector
//
// Injects lock.cjs, license.cjs, bootstrap.cjs into dist/ and prepends
// bootstrap initialization to all existing JS files.
//
// Usage:
//   node scripts/inject-lock.js              // Inject into dist/
//   node scripts/inject-lock.js --dry-run    // Show what would change
//
// Environment:
//   SGM_PUBLIC_KEY_PATH  — path to Ed25519 public key (PEM). Defaults to ./sgm-public.key

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var ROOT = join(__dirname, '..');
var DIST = join(ROOT, 'dist');

// ── CLI args ──
var DRY_RUN = process.argv.includes('--dry-run');
var INJECT_ONLY = process.argv.includes('--inject-only');

// ── Public key ──
var publicKeyPath =
  process.env.SGM_PUBLIC_KEY_PATH ||
  join(ROOT, 'sgm-public.key');

var publicKeyPem = '';
if (!INJECT_ONLY) {
  if (!existsSync(publicKeyPath)) {
    console.error('[inject-lock] Public key not found: ' + publicKeyPath);
    console.error('[inject-lock] Set SGM_PUBLIC_KEY_PATH or place sgm-public.key at repo root');
    process.exit(1);
  }
  publicKeyPem = readFileSync(publicKeyPath, 'utf8').trim();
}

// ── File helpers ──

function listDistFiles() {
  var result = [];
  function walk(dir) {
    var entries = readdirSync(dir);
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var full = join(dir, entry);
      var st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.js') || entry.endsWith('.cjs')) {
        result.push(relative(DIST, full));
      }
    }
  }
  walk(DIST);
  return result;
}

// ── Bootstrap code to prepend to each ESM file ──
// Uses top-level await (Node.js 22+ ESM) to BLOCK module loading until bootstrap completes.
// This ensures license errors prevent the module from loading.
// Only swallows ENOENT errors (bootstrap.cjs missing); exits on everything else.
var BOOTSTRAP_PREFIX =
  '\n' +
  '// -- SGM Tamper-Resistant Lock (auto-injected) --\n' +
  'if (!globalThis.__SGM_INJECTED__) {\n' +
  '  globalThis.__SGM_INJECTED__ = true;\n' +
  '  try { var bs = await import("./bootstrap.cjs"); await bs.bootstrap(); } catch (e) { if (e.code !== "ERR_MODULE_NOT_FOUND" && e.code !== "ENOENT") { console.error(e.message); process.exit(1); } }\n' +
  '}\n';

// ── Invoke mutex injection: wrap invoke() with license semaphore ──
//
// Transforms WorkflowEngine.invoke() body into _invokeInner() and wraps
// invoke() with license semaphore acquire/release via globalThis.__SGM_LICENSE_MANAGER.
//
// Before:
//   async invoke(input, options) {
//     if (!this.isBuilt) { ... }
//     ...
//   }
//
// After:
//   async invoke(input, options) {
//     // Tamper-resistant license enforcement (auto-injected)
//     var __SGM_LM = globalThis.__SGM_LICENSE_MANAGER;
//     if (__SGM_LM) {
//       var __SGM_RELEASE = await __SGM_LM.acquire();
//       try {
//         return await this._invokeInner(input, options);
//       } finally {
//         __SGM_RELEASE();
//       }
//     }
//     return await this._invokeInner(input, options);
//   }
//
//   _invokeInner(input, options) {
//     if (!this.isBuilt) { ... }
//     ...  // original invoke body
//   }
//
function injectInvokeMutex(code) {
  // Find "async invoke(" in the code
  var idx = code.indexOf('async invoke');
  if (idx === -1) return code;

  // Find the opening brace of the method body (skip strings)
  var openBraceIdx = -1;
  var inStr = null;
  for (var ci = idx; ci < code.length; ci++) {
    var ch = code[ci];
    if (inStr) {
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '{') {
      openBraceIdx = ci;
      break;
    }
  }
  if (openBraceIdx === -1) return code;

  // Find the matching closing brace
  var depth = 0;
  var inStr2 = null;
  for (var cj = openBraceIdx; cj < code.length; cj++) {
    var ch2 = code[cj];
    if (inStr2) {
      if (ch2 === inStr2) inStr2 = null;
      continue;
    }
    if (ch2 === '"' || ch2 === "'" || ch2 === '`') {
      inStr2 = ch2;
      continue;
    }
    if (ch2 === '{') depth++;
    else if (ch2 === '}') {
      depth--;
      if (depth === 0) {
        // Found matching close brace
        var bodyEndIdx = cj;

        // Signature: from 'async invoke' to just before '{'
        var signature = code.slice(idx, openBraceIdx).trim();

        // Body: content between '{' and '}'
        var body = code.slice(openBraceIdx + 1, bodyEndIdx);

        // Determine the indentation of the original body (first non-empty line)
        var bodyLines = body.split('\n');
        var bodyIndent = '';
        for (var bi = 0; bi < bodyLines.length; bi++) {
          var line = bodyLines[bi];
          if (line.trim().length > 0) {
            var leading = line.match(/^(\s*)/);
            if (leading) bodyIndent = leading[1];
            break;
          }
        }
        var bi2 = bodyIndent.length + 2; // +2 for the extra if/try level

        // Build replacement with matching indentation
        var injectCode =
          '\n' +
          bodyIndent + '  // Tamper-resistant license enforcement (auto-injected)\n' +
          bodyIndent + '  var __SGM_LM = globalThis.__SGM_LICENSE_MANAGER;\n' +
          bodyIndent + '  if (__SGM_LM) {\n' +
          bodyIndent + '    var __SGM_RELEASE = await __SGM_LM.acquire();\n' +
          bodyIndent + '    try {\n' +
          bodyIndent + '      return await this._invokeInner(input, options);\n' +
          bodyIndent + '    } finally {\n' +
          bodyIndent + '      __SGM_RELEASE();\n' +
          bodyIndent + '    }\n' +
          bodyIndent + '  }\n' +
          bodyIndent + '  return await this._invokeInner(input, options);';

        // signature = "async invoke(input, options)"
        // For _invokeInner, reuse the parameter list from signature
        var paramList = signature.replace(/^async\s+invoke\s*\(/, '').replace(/\)\s*$/, '');

        var fullReplacement = signature + ' {\n' + injectCode + '\n' + bodyIndent + '  }\n\n' + bodyIndent + '  async _invokeInner(' + paramList + ')' + code.slice(openBraceIdx, bodyEndIdx + 1);
        var replacement = fullReplacement;
          injectCode +
          '\n' +
          bodyIndent + '  }\n' +
          '\n' +
          bodyIndent + '  async _invokeInner(' + paramList + ')' + code.slice(openBraceIdx);

        return code.slice(0, idx) + replacement + code.slice(bodyEndIdx + 1);
      }
    }
  }
  return code; // Could not find matching brace
}

// ── Feature gate injection: wrap build() with license check ──
//
// Injects checkFeature('a2a') call at the top of WorkflowEngine.build().
//
// Before:
//   public async build(): Promise<void> {
//     try {
//       logger.log("\n=== Building Workflow Engine ===");
//       ...
//
// After:
//   public async build(): Promise<void> {
//     try {
//       // Tamper-resistant feature gate (auto-injected)
//       var __SGM_LM = globalThis.__SGM_LICENSE_MANAGER;
//       if (__SGM_LM && !__SGM_LM.checkFeature('a2a')) {
//         throw new Error("[SGM LICENSE] A2A requires professional level or higher. Current: " + (__SGM_LM.license ? __SGM_LM.license.level : "unknown"));
//       }
//       logger.log("\n=== Building Workflow Engine ===");
//       ...
function injectBuildFeatureGate(code) {
  // Match "async build()" followed eventually by "{" on the same or next line
  // but NOT inside a comment. Search for the pattern: "async build()\n" or "async build() {"
  var idx = code.indexOf('async build()');
  if (idx === -1) return code;

  // Make sure this isn't inside a comment — scan backwards for // or /*
  var before = code.slice(0, idx);
  var lastLineStart = before.lastIndexOf('\n');
  var lineBefore = before.slice(lastLineStart + 1);
  if (lineBefore.trim().startsWith('//') || lineBefore.trim().startsWith('*')) {
    return code;
  }

  // Find the opening brace — could be on same line or next line
  var searchStart = idx + 'async build()'.length;
  var braceStart = code.indexOf('{', searchStart);
  if (braceStart === -1) return code;

  // Verify: between async build() and {, there should only be whitespace/newlines
  var between = code.slice(searchStart, braceStart).replace(/\n/g, ' ').trim();
  if (between.length > 0) return code; // unexpected content between signature and brace

  // Find "try {" after build(
  var tryIdx = code.indexOf('try {', braceStart);
  if (tryIdx === -1) return code;

  // Find the first statement after "try {"
  var afterTry = tryIdx + 'try {'.length;
  var firstStmtIdx = afterTry;
  while (firstStmtIdx < code.length && (code[firstStmtIdx] === ' ' || code[firstStmtIdx] === '\n' || code[firstStmtIdx] === '\t')) {
    firstStmtIdx++;
  }

  var firstLineEnd = code.indexOf('\n', firstStmtIdx);
  if (firstLineEnd === -1) return code;

  var firstLine = code.slice(firstStmtIdx, firstLineEnd);
  var indentMatch = firstLine.match(/^(\s*)/);
  var indent = indentMatch ? indentMatch[1] : '      ';

  var injectCode =
    '\n' +
    indent + '// Tamper-resistant feature gate (auto-injected)\n' +
    indent + 'var __SGM_LM = globalThis.__SGM_LICENSE_MANAGER;\n' +
    indent + 'if (__SGM_LM && !__SGM_LM.checkFeature(\'a2a\')) {\n' +
    indent + '  throw new Error("[SGM LICENSE] A2A requires professional level or higher. Current: " + (__SGM_LM.license ? __SGM_LM.license.level : "unknown"));\n' +
    indent + '}';

  return code.slice(0, firstLineEnd) + injectCode + '\n' + code.slice(firstLineEnd);
}

// ── license.cjs source ──
function buildLicenseCjs(publicKey) {
  var L = [];
  L.push("'use strict';");
  L.push('');
  L.push("var crypto = require('crypto');");
  L.push("var os = require('os');");
  L.push('');
  L.push('// -- Embedded public key (injected at build time) --');
  L.push('var EMBEDDED_PUBLIC_KEY = ' + JSON.stringify(publicKey) + ';');
  L.push('');
  L.push('// -- Access level definitions --');
  L.push('var ACCESS_LEVELS = {');
  L.push('  development:  { maxConcurrent: 1,  features: { a2a: false, mcp: false, enterprise: false } },');
  L.push('  professional: { maxConcurrent: 5,  features: { a2a: true,  mcp: true,  enterprise: false } },');
  L.push('  enterprise:   { maxConcurrent: 20, features: { a2a: true,  mcp: true,  enterprise: true  } },');
  L.push('  unlimited:    { maxConcurrent: 0,  features: { a2a: true,  mcp: true,  enterprise: true  } },');
  L.push('};');
  L.push('');
  L.push('// -- Error class --');
  L.push('function LicenseError(message) {');
  L.push('  this.name = "LicenseError";');
  L.push('  this.message = "[SGM LICENSE] " + message;');
  L.push('  Error.captureStackTrace(this, LicenseError);');
  L.push('}');
  L.push('LicenseError.prototype = Object.create(Error.prototype);');
  L.push('LicenseError.prototype.constructor = LicenseError;');
  L.push('');
  L.push('// -- Semaphore: concurrent instance limit --');
  L.push('function Semaphore(limit, license) {');
  L.push('  this.limit = limit;');
  L.push('  this.count = 0;');
  L.push('  this.license = license;');
  L.push('  this.waiting = [];');
  L.push('}');
  L.push('');
  L.push('Semaphore.prototype.acquire = function () {');
  L.push('  var self = this;');
  L.push('  if (this.limit > 0 && this.count >= this.limit) {');
  L.push('    return new Promise(function (resolve, reject) {');
  L.push('      var timeoutId = setTimeout(function () {');
  L.push('        var idx = self.waiting.findIndex(function (w) { return w.resolve === resolve; });');
  L.push('        if (idx >= 0) {');
  L.push('          self.waiting.splice(idx, 1);');
  L.push('        }');
  L.push('        reject(new LicenseError(');
  L.push('          "License limit exceeded: " + self.limit + " concurrent instances max. " +');
  L.push('          "Currently: " + self.count + ", waiting: " + self.waiting.length + ". " +');
  L.push('          "User: " + self.license.sub');
  L.push('        ));');
  L.push('      }, 5000);');
  L.push('');
  L.push('      self.waiting.push({');
  L.push('        resolve: function () { clearTimeout(timeoutId); resolve(); },');
  L.push('        reject: function (err) { clearTimeout(timeoutId); reject(err); },');
  L.push('      });');
  L.push('    });');
  L.push('  }');
  L.push('');
  L.push('  this.count++;');
  L.push('  return {');
  L.push('    release: function () {');
  L.push('      self.count--;');
  L.push('      if (self.waiting.length > 0) {');
  L.push('        var next = self.waiting.shift();');
  L.push('        next.resolve();');
  L.push('      }');
  L.push('    },');
  L.push('  };');
  L.push('};');
  L.push('');
  L.push('// -- License manager singleton --');
  L.push('function LicenseManager() {');
  L.push('  this.license = null;');
  L.push('  this.semaphore = null;');
  L.push('  this._loaded = false;');
  L.push('}');
  L.push('');
  L.push('LicenseManager.prototype.readFromSecretStore = function () {');
  L.push("  var execFileSync = require('child_process').execFileSync;");
  L.push('  var osName = os.platform();');
  L.push('  try {');
  L.push("    if (osName === 'darwin') {");
  L.push("      return execFileSync('security', ['find-generic-password', '-a', 'scenegraphmanager', '-s', 'sgm-license', '-w'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();");
  L.push('    }');
  L.push("    if (osName === 'linux') {");
  L.push("      return execFileSync('secret-tool', ['lookup', 'service', 'scenegraphmanager', 'key', 'sgm-license'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();");
  L.push('    }');
  L.push("    if (osName === 'win32') {");
  L.push('      var ps = \'(Get-StoredCredential -Target "scenegraphmanager/sgm-license\").GetNetworkCredential().Password\';');
  L.push("      return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();");
  L.push('    }');
  L.push('  } catch (e) {')
  L.push('    // Not found or command not available');
  L.push('  }');
  L.push('  return null;');
  L.push('};');
  L.push('');
  L.push('LicenseManager.prototype.load = function () {');
  L.push('  if (this._loaded) return;');
  L.push('  this._loaded = true;');
  L.push('');
  L.push('  // 1. Test override (SGM_LICENSE_RAW) — for E2E tests only, highest priority');
  L.push('  var rawOverride = process.env.SGM_LICENSE_RAW;');
  L.push('  var secret = null;');
  L.push('  if (rawOverride) {');
  L.push('    try {');
  L.push('      secret = JSON.parse(rawOverride);');
  L.push('    } catch (e) {');
  L.push('      // invalid JSON — fall through to secret store');
  L.push('    }');
  L.push('  }');
  L.push('');
  L.push('  // 2. Read from OS secret store (primary for production)');
  L.push('  if (!secret) {');
  L.push('    secret = this.readFromSecretStore();');
  L.push('  }');
  L.push('');
  L.push('  // 3. Development fallback (no secret store — local dev only)');
  L.push('  if (!secret) {');
  L.push("    console.warn('[SGM LICENSE] No license in secret store. Running in development mode.');");
  L.push('    this.license = this._createDevLicense();');
  L.push('    this.semaphore = new Semaphore(this.license.maxConcurrent, this.license);');
  L.push('    return;');
  L.push('  }');
  L.push('');
  L.push('  // 4. Verify and validate');
  L.push('  this.license = this._verifyLicenseData(secret);');
  L.push('  this._validateLevel(this.license.level);');
  L.push('  this.semaphore = new Semaphore(this.license.maxConcurrent, this.license);');
  L.push('};');
  L.push('');
  L.push('LicenseManager.prototype._verifyLicenseData = function (rawJson) {');
  L.push('  var license;');
  L.push('  try {');
  L.push('    license = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;');
  L.push('  } catch (e) {');
  L.push('    throw new LicenseError("Invalid license data");');
  L.push('  }');
  L.push('');
  L.push('  // Reconstruct payload for verification (exclude sig + alg)');
  L.push('  var payloadForVerify = Object.assign({}, license);');
  L.push('  delete payloadForVerify.sig;');
  L.push('  delete payloadForVerify.alg;');
  L.push('  var payloadJson = JSON.stringify(payloadForVerify, null, 2);');
  L.push('  var dataForVerify = Buffer.from(payloadJson, "utf8");');
  L.push("  var signature = Buffer.from(license.sig, 'base64url');");
  L.push('');
  L.push('  var valid = crypto.verify(');
  L.push('    null,');
  L.push('    dataForVerify,');
  L.push('    EMBEDDED_PUBLIC_KEY,');
  L.push('    signature');
  L.push('  );');
  L.push('');
  L.push('  if (!valid) {');
  L.push("    throw new LicenseError('License signature verification failed');");
  L.push('  }');
  L.push('');
  L.push('  // Expiry check');
  L.push('  var expDate = new Date(license.exp);');
  L.push('  var now = new Date();');
  L.push('  if (now >= expDate) {');
  L.push('    throw new LicenseError("License expired: " + license.exp + ". User: " + license.sub);');
  L.push('  }');
  L.push('');
  L.push('  return license;');
  L.push('};');
  L.push('');
  L.push('LicenseManager.prototype._validateLevel = function (level) {');
  L.push('  if (!ACCESS_LEVELS[level]) {');
  L.push('    throw new LicenseError("Unknown access level: " + level);');
  L.push('  }');
  L.push('};');
  L.push('');
  L.push('LicenseManager.prototype._createDevLicense = function () {');
  L.push('  return {');
  L.push("    jti: 'dev-localhost',");
  L.push("    sub: 'developer',");
  L.push("    iss: 'kudos-ai',");
  L.push("    level: 'development',");
  L.push('    maxConcurrent: 1,');
  L.push('    maxDurationMin: 0,');
  L.push("    _dev: true,");
  L.push('  };');
  L.push('};');
  L.push('');
  L.push('LicenseManager.prototype.acquire = function () {');
  L.push('  if (!this.semaphore) {');
  L.push("    throw new LicenseError('License not loaded. Call load() first.');");
  L.push('  }');
  L.push('  return this.semaphore.acquire();');
  L.push('};');
  L.push('');
  L.push('Object.defineProperty(LicenseManager.prototype, "features", {');
  L.push('  get: function () {');
  L.push('    if (!this.license) return null;');
  L.push('    return ACCESS_LEVELS[this.license.level] ? ACCESS_LEVELS[this.license.level].features : null;');
  L.push('  },');
  L.push('  configurable: true,');
  L.push('});');
  L.push('');
  L.push('LicenseManager.prototype.checkFeature = function (feature) {');
  L.push('  if (!this.license) return false;');
  L.push('  var f = this.features;');
  L.push('  return f ? (f[feature] || false) : false;');
  L.push('};');
  L.push('');
  L.push('// -- Export --');
  L.push('var licenseManager = new LicenseManager();');
  L.push('module.exports = { LicenseManager: LicenseManager, LicenseError: LicenseError, licenseManager: licenseManager, ACCESS_LEVELS: ACCESS_LEVELS };');
  return L.join('\n');
}

// ── lock.cjs source ──
function buildLockCjs() {
  var L = [];
  L.push("'use strict';");
  L.push('');
  L.push("var crypto = require('crypto');");
  L.push("var fs = require('fs');");
  L.push("var path = require('path');");
  L.push('');
  L.push('// -- Error class --');
  L.push('function LockError(message) {');
  L.push('  this.name = "LockError";');
  L.push('  this.message = "[SGM LOCK] " + message;');
  L.push('  Error.captureStackTrace(this, LockError);');
  L.push('}');
  L.push('LockError.prototype = Object.create(Error.prototype);');
  L.push('LockError.prototype.constructor = LockError;');
  L.push('');
  L.push('// -- Invoke mutex: prevents concurrent WorkflowEngine.invoke() --');
  L.push('function InvokeMutex() {');
  L.push('  this.locked = false;');
  L.push('  this.waiting = [];');
  L.push('}');
  L.push('');
  L.push('InvokeMutex.prototype.acquire = function () {');
  L.push('  var self = this;');
  L.push('  if (this.locked) {');
  L.push('    return new Promise(function (resolve, reject) {');
  L.push('      var timeoutId = setTimeout(function () {');
  L.push('        var idx = self.waiting.findIndex(function (w) { return w.resolve === resolve; });');
  L.push('        if (idx >= 0) {');
  L.push('          self.waiting.splice(idx, 1);');
  L.push('        }');
  L.push('        reject(new LockError(');
  L.push("          'WorkflowEngine.invoke() is already in progress. ' +");
  L.push("          'Concurrent invocations are not allowed.'");
  L.push('        ));');
  L.push('      }, 30000);');
  L.push('');
  L.push('      self.waiting.push({');
  L.push('        resolve: function () { clearTimeout(timeoutId); resolve(); },');
  L.push('        reject: function (err) { clearTimeout(timeoutId); reject(err); },');
  L.push('      });');
  L.push('    });');
  L.push('  }');
  L.push('');
  L.push('  this.locked = true;');
  L.push('  return {');
  L.push('    release: function () {');
  L.push('      self.locked = false;');
  L.push('      if (self.waiting.length > 0) {');
  L.push('        var next = self.waiting.shift();');
  L.push('        next.resolve();');
  L.push('      }');
  L.push('    },');
  L.push('  };');
  L.push('};');
  L.push('');
  L.push('// -- Hash manifest verifier --');
  // Use __SGM_DIST_ROOT set by bootstrap.cjs, fallback to walking up from __dirname
  L.push("var MANIFEST_PATH = (function() {");
  L.push("  if (globalThis.__SGM_DIST_ROOT) return path.join(globalThis.__SGM_DIST_ROOT, '.integrity-manifest.json');");
  L.push("  var d = __dirname;");
  L.push("  while (d && d.length > 1) {");
  L.push("    var p = path.join(d, '.integrity-manifest.json');");
  L.push("    if (fs.existsSync(p)) return p;");
  L.push("    var parent = path.dirname(d);");
  L.push("    if (parent === d) break;");
  L.push("    d = parent;");
  L.push("  }");
  L.push("  return path.join(__dirname, '.integrity-manifest.json');");
  L.push("})();");
  L.push('');
  L.push('function loadManifest() {');
  L.push('  try {');
  L.push('    var raw = fs.readFileSync(MANIFEST_PATH, "utf8");');
  L.push('    return JSON.parse(raw);');
  L.push('  } catch (e) {');
  L.push('    return null;');
  L.push('  }');
  L.push('}');
  L.push('');
  L.push('function verifyIntegrity() {');
  L.push('  var manifest = loadManifest();');
  L.push('  if (!manifest) {');
  L.push("    console.warn('[SGM LOCK] No integrity manifest found. Skipping hash verification.');");
  L.push('    return;');
  L.push('  }');
  L.push('');
  L.push('  if (manifest.version !== 1) {');
  L.push('    throw new LockError("Unsupported manifest version: " + manifest.version);');
  L.push('  }');
  L.push('');
  L.push('  // Verify manifest self-hash (detect tampering of the manifest itself)');
  L.push('  if (manifest.selfHash) {');
  L.push('    var sorted = {};');
  L.push('    var selfKeys = Object.keys(manifest).filter(function (k) { return k !== "selfHash"; });');
  L.push('    selfKeys.sort();');
  L.push('    for (var si = 0; si < selfKeys.length; si++) {');
  L.push('      sorted[selfKeys[si]] = manifest[selfKeys[si]];');
  L.push('    }');
  L.push("    var contentForHash = JSON.stringify(sorted, null, 2);");
  L.push("    var computedHash = crypto.createHash('sha256').update(contentForHash).digest('hex');");
  L.push('    if (computedHash !== manifest.selfHash) {');
  L.push("      var mode = process.env.SGM_LOCK_MODE || 'deny';");
  L.push("      console.error('[SGM LOCK] INTEGRITY VIOLATION: manifest self-hash mismatch');");
  L.push("      console.error('[SGM LOCK]   expected: ' + manifest.selfHash.slice(0, 16));");
  L.push("      console.error('[SGM LOCK]   computed: ' + computedHash.slice(0, 16));");
  L.push("      if (mode === 'deny') {");
  L.push("        console.error('[SGM LOCK] Application terminated (SGM_LOCK_MODE=deny)');");
  L.push('        process.exit(99);');
  L.push('      } else {');
  L.push("        console.warn('[SGM LOCK] Continuing in warn mode (SGM_LOCK_MODE=warn)');");
  L.push('      }');
  L.push('    } else {');
  L.push("      console.log('[SGM LOCK] Manifest self-hash verified OK');");
  L.push('    }');
  L.push('  }');
  L.push('');
  L.push('  var errors = [];');
  L.push('  var fileEntries = Object.entries(manifest.files);');
  L.push('  for (var fi = 0; fi < fileEntries.length; fi++) {');
  L.push('    var fileEntry = fileEntries[fi];');
  L.push('    var file = fileEntry[0];');
  L.push('    var expectedHash = fileEntry[1];');
  L.push('    if (file === ".integrity-manifest.json") continue;');
  L.push('    var filePath = path.join(globalThis.__SGM_DIST_ROOT || __dirname, file);');
  L.push('    try {');
  L.push('      var content = fs.readFileSync(filePath);');
  L.push("      var actualHash = crypto.createHash('sha256').update(content).digest('hex');");
  L.push('      if (actualHash !== expectedHash) {');
  L.push('        errors.push({');
  L.push('          file: file,');
  L.push('          expected: expectedHash.slice(0, 16),');
  L.push('          actual: actualHash.slice(0, 16),');
  L.push('        });');
  L.push('      }');
  L.push('    } catch (e) {');
  L.push('      errors.push({ file: file, error: "MISSING" });');
  L.push('    }');
  L.push('  }');
  L.push('');
  L.push('  if (errors.length > 0) {');
  L.push("    var mode = process.env.SGM_LOCK_MODE || 'deny';");
  L.push("    console.error('[SGM LOCK] INTEGRITY VIOLATION DETECTED');");
  L.push('    for (var j = 0; j < errors.length; j++) {');
  L.push('      var e = errors[j];');
  L.push('      var detail = e.error;');
  L.push('      if (!detail && e.expected) {');
  L.push('        detail = "expected=" + e.expected + " actual=" + e.actual;');
  L.push('      }');
  L.push('      console.error("[SGM LOCK]   " + e.file + ": " + detail);');
  L.push('    }');
  L.push("    if (mode === 'deny') {");
  L.push("      console.error('[SGM LOCK] Application terminated (SGM_LOCK_MODE=deny)');");
  L.push('      process.exit(99);');
  L.push('    } else {');
  L.push("      console.warn('[SGM LOCK] Continuing in warn mode (SGM_LOCK_MODE=warn)');");
  L.push('    }');
  L.push('  }');
  L.push('}');
  L.push('');
  L.push('// -- Export --');
  L.push('module.exports = { InvokeMutex: InvokeMutex, LockError: LockError, verifyIntegrity: verifyIntegrity, loadManifest: loadManifest };');
  return L.join('\n');
}

// ── bootstrap.cjs source ──
function buildBootstrapCjs() {
  return [
    "'use strict';",
    '',
    "var path = require('path');",
    "var fs = require('fs');",
    '',
    '// Find the dist root by walking up from __dirname to find .integrity-manifest.json',
    "var __SGM_DIST_ROOT = (function() {",
    '  var d = __dirname;',
    '  while (d && d.length > 1) {',
    '    var p = path.join(d, \".integrity-manifest.json\");',
    '    if (fs.existsSync(p)) return d;',
    '    var parent = path.dirname(d);',
    '    if (parent === d) break;',
    '    d = parent;',
    '  }',
    '  return __dirname;',
    '})();',
    'globalThis.__SGM_DIST_ROOT = __SGM_DIST_ROOT;',
    '',
    'var _initPromise = null;',
    '',
    '/**',
    ' * Initialize the tamper-resistant lock system.',
    ' * Loads license.cjs (signature verification + expiry) and lock.cjs (mutex).',
    ' * Idempotent -- safe to call from multiple files.',
    ' */',
    'async function bootstrap() {',
    '  if (_initPromise) return _initPromise;',
    '  _initPromise = (async () => {',
    '    // 1. Load license manager',
    "    var lmMod = require(path.join(__SGM_DIST_ROOT, 'license.cjs'));",
    '    lmMod.licenseManager.load();',
    '    globalThis.__SGM_LICENSE_MANAGER = lmMod.licenseManager;',
    '',
    '    // 2. Load invoke mutex + hash verifier',
    '    try {',
    "      var lkMod = require(path.join(__SGM_DIST_ROOT, 'lock.cjs'));",
    '      globalThis.__SGM_LOCK = new lkMod.InvokeMutex();',
    '      globalThis.__SGM_VERIFY = lkMod.verifyIntegrity;',
    '',
    '      // Run integrity check',
    '      lkMod.verifyIntegrity();',
    '    } catch (e) {',
    '      // lock.cjs not found -- run without mutex',
    "      console.warn('[SGM LOCK] lock.cjs not found. Running without mutex.');",
    '    }',
    '',
    '    return lmMod.licenseManager;',
    '  })();',
    '  return _initPromise;',
    '}',
    '',
    "module.exports = { bootstrap: bootstrap };",
    '',
  ].join('\n');
}

// ── Main ──

function main() {
  console.log('[inject-lock] Starting lock/license injection...');
  console.log('[inject-lock] dist/: ' + DIST);
  console.log('[inject-lock] public key: ' + publicKeyPath);
  console.log('[inject-lock] dry-run: ' + DRY_RUN);
  console.log('[inject-lock] inject-only: ' + INJECT_ONLY);
  console.log('');

  // 1. Verify dist/ exists
  if (!existsSync(DIST)) {
    console.error('[inject-lock] dist/ does not exist. Run yarn build first.');
    process.exit(1);
  }

  // --inject-only: skip public key check and key-dependent steps
  if (INJECT_ONLY) {
    console.log('[inject-lock] --inject-only mode: skipping license/lock/bootstrap generation');
  } else if (!existsSync(publicKeyPath)) {
    console.error('[inject-lock] Public key not found: ' + publicKeyPath);
    console.error('[inject-lock] Set SGM_PUBLIC_KEY_PATH or place sgm-public.key at repo root');
    process.exit(1);
  }

  // 2. Generate and write license.cjs (skip in inject-only mode)
  if (!INJECT_ONLY) {
    var licenseCjs = buildLicenseCjs(publicKeyPem);
    if (DRY_RUN) {
      console.log('[dry-run] Would create dist/license.cjs (' + licenseCjs.length + ' bytes)');
    } else {
      writeFileSync(join(DIST, 'license.cjs'), licenseCjs, 'utf8');
      console.log('[inject-lock] ✓ dist/license.cjs (' + licenseCjs.length + ' bytes)');
    }

    // 3. Generate and write lock.cjs
    var lockCjs = buildLockCjs();
    if (DRY_RUN) {
      console.log('[dry-run] Would create dist/lock.cjs (' + lockCjs.length + ' bytes)');
    } else {
      writeFileSync(join(DIST, 'lock.cjs'), lockCjs, 'utf8');
      console.log('[inject-lock] ✓ dist/lock.cjs (' + lockCjs.length + ' bytes)');
    }

    // 4. Generate and write bootstrap.cjs
    var bootstrapCjs = buildBootstrapCjs();
    if (DRY_RUN) {
      console.log('[dry-run] Would create dist/bootstrap.cjs (' + bootstrapCjs.length + ' bytes)');
    } else {
      writeFileSync(join(DIST, 'bootstrap.cjs'), bootstrapCjs, 'utf8');
      console.log('[inject-lock] ✓ dist/bootstrap.cjs (' + bootstrapCjs.length + ' bytes)');
      // Copy bootstrap.cjs, license.cjs, and lock.cjs to all subdirectories
      // so that require() paths inside bootstrap.cjs resolve correctly
      var cjsFiles = ['bootstrap.cjs', 'license.cjs', 'lock.cjs'];
      function copyCjsToSubdirs(dir) {
        var entries = readdirSync(dir);
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var full = join(dir, entry);
          var st = statSync(full);
          if (st.isDirectory()) {
            for (var k = 0; k < cjsFiles.length; k++) {
              writeFileSync(join(full, cjsFiles[k]), readFileSync(join(DIST, cjsFiles[k])), 'utf8');
            }
            copyCjsToSubdirs(full);
          }
        }
      }
      copyCjsToSubdirs(DIST);
      console.log('[inject-lock] ✓ copied .cjs files to all subdirectories');
    }

    // 5. Inject bootstrap into all existing ESM JS files (skip .cjs files)
    var GENERATED_FILES = {
      'license.cjs': true,
      'lock.cjs': true,
      'bootstrap.cjs': true,
    };
    var distFiles = listDistFiles();
    var modifiedFiles = [];
    for (var i = 0; i < distFiles.length; i++) {
      var rel = distFiles[i];
      if (GENERATED_FILES[rel]) continue;
      if (!rel.endsWith('.js')) continue;
      var fullPath = join(DIST, rel);
      var content = readFileSync(fullPath, 'utf8');
      if (!content.includes('__SGM_INJECTED__')) {
        if (DRY_RUN) {
          console.log('[dry-run] Would prepend bootstrap to ' + rel);
          modifiedFiles.push(rel);
        } else {
          writeFileSync(fullPath, BOOTSTRAP_PREFIX + content, 'utf8');
          modifiedFiles.push(rel);
        }
      }
    }
    if (DRY_RUN) {
      console.log('[dry-run] Would modify ' + modifiedFiles.length + ' file(s)');
    } else {
      for (var j = 0; j < modifiedFiles.length; j++) {
        console.log('[inject-lock] ✓ injected bootstrap into ' + modifiedFiles[j]);
      }
    }
  } else {
    console.log('[inject-lock] Skipping license/lock/bootstrap generation (inject-only mode)');
  }

  // 5.5. Inject license semaphore into WorkflowEngine.invoke() (workflow.js only)
  var workflowPath = join(DIST, 'lib', 'workflow.js');
  if (existsSync(workflowPath)) {
    var workflowCode = readFileSync(workflowPath, 'utf8');
    var injected = injectInvokeMutex(workflowCode);

    // 5.6. Inject feature gate into WorkflowEngine.build()
    injected = injectBuildFeatureGate(injected);

    if (injected !== workflowCode) {
      if (DRY_RUN) {
        console.log('[dry-run] Would inject license semaphore into workflow.js invoke()');
        console.log('[dry-run] Would inject feature gate into workflow.js build()');
      } else {
        writeFileSync(workflowPath, injected, 'utf8');
        console.log('[inject-lock] ✓ injected license semaphore into workflow.js invoke()');
        console.log('[inject-lock] ✓ injected feature gate into workflow.js build()');
      }
    } else {
      console.log('[inject-lock] - workflow.js: invoke() not found, skipping mutex injection');
    }
  }

  // 6. Generate integrity manifest
  if (DRY_RUN) {
    console.log('[dry-run] Would generate dist/.integrity-manifest.json');
  } else {
    var manifest = generateManifest();
    writeFileSync(join(DIST, '.integrity-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    console.log('[inject-lock] ✓ dist/.integrity-manifest.json (' + Object.keys(manifest.files).length + ' files)');
  }

  console.log('');
  console.log('[inject-lock] Done.');
}

function generateManifest() {
  var distFiles = listDistFiles();
  var files = {};
  for (var i = 0; i < distFiles.length; i++) {
    var rel = distFiles[i];
    if (rel === '.integrity-manifest.json') continue;
    var fullPath = join(DIST, rel);
    var content = readFileSync(fullPath);
    var hash = createHash('sha256').update(content).digest('hex');
    files[rel] = hash;
  }

  // Two-pass: compute self-hash of manifest without selfHash, then add it
  // Must match the verification logic in lock.cjs: sort keys, exclude selfHash
  var manifestNoSelf = {
    version: 1,
    generatedAt: new Date().toISOString(),
    files: files,
  };
  // Sort keys the same way verifyIntegrity() does
  var sortedKeys = Object.keys(manifestNoSelf).sort();
  var sorted = {};
  for (var i = 0; i < sortedKeys.length; i++) {
    sorted[sortedKeys[i]] = manifestNoSelf[sortedKeys[i]];
  }
  var contentForHash = JSON.stringify(sorted, null, 2);
  var selfHash = createHash('sha256').update(contentForHash).digest('hex');

  return {
    version: 1,
    generatedAt: manifestNoSelf.generatedAt,
    selfHash: selfHash,
    files: files,
  };
}

main();
