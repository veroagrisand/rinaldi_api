const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleMiddleware');

// Public/User routes
router.get('/active', couponController.getActiveCoupons);
router.post('/validate', authMiddleware, couponController.validateCoupon);

// Admin routes
router.get('/', authMiddleware, isAdmin, couponController.getAllCoupons);
router.get('/:id', authMiddleware, isAdmin, couponController.getCouponById);
router.post('/', authMiddleware, isAdmin, couponController.createCoupon);
router.put('/:id', authMiddleware, isAdmin, couponController.updateCoupon);
router.delete('/:id', authMiddleware, isAdmin, couponController.deleteCoupon);

module.exports = router;
