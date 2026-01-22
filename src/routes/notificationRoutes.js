const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/my-notifications', notificationController.getUserNotifications);
router.delete('/clear-all', notificationController.deleteAllUserNotifications);

router.get('/', isAdmin, notificationController.getAllNotifications);
router.post('/', isAdmin, notificationController.createNotification);
router.post('/broadcast', isAdmin, notificationController. broadcastNotification);

router.get('/:id', notificationController.getNotificationById);
router.delete('/:id', notificationController. deleteNotification);

module.exports = router;
