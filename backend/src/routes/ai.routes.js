const router = require('express').Router();
const ctrl   = require('../controllers/analysis.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/analyze', requireAuth, ctrl.aiAnalyze);

module.exports = router;
