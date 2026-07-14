const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Address = sequelize.define('Address', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  addressLine1: {
    type: DataTypes.STRING,
    allowNull: false
  },
  addressLine2: {
    type: DataTypes.STRING
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false
  },
  postalCode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  country: {
    type: DataTypes.STRING,
    defaultValue: 'India'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'addresses'
});

User.hasMany(Address, { foreignKey: 'userId', constraints: false });
Address.belongsTo(User, { foreignKey: 'userId', constraints: false });

module.exports = Address;
