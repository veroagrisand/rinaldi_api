const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/auth');
const { isAdminOrReseller, isAdmin } = require('../middleware/roleMiddleware');

router.get('/', productController. getAllProducts);
router.get('/slug/:slug', productController.getProductBySlug);
router.get('/:id', productController. getProductById);
router.post('/', authMiddleware, isAdminOrReseller, productController. createProduct);
router.put('/:id', authMiddleware, isAdminOrReseller, productController.updateProduct);
router.delete('/:id', authMiddleware, isAdmin, productController.deleteProduct);

module.exports = router;
