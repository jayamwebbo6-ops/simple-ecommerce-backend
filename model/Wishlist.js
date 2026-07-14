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
}, {
  tableName: 'wishlists'
});

// Setup relationships
User.belongsToMany(Product, { 
  through: Wishlist, 
  as: 'wishlistProducts',
  constraints: false,
  uniqueKey: 'wishlist_user_prod_unique'
});
Product.belongsToMany(User, { 
  through: Wishlist,
  constraints: false,
  uniqueKey: 'wishlist_user_prod_unique'
});

// Direct associations for eager loading
Wishlist.belongsTo(User, { constraints: false });
Wishlist.belongsTo(Product, { constraints: false });
User.hasMany(Wishlist, { constraints: false });
Product.hasMany(Wishlist, { constraints: false });

module.exports = Wishlist;
