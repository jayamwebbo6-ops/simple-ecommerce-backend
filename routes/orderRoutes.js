const express = require('express');
const router = express.Router();
const orderController = require('../controller/orderController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/checkout', authMiddleware, orderController.checkout);
router.get('/', authMiddleware, orderController.getOrders);
router.put('/payment-status', authMiddleware, orderController.updatePaymentStatus);

// Admin routes
router.get('/admin/all', authMiddleware, orderController.getAllOrders);
router.put('/admin/status/:orderId', authMiddleware, orderController.updateOrderStatus);

module.exports = router;
