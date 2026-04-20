const { Pool } = require('pg');
const path = require('path');

// ✅ FIX: सही path से .env load करो
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

console.log("🔍 DB CONFIG CHECK:");
console.log("HOST:", process.env.DB_HOST);
console.log("PORT:", process.env.DB_PORT);
console.log("DB:", process.env.DB_NAME);
console.log("USER:", process.env.DB_USER);
console.log("PASSWORD:", process.env.DB_PASSWORD ? "✅ Loaded" : "❌ Missing");

// ❗ अगर env load नहीं हुआ तो तुरंत error
if (!process.env.DB_HOST) {
  console.error("❌ ERROR: .env file not loaded properly");
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '6543'), // ✅ Supabase pooler port
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('✅ New DB connection established');
});

pool.on('error', (err) => {
  console.error('❌ Pool error:', err.message);
});

// ✅ Helper query function (important fix)
const query = (text, params) => pool.query(text, params);

// ✅ Test connection
const testConnection = async () => {
  try {
    console.log("⏳ Testing DB connection...");
    const res = await pool.query('SELECT NOW(), current_database();');
    console.log('✅ PostgreSQL connected:', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection failed FULL ERROR:\n', err);
  }
};

module.exports = {
  pool,
  query,          // 🔥 IMPORTANT (tumhara error yahin tha)
  testConnection
};