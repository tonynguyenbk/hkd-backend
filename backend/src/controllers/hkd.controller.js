const hkdRepo = require('../repositories/hkd.repository');
const { ok, fail } = require('../utils/response');

exports.list = async (req, res) => {
  const { rows } = await hkdRepo.findByUser(req.userId);
  ok(res, { profiles: rows });
};

exports.create = async (req, res) => {
  const { name } = req.body;
  if (!name) return fail(res, 'Tên hộ kinh doanh là bắt buộc');
  const { rows } = await hkdRepo.create(req.userId, req.body);
  ok(res, { profile: rows[0] });
};

exports.update = async (req, res) => {
  const { rows } = await hkdRepo.update(req.params.id, req.userId, req.body);
  if (!rows.length) return fail(res, 'Không tìm thấy hoặc không có quyền', 404);
  ok(res, { profile: rows[0] });
};

exports.remove = async (req, res) => {
  const { rowCount } = await hkdRepo.remove(req.params.id, req.userId);
  if (!rowCount) return fail(res, 'Không tìm thấy', 404);
  ok(res, { message: 'Đã xóa' });
};
