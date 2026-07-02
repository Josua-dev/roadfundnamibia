const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicController');

router.get('/stats', ctrl.getStats);
router.get('/impact', ctrl.getImpact);
router.get('/map', ctrl.getMapReports);
router.get('/regions', ctrl.getRegions);
router.get('/uploads/:filename', ctrl.getPublicPhoto);

module.exports = router;
