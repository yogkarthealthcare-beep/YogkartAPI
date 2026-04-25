/**
 * ============================================================
 * OTP Store — in-memory with TTL
 * ============================================================
 * Production mein Redis use karo:
 *   await redisClient.setEx(`otp:${email}`, 600, JSON.stringify({ otp, attempts: 0 }));
 * ============================================================
 */

const OTP_TTL_MS   = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

// Map<email, { otp, expiresAt, attempts }>
const store = new Map();

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const saveOtp = (email, otp) => {
  store.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
};

const verifyOtp = (email, otp) => {
  const key    = email.toLowerCase();
  const record = store.get(key);

  if (!record)                         return { valid: false, reason: 'OTP not found or already used' };
  if (Date.now() > record.expiresAt)   { store.delete(key); return { valid: false, reason: 'OTP expired' }; }
  if (record.attempts >= MAX_ATTEMPTS) { store.delete(key); return { valid: false, reason: 'Too many attempts' }; }

  record.attempts += 1;
  if (record.otp !== otp.toString())   return { valid: false, reason: 'Invalid OTP' };

  store.delete(key); // one-time use
  return { valid: true };
};

// Cleanup expired entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (now > val.expiresAt) store.delete(key);
  }
}, 15 * 60 * 1000);

module.exports = { generateOtp, saveOtp, verifyOtp };
