const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Product = sequelize.define('Product', {
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: false },
  originPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  sellingPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  // Units temporarily held here after a payment_failed order.
  // They are restored back to `stock` after 10 minutes by the cron job.
  reserveStock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
  image: { type: DataTypes.STRING, allowNull: true },
}, {
  timestamps: true,
  tableName: 'products'
});

module.exports = Product;
