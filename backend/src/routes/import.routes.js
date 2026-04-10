const router = require('express').Router();
const ctrl   = require('../controllers/import.controller');
const upload = require('../middleware/upload.middleware');
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/excel', requireAuth, upload.single('file'), ctrl.excel);
router.post('/xml',   requireAuth, upload.single('file'), ctrl.xml);

module.exports = router;
