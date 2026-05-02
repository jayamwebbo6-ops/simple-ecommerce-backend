require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false, // Set to console.log to see the generated SQL queries
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Test the connection
sequelize.authenticate()
  .then(() => {
    console.log(`Connected to MySQL Database via Sequelize: ${process.env.DB_NAME} on port ${process.env.DB_PORT || 3306}`);
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err.message);
  });

module.exports = sequelize;
