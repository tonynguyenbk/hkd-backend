const pool = require('../config/db');

const upsert = (hkdId, userId, frequency, sendDay, email) =>
  pool.query(
    `INSERT INTO report_schedules(hkd_id,user_id,frequency,send_day,email)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT (hkd_id) DO UPDATE SET frequency=$3,send_day=$4,email=$5,is_active=true
     RETURNING *`,
    [hkdId, userId, frequency || 'monthly', sendDay || 5, email]
  );

const findByUser = (userId) =>
  pool.query(
    `SELECT rs.*,hp.name as hkd_name
     FROM report_schedules rs
     JOIN hkd_profiles hp ON hp.id=rs.hkd_id
     WHERE rs.user_id=$1`,
    [userId]
  );

const findActiveByDay = (day) =>
  pool.query(
    `SELECT rs.*,hp.name as hkd_name
     FROM report_schedules rs
     JOIN hkd_profiles hp ON hp.id=rs.hkd_id
     WHERE rs.is_active=true AND rs.send_day=$1`,
    [day]
  );

const markSent = (id) =>
  pool.query('UPDATE report_schedules SET last_sent_at=NOW() WHERE id=$1', [id]);

module.exports = { upsert, findByUser, findActiveByDay, markSent };
