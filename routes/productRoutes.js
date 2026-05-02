const express = require('express');
const { createProduct, getProducts, deleteProduct, getProductById, updateProduct } = require('../controller/productController');
const authMiddleware = require('../middleware/authMiddleware');
const productUpload = require('../middleware/productUploadMiddleware');
const router = express.Router();

router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', authMiddleware, productUpload.single('image'), createProduct);
router.put('/:id', authMiddleware, productUpload.single('image'), updateProduct);
router.delete('/:id', authMiddleware, deleteProduct);

module.exports = router;
