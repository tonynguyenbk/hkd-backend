const jwt  = require('jsonwebtoken');
const { fail } = require('../utils/response');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return fail(res, 'Chưa đăng nhập', 401);
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.userId = decoded.sub;
    next();
  } catch {
    return fail(res, 'Phiên đăng nhập hết hạn', 401);
  }
}

module.exports = { requireAuth };
