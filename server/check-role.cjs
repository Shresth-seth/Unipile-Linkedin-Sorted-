const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NoBl2i9yPcpq@ep-little-recipe-ay9d5cov-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require' });
pool.query("SELECT email, role FROM users WHERE email='admin@example.com'", (err, res) => {
  console.log(res.rows);
  process.exit(0);
});
