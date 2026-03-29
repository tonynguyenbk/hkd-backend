// ============================================================
// server.js — HKD Financial Health API
// Node.js + Express + PostgreSQL
// ============================================================
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { Pool }   = require('pg');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const multer     = require('multer');
const XLSX       = require('xlsx');
const cron       = require('node-cron');
const nodemailer = require('nodemailer');
const crypto     = require('crypto');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── DB Pool ──────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => console.error('DB pool error:', err));

// ── Middleware ───────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({ windowMs: 15*60*1000, max: 100, standardHeaders: true });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, message: { error: 'Quá nhiều yêu cầu, thử lại sau 15 phút' } });
app.use('/api/', limiter);

// ── JWT Helpers ──────────────────────────────────────────────
function signAccess(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
}
function signRefresh(userId) {
  return jwt.sign({ sub: userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' });
}

// ── Auth Middleware ───────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.userId = decoded.sub;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn' });
  }
}

// ── Helpers ──────────────────────────────────────────────────
const ok   = (res, data)      => res.json({ ok: true, ...data });
const fail = (res, msg, code=400) => res.status(code).json({ ok: false, error: msg });

// ============================================================
// AUTH ROUTES
// ============================================================

// POST /api/auth/register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  if (!email || !password) return fail(res, 'Email và mật khẩu là bắt buộc');
  if (password.length < 6) return fail(res, 'Mật khẩu tối thiểu 6 ký tự');

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (exists.rows.length) return fail(res, 'Email đã được sử dụng');

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users(email,password_hash,full_name,phone) VALUES($1,$2,$3,$4) RETURNING id,email,full_name',
      [email.toLowerCase(), hash, full_name||'', phone||'']
    );
    const user = rows[0];
    const accessToken  = signAccess(user.id);
    const refreshToken = signRefresh(user.id);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30*24*60*60*1000);
    await pool.query('INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,$3)', [user.id, tokenHash, expiresAt]);

    ok(res, { user: { id: user.id, email: user.email, full_name: user.full_name }, accessToken, refreshToken });
  } catch (e) {
    console.error('Register error:', e);
    fail(res, 'Lỗi hệ thống', 500);
  }
});

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return fail(res, 'Email và mật khẩu là bắt buộc');

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email.toLowerCase()]);
    if (!rows.length) return fail(res, 'Email hoặc mật khẩu không đúng', 401);
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return fail(res, 'Email hoặc mật khẩu không đúng', 401);

    await pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

    const accessToken  = signAccess(user.id);
    const refreshToken = signRefresh(user.id);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30*24*60*60*1000);
    await pool.query('INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,$3)', [user.id, tokenHash, expiresAt]);

    ok(res, {
      user: { id: user.id, email: user.email, full_name: user.full_name },
      accessToken, refreshToken
    });
  } catch (e) {
    console.error('Login error:', e);
    fail(res, 'Lỗi hệ thống', 500);
  }
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return fail(res, 'Thiếu refresh token', 401);
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') return fail(res, 'Token không hợp lệ', 401);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const { rows } = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token_hash=$1 AND revoked=false AND expires_at>NOW()',
      [tokenHash]
    );
    if (!rows.length) return fail(res, 'Token hết hạn hoặc đã bị thu hồi', 401);
    const newAccess = signAccess(decoded.sub);
    ok(res, { accessToken: newAccess });
  } catch (e) {
    fail(res, 'Token không hợp lệ', 401);
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await pool.query('UPDATE refresh_tokens SET revoked=true WHERE token_hash=$1', [tokenHash]);
  }
  ok(res, { message: 'Đã đăng xuất' });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id,email,full_name,phone,created_at FROM users WHERE id=$1', [req.userId]);
  if (!rows.length) return fail(res, 'Không tìm thấy user', 404);
  ok(res, { user: rows[0] });
});

// ============================================================
// HKD PROFILE ROUTES
// ============================================================

// GET /api/hkd — danh sách HKD của user
app.get('/api/hkd', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM hkd_profiles WHERE user_id=$1 ORDER BY created_at DESC',
    [req.userId]
  );
  ok(res, { profiles: rows });
});

