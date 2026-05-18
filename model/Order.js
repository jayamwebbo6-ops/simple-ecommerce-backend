const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM('awaiting_payment', 'confirmed', 'shipped', 'delivered', 'cancelled', 'payment_failed'),
    defaultValue: 'awaiting_payment'
  },
  shippingAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Set when status becomes payment_failed — cron uses this to restore stock after 10 min
  failedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

Order.belongsTo(User, { constraints: false });
User.hasMany(Order, { constraints: false });

module.exports = Order;
