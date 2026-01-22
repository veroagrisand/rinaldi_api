const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleMiddleware');

// Public routes
router.get('/', newsController.getAllNews);
router.get('/slug/:slug', newsController.getNewsBySlug);
router.get('/:id', newsController.getNewsById);

router.post('/', authMiddleware, isAdmin, newsController.createNews);
router.put('/:id', authMiddleware, isAdmin, newsController.updateNews);
router.delete('/:id', authMiddleware, isAdmin, newsController.deleteNews);

module.exports = router;
