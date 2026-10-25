try { require('dotenv').config(); } catch (e) {}
let Pool;
try {
  Pool = require('pg').Pool;
} catch (e) {}

const connectionString = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();
if (!connectionString) {
  console.error("❌ Fatal: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const targetEmail = process.env.CHECK_EMAIL || 'admin@example.com';

pool.query("SELECT email, role FROM users WHERE email = $1", [targetEmail], (err, res) => {
  if (err) {
    console.error("Query failed:", err.message);
    process.exit(1);
  }
  console.log(res.rows);
  pool.end();
  process.exit(0);
});
