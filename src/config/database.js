const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false   // ← Supabase ke liye zaroori
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

// Helper: run a query
const query = (text, params) => pool.query(text, params);

// Helper: get a client for transactions
const getClient = () => pool.connect();

// Test connection on startup
const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected:', res.rows[0].now);
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = { pool, query, getClient, testConnection };
