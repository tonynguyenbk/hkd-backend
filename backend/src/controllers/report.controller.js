const scheduleRepo = require('../repositories/schedule.repository');
const { ok, fail } = require('../utils/response');

exports.upsertSchedule = async (req, res) => {
  const { hkd_id, frequency, send_day, email } = req.body;
  if (!hkd_id || !email) return fail(res, 'Thiếu thông tin');
  const { rows } = await scheduleRepo.upsert(hkd_id, req.userId, frequency, send_day, email);
  ok(res, { schedule: rows[0] });
};

exports.listSchedules = async (req, res) => {
  const { rows } = await scheduleRepo.findByUser(req.userId);
  ok(res, { schedules: rows });
};
