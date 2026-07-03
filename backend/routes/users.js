const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usersController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { passwordStrength } = require('../utils/validators');

router.get('/', authenticateToken, requireAdmin, ctrl.getAllUsers);
router.post('/', authenticateToken, requireAdmin, [passwordStrength('password')], ctrl.createUser);
router.put('/:id', authenticateToken, requireAdmin, ctrl.updateUser);
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, ctrl.toggleStatus);
router.patch('/:id/reset-password', authenticateToken, requireAdmin, [passwordStrength('new_password')], ctrl.resetPassword);

module.exports = router;
