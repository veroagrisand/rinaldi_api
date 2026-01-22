const express = require('express');
const router = express.Router();
const dataStockController = require('../controllers/dataStockController');
const authMiddleware = require('../middleware/auth');
const { isAdminOrReseller, isAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/', isAdminOrReseller, dataStockController.getAllDataStocks);
router.get('/variant/:variant_id/count', isAdminOrReseller, dataStockController.getStockCountByVariant);
router.get('/:id', isAdminOrReseller, dataStockController.getDataStockById);
router.post('/', isAdminOrReseller, dataStockController.createDataStock);
router.post('/bulk', isAdminOrReseller, dataStockController.bulkCreateDataStocks);
router.put('/:id', isAdminOrReseller, dataStockController.updateDataStock);

router.delete('/:id', isAdmin, dataStockController.deleteDataStock);

module.exports = router;
