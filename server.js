require('dotenv').config();
const { initLogger } = require('./utils/logger');
initLogger(); // Initialize file logger overrides early

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
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173', 'http://localhost:5174', 'https://webscape.co.in'], credentials: true }));
app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// Routes
const apiRouter = express.Router();

// Test API route
apiRouter.get('/test', (req, res) => {
  res.json({ success: true, message: 'API is working successfully' });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/wishlist', wishlistRoutes);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/addresses', addressRoutes);

const apiPrefix = process.env.API_URL ? `/${process.env.API_URL}/api` : '/api';
app.use(apiPrefix, apiRouter);

// Static files — canonical path: /simple-ecommerce/api/uploads/...
// This matches what the frontend builds from VITE_API_URL + /uploads/...
app.use(`${apiPrefix}/uploads`, express.static('uploads')); // /simple-ecommerce/api/uploads
// Legacy / direct fallback paths
if (process.env.API_URL) {
  app.use(`/${process.env.API_URL}/uploads`, express.static('uploads')); // /simple-ecommerce/uploads
  app.use('/uploads', express.static('uploads'));                         // bare /uploads
}

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

  const productCols = await qi.describeTable('products').catch(() => ({}));
  if (!productCols.reserveStock) {
    await sequelize.query(
      "ALTER TABLE `products` ADD COLUMN `reserveStock` INT NOT NULL DEFAULT 0"
    );
    console.log('[MIGRATE] Added products.reserveStock');
  }

  const orderCols = await qi.describeTable('orders').catch(() => ({}));
  if (!orderCols.failedAt) {
    await sequelize.query(
      "ALTER TABLE `orders` ADD COLUMN `failedAt` DATETIME NULL"
    );
    console.log('[MIGRATE] Added orders.failedAt');
  }

  const adminCols = await qi.describeTable('admins').catch(() => ({}));
  if (!adminCols.address) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `address` TEXT NULL");
    console.log('[MIGRATE] Added admins.address');
  }
  if (!adminCols.phone) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `phone` VARCHAR(255) NULL");
    console.log('[MIGRATE] Added admins.phone');
  }
  if (!adminCols.facebook) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `facebook` VARCHAR(255) NULL");
    console.log('[MIGRATE] Added admins.facebook');
  }
  if (!adminCols.twitter) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `twitter` VARCHAR(255) NULL");
    console.log('[MIGRATE] Added admins.twitter');
  }
  if (!adminCols.instagram) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `instagram` VARCHAR(255) NULL");
    console.log('[MIGRATE] Added admins.instagram');
  }
  if (!adminCols.showAddress) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `showAddress` TINYINT(1) NOT NULL DEFAULT 1");
    console.log('[MIGRATE] Added admins.showAddress');
  }
  if (!adminCols.showPhone) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `showPhone` TINYINT(1) NOT NULL DEFAULT 1");
    console.log('[MIGRATE] Added admins.showPhone');
  }
  if (!adminCols.showSocial) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `showSocial` TINYINT(1) NOT NULL DEFAULT 1");
    console.log('[MIGRATE] Added admins.showSocial');
  }
  if (!adminCols.showFacebook) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `showFacebook` TINYINT(1) NOT NULL DEFAULT 1");
    console.log('[MIGRATE] Added admins.showFacebook');
  }
  if (!adminCols.showTwitter) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `showTwitter` TINYINT(1) NOT NULL DEFAULT 1");
    console.log('[MIGRATE] Added admins.showTwitter');
  }
  if (!adminCols.showInstagram) {
    await sequelize.query("ALTER TABLE `admins` ADD COLUMN `showInstagram` TINYINT(1) NOT NULL DEFAULT 1");
    console.log('[MIGRATE] Added admins.showInstagram');
  }

  // Ensure all ENUM values exist on orders.status
  await sequelize.query(
    "ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('awaiting_payment','confirmed','shipped','delivered','cancelled','payment_failed') NOT NULL DEFAULT 'awaiting_payment'"
  ).catch(err => console.warn('[MIGRATE] Could not update orders.status ENUM:', err.message));

  // Proactive Fix: Update any existing "empty" statuses (caused by previous ENUM failure) to 'confirmed'
  await sequelize.query(
    "UPDATE `orders` SET `status` = 'confirmed' WHERE `status` = '' OR `status` IS NULL"
  ).then(([result]) => {
    if (result.affectedRows > 0) console.log(`[MIGRATE] Fixed ${result.affectedRows} orders with empty status.`);
  }).catch(err => console.warn('[MIGRATE] Could not fix existing statuses:', err.message));
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
// Reload trigger comment
