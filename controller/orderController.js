const Order = require('../model/Order');
const OrderItem = require('../model/OrderItem');
const Cart = require('../model/Cart');
const Product = require('../model/Product');
const User = require('../model/User');
const Admin = require('../model/Admin');
const { sendOrderConfirmationEmail, sendAdminOrderNotificationEmail, sendOrderStatusUpdateEmail } = require('../utils/emailHelper');
const { generateInvoicePDF } = require('../utils/invoice');
const sequelize = require('../config/db');
const { log } = require('../utils/logger');

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
        const availableStock = item.Product ? item.Product.stock : 0;
        return res.status(400).json({ 
          message: `Insufficient stock for ${item.Product?.name || 'a product'}. Only ${availableStock} unit(s) available.` 
        });
      }
      totalAmount += parseFloat(item.Product.sellingPrice) * item.quantity;

      // 3. Reduce stock immediately and move to reserveStock
      await item.Product.decrement('stock',        { by: item.quantity, transaction });
      await item.Product.increment('reserveStock', { by: item.quantity, transaction });
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

    await transaction.commit();

    res.status(201).json({ message: "Order initiated. Please complete payment.", order });
  } catch (error) {
    if (transaction) await transaction.rollback();
    log("Error during checkout: " + error.message);
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
    log("Error fetching orders: " + error.message);
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
    log("Error fetching all orders: " + error.message);
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

    const order = await Order.findByPk(orderId, {
      include: [
        { model: OrderItem, as: 'items', include: [Product] },
        { model: User }
      ]
    });
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

    // Trigger status update notification email in background
    if (order.User && order.User.email) {
      sendOrderStatusUpdateEmail(order.User.email, order, order.items || [], status)
        .then(() => log(`[DEBUG] Status update email sent to ${order.User.email} (Status: ${status})`))
        .catch(err => log(`[DEBUG] Failed to send status update email to ${order.User.email}: ` + err.message));
    }

    res.status(200).json({ message: "Order status updated successfully", order });
  } catch (error) {
    log("Error updating order status: " + error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  log(`[DEBUG] Received updatePaymentStatus request: ${JSON.stringify(req.body)}`);
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
      log(`[DEBUG] Order #${orderId} not found`);
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = order.status || 'awaiting_payment';
    log(`[DEBUG] Order #${orderId} found. Current status: "${currentStatus}". Target status: "${status}"`);

    // If already in target status, return success (Idempotency)
    if (currentStatus === status || (currentStatus === 'confirmed' && status === 'confirmed')) {
      log(`[DEBUG] Order #${orderId} is already in the desired status: ${currentStatus}`);
      return res.json({ message: "Payment already processed", order });
    }

    // Only allow updating if currently awaiting_payment
    if (currentStatus !== 'awaiting_payment') {
      log(`[DEBUG] Order #${orderId} cannot be updated. Current status: "${currentStatus}"`);
      return res.status(400).json({ message: `Order #${orderId} is already processed (Status: ${currentStatus})` });
    }

    if (status === 'payment_failed') {
      const transaction = await sequelize.transaction();
      try {
        order.status = 'payment_failed';
        order.failedAt = null; // immediately restored, so clear failedAt
        await order.save({ transaction });

        log(`[DEBUG] Order #${orderId} payment failed — restoring stock immediately from reserveStock...`);

        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const pId = item.ProductId || item.productId || item.product_id;
            if (!pId) continue;
            const product = await Product.findByPk(pId, { transaction });
            if (product) {
              const restoreQty = Math.min(item.quantity, product.reserveStock);
              await product.decrement('reserveStock', { by: restoreQty, transaction });
              await product.increment('stock',        { by: restoreQty, transaction });
              log(`[DEBUG] Immediately restored ${restoreQty} units for Product #${pId} (payment_failed)`);
            }
          }
        }

        await transaction.commit();
      } catch (err) {
        if (transaction) await transaction.rollback();
        log(`[DEBUG] Error during payment_failed immediate restore for Order #${orderId}: ` + err.message);
        throw err;
      }
    } else if (status === 'confirmed') {
      const transaction = await sequelize.transaction();
      try {
        order.status = 'confirmed';
        await order.save({ transaction });
        log(`[DEBUG] Order #${orderId} marked as confirmed (payment success)`);

        // Since order is confirmed, decrement reserveStock
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const pId = item.ProductId || item.productId || item.product_id;
            if (pId) {
              const product = await Product.findByPk(pId, { transaction });
              if (product) {
                const decrQty = Math.min(item.quantity, product.reserveStock);
                await product.decrement('reserveStock', { by: decrQty, transaction });
                log(`[DEBUG] Product #${pId} reserveStock -= ${decrQty} (permanent sale confirmed)`);
              }
            }
          }
        }

        // Clear user's cart now that payment is confirmed
        await Cart.destroy({ where: { UserId: order.UserId }, transaction });

        await transaction.commit();
      } catch (err) {
        if (transaction) await transaction.rollback();
        log(`[DEBUG] Error during confirmation for Order #${orderId}: ` + err.message);
        throw err;
      }

      // TRIGGER EMAILS ONLY AFTER PAYMENT SUCCESS
      try {
        const user = order.User;
        const dbAdmin = await Admin.findOne();
        const adminRecipient = dbAdmin?.email || process.env.EMAIL_USER;

        log(`[DEBUG] Email Dispatch for Order #${orderId}:`);
        log(`[DEBUG] -> Customer: ${user?.email}`);
        log(`[DEBUG] -> Admin: ${adminRecipient}`);

        // Build invoice PDF and send ONE combined confirmation + PDF invoice email to customer
        if (user && user.email) {
          try {
            const { pdfBuffer, invoiceId } = await generateInvoicePDF(order);
            sendOrderConfirmationEmail(user.email, order, order.items, pdfBuffer, invoiceId)
              .then(() => log(`[DEBUG] Confirmation+PDF Invoice email sent to ${user.email} (${invoiceId})`))
              .catch(err => log(`[DEBUG] Confirmation+PDF Invoice email FAILED to ${user.email}: ` + err.message));
          } catch (invoiceErr) {
            log('[DEBUG] PDF generation failed, sending plain confirmation email: ' + invoiceErr.message);
            sendOrderConfirmationEmail(user.email, order, order.items)
              .then(() => log(`[DEBUG] Plain confirmation email sent to ${user.email}`))
              .catch(err => log(`[DEBUG] Plain confirmation email FAILED to ${user.email}: ` + err.message));
          }
        }

        if (adminRecipient) {
          sendAdminOrderNotificationEmail(adminRecipient, order, order.items, user)
            .then(() => log(`[DEBUG] Admin email sent successfully to ${adminRecipient}`))
            .catch(err => log(`[DEBUG] Admin email FAILED to ${adminRecipient}: ` + err.message));
        } else {
          log("[DEBUG] No admin recipient email found.");
        }
      } catch (emailErr) {
        log("[DEBUG] Critical error during email preparation: " + emailErr.message);
      }
    } else if (status === 'cancelled') {
      // CANCEL: restore stock immediately from reserveStock
      const transaction = await sequelize.transaction();
      try {
        order.status = 'cancelled';
        await order.save({ transaction });

        log(`[DEBUG] Cancelling Order #${orderId} — restoring stock immediately from reserveStock...`);

        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const pId = item.ProductId || item.productId || item.product_id;
            if (!pId) continue;
            const product = await Product.findByPk(pId, { transaction });
            if (product) {
              const restoreQty = Math.min(item.quantity, product.reserveStock);
              await product.decrement('reserveStock', { by: restoreQty, transaction });
              await product.increment('stock',        { by: restoreQty, transaction });
              log(`[DEBUG] Immediately restored ${restoreQty} units for Product #${pId} (reserveStock -> stock)`);
            }
          }
        }

        await transaction.commit();
        log(`[DEBUG] Cancel stock-restore committed for Order #${orderId}`);
      } catch (err) {
        if (transaction) await transaction.rollback();
        log(`[DEBUG] Error during cancel-restore for Order #${orderId}: ` + err.message);
        throw err;
      }
    } else {
      return res.status(400).json({ message: "Invalid status provided" });
    }

    res.json({ message: "Payment status updated successfully", order });
  } catch (error) {
    log("Error in updatePaymentStatus: " + error.message);
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
    log("Error fetching dashboard stats: " + error.message);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
