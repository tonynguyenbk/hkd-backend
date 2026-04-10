const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const userRepo  = require('../repositories/user.repository');
const tokenRepo = require('../repositories/token.repository');
const { signAccess, signRefresh, hashToken } = require('../utils/jwt');

const REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;

async function register({ email, password, full_name, phone }) {
  const exists = await userRepo.existsByEmail(email.toLowerCase());
  if (exists) throw Object.assign(new Error('EMAIL_EXISTS'), { status: 400 });

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await userRepo.create(email.toLowerCase(), hash, full_name || '', phone || '');
  const user = rows[0];

  const accessToken  = signAccess(user.id);
  const refreshToken = signRefresh(user.id);
  const expiresAt    = new Date(Date.now() + REFRESH_EXPIRES_MS);
  await tokenRepo.create(user.id, hashToken(refreshToken), expiresAt);

  return { user: { id: user.id, email: user.email, full_name: user.full_name }, accessToken, refreshToken };
}

async function login({ email, password }) {
  const { rows } = await userRepo.findByEmail(email.toLowerCase());
  if (!rows.length) throw Object.assign(new Error('INVALID_CREDENTIALS'), { status: 401 });

  const user  = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw Object.assign(new Error('INVALID_CREDENTIALS'), { status: 401 });

  await userRepo.updateLastLogin(user.id);

  const accessToken  = signAccess(user.id);
  const refreshToken = signRefresh(user.id);
  const expiresAt    = new Date(Date.now() + REFRESH_EXPIRES_MS);
  await tokenRepo.create(user.id, hashToken(refreshToken), expiresAt);

  return { user: { id: user.id, email: user.email, full_name: user.full_name }, accessToken, refreshToken };
}

async function refresh({ refreshToken }) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch {
    throw Object.assign(new Error('INVALID_TOKEN'), { status: 401 });
  }
  if (decoded.type !== 'refresh') throw Object.assign(new Error('INVALID_TOKEN'), { status: 401 });

  const { rows } = await tokenRepo.findValid(hashToken(refreshToken));
  if (!rows.length) throw Object.assign(new Error('TOKEN_EXPIRED'), { status: 401 });

  return { accessToken: signAccess(decoded.sub) };
}

async function logout({ userId, refreshToken }) {
  if (refreshToken) await tokenRepo.revoke(hashToken(refreshToken));
}

module.exports = { register, login, refresh, logout };
