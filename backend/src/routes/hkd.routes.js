const router = require('express').Router();
const ctrl   = require('../controllers/hkd.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/',     requireAuth, ctrl.list);
router.post('/',    requireAuth, ctrl.create);
router.put('/:id',  requireAuth, ctrl.update);
router.delete('/:id', requireAuth, ctrl.remove);

module.exports = router;
