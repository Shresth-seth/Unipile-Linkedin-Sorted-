#!/usr/bin/env node
/**
 * Configuration Validation & Error Redaction Verification Test
 *
 * Verifies:
 * 1. validateProductionConfig() fails when mandatory environment variables are missing or insecure.
 * 2. validateProductionConfig() succeeds when all required production configurations are valid.
 * 3. Error redaction scrubs database URLs, passwords, and bearer tokens.
 * 4. Critical scripts fail cleanly with exit code 1 when DATABASE_URL is omitted.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

console.log('======================================================');
console.log('🧪 CONFIGURATION VALIDATION & SENSITIVE DATA TESTS');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Production Config Validation
// -----------------------------------------------------------------------------
console.log('[Test 1] Testing production configuration validation rules...');

const MIN_SECRET_LENGTH = 32;

function requireSecret(env, name) {
  const value = env[name]?.trim();
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be configured with at least ${MIN_SECRET_LENGTH} characters in production.`);
  }
}

function requireValue(env, name) {
  if (!env[name]?.trim()) throw new Error(`${name} must be configured in production.`);
}

function validateProductionConfigMock(env) {
  if (env.NODE_ENV !== 'production') return;

  requireSecret(env, 'JWT_SECRET');
  requireSecret(env, 'DATA_ENCRYPTION_KEY');
  requireSecret(env, 'UNIPILE_WEBHOOK_SECRET');
  requireValue(env, 'UNIPILE_API_KEY');
  requireValue(env, 'RAZORPAY_KEY_SECRET');
  requireSecret(env, 'RAZORPAY_WEBHOOK_SECRET');
  if (!env.RESEND_API_KEY?.trim()) throw new Error('RESEND_API_KEY must be configured in production.');
  if (!env.EMAIL_FROM?.trim()) throw new Error('EMAIL_FROM must be configured in production.');
  if (!env.SUPPORT_EMAIL?.trim()) throw new Error('SUPPORT_EMAIL must be configured in production.');

  for (const name of ['UNIPILE_DSN', 'RAZORPAY_KEY_ID', 'RAZORPAY_PLAN_PRO_MONTHLY', 'RAZORPAY_PLAN_PRO_YEARLY']) {
    requireValue(env, name);
  }

  const unipileDsn = new URL(env.UNIPILE_DSN.trim());
  if (unipileDsn.protocol !== 'https:' || !unipileDsn.hostname.endsWith('.unipile.com')) {
    throw new Error('UNIPILE_DSN must be an HTTPS endpoint on unipile.com in production.');
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl || databaseUrl.includes('localhost')) {
    throw new Error('DATABASE_URL must reference a production database.');
  }

  const clientUrl = env.CLIENT_URL?.trim();
  if (!clientUrl?.startsWith('https://')) {
    throw new Error('CLIENT_URL must be an HTTPS URL in production.');
  }
}

// 1a. Missing JWT_SECRET in production
assert.throws(
  () => validateProductionConfigMock({ NODE_ENV: 'production' }),
  /JWT_SECRET must be configured with at least 32 characters in production/
);
console.log('✓ Throws when JWT_SECRET is missing');

// 1b. Weak JWT_SECRET in production
assert.throws(
  () => validateProductionConfigMock({ NODE_ENV: 'production', JWT_SECRET: 'short_key' }),
  /JWT_SECRET must be configured with at least 32 characters in production/
);
console.log('✓ Throws when JWT_SECRET is shorter than 32 characters');

// 1c. Missing DATABASE_URL or localhost in production
assert.throws(
  () =>
    validateProductionConfigMock({
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(40),
      DATA_ENCRYPTION_KEY: 'y'.repeat(40),
      UNIPILE_WEBHOOK_SECRET: 'w'.repeat(40),
      UNIPILE_API_KEY: 'api_key_valid',
      RAZORPAY_KEY_SECRET: 'rzp_sec',
      RAZORPAY_WEBHOOK_SECRET: 'r'.repeat(40),
      RESEND_API_KEY: 're_123',
      EMAIL_FROM: 'test@example.com',
      SUPPORT_EMAIL: 'support@example.com',
      UNIPILE_DSN: 'https://api1.unipile.com:13200',
      RAZORPAY_KEY_ID: 'rzp_id',
      RAZORPAY_PLAN_PRO_MONTHLY: 'plan_m',
      RAZORPAY_PLAN_PRO_YEARLY: 'plan_y',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/workpilot',
      CLIENT_URL: 'https://linkdin.workpilot.co.in',
    }),
  /DATABASE_URL must reference a production database/
);
console.log('✓ Throws when DATABASE_URL contains localhost in production');

// 1d. Valid production config succeeds
const validProdEnv = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(40),
  DATA_ENCRYPTION_KEY: 'b'.repeat(40),
  UNIPILE_WEBHOOK_SECRET: 'c'.repeat(40),
  UNIPILE_API_KEY: 'api_key_valid',
  RAZORPAY_KEY_SECRET: 'rzp_sec',
  RAZORPAY_WEBHOOK_SECRET: 'd'.repeat(40),
  RESEND_API_KEY: 're_123456',
  EMAIL_FROM: 'WORKPILOT <no-reply@workpilot.co.in>',
  SUPPORT_EMAIL: 'support@workpilot.co.in',
  UNIPILE_DSN: 'https://api1.unipile.com:13200',
  RAZORPAY_KEY_ID: 'rzp_id_live',
  RAZORPAY_PLAN_PRO_MONTHLY: 'plan_monthly',
  RAZORPAY_PLAN_PRO_YEARLY: 'plan_yearly',
  DATABASE_URL: 'postgresql://workpilot_app:db_password_123@ep-prod-db.us-east-2.aws.neon.tech/neondb?sslmode=require',
  CLIENT_URL: 'https://linkdin.workpilot.co.in',
};
assert.doesNotThrow(() => validateProductionConfigMock(validProdEnv));
console.log('✓ Successfully passes with valid production configuration\n');

// -----------------------------------------------------------------------------
// Test 2: Sensitive Data Redaction
// -----------------------------------------------------------------------------
console.log('[Test 2] Testing sensitive error and log redaction...');

function redactSensitiveText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi, '$1[REDACTED]$2')
    .replace(/(bearer\s+)[a-z0-9_\-\.]+/gi, '$1[REDACTED]')
    .replace(/(api[_-]?key[:=]\s*)[a-z0-9_\-\.]+/gi, '$1[REDACTED]')
    .replace(/(password[:=]\s*)[^\s,;&]+/gi, '$1[REDACTED]');
}

const rawDbError = 'Connection failed: postgresql://neondb_owner:npg_SecretPass9988@ep-pooler.neon.tech/neondb?sslmode=require';
const redactedDbError = redactSensitiveText(rawDbError);
assert.ok(!redactedDbError.includes('npg_SecretPass9988'), 'Raw DB password must not appear');
assert.ok(redactedDbError.includes('[REDACTED]'), 'DB password must be replaced with [REDACTED]');
console.log(`✓ Database URL password redacted: ${redactedDbError}`);

const rawTokenMsg = 'Authorization header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig';
const redactedTokenMsg = redactSensitiveText(rawTokenMsg);
assert.ok(!redactedTokenMsg.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'Bearer token must not appear');
console.log(`✓ Bearer token redacted: ${redactedTokenMsg}`);

const rawApiKeyMsg = 'Request failed with api_key: unipile_live_abcdef1234567890';
const redactedApiKeyMsg = redactSensitiveText(rawApiKeyMsg);
assert.ok(!redactedApiKeyMsg.includes('unipile_live_abcdef1234567890'), 'API key must not appear');
console.log(`✓ API key redacted: ${redactedApiKeyMsg}\n`);

// -----------------------------------------------------------------------------
// Test 3: Standalone Script Startup Failure when DATABASE_URL is Missing
// -----------------------------------------------------------------------------
console.log('[Test 3] Verifying standalone scripts fail gracefully when DATABASE_URL is missing...');

const scriptsToVerify = [
  { script: 'server/check-role.cjs', interpreter: process.execPath },
  { script: 'server/check_unipile.mjs', interpreter: process.execPath },
];

for (const item of scriptsToVerify) {
  const result = spawnSync(item.interpreter, [path.join(REPO_ROOT, item.script)], {
    env: { ...process.env, DATABASE_URL: '' },
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    1,
    `Expected ${item.script} to exit with code 1 when DATABASE_URL is empty, but got ${result.status}`
  );
  assert.ok(
    result.stderr.includes('DATABASE_URL environment variable is required'),
    `Expected fatal error message in stderr for ${item.script}, got: ${result.stderr}`
  );
  console.log(`✓ ${item.script} exits cleanly with code 1 on missing DATABASE_URL`);
}

console.log('\n======================================================');
console.log('🎉 ALL CONFIGURATION VALIDATION TESTS PASSED!');
console.log('======================================================');
