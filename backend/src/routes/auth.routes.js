const router      = require('express').Router();
const ctrl        = require('../controllers/auth.controller');
const { requireAuth }  = require('../middleware/auth.middleware');
const { authLimiter }  = require('../middleware/rateLimit.middleware');

router.post('/register', authLimiter, ctrl.register);
router.post('/login',    authLimiter, ctrl.login);
router.post('/refresh',  ctrl.refresh);
router.post('/logout',   requireAuth, ctrl.logout);
router.get('/me',        requireAuth, ctrl.me);

module.exports = router;
