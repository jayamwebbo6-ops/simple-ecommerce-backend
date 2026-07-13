const Wishlist = require('../model/Wishlist');
const Product = require('../model/Product');
const { log } = require('../utils/logger');

exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const existingItem = await Wishlist.findOne({
      where: { UserId: userId, ProductId: productId }
    });

    if (existingItem) {
      // If it exists, remove it
      await existingItem.destroy();
      return res.status(200).json({ message: "Removed from wishlist", isWishlisted: false });
    } else {
      // If it doesn't exist, add it
      await Wishlist.create({ UserId: userId, ProductId: productId });
      return res.status(200).json({ message: "Added to wishlist", isWishlisted: true });
    }
  } catch (error) {
    log("Error toggling wishlist: " + error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch wishlist items with their associated product details
    const wishlistItems = await Wishlist.findAll({
      where: { UserId: userId },
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'sellingPrice', 'originPrice', 'image', 'status']
        }
      ]
    });

    // Format the response to be an array of products for easy rendering
    const products = wishlistItems.map(item => item.Product);

    res.status(200).json(products);
  } catch (error) {
    log("Error getting wishlist: " + error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
