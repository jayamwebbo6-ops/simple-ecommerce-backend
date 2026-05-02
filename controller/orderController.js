const Order = require('../model/Order');
const OrderItem = require('../model/OrderItem');
const Cart = require('../model/Cart');
const Product = require('../model/Product');
const sequelize = require('../config/db');

exports.checkout = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const userId = req.user.id;
    const { shippingAddress } = req.body;

    const cartItems = await Cart.findAll({
      where: { UserId: userId },
      include: [{ model: Product }]
    });

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let totalAmount = 0;
    cartItems.forEach(item => {
      totalAmount += parseFloat(item.Product.sellingPrice) * item.quantity;
    });

    const order = await Order.create({
      UserId: userId,
      totalAmount: totalAmount.toFixed(2),
      status: 'pending',
      shippingAddress: shippingAddress || ''
    }, { transaction });

    const orderItemsData = cartItems.map(item => ({
      OrderId: order.id,
      ProductId: item.ProductId,
      quantity: item.quantity,
      price: item.Product.sellingPrice
    }));

    await OrderItem.bulkCreate(orderItemsData, { transaction });
    await Cart.destroy({ where: { UserId: userId }, transaction });

    await transaction.commit();
    res.status(201).json({ message: "Checkout successful", order });
  } catch (error) {
    await transaction.rollback();
    console.error("Error during checkout:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.findAll({
      where: { UserId: userId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [{ model: Product }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
