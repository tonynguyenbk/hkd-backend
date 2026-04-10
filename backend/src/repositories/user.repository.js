const pool = require('../config/db');

const existsByEmail = async (email) => {
  const { rows } = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  return rows.length > 0;
};

const findByEmail = (email) =>
  pool.query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email]);

const findById = (id) =>
  pool.query('SELECT id,email,full_name,phone,created_at FROM users WHERE id=$1', [id]);

const create = (email, passwordHash, fullName, phone) =>
  pool.query(
    'INSERT INTO users(email,password_hash,full_name,phone) VALUES($1,$2,$3,$4) RETURNING id,email,full_name',
    [email, passwordHash, fullName, phone]
  );

const updateLastLogin = (id) =>
  pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [id]);

module.exports = { existsByEmail, findByEmail, findById, create, updateLastLogin };
