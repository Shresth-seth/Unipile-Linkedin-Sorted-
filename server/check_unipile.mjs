try { await import('dotenv/config'); } catch (e) {}

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("❌ Fatal: DATABASE_URL environment variable is required.");
  process.exit(1);
}

let postgres;
try {
  postgres = (await import('postgres')).default;
} catch (e) {
  console.error("❌ Missing postgres driver. Run npm install.");
  process.exit(1);
}

const sql = postgres(connectionString);

async function test() {
  const settings = await sql`SELECT key, value FROM system_settings`;
  console.log('--- SYSTEM SETTINGS IN DB ---');
  console.log(
    settings.map((s) => ({
      key: s.key,
      value: s.key.toLowerCase().includes('key') || s.key.toLowerCase().includes('secret')
        ? '[REDACTED]'
        : s.value,
    }))
  );

  const unipileAccounts = await sql`SELECT id, user_id, unipile_account_id, linkedin_name, is_connected, health_status FROM linkedin_accounts`;
  console.log('--- LINKEDIN ACCOUNTS IN DB ---');
  console.log(
    unipileAccounts.map((a) => ({
      ...a,
      unipile_account_id: a.unipile_account_id
        ? a.unipile_account_id.substring(0, 4) + '...'
        : null,
    }))
  );

  if (process.env.ADMIN_NEW_HASH) {
    console.log('--- UPDATING ADMIN PASSWORD FROM ENVIRONMENT HASH ---');
    const pwdUpdated = await sql`
      UPDATE users
      SET password = ${process.env.ADMIN_NEW_HASH}, role = 'ADMIN', updated_at = NOW()
      WHERE email = 'admin@workpilot.co.in'
      RETURNING id, name, email, role
    `;
    console.log('Admin user updated:', pwdUpdated);
  }

  await sql.end();
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
