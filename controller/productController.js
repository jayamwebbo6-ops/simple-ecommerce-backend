const Product = require('../model/Product');
const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logger');

exports.createProduct = async (req, res) => {
  try {
    const { name, slug, description, originPrice, sellingPrice, stock, status } = req.body;
    let image = null;

    if (req.file) {
      image = `/uploads/products/${req.file.filename}`;
    }

    // Ensure unique slug
    let finalSlug = slug;
    const existingProduct = await Product.findOne({ where: { slug: finalSlug } });
    if (existingProduct) {
      finalSlug = `${slug}-${Math.floor(Math.random() * 9000) + 1000}`;
    }

    const product = await Product.create({
      name, slug: finalSlug, description, originPrice, sellingPrice, stock, status, image
    });

    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    log("Error creating product: " + error.message);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({ order: [['createdAt', 'DESC']] });
    res.json(products);
  } catch (error) {
    log("Error fetching products: " + error.message);
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
      image = `/uploads/products/${req.file.filename}`;
    }

    // Check if new slug already exists (excluding current product)
    let finalSlug = slug;
    if (slug !== product.slug) {
      const existingProduct = await Product.findOne({ where: { slug: finalSlug } });
      if (existingProduct) {
        finalSlug = `${slug}-${Math.floor(Math.random() * 9000) + 1000}`;
      }
    }

    await product.update({
      name, slug: finalSlug, description, originPrice, sellingPrice, stock, status, image
    });

    res.json({ message: "Product updated successfully", product });
  } catch (error) {
    log("Error updating product: " + error.message);
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
