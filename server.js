require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const addressRoutes = require('./routes/addressRoutes');
const { startStockRestoreCron } = require('./utils/stockRestoreCron');

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);

// Static files
app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 5000;

const Admin = require('./model/Admin');
const bcrypt = require('bcryptjs');
require('./model/Wishlist'); // Require to sync with DB
require('./model/Cart');
require('./model/Order');
require('./model/OrderItem');
require('./model/Address');

// Safely add new columns if they don't already exist (avoids alter:true index explosion)
async function addMissingColumns() {
  const qi = sequelize.getQueryInterface();

  const productCols = await qi.describeTable('Products').catch(() => ({}));
  if (!productCols.reserveStock) {
    await sequelize.query(
      "ALTER TABLE `Products` ADD COLUMN `reserveStock` INT NOT NULL DEFAULT 0"
    );
    console.log('[MIGRATE] Added Products.reserveStock');
  }

  const orderCols = await qi.describeTable('Orders').catch(() => ({}));
  if (!orderCols.failedAt) {
    await sequelize.query(
      "ALTER TABLE `Orders` ADD COLUMN `failedAt` DATETIME NULL"
    );
    console.log('[MIGRATE] Added Orders.failedAt');
  }

  // Ensure all ENUM values exist on Orders.status
  await sequelize.query(
    "ALTER TABLE `Orders` MODIFY COLUMN `status` ENUM('awaiting_payment','pending','payment_failed','processing','completed','cancelled') NOT NULL DEFAULT 'awaiting_payment'"
  ).catch(err => console.warn('[MIGRATE] Could not update Orders.status ENUM:', err.message));
}

// Sync database and start server
sequelize.sync().then(async () => {
  console.log('Database synced');

  // Add new columns without touching existing indexes
  await addMissingColumns();

  // Start background cron — restores reserve stock after 10 min
  startStockRestoreCron();

  // Seed default admin if none exists
  const adminCount = await Admin.count();
  if (adminCount === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({
      name: 'Admin',
      email: 'admin123@gmail.com',
      password: hashedPassword
    });
    console.log('Seeded default admin (admin123@gmail.com / admin123)');
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to sync database", err);
});