// POST /api/hkd — tạo HKD mới
app.post('/api/hkd', requireAuth, async (req, res) => {
  const { name, industry, size, region, province, duration, mst, address } = req.body;
  if (!name) return fail(res, 'Tên hộ kinh doanh là bắt buộc');
  const { rows } = await pool.query(
    `INSERT INTO hkd_profiles(user_id,name,industry,size,region,province,duration,mst,address)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.userId, name, industry||'thuong_mai', size||'sieu_nho', region||'tinh_lon', province||'', duration||'', mst||'', address||'']
  );
  ok(res, { profile: rows[0] });
});

// PUT /api/hkd/:id — cập nhật HKD
app.put('/api/hkd/:id', requireAuth, async (req, res) => {
  const { name, industry, size, region, province, duration, mst } = req.body;
  const { rows } = await pool.query(
    `UPDATE hkd_profiles SET name=$1,industry=$2,size=$3,region=$4,province=$5,duration=$6,mst=$7
     WHERE id=$8 AND user_id=$9 RETURNING *`,
    [name, industry, size, region, province, duration, mst, req.params.id, req.userId]
  );
  if (!rows.length) return fail(res, 'Không tìm thấy hoặc không có quyền', 404);
  ok(res, { profile: rows[0] });
});

// DELETE /api/hkd/:id
app.delete('/api/hkd/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM hkd_profiles WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
  if (!rowCount) return fail(res, 'Không tìm thấy', 404);
  ok(res, { message: 'Đã xóa' });
});

// ============================================================
// ANALYSIS ROUTES
// ============================================================

// POST /api/analysis — lưu kết quả phân tích
app.post('/api/analysis', requireAuth, async (req, res) => {
  const { hkd_id, period, period_label, score, classification,
          input_revenue, input_expenses, input_assets, ratios, summary, import_source } = req.body;
  if (!hkd_id || !period || score === undefined) return fail(res, 'Thiếu dữ liệu bắt buộc');

  // Kiểm tra HKD thuộc user này
  const { rows: hkdRows } = await pool.query('SELECT id FROM hkd_profiles WHERE id=$1 AND user_id=$2', [hkd_id, req.userId]);
  if (!hkdRows.length) return fail(res, 'Không có quyền truy cập HKD này', 403);

  const { rows } = await pool.query(
    `INSERT INTO analyses(hkd_id,user_id,period,period_label,score,classification,
       input_revenue,input_expenses,input_assets,ratios,summary,import_source)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [hkd_id, req.userId, period, period_label||'', score, classification||'warn',
     JSON.stringify(input_revenue||{}), JSON.stringify(input_expenses||{}),
     JSON.stringify(input_assets||{}), JSON.stringify(ratios||{}), JSON.stringify(summary||{}),
     import_source||'manual']
  );
  ok(res, { analysis: rows[0] });
});

