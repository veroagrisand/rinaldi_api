const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/auth');
const { isAdminOrReseller, isAdmin } = require('../middleware/roleMiddleware');

router.get('/', categoryController.getAllCategories);
router.get('/slug/:slug', categoryController.getCategoryBySlug);
router.get('/:id', categoryController.getCategoryById);

router.post('/', authMiddleware, isAdminOrReseller, categoryController. createCategory);
router.put('/:id', authMiddleware, isAdminOrReseller, categoryController.updateCategory);

router.delete('/:id', authMiddleware, isAdmin, categoryController.deleteCategory);

module.exports = router;
