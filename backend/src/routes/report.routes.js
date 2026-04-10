const router = require('express').Router();
const ctrl   = require('../controllers/report.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/schedule',  requireAuth, ctrl.upsertSchedule);
router.get('/schedules',  requireAuth, ctrl.listSchedules);

module.exports = router;
