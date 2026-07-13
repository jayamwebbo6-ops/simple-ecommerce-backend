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
const { log } = require('./logger');

const RESERVE_MINUTES = 1; // how long stock is held in reserve

function startStockRestoreCron() {
  // Run every minute  ─  '* * * * *'
  cron.schedule('* * * * *', async () => {
    const cutoff = new Date(Date.now() - RESERVE_MINUTES * 60 * 1000);

    try {
      // Find failed or awaiting_payment orders that have been sitting in reserve long enough
      const expiredOrders = await Order.findAll({
        where: {
          [Op.or]: [
            {
              status: 'payment_failed',
              failedAt: { [Op.not]: null, [Op.lte]: cutoff }
            },
            {
              status: 'awaiting_payment',
              createdAt: { [Op.lte]: cutoff }
            }
          ]
        },
        include: [{ model: OrderItem, as: 'items', include: [Product] }]
      });

      if (expiredOrders.length === 0) return;

      log(`[CRON] Found ${expiredOrders.length} expired order(s) (awaiting_payment/payment_failed). Restoring stock...`);

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

              log(`[CRON] Order #${order.id}: Restored ${restoreQty} units for Product #${pId} (reserveStock → stock)`);
            }
          }

          // Conditional status resolution
          if (order.status === 'payment_failed') {
            order.failedAt = null;
            await order.save({ transaction: t });
            log(`[CRON] Order #${order.id} (payment_failed) (reserveStock -> stock) restored, status kept as payment_failed.`);
          } else {
            order.status = 'cancelled';
            await order.save({ transaction: t });
            log(`[CRON] Order #${order.id} (awaiting_payment) marked as cancelled, (reserveStock -> stock) restored.`);
          }

          await t.commit();
        } catch (err) {
          await t.rollback();
          log(`[CRON] Error restoring stock for Order #${order.id}: ` + err.message);
        }
      }
    } catch (err) {
      log('[CRON] stockRestoreCron error: ' + err.message);
    }
  });

  log(`[CRON] stockRestoreCron started — restores reserve stock after ${RESERVE_MINUTES} minutes.`);
}

module.exports = { startStockRestoreCron };
