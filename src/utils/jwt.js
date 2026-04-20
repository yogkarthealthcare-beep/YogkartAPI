const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

const saveRefreshToken = async (userId, token) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
};

const verifyRefreshToken = async (token) => {
  // Verify signature
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  // Check in DB and not expired
  const result = await query(
    `SELECT * FROM refresh_tokens
     WHERE token = $1 AND user_id = $2 AND expires_at > NOW()`,
    [token, decoded.id]
  );
  if (result.rows.length === 0) throw new Error('Invalid or expired refresh token');
  return decoded;
};

const revokeRefreshToken = async (token) => {
  await query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
};

const revokeAllUserTokens = async (userId) => {
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
