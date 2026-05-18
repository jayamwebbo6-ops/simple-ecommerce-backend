/**
 * stockRestoreCron.js
 *
 * Runs every minute.
 * Finds all `payment_failed` orders whose `failedAt` timestamp is
 * more than 10 minutes ago, then:
 *   1. Moves the units from Product.reserveStock  →  Product.stock
 *   2. Marks the order as `cancelled` (fully resolved)
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const Order = require('../model/Order');
const OrderItem = require('../model/OrderItem');
const Product = require('../model/Product');

const RESERVE_MINUTES = 10; // how long stock is held in reserve

function startStockRestoreCron() {
  // Run every minute  ─  '* * * * *'
  cron.schedule('* * * * *', async () => {
    const cutoff = new Date(Date.now() - RESERVE_MINUTES * 60 * 1000);

    try {
      // Find failed orders that have been sitting in reserve long enough
      const expiredOrders = await Order.findAll({
        where: {
          status: 'payment_failed',
          failedAt: { [Op.not]: null, [Op.lte]: cutoff }
        },
        include: [{ model: OrderItem, as: 'items', include: [Product] }]
      });

      if (expiredOrders.length === 0) return;

      console.log(`[CRON] Found ${expiredOrders.length} expired failed order(s). Restoring stock...`);

      for (const order of expiredOrders) {
        const t = await sequelize.transaction();
        try {
          if (order.items && order.items.length > 0) {
            for (const item of order.items) {
              const pId = item.ProductId || item.productId;
              if (!pId) continue;

              const product = await Product.findByPk(pId, { transaction: t });
              if (!product) continue;

              const restoreQty = Math.min(item.quantity, product.reserveStock); // safety guard

              // Move from reserve → main stock
              await product.decrement('reserveStock', { by: restoreQty, transaction: t });
              await product.increment('stock',        { by: restoreQty, transaction: t });

              console.log(`[CRON] Order #${order.id}: Restored ${restoreQty} units for Product #${pId} (reserveStock → stock)`);
            }
          }

          // Mark order as cancelled — it's fully resolved now
          order.status = 'cancelled';
          await order.save({ transaction: t });

          await t.commit();
          console.log(`[CRON] Order #${order.id} marked as cancelled. Stock fully restored.`);
        } catch (err) {
          await t.rollback();
          console.error(`[CRON] Error restoring stock for Order #${order.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[CRON] stockRestoreCron error:', err);
    }
  });

  console.log(`[CRON] stockRestoreCron started — restores reserve stock after ${RESERVE_MINUTES} minutes.`);
}

module.exports = { startStockRestoreCron };
