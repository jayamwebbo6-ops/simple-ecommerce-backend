const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');
const Product = require('./Product');

const Cart = sequelize.define('Cart', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
});

// Direct associations for eager loading
Cart.belongsTo(User, { constraints: false });
Cart.belongsTo(Product, { constraints: false });
User.hasMany(Cart, { constraints: false });
Product.hasMany(Cart, { constraints: false });

module.exports = Cart;
