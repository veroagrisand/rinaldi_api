const express = require('express');
const router = express.Router();
const productVariantController = require('../controllers/productVariantController');
const authMiddleware = require('../middleware/auth');
const { isAdminOrReseller, isAdmin } = require('../middleware/roleMiddleware');

router.get('/product/:product_id', productVariantController.getVariantsByProduct);
router.get('/sku/:sku', productVariantController.getVariantBySku);
router.get('/:id', productVariantController.getVariantById);

router.post('/', authMiddleware, isAdminOrReseller, productVariantController.createVariant);
router.put('/:id', authMiddleware, isAdminOrReseller, productVariantController.updateVariant);

router.delete('/:id', authMiddleware, isAdmin, productVariantController.deleteVariant);

module.exports = router;
