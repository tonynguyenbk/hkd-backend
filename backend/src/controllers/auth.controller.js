const authService = require('../services/auth.service');
const userRepo    = require('../repositories/user.repository');
const { ok, fail } = require('../utils/response');

const ERR_MSG = {
  EMAIL_EXISTS:        'Email đã được sử dụng',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
  INVALID_TOKEN:       'Token không hợp lệ',
  TOKEN_EXPIRED:       'Token hết hạn hoặc đã bị thu hồi',
};

function handleServiceError(res, err) {
  const msg  = ERR_MSG[err.message] || 'Lỗi hệ thống';
  const code = err.status || 500;
  if (!ERR_MSG[err.message]) console.error(err);
  return fail(res, msg, code);
}

exports.register = async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  if (!email || !password) return fail(res, 'Email và mật khẩu là bắt buộc');
  if (password.length < 6) return fail(res, 'Mật khẩu tối thiểu 6 ký tự');
  try {
    ok(res, await authService.register({ email, password, full_name, phone }));
  } catch (e) { handleServiceError(res, e); }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return fail(res, 'Email và mật khẩu là bắt buộc');
  try {
    ok(res, await authService.login({ email, password }));
  } catch (e) { handleServiceError(res, e); }
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return fail(res, 'Thiếu refresh token', 401);
  try {
    ok(res, await authService.refresh({ refreshToken }));
  } catch (e) { handleServiceError(res, e); }
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  await authService.logout({ userId: req.userId, refreshToken });
  ok(res, { message: 'Đã đăng xuất' });
};

exports.me = async (req, res) => {
  const { rows } = await userRepo.findById(req.userId);
  if (!rows.length) return fail(res, 'Không tìm thấy user', 404);
  ok(res, { user: rows[0] });
};
