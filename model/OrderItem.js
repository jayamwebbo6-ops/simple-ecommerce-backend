const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Order = require('./Order');
const Product = require('./Product');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
}, {
  tableName: 'orderitems'
});

OrderItem.belongsTo(Order, { constraints: false });
Order.hasMany(OrderItem, { as: 'items', constraints: false });

OrderItem.belongsTo(Product, { constraints: false });
Product.hasMany(OrderItem, { constraints: false });

module.exports = OrderItem;
