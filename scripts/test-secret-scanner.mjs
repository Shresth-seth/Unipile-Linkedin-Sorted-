#!/usr/bin/env node
/**
 * Secret Scanner Regression Test
 *
 * Verifies that:
 * 1. Clean repository passes scan (0 findings).
 * 2. When a canary dummy secret is introduced in an isolated fixture, scanner detects it and fails.
 * 3. After removing the canary fixture, scanner passes again.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runScan } from './scan-secrets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'test-fixtures');
const CANARY_FILE = path.join(FIXTURE_DIR, 'canary-secret.tmp');

console.log('======================================================');
console.log('🧪 RUNNING SECRET SCANNER REGRESSION TEST SUITE');
console.log('======================================================\n');

try {
  // Test Phase 1: Baseline Clean Repo Verification
  console.log('[Phase 1] Scanning baseline repository...');
  const baselineFindings = runScan(REPO_ROOT);
  assert.equal(
    baselineFindings.length,
    0,
    `Expected 0 findings in clean repository, but got ${baselineFindings.length}`
  );
  console.log('✓ Baseline scan clean (0 findings)\n');

  // Test Phase 2: Canary Secret Injection (Isolated Fixture)
  console.log('[Phase 2] Introducing dummy canary secret fixture...');
  if (!fs.existsSync(FIXTURE_DIR)) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  }

  const dummyCanarySecret = 'CANARY_API_KEY="dummyscan_live_secret_canary_key_9988776655aabbcc"';
  fs.writeFileSync(CANARY_FILE, dummyCanarySecret, 'utf8');
  console.log(`✓ Created isolated test fixture: ${path.relative(REPO_ROOT, CANARY_FILE)}`);

  console.log('[Phase 3] Scanning fixture to verify secret detection...');
  const fixtureFindings = runScan(FIXTURE_DIR);
  console.log(`✓ Scanner detected ${fixtureFindings.length} finding(s) as expected:`);
  for (const f of fixtureFindings) {
    console.log(`    - Rule: ${f.rule} (File: ${f.file}:${f.line})`);
  }
  assert.ok(
    fixtureFindings.length > 0,
    'Regression Failure: Scanner failed to detect injected dummy secret!'
  );
  assert.ok(
    fixtureFindings.some((f) => f.rule === 'High-Entropy Secret Canary'),
    'Expected canary rule match'
  );
  console.log('✓ Injected dummy secret successfully caught by scanner!\n');

  // Test Phase 4: Cleanup Fixture
  console.log('[Phase 4] Cleaning up dummy secret fixture...');
  if (fs.existsSync(CANARY_FILE)) {
    fs.unlinkSync(CANARY_FILE);
  }
  if (fs.existsSync(FIXTURE_DIR)) {
    fs.rmdirSync(FIXTURE_DIR);
  }
  assert.equal(fs.existsSync(CANARY_FILE), false, 'Fixture file must be deleted');
  console.log('✓ Dummy secret fixture cleanly removed\n');

  // Test Phase 5: Post-Cleanup Verification
  console.log('[Phase 5] Re-scanning repository after cleanup...');
  const postCleanupFindings = runScan(REPO_ROOT);
  assert.equal(
    postCleanupFindings.length,
    0,
    `Expected 0 findings after cleanup, but got ${postCleanupFindings.length}`
  );
  console.log('✓ Post-cleanup scan clean (0 findings)\n');

  console.log('======================================================');
  console.log('🎉 ALL SECRET SCANNER REGRESSION TESTS PASSED!');
  console.log('======================================================');
  process.exit(0);
} catch (error) {
  // Ensure cleanup even on unexpected error
  if (fs.existsSync(CANARY_FILE)) {
    fs.unlinkSync(CANARY_FILE);
  }
  if (fs.existsSync(FIXTURE_DIR)) {
    fs.rmdirSync(FIXTURE_DIR);
  }
  console.error('\n❌ REGRESSION TEST FAILED:', error.message);
  process.exit(1);
}
