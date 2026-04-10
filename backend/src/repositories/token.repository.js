const pool = require('../config/db');

const create = (userId, tokenHash, expiresAt) =>
  pool.query(
    'INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,$3)',
    [userId, tokenHash, expiresAt]
  );

const findValid = (tokenHash) =>
  pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash=$1 AND revoked=false AND expires_at>NOW()',
    [tokenHash]
  );

const revoke = (tokenHash) =>
  pool.query('UPDATE refresh_tokens SET revoked=true WHERE token_hash=$1', [tokenHash]);

module.exports = { create, findValid, revoke };
