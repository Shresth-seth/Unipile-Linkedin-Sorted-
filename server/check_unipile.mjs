import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_NoBl2i9yPcpq@ep-little-recipe-ay9d5cov-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require');

async function test() {
  const settings = await sql`SELECT key, value FROM system_settings`;
  console.log('--- SYSTEM SETTINGS IN DB ---');
  console.log(settings);

  const unipileAccounts = await sql`SELECT id, user_id, unipile_account_id, linkedin_name, is_connected, health_status FROM linkedin_accounts`;
  console.log('--- LINKEDIN ACCOUNTS IN DB ---');
  console.log(unipileAccounts);

  console.log('--- UPDATING ADMIN PASSWORD ---');
  const newHash = "$2b$10$A1JW0UvbBnmt.ixDvkumO.m6rNPMYASqijto0kNnPozVFxzIh2iqO"; // WorkPilot@2026
  const pwdUpdated = await sql`
    UPDATE users
    SET password = ${newHash}, role = 'ADMIN', updated_at = NOW()
    WHERE email = 'admin@workpilot.co.in'
    RETURNING id, name, email, role
  `;
  console.log('Admin user:', pwdUpdated);

  await sql.end();
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
