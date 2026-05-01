const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');
const authRoutes      = require('./routes/auth.routes');
const productRoutes   = require('./routes/product.routes');
const categoryRoutes  = require('./routes/category.routes');
const orderRoutes     = require('./routes/order.routes');
const wishlistRoutes  = require('./routes/wishlist.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security Middleware ────────────────────────────────
app.use(helmet());
app.set('trust proxy', 1); // ✅ Render ke liye zaroori
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'https://yogkart-eedb8.web.app',        // Firebase hosting
  'https://yogkart-eedb8.firebaseapp.com', // Firebase alternate
  'https://www.yogkart.in',               // Custom domain
  'https://www.yogkart.com',               // Custom domain 
  'https://yogkart.in',                   // Custom domain (without www)
  process.env.FRONTEND_URL,               // Render env variable
].filter(Boolean); // null/undefined hata do

app.use(cors({
  origin: (origin, callback) => {
    // Postman / server-to-server (no origin) — allow
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// OPTIONS preflight requests allow karo
app.options('*', cors());

// ── Rate Limiting ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter for auth routes
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

app.use(globalLimiter);

// ── Body Parsing ───────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Health Check ───────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Yogkart API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ─────────────────────────────────────────
app.use('/api/auth',       authLimiter, authRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/wishlist',   wishlistRoutes);

// ── 404 Handler ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ── Global Error Handler ───────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ── Start Server ───────────────────────────────────────
const start = async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`\n🚀 Yogkart API running on http://localhost:${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\nEndpoints:`);
    console.log(`  POST   /api/auth/register`);
    console.log(`  POST   /api/auth/login`);
    console.log(`  POST   /api/auth/refresh`);
    console.log(`  GET    /api/auth/me`);
    console.log(`  GET    /api/products`);
    console.log(`  GET    /api/products/:slug`);
    console.log(`  GET    /api/categories`);
    console.log(`  GET    /api/orders`);
    console.log(`  POST   /api/orders`);
    console.log(`  GET    /api/wishlist`);
    console.log(`  POST   /api/wishlist/:productId\n`);
  });
};

start();

module.exports = app;