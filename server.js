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

// Static files
const uploadsPrefix = process.env.API_URL ? `/${process.env.API_URL}/uploads` : '/uploads';
app.use(uploadsPrefix, express.static('uploads'));
if (process.env.API_URL) {
  app.use('/uploads', express.static('uploads'));
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
    "ALTER TABLE `Orders` MODIFY COLUMN `status` ENUM('awaiting_payment','confirmed','shipped','delivered','cancelled','payment_failed') NOT NULL DEFAULT 'awaiting_payment'"
  ).catch(err => console.warn('[MIGRATE] Could not update Orders.status ENUM:', err.message));

  // Proactive Fix: Update any existing "empty" statuses (caused by previous ENUM failure) to 'confirmed'
  await sequelize.query(
    "UPDATE `Orders` SET `status` = 'confirmed' WHERE `status` = '' OR `status` IS NULL"
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

