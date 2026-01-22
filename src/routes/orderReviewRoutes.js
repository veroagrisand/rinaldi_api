const express = require('express');
const router = express.Router();
const orderReviewController = require('../controllers/orderReviewController');
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authMiddleware);

// User routes
router. post('/', orderReviewController.createReview);
router.put('/:id', orderReviewController.updateReview);
router.delete('/:id', orderReviewController.deleteReview);

router.get('/', isAdmin, orderReviewController. getAllReviews);

router.get('/transaction/:transaction_id', orderReviewController.getReviewsByTransaction);
router.get('/:id', orderReviewController. getReviewById);

module.exports = router;
