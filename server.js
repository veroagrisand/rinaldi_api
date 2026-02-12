const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./src/utils/errorHandler');
require('dotenv').config();

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const productRoutes = require('./src/routes/productRoutes');
const productVariantRoutes = require('./src/routes/productVariantRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const transactionRoutes = require('./src/routes/transactionRoutes');
const orderItemRoutes = require('./src/routes/orderItemRoutes');
const dataStockRoutes = require('./src/routes/dataStockRoutes');
const bankRoutes = require('./src/routes/bankRoutes');
const couponRoutes = require('./src/routes/couponRoutes');
const newsRoutes = require('./src/routes/newsRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const orderReviewRoutes = require('./src/routes/orderReviewRoutes');
const monitoringRoutes = require('./src/routes/monitoring');


const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'REST API with Role-Based Access Control is running',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      categories: '/api/categories',
      products: '/api/products',
      variants: '/api/variants',
      cart: '/api/cart',
      transactions: '/api/transactions',
      orderItems: '/api/order-items',
      dataStocks: '/api/data-stocks',
      banks: '/api/banks',
      coupons: '/api/coupons',
      news: '/api/news',
      notifications: '/api/notifications',
      settings: '/api/settings',
      reviews: '/api/reviews'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/variants', productVariantRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/order-items', orderItemRoutes);
app.use('/api/data-stocks', dataStockRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reviews', orderReviewRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
    path: req.path
  });
});

// Global error handler (must be last)
app.use(errorHandler);

app.use('/api/monitoring', monitoringRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
Server is running on port ${PORT}

API Documentation:
GET https://docs.verospace.app/

Roles: user, admin, reseller
JWT Authentication: No Expiration
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION!    Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION!  Shutting down...');
  console.error(err. name, err.message);
  process.exit(1);
});
