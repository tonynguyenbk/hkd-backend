const analysisRepo = require('../repositories/analysis.repository');
const hkdRepo      = require('../repositories/hkd.repository');
const aiService    = require('../services/ai.service');
const { ok, fail } = require('../utils/response');

exports.create = async (req, res) => {
  const { hkd_id, period, score, period_label, classification,
          input_revenue, input_expenses, input_assets, ratios, summary, import_source } = req.body;
  if (!hkd_id || !period || score === undefined) return fail(res, 'Thiếu dữ liệu bắt buộc');

  const { rows: hkdRows } = await hkdRepo.findById(hkd_id, req.userId);
  if (!hkdRows.length) return fail(res, 'Không có quyền truy cập HKD này', 403);

  const { rows } = await analysisRepo.create({
    hkdId: hkd_id, userId: req.userId, period, periodLabel: period_label,
    score, classification, inputRevenue: input_revenue, inputExpenses: input_expenses,
    inputAssets: input_assets, ratios, summary, importSource: import_source,
  });
  ok(res, { analysis: rows[0] });
};

exports.history = async (req, res) => {
  const { limit = 24, offset = 0 } = req.query;
  const { rows }  = await analysisRepo.findHistory(req.params.hkd_id, req.userId, limit, offset);
  const { rows: total } = await analysisRepo.countByHkd(req.params.hkd_id, req.userId);
  ok(res, { analyses: rows, total: +total[0].count });
};

exports.detail = async (req, res) => {
  const { rows } = await analysisRepo.findById(req.params.id, req.userId);
  if (!rows.length) return fail(res, 'Không tìm thấy', 404);
  ok(res, { analysis: rows[0] });
};

exports.aiAnalyze = async (req, res) => {
  const { prompt, analysis_id } = req.body;
  if (!prompt) return fail(res, 'Thiếu prompt');
  try {
    const result = await aiService.analyze({ prompt, analysisId: analysis_id, userId: req.userId });
    ok(res, result);
  } catch (e) {
    if (e.message === 'API_NOT_CONFIGURED') return fail(res, 'API key chưa cấu hình', 500);
    console.error('AI proxy error:', e);
    fail(res, e.message || 'Lỗi kết nối AI', e.status || 500);
  }
};
