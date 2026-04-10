const pool = require('../config/db');

const create = ({ hkdId, userId, period, periodLabel, score, classification,
                  inputRevenue, inputExpenses, inputAssets, ratios, summary, importSource }) =>
  pool.query(
    `INSERT INTO analyses(hkd_id,user_id,period,period_label,score,classification,
       input_revenue,input_expenses,input_assets,ratios,summary,import_source)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [hkdId, userId, period, periodLabel || '', score, classification || 'warn',
     JSON.stringify(inputRevenue || {}), JSON.stringify(inputExpenses || {}),
     JSON.stringify(inputAssets || {}), JSON.stringify(ratios || {}),
     JSON.stringify(summary || {}), importSource || 'manual']
  );

const findHistory = (hkdId, userId, limit, offset) =>
  pool.query(
    `SELECT id,period,period_label,score,classification,summary,analysis_date,created_at,import_source
     FROM analyses WHERE hkd_id=$1 AND user_id=$2
     ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
    [hkdId, userId, Math.min(+limit, 48), +offset]
  );

const countByHkd = (hkdId, userId) =>
  pool.query('SELECT COUNT(*) FROM analyses WHERE hkd_id=$1 AND user_id=$2', [hkdId, userId]);

const findById = (id, userId) =>
  pool.query('SELECT * FROM analyses WHERE id=$1 AND user_id=$2', [id, userId]);

const updateAiAnalysis = (id, userId, text) =>
  pool.query(
    'UPDATE analyses SET ai_analysis=$1, ai_generated_at=NOW() WHERE id=$2 AND user_id=$3',
    [text, id, userId]
  );

const findLastTwo = (hkdId) =>
  pool.query('SELECT * FROM analyses WHERE hkd_id=$1 ORDER BY created_at DESC LIMIT 2', [hkdId]);

module.exports = { create, findHistory, countByHkd, findById, updateAiAnalysis, findLastTwo };
