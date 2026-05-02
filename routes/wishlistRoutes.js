const express = require('express');
const router = express.Router();
const wishlistController = require('../controller/wishlistController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, wishlistController.getWishlist);
router.post('/toggle', authMiddleware, wishlistController.toggleWishlist);

module.exports = router;
