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

// Sync database and start server
sequelize.sync({ alter: true }).then(async () => {
  console.log('Database synced');

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
