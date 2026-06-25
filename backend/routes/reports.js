const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportsController');
const { authenticateToken, requireStaff, requireAdmin, requireInspector } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/map', authenticateToken, ctrl.getMapData);
router.get('/nearby', authenticateToken, ctrl.getNearbyReports);
router.get('/', authenticateToken, ctrl.getAllReports);
router.get('/:id', authenticateToken, ctrl.getReport);
router.post('/', authenticateToken, upload.array('images', 5), ctrl.createReport);
router.post('/:id/inspections', authenticateToken, requireInspector, ctrl.createInspection);
router.patch('/:id/status', authenticateToken, requireStaff, ctrl.updateStatus);
router.delete('/:id', authenticateToken, ctrl.deleteReport);

module.exports = router;