// GET /api/analysis/history/:hkd_id — lịch sử phân tích
app.get('/api/analysis/history/:hkd_id', requireAuth, async (req, res) => {
  const { limit = 24, offset = 0 } = req.query;
  const { rows } = await pool.query(
    `SELECT id,period,period_label,score,classification,summary,analysis_date,created_at,import_source
     FROM analyses WHERE hkd_id=$1 AND user_id=$2
     ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
    [req.params.hkd_id, req.userId, Math.min(+limit, 48), +offset]
  );
  const { rows: total } = await pool.query(
    'SELECT COUNT(*) FROM analyses WHERE hkd_id=$1 AND user_id=$2',
    [req.params.hkd_id, req.userId]
  );
  ok(res, { analyses: rows, total: +total[0].count });
});

// GET /api/analysis/:id — chi tiết một kỳ
app.get('/api/analysis/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM analyses WHERE id=$1 AND user_id=$2',
    [req.params.id, req.userId]
  );
  if (!rows.length) return fail(res, 'Không tìm thấy', 404);
  ok(res, { analysis: rows[0] });
});

// ============================================================
// AI PROXY ROUTE — Key lưu server, không lộ frontend
// ============================================================
app.post('/api/ai/analyze', requireAuth, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return fail(res, 'Thiếu prompt');
  if (!process.env.ANTHROPIC_API_KEY) return fail(res, 'API key chưa cấu hình', 500);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(()=>({}));
      return fail(res, err?.error?.message || 'Lỗi API', response.status);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Tùy chọn: lưu AI analysis vào DB nếu có analysis_id
    if (req.body.analysis_id) {
      await pool.query(
        'UPDATE analyses SET ai_analysis=$1, ai_generated_at=NOW() WHERE id=$2 AND user_id=$3',
        [text, req.body.analysis_id, req.userId]
      ).catch(() => {});
    }

    ok(res, { text });
  } catch (e) {
    console.error('AI proxy error:', e);
    fail(res, 'Lỗi kết nối AI', 500);
  }
});

// ============================================================
// IMPORT ROUTES
// ============================================================

// POST /api/import/excel — parse Excel server-side
app.post('/api/import/excel', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return fail(res, 'Không có file');
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const normalized = (s) => s.toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/đ/g,'d').replace(/[^a-z0-9\s]/g,'').trim();

    const map = {};
    rows.forEach(row => {
      if (!row[0]) return;
      const key = normalized(String(row[0]));
      const val = parseFloat(String(row[1]||'').replace(/[^0-9.-]/g,'')) || 0;
      map[key] = val;
    });

    const get = (...keys) => { for(const k of keys) if(map[k]) return map[k]; return 0; };
    const result = {
      revenue:  { tongDoanhThu: get('tong doanh thu','doanh thu','dt'), giaVon: get('gia von hang ban','gia von'), thuNhapKhac: get('thu nhap khac') },
      expenses: { thueMatBang: get('thue mat bang','mat bang'), nhanCong: get('nhan cong','tien luong','luong'), chiPhiKhac: get('chi phi khac'), thueNopTrongKy: get('thue da nop','thue') },
      assets:   { tienMat: get('tien mat','cash'), hangTonKho: get('hang ton kho','htk'), phaiThu: get('phai thu'), taiSanCoDinh: get('tai san co dinh','tscd'), noNganHan: get('no ngan han'), noDaiHan: get('no dai han'), vonChuSoHuu: get('von chu so huu') }
    };

    const filled = Object.values(result).flatMap(Object.values).filter(v => v > 0).length;
    ok(res, { result, filled, rows: rows.length });
  } catch(e) {
    fail(res, 'Lỗi đọc file: ' + e.message);
  }
});

// POST /api/import/xml — parse HTKK XML server-side
app.post('/api/import/xml', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return fail(res, 'Không có file');
  try {
    const xml = req.file.buffer.toString('utf-8');
    const getTag = (tag) => { const m = xml.match(new RegExp('<'+tag+'[^>]*>([^<]*)<\/'+tag+'>', 'i')); return m ? m[1].trim() : ''; };
    const getNum = (tag) => parseFloat(getTag(tag).replace(/[^0-9.-]/g,'')) || 0;
    const toMil  = (v)   => v >= 100000 ? +(v/1000000).toFixed(2) : v;

    const result = {
      tenHKD:   getTag('TenNguoiNopThue') || getTag('TenHKD'),
      mst:      getTag('MST') || getTag('MaSoThue'),
      kyKhai:   getTag('KyTinh') || getTag('KyKhaiThue'),
      doanhThu: toMil(getNum('DoanhThu') || getNum('TongDoanhThu')),
      thueGTGT: toMil(getNum('ThuGTGT') || getNum('ThueGTGT')),
      thueTNCN: toMil(getNum('ThueTNCN') || getNum('ThuTNCN')),
      tongThue: toMil(getNum('TongThuPhaiNop'))
    };
    if (!result.tongThue && result.thueGTGT) result.tongThue = +(result.thueGTGT + result.thueTNCN).toFixed(2);

    ok(res, { result });
  } catch(e) {
    fail(res, 'Lỗi đọc XML: ' + e.message);
  }
});

// ============================================================
// REPORT SCHEDULE ROUTES
// ============================================================

// POST /api/report/schedule
app.post('/api/report/schedule', requireAuth, async (req, res) => {
  const { hkd_id, frequency, send_day, email } = req.body;
  if (!hkd_id || !email) return fail(res, 'Thiếu thông tin');
  const { rows } = await pool.query(
    `INSERT INTO report_schedules(hkd_id,user_id,frequency,send_day,email)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT (hkd_id) DO UPDATE SET frequency=$3,send_day=$4,email=$5,is_active=true
     RETURNING *`,
    [hkd_id, req.userId, frequency||'monthly', send_day||5, email]
  );
  ok(res, { schedule: rows[0] });
});

// GET /api/report/schedules
app.get('/api/report/schedules', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT rs.*,hp.name as hkd_name FROM report_schedules rs JOIN hkd_profiles hp ON hp.id=rs.hkd_id WHERE rs.user_id=$1',
    [req.userId]
  );
  ok(res, { schedules: rows });
});

// ============================================================
// EMAIL REPORT HELPER
// ============================================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function sendMonthlyReport(schedule) {
  const { rows: analyses } = await pool.query(
    `SELECT * FROM analyses WHERE hkd_id=$1 ORDER BY created_at DESC LIMIT 2`,
    [schedule.hkd_id]
  );
  if (!analyses.length) return;

  const curr = analyses[0];
  const prev = analyses[1];
  const clsLabel = { safe: '✅ AN TOÀN', warn: '⚠️ CẦN THEO DÕI', danger: '🚨 NGUY CƠ CAO' };
  const deltaTxt = prev ? (curr.score - prev.score > 0 ? `+${curr.score - prev.score}` : `${curr.score - prev.score}`) + ' so kỳ trước' : 'Kỳ đầu tiên';

  const { rows: hkdRows } = await pool.query('SELECT * FROM hkd_profiles WHERE id=$1', [schedule.hkd_id]);
  const hkd = hkdRows[0] || {};

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
<div style="background:#0D1B2A;padding:20px;border-radius:8px;text-align:center;margin-bottom:20px">
  <h2 style="color:#D4A843;margin:0">Báo cáo Tài chính Định kỳ</h2>
  <p style="color:#94A3B8;margin:5px 0">${hkd.name} — ${curr.period_label || curr.period}</p>
</div>
<div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:20px;text-align:center">
  <div style="font-size:48px;font-weight:bold;color:${curr.classification==='safe'?'#22C55E':curr.classification==='warn'?'#F59E0B':'#EF4444'}">${curr.score}</div>
  <div style="font-size:18px;color:#555">${clsLabel[curr.classification] || curr.classification}</div>
  <div style="color:#888;margin-top:5px">${deltaTxt}</div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
  <tr style="background:#D4A843;color:#0D1B2A">
    <th style="padding:10px;text-align:left">Chỉ tiêu</th>
    <th style="padding:10px;text-align:right">Giá trị</th>
  </tr>
  <tr style="background:#f0f0f0"><td style="padding:8px">Doanh thu/năm</td><td style="padding:8px;text-align:right">₫${(curr.summary?.dtNam||0).toFixed(0)} triệu</td></tr>
  <tr><td style="padding:8px">Lợi nhuận ròng</td><td style="padding:8px;text-align:right;color:${(curr.summary?.lnRong||0)>=0?'green':'red'}">₫${(curr.summary?.lnRong||0).toFixed(0)} triệu</td></tr>
  <tr style="background:#f0f0f0"><td style="padding:8px">Tổng nợ</td><td style="padding:8px;text-align:right">₫${(curr.summary?.tongNo||0).toFixed(0)} triệu</td></tr>
</table>
${curr.ai_analysis ? `<div style="background:#f8f9fa;border-left:4px solid #D4A843;padding:15px;border-radius:4px;margin-bottom:20px"><h4 style="margin:0 0 10px;color:#D4A843">Nhận xét từ AI</h4><p style="margin:0;line-height:1.6;font-size:14px">${curr.ai_analysis.slice(0,500)}...</p></div>` : ''}
<p style="color:#888;font-size:12px;text-align:center">Báo cáo tự động từ hệ thống phân tích tài chính HKD. Không thay thế tư vấn chuyên nghiệp.</p>
</body></html>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: schedule.email,
    subject: `[Báo cáo tài chính] ${hkd.name} — ${curr.period_label || new Date().toLocaleDateString('vi-VN')}`,
    html
  });
  await pool.query('UPDATE report_schedules SET last_sent_at=NOW() WHERE id=$1', [schedule.id]);
  console.log(`✓ Report sent to ${schedule.email} for ${hkd.name}`);
}

// ── Cron: Chạy mỗi ngày lúc 8:00 sáng ───────────────────────
cron.schedule('0 8 * * *', async () => {
  const today = new Date().getDate();
  console.log(`[CRON] Checking report schedules for day ${today}...`);
  const { rows } = await pool.query(
    'SELECT rs.*,hp.name as hkd_name FROM report_schedules rs JOIN hkd_profiles hp ON hp.id=rs.hkd_id WHERE rs.is_active=true AND rs.send_day=$1',
    [today]
  );
  for (const schedule of rows) {
    try { await sendMonthlyReport(schedule); }
    catch (e) { console.error(`Failed report for ${schedule.hkd_id}:`, e.message); }
  }
});

// ============================================================
// BENCHMARK ROUTE — trả về ngưỡng theo vùng/ngành
// ============================================================
app.get('/api/benchmark', (req, res) => {
  const BENCHMARKS = {
    regions: {
      hn_hcm:    { label:'Hà Nội / TP.HCM',     mb_warn:18, cp_warn:32 },
      tinh_lon:  { label:'Tỉnh lớn',             mb_warn:14, cp_warn:28 },
      tinh_nho:  { label:'Tỉnh nhỏ / Nông thôn', mb_warn:10, cp_warn:25 }
    },
    margins: {
      thuong_mai: { hn_hcm:20, tinh_lon:22, tinh_nho:25 },
      dich_vu:    { hn_hcm:32, tinh_lon:35, tinh_nho:38 },
      san_xuat:   { hn_hcm:22, tinh_lon:25, tinh_nho:28 },
      xay_dung:   { hn_hcm:20, tinh_lon:22, tinh_nho:24 },
      khac:       { hn_hcm:20, tinh_lon:22, tinh_nho:24 }
    }
  };
  ok(res, { benchmarks: BENCHMARKS });
});

// ── Health check ─────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route không tồn tại' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Lỗi hệ thống' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🟢 HKD Financial API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Mode:   ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
