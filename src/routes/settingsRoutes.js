const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleMiddleware');

router.get('/', settingsController.getSettings);

router.put('/', authMiddleware, isAdmin, settingsController.updateSettings);

module.exports = router;
