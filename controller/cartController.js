const Cart = require('../model/Cart');
const Product = require('../model/Product');

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let cartItem = await Cart.findOne({
      where: { UserId: userId, ProductId: productId }
    });

    const requestedQuantity = parseInt(quantity, 10);
    const existingQuantity = cartItem ? cartItem.quantity : 0;
    const totalRequestedQuantity = existingQuantity + requestedQuantity;

    if (totalRequestedQuantity > product.stock) {
      return res.status(400).json({ 
        message: `Only ${product.stock} units available in stock. You already have ${existingQuantity} in cart.`,
        availableStock: product.stock 
      });
    }

    if (cartItem) {
      cartItem.quantity = totalRequestedQuantity;
      await cartItem.save();
    } else {
      cartItem = await Cart.create({
        UserId: userId,
        ProductId: productId,
        quantity: requestedQuantity
      });
    }

    return res.status(200).json({ message: "Added to cart", cartItem });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItems = await Cart.findAll({
      where: { UserId: userId },
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'sellingPrice', 'originPrice', 'image', 'status', 'stock']
        }
      ]
    });
    res.status(200).json(cartItems);
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const cartItem = await Cart.findOne({ where: { id, UserId: userId } });
    if (!cartItem) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    await cartItem.destroy();
    res.status(200).json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    if (quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    const cartItem = await Cart.findOne({ 
      where: { id, UserId: userId },
      include: [Product]
    });

    if (!cartItem) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (parseInt(quantity, 10) > cartItem.Product.stock) {
      return res.status(400).json({ 
        message: `Only ${cartItem.Product.stock} units available in stock.`,
        availableStock: cartItem.Product.stock
      });
    }

    cartItem.quantity = parseInt(quantity, 10);
    await cartItem.save();

    res.status(200).json({ message: "Cart updated", cartItem });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    await Cart.destroy({ where: { UserId: userId } });
    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
