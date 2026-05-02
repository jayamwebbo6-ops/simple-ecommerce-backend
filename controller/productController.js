const Product = require('../model/Product');
const fs = require('fs');
const path = require('path');

exports.createProduct = async (req, res) => {
  try {
    const { name, slug, description, originPrice, sellingPrice, stock, status } = req.body;
    let image = null;

    if (req.file) {
      image = `${process.env.VITE_API_URL || 'http://localhost:5000'}/uploads/products/${req.file.filename}`;
    }

    const product = await Product.create({
      name, slug, description, originPrice, sellingPrice, stock, status, image
    });

    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({ order: [['createdAt', 'DESC']] });
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { name, slug, description, originPrice, sellingPrice, stock, status } = req.body;
    
    let image = product.image;
    if (req.file) {
      if (product.image && product.image.includes('/uploads/products/')) {
        const oldFilename = product.image.split('/uploads/products/')[1];
        if (oldFilename) {
          const oldFilePath = path.join(__dirname, '../uploads/products', oldFilename);
          if (fs.existsSync(oldFilePath)) {
            try { fs.unlinkSync(oldFilePath); } catch (e) {}
          }
        }
      }
      image = `${process.env.VITE_API_URL || 'http://localhost:5000'}/uploads/products/${req.file.filename}`;
    }

    await product.update({
      name, slug, description, originPrice, sellingPrice, stock, status, image
    });

    res.json({ message: "Product updated successfully", product });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // delete image if exists
    if (product.image && product.image.includes('/uploads/products/')) {
      const oldFilename = product.image.split('/uploads/products/')[1];
      if (oldFilename) {
        const oldFilePath = path.join(__dirname, '../uploads/products', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          try { fs.unlinkSync(oldFilePath); } catch (e) {}
        }
      }
    }

    await product.destroy();
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
