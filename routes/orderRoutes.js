const express = require('express');
const router = express.Router();
const orderController = require('../controller/orderController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/checkout', authMiddleware, orderController.checkout);
router.get('/', authMiddleware, orderController.getOrders);

module.exports = router;
