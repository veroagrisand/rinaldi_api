const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleMiddleware');

//User's own profile routes
router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.put('/change-password', authMiddleware, userController.changePassword);

//Admin only routes
router.get('/', authMiddleware, isAdmin, userController.getAllUsers);
router.get('/:id', authMiddleware, isAdmin, userController.getUserById);
router.put('/:id/role', authMiddleware, isAdmin, userController.updateUserRole);
router.put('/:id/status', authMiddleware, isAdmin, userController.updateUserStatus);
router.put('/:id/balance', authMiddleware, isAdmin, userController.updateBalance);
router.delete('/:id', authMiddleware, isAdmin, userController.deleteUser);

module.exports = router;
