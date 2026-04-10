const router = require('express').Router();
const ctrl   = require('../controllers/analysis.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/',                    requireAuth, ctrl.create);
router.get('/history/:hkd_id',      requireAuth, ctrl.history);
router.get('/:id',                  requireAuth, ctrl.detail);

module.exports = router;
