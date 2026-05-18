const Order = require('../model/Order');
const OrderItem = require('../model/OrderItem');
const Cart = require('../model/Cart');
const Product = require('../model/Product');
const User = require('../model/User');
const Admin = require('../model/Admin');
const { sendOrderConfirmationEmail, sendAdminOrderNotificationEmail } = require('../utils/emailHelper');
const sequelize = require('../config/db');

exports.checkout = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const userId = req.user.id;
    const { shippingAddress } = req.body;

    // 1. Get cart items
    const cartItems = await Cart.findAll({
      where: { UserId: userId },
      include: [Product]
    });

    if (cartItems.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Cart is empty" });
    }

    let totalAmount = 0;
    // 2. Validate stock and calculate total
    for (const item of cartItems) {
      if (!item.Product || item.Product.stock < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({ message: `Insufficient stock for ${item.Product?.name || 'a product'}` });
      }
      totalAmount += parseFloat(item.Product.sellingPrice) * item.quantity;

      // 3. Reduce stock immediately (Awaiting Payment status)
      await item.Product.decrement('stock', { by: item.quantity, transaction });
    }

    // 4. Create order
    const order = await Order.create({
      UserId: userId,
      totalAmount: totalAmount.toFixed(2),
      status: 'awaiting_payment',
      shippingAddress: shippingAddress || ''
    }, { transaction });

    // Create order items
    const orderItemsData = cartItems.map(item => ({
      OrderId: order.id,
      ProductId: item.ProductId || item.productId,
      quantity: item.quantity,
      price: item.Product.sellingPrice
    }));

    await OrderItem.bulkCreate(orderItemsData, { transaction });

    await Cart.destroy({ where: { UserId: userId }, transaction });

    await transaction.commit();

    res.status(201).json({ message: "Order initiated. Please complete payment.", order });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error during checkout:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.findAll({
      where: { UserId: userId },
      include: [{
        model: OrderItem,
        as: 'items',
        include: [Product]
      }],
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access forbidden: Admins only" });
    }

    const orders = await Order.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email']
        },
        {
          model: OrderItem,
          as: 'items',
          include: [Product]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access forbidden: Admins only" });
    }

    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = order.status;

    // Transition Logic Rules:
    // 1. Once 'shipped', cannot go back to 'confirmed' or 'pending'
    if (currentStatus === 'shipped' && (status === 'confirmed' || status === 'pending')) {
      return res.status(400).json({ message: "Order already shipped. Cannot move back to confirmed." });
    }
    // 2. Once 'delivered', cannot go back to 'shipped', 'confirmed' or 'pending'
    if (currentStatus === 'delivered' && (status === 'shipped' || status === 'confirmed' || status === 'pending')) {
      return res.status(400).json({ message: "Order already delivered. Cannot move back." });
    }
    // 3. Once 'cancelled', cannot be changed
    if (currentStatus === 'cancelled') {
      return res.status(400).json({ message: "Order is cancelled. Cannot change status." });
    }

    order.status = status;
    await order.save();

    res.status(200).json({ message: "Order status updated successfully", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  console.log(`[DEBUG] Received updatePaymentStatus request:`, req.body);
  try {
    const { orderId, status } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const order = await Order.findByPk(orderId, {
      include: [
        { model: OrderItem, as: 'items', include: [Product] },
        { model: User }
      ]
    });

    if (!order) {
      console.error(`[DEBUG] Order #${orderId} not found`);
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = order.status || 'awaiting_payment';
    console.log(`[DEBUG] Order #${orderId} found. Current status: "${currentStatus}". Target status: "${status}"`);

    // If already in target status, return success (Idempotency)
    if (currentStatus === status || (currentStatus === 'confirmed' && status === 'confirmed')) {
      console.log(`[DEBUG] Order #${orderId} is already in the desired status: ${currentStatus}`);
      return res.json({ message: "Payment already processed", order });
    }

    // Only allow updating if currently awaiting_payment
    if (currentStatus !== 'awaiting_payment') {
      console.warn(`[DEBUG] Order #${orderId} cannot be updated. Current status: "${currentStatus}"`);
      return res.status(400).json({ message: `Order #${orderId} is already processed (Status: ${currentStatus})` });
    }

    if (status === 'payment_failed') {
      const transaction = await sequelize.transaction();
      try {
        order.status = 'payment_failed';
        order.failedAt = new Date(); // ← cron will check this to restore after 10 min
        await order.save({ transaction });

        console.log(`[DEBUG] Moving stock to RESERVE for Order #${orderId}...`);

        // Move stock from main stock → reserveStock (NOT restored yet)
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const pId = item.ProductId || item.productId || item.product_id;
            console.log(`[DEBUG] Reserving ${item.quantity} units for Product #${pId}`);

            if (pId) {
              const product = await Product.findByPk(pId);
              if (product) {
                // Stock stays reduced — units move into reserveStock bucket
                await product.increment('reserveStock', { by: item.quantity, transaction });
                console.log(`[DEBUG] Product #${pId} reserveStock += ${item.quantity}. Will restore in 10 min.`);
              }
            }
          }
        }

        await transaction.commit();
        console.log(`[DEBUG] Reserve stock committed for Order #${orderId}. Cron will restore in 10 min.`);
      } catch (err) {
        if (transaction) await transaction.rollback();
        console.error(`[DEBUG] Error during reserve-stock for Order #${orderId}:`, err);
        throw err;
      }
    } else if (status === 'confirmed') {
      order.status = 'confirmed';
      await order.save();
      console.log(`[DEBUG] Order #${orderId} marked as confirmed (payment success)`);

      // TRIGGER EMAILS ONLY AFTER PAYMENT SUCCESS
      try {
        const user = order.User;
        const dbAdmin = await Admin.findOne();
        const adminRecipient = dbAdmin?.email || process.env.EMAIL_USER;

        console.log(`[DEBUG] Email Dispatch for Order #${orderId}:`);
        console.log(`[DEBUG] -> Customer: ${user?.email}`);
        console.log(`[DEBUG] -> Admin: ${adminRecipient}`);

        if (user && user.email) {
          sendOrderConfirmationEmail(user.email, order, order.items)
            .then(() => console.log(`[DEBUG] User email sent successfully to ${user.email}`))
            .catch(err => console.error(`[DEBUG] User email FAILED to ${user.email}:`, err));
        }

        if (adminRecipient) {
          sendAdminOrderNotificationEmail(adminRecipient, order, order.items, user)
            .then(() => console.log(`[DEBUG] Admin email sent successfully to ${adminRecipient}`))
            .catch(err => console.error(`[DEBUG] Admin email FAILED to ${adminRecipient}:`, err));
        } else {
          console.warn("[DEBUG] No admin recipient email found.");
        }
      } catch (emailErr) {
        console.error("[DEBUG] Critical error during email preparation:", emailErr);
      }
    } else if (status === 'cancelled') {
      // CANCEL: restore stock immediately — no reserve wait
      const transaction = await sequelize.transaction();
      try {
        order.status = 'cancelled';
        await order.save({ transaction });

        console.log(`[DEBUG] Cancelling Order #${orderId} — restoring stock immediately...`);

        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const pId = item.ProductId || item.productId || item.product_id;
            if (!pId) continue;
            const product = await Product.findByPk(pId);
            if (product) {
              await product.increment('stock', { by: item.quantity, transaction });
              console.log(`[DEBUG] Immediately restored ${item.quantity} units for Product #${pId}`);
            }
          }
        }

        await transaction.commit();
        console.log(`[DEBUG] Cancel stock-restore committed for Order #${orderId}`);
      } catch (err) {
        if (transaction) await transaction.rollback();
        console.error(`[DEBUG] Error during cancel-restore for Order #${orderId}:`, err);
        throw err;
      }
    } else {
      return res.status(400).json({ message: "Invalid status provided" });
    }

    res.json({ message: "Payment status updated successfully", order });
  } catch (error) {
    console.error("Error in updatePaymentStatus:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access forbidden: Admins only" });
    }

    const totalOrders = await Order.count();
    const totalProducts = await Product.count();
    const totalCustomers = await User.count();

    const totalRevenue = await Order.sum('totalAmount', {
      where: {
        status: ['confirmed', 'shipped', 'delivered']
      }
    }) || 0;

    const recentOrders = await Order.findAll({
      include: [{ model: User, attributes: ['name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    res.json({
      totalOrders,
      totalProducts,
      totalCustomers,
      totalRevenue: parseFloat(totalRevenue).toFixed(2),
      recentOrders
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
