const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const pool      = require('./config/db');
const { limiter } = require('./middleware/rateLimit.middleware');

const authRoutes      = require('./routes/auth.routes');
const hkdRoutes       = require('./routes/hkd.routes');
const analysisRoutes  = require('./routes/analysis.routes');
const aiRoutes        = require('./routes/ai.routes');
const importRoutes    = require('./routes/import.routes');
const reportRoutes    = require('./routes/report.routes');
const benchmarkRoutes = require('./routes/benchmark.routes');

const app = express();

// ── Security & Parsing ───────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin:         process.env.FRONTEND_URL || '*',
  methods:        ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));
app.use('/api/', limiter);

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/hkd',       hkdRoutes);
app.use('/api/analysis',  analysisRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/import',    importRoutes);
app.use('/api/report',    reportRoutes);
app.use('/api/benchmark', benchmarkRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route không tồn tại' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Lỗi hệ thống' });
});

module.exports = app;
