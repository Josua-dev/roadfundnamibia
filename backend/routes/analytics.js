const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analyticsController');
const { authenticateToken, requireStaff } = require('../middleware/auth');

router.get('/overview', authenticateToken, requireStaff, ctrl.getOverview);
router.get('/charts', authenticateToken, requireStaff, ctrl.getCharts);
router.get('/by-region', authenticateToken, requireStaff, ctrl.getByRegion);
router.get('/monthly-trend', authenticateToken, requireStaff, ctrl.getMonthlyTrend);
router.get('/by-severity', authenticateToken, ctrl.getBySeverity);
router.get('/by-status', authenticateToken, ctrl.getByStatus);
router.get('/by-issue-type', authenticateToken, ctrl.getByIssueType);
router.get('/citizen-stats', authenticateToken, ctrl.getCitizenStats);
router.get('/inspector-stats', authenticateToken, ctrl.getInspectorStats);
router.get('/maintenance-stats', authenticateToken, ctrl.getMaintenanceStats);

module.exports = router;
