const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleMiddleware');

// Public routes
router.get('/', bankController.getAllBanks);
router.get('/:id', bankController.getBankById);

// Admin only routes
router.post('/', authMiddleware, isAdmin, bankController.createBank);
router.put('/:id', authMiddleware, isAdmin, bankController.updateBank);
router.delete('/:id', authMiddleware, isAdmin, bankController.deleteBank);

module.exports = router;
