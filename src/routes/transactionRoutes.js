const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.get('/my-transactions', transactionController.getUserTransactions);
router.post('/checkout', transactionController.createTransaction);
router.get('/invoice/:invoice', transactionController.getTransactionByInvoice);
router.get('/:id', transactionController.getTransactionById);
router.post('/: id/cancel', transactionController.cancelTransaction);
router.get('/', isAdmin, transactionController.getAllTransactions);
router.put('/:id/status', isAdmin, transactionController.updateTransactionStatus);
module.exports = router;
