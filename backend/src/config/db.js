const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
  max: 3,
});
pool.on('error', (err) => console.error('DB pool error:', err));

module.exports = pool;
