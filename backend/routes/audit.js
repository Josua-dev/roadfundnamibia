const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auditController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, requireAdmin, ctrl.getAuditLogs);
router.get('/meta', authenticateToken, requireAdmin, ctrl.getAuditMeta);

module.exports = router;
