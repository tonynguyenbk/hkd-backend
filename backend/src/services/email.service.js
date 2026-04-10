const nodemailer    = require('nodemailer');
const analysisRepo  = require('../repositories/analysis.repository');
const hkdRepo       = require('../repositories/hkd.repository');
const scheduleRepo  = require('../repositories/schedule.repository');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   +process.env.SMTP_PORT || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const CLS_LABEL = {
  safe:   '✅ AN TOÀN',
  warn:   '⚠️ CẦN THEO DÕI',
  danger: '🚨 NGUY CƠ CAO',
};

function buildHtml(hkd, curr, prev) {
  const deltaTxt = prev
    ? (curr.score - prev.score > 0 ? `+${curr.score - prev.score}` : `${curr.score - prev.score}`) + ' so kỳ trước'
    : 'Kỳ đầu tiên';

  const scoreColor = curr.classification === 'safe' ? '#22C55E'
    : curr.classification === 'warn' ? '#F59E0B' : '#EF4444';

  return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
<div style="background:#0D1B2A;padding:20px;border-radius:8px;text-align:center;margin-bottom:20px">
  <h2 style="color:#D4A843;margin:0">Báo cáo Tài chính Định kỳ</h2>
  <p style="color:#94A3B8;margin:5px 0">${hkd.name} — ${curr.period_label || curr.period}</p>
</div>
<div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:20px;text-align:center">
  <div style="font-size:48px;font-weight:bold;color:${scoreColor}">${curr.score}</div>
  <div style="font-size:18px;color:#555">${CLS_LABEL[curr.classification] || curr.classification}</div>
  <div style="color:#888;margin-top:5px">${deltaTxt}</div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
  <tr style="background:#D4A843;color:#0D1B2A">
    <th style="padding:10px;text-align:left">Chỉ tiêu</th>
    <th style="padding:10px;text-align:right">Giá trị</th>
  </tr>
  <tr style="background:#f0f0f0"><td style="padding:8px">Doanh thu/năm</td><td style="padding:8px;text-align:right">₫${(curr.summary?.dtNam || 0).toFixed(0)} triệu</td></tr>
  <tr><td style="padding:8px">Lợi nhuận ròng</td><td style="padding:8px;text-align:right;color:${(curr.summary?.lnRong || 0) >= 0 ? 'green' : 'red'}">₫${(curr.summary?.lnRong || 0).toFixed(0)} triệu</td></tr>
  <tr style="background:#f0f0f0"><td style="padding:8px">Tổng nợ</td><td style="padding:8px;text-align:right">₫${(curr.summary?.tongNo || 0).toFixed(0)} triệu</td></tr>
</table>
${curr.ai_analysis ? `<div style="background:#f8f9fa;border-left:4px solid #D4A843;padding:15px;border-radius:4px;margin-bottom:20px"><h4 style="margin:0 0 10px;color:#D4A843">Nhận xét từ AI</h4><p style="margin:0;line-height:1.6;font-size:14px">${curr.ai_analysis.slice(0, 500)}...</p></div>` : ''}
<p style="color:#888;font-size:12px;text-align:center">Báo cáo tự động từ hệ thống phân tích tài chính HKD. Không thay thế tư vấn chuyên nghiệp.</p>
</body></html>`;
}

async function sendMonthlyReport(schedule) {
  const { rows: analyses } = await analysisRepo.findLastTwo(schedule.hkd_id);
  if (!analyses.length) return;

  const curr = analyses[0];
  const prev = analyses[1];

  const { rows: hkdRows } = await hkdRepo.findByIdOnly(schedule.hkd_id);
  const hkd = hkdRows[0] || {};

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      schedule.email,
    subject: `[Báo cáo tài chính] ${hkd.name} — ${curr.period_label || new Date().toLocaleDateString('vi-VN')}`,
    html:    buildHtml(hkd, curr, prev),
  });

  await scheduleRepo.markSent(schedule.id);
  console.log(`✓ Report sent to ${schedule.email} for ${hkd.name}`);
}

module.exports = { sendMonthlyReport };
