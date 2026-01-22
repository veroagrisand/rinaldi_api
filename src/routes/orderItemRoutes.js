const express = require('express');
const router = express.Router();
const orderItemController = require('../controllers/orderItemController');
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleMiddleware');

router. use(authMiddleware);

router.get('/my-orders', orderItemController.getUserOrderItems);
router.get('/:id', orderItemController.getOrderItemById);

router.get('/', isAdmin, orderItemController. getAllOrderItems);
router.put('/:id/status', isAdmin, orderItemController.updateOrderItemStatus);

module.exports = router;
