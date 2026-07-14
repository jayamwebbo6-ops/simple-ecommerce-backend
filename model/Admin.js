const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Admin = sequelize.define('Admin', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  profilePicture: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  facebook: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  twitter: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  instagram: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  showAddress: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  showPhone: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  showSocial: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  showFacebook: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  showTwitter: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  showInstagram: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  otp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  otpExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  timestamps: true,
  tableName: 'admins'
});

module.exports = Admin;
