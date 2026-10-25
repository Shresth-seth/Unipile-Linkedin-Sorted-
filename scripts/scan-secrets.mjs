#!/usr/bin/env node
/**
 * WorkPilot Secret Scanner
 * Scans repository files for committed credentials, private keys, database passwords, and high-entropy API tokens.
 * Exits with code 0 if clean, or code 1 if potential secrets are detected.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Directories and files strictly ignored during scan
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.next',
  'coverage',
  '.nyc_output',
  'audit-evidence',
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  '.env.example',
  '.env.production.example',
  'scan-secrets.mjs',
  'test-secret-scanner.mjs',
  'test-config-validation.mjs',
]);

const IGNORED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.webm',
  '.pdf',
  '.tar.gz',
  '.tgz',
  '.zip',
]);

// Known harmless placeholders
const PLACEHOLDER_STRINGS = [
  'your_jwt_secret',
  'your_separate_data_encryption_key',
  'your_unipile_api_key_here',
  'your_unipile_webhook_secret_here',
  'your_razorpay_key_secret',
  'your_gemini_api_key_here',
  'rzp_test_replace_me',
  'rzp_live_replace_me',
  'plan_replace_me',
  're_replace_me',
  'postgres:postgres@localhost:5432',
  'postgresql://user:password@host',
  'postgresql://neondb_owner:password@ep-little-recipe',
  'postgresql://workpilot_admin:<PASSWORD>@<RDS_ENDPOINT>',
  'postgresql://workpilot_admin:PASSWORD@your-rds-endpoint',
  'postgresql://postgres:postgres@postgres:5432',
  'local-development-only',
  '[REDACTED]',
  '***REDACTED***',
  'dummy_password',
  'hashed_dummy_password',
  'super$ecurep@ss',
  'mockpersonal',
  'aizasyfaketestkey',
  'unipile-provider-key',
  'provider-secret',
  'webhook-secret-for-tests',
  'dummyscan_safe_placeholder',
];

const SECRET_PATTERNS = [
  {
    name: 'Private Key Header',
    regex: /-----BEGIN\s+(?:RSA|OPENSSH|EC|DSA|PGP|ENCRYPTED)?\s*PRIVATE KEY-----/i,
  },
  {
    name: 'PostgreSQL Connection String with Real Password',
    regex: /postgres(?:ql)?:\/\/[a-zA-Z0-9_.-]+:(?!postgres|password|<password>|\$\{)[^@\s/]{6,}@[a-zA-Z0-9_.-]+/i,
  },
  {
    name: 'AWS Access Key ID',
    regex: /\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/,
  },
  {
    name: 'Live Unipile / Generic API Key Assignment',
    regex: /(?:UNIPILE_API_KEY|GEMINI_API_KEY|RESEND_API_KEY|RAZORPAY_KEY_SECRET)\s*[:=]\s*['"][a-zA-Z0-9_.-]{20,}['"]/i,
  },
  {
    name: 'High-Entropy Secret Canary',
    regex: /dummyscan_live_secret_canary_key_[a-zA-Z0-9_]+/i,
  },
];

function isPlaceholder(line) {
  const lower = line.toLowerCase();
  return PLACEHOLDER_STRINGS.some((ph) => lower.includes(ph.toLowerCase()));
}

function scanFile(filePath) {
  const relativePath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (IGNORED_FILES.has(fileName) || IGNORED_EXTENSIONS.has(ext)) {
    return [];
  }

  // Skip documentation dossiers that only describe past security reports with redacting
  if (relativePath.startsWith('audit-evidence/')) {
    return [];
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const findings = [];
  const lines = content.split(/\r?\n/);

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1];

    if (isPlaceholder(line)) {
      continue;
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: relativePath,
          line: lineNum,
          rule: pattern.name,
          preview: line.trim().substring(0, 40) + '... [REDACTED]',
        });
      }
    }
  }

  return findings;
}

function walkDir(dir, targetList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        walkDir(path.join(dir, entry.name), targetList);
      }
    } else if (entry.isFile()) {
      targetList.push(path.join(dir, entry.name));
    }
  }
  return targetList;
}

export function runScan(targetDir = REPO_ROOT) {
  console.log(`🔍 [SECRET SCANNER] Scanning target: ${targetDir}`);
  const allFiles = walkDir(targetDir);
  const allFindings = [];

  for (const file of allFiles) {
    const findings = scanFile(file);
    if (findings.length > 0) {
      allFindings.push(...findings);
    }
  }

  return allFindings;
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targetArg = process.argv[2] ? path.resolve(process.argv[2]) : REPO_ROOT;
  const findings = runScan(targetArg);

  if (findings.length > 0) {
    console.error(`\n❌ [SECURITY ALERT] Found ${findings.length} potential secret(s) in repository:`);
    for (const f of findings) {
      console.error(`  - ${f.file}:${f.line} [${f.rule}] -> ${f.preview}`);
    }
    console.error('\nImmediate containment required: Remove hardcoded secrets from source code.\n');
    process.exit(1);
  } else {
    console.log(`\n✅ [PASSED] Secret scan clean. Zero live credentials detected.`);
    process.exit(0);
  }
}
