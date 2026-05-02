const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');
const Product = require('./Product');

const Wishlist = sequelize.define('Wishlist', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  }
});

// Setup relationships
User.belongsToMany(Product, { through: Wishlist, as: 'wishlistProducts' });
Product.belongsToMany(User, { through: Wishlist });

// Direct associations for eager loading
Wishlist.belongsTo(User);
Wishlist.belongsTo(Product);
User.hasMany(Wishlist);
Product.hasMany(Wishlist);

module.exports = Wishlist;
