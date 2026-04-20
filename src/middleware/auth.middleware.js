const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { unauthorized, forbidden } = require('../utils/response');

// ── Protect: verify JWT access token ──────────────────
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB
    const result = await query(
      'SELECT id, name, email, phone, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return unauthorized(res, 'User not found');
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return unauthorized(res, 'Account is deactivated');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token expired');
    }
    if (err.name === 'JsonWebTokenError') {
      return unauthorized(res, 'Invalid token');
    }
    return unauthorized(res, 'Authentication failed');
  }
};

// ── Admin only ─────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return forbidden(res, 'Admin access required');
  }
  next();
};

// ── Optional auth (attach user if token present) ───────
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, name, email, phone, role FROM users WHERE id = $1 AND is_active = TRUE',
      [decoded.id]
    );
    if (result.rows.length > 0) req.user = result.rows[0];
  } catch (_) {
    // Ignore errors — just continue without user
  }
  next();
};

module.exports = { protect, adminOnly, optionalAuth };
