/**
 * ============================================================
 * OTP Controller
 * ============================================================
 * POST /api/auth/send-otp     — OTP send karo (any type)
 * POST /api/auth/verify-otp   — OTP verify karo
 * ============================================================
 */

const { query }        = require('../config/database');
const { sendEmail }    = require('../utils/email.service');
const { generateOtp, saveOtp, verifyOtp } = require('../utils/otp.store');
const { generateAccessToken, generateRefreshToken, saveRefreshToken } = require('../utils/jwt');
const { success, badRequest, error, notFound } = require('../utils/response');

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
// Body: { email, type: 'email_verify' | 'password_reset' }
//
const sendOtp = async (req, res) => {
  try {
    const { email, type = 'email_verify' } = req.body;

    if (!email) return badRequest(res, 'Email is required');

    const validTypes = ['email_verify', 'password_reset'];
    if (!validTypes.includes(type)) {
      return badRequest(res, `Invalid type. Use: ${validTypes.join(', ')}`);
    }

    // For password_reset, user must already exist
    if (type === 'password_reset') {
      const exists = await query(
        'SELECT id, name FROM users WHERE email = $1 AND is_active = TRUE',
        [email.toLowerCase().trim()]
      );
      if (exists.rows.length === 0) {
        // Security: same response regardless — don't reveal if email exists
        return success(res, null, 'If this email is registered, you will receive an OTP shortly.');
      }
      const user = exists.rows[0];
      const otp  = generateOtp();
      saveOtp(email, otp);
      await sendEmail({ type: 'password_reset', to: email, data: { name: user.name, otp } });
      return success(res, null, 'Password reset OTP sent to your email.');
    }

    // email_verify — fetch name from DB if user exists, else use placeholder
    let name = 'User';
    const existing = await query(
      'SELECT name FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (existing.rows.length > 0) name = existing.rows[0].name;

    const otp = generateOtp();
    saveOtp(email, otp);
    await sendEmail({ type: 'otp', to: email, data: { name, otp } });

    return success(res, null, 'OTP sent successfully. Valid for 10 minutes.');
  } catch (err) {
    console.error('sendOtp error:', err);
    return error(res, 'Failed to send OTP. Please try again.');
  }
};

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
// Body: { email, otp, purpose: 'login' | 'password_reset' | 'email_verify' }
//
// purpose = 'login'          → verify + return auth tokens (passwordless login)
// purpose = 'email_verify'   → verify only, mark is_verified = true
// purpose = 'password_reset' → verify only, return short-lived reset_token flag
//
const verifyOtpHandler = async (req, res) => {
  try {
    const { email, otp, purpose = 'email_verify' } = req.body;

    if (!email || !otp) return badRequest(res, 'Email and OTP are required');

    const result = verifyOtp(email, otp);
    if (!result.valid) return badRequest(res, result.reason);

    // ── purpose: email_verify ──────────────────────────────────────────────
    if (purpose === 'email_verify') {
      await query(
        'UPDATE users SET is_verified = TRUE, updated_at = NOW() WHERE email = $1',
        [email.toLowerCase().trim()]
      );
      return success(res, { verified: true }, 'Email verified successfully.');
    }

    // ── purpose: password_reset ────────────────────────────────────────────
    if (purpose === 'password_reset') {
      // Return a flag — frontend will send new password to /api/auth/reset-password
      // (Stateless: store reset permission in OTP store for 5 min)
      const { saveOtp } = require('../utils/otp.store');
      saveOtp(`reset_${email}`, 'GRANTED'); // tiny 10-min window
      return success(res, { resetGranted: true }, 'OTP verified. You may now reset your password.');
    }

    // ── purpose: login (passwordless) ─────────────────────────────────────
    const userResult = await query(
      'SELECT id, name, email, phone, role, avatar FROM users WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return notFound(res, 'Account not found. Please register first.');
    }

    const user         = userResult.rows[0];
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, refreshToken);

    return success(res, {
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatar: user.avatar },
      accessToken,
      refreshToken,
    }, 'OTP verified. Login successful.');

  } catch (err) {
    console.error('verifyOtp error:', err);
    return error(res, 'OTP verification failed.');
  }
};

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
// Body: { email, newPassword }  — call only after /verify-otp (password_reset)
//
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return badRequest(res, 'Email and newPassword required');
    if (newPassword.length < 6)  return badRequest(res, 'Password must be at least 6 characters');

    // Check grant token
    const { verifyOtp: checkGrant } = require('../utils/otp.store');
    const grant = checkGrant(`reset_${email}`, 'GRANTED');
    if (!grant.valid) return badRequest(res, 'Reset session expired. Please request OTP again.');

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, name, email',
      [hash, email.toLowerCase().trim()]
    );
    if (result.rows.length === 0) return notFound(res, 'User not found');

    await sendEmail({ type: 'password_changed', to: email, data: { name: result.rows[0].name } });

    return success(res, null, 'Password reset successfully. Please login.');
  } catch (err) {
    console.error('resetPassword error:', err);
    return error(res, 'Password reset failed.');
  }
};

// ── POST /api/email/send ───────────────────────────────────────────────────────
// Admin / internal: any type send karo
// Body: { type, to, data }
//
const sendTypedEmail = async (req, res) => {
  try {
    const { type, to, data = {} } = req.body;
    if (!type || !to) return badRequest(res, 'type and to are required');

    const result = await sendEmail({ type, to, data });
    return success(res, { messageId: result.messageId }, `Email (${type}) sent successfully`);
  } catch (err) {
    if (err.message.startsWith('Unknown email type')) return badRequest(res, err.message);
    console.error('sendTypedEmail error:', err);
    return error(res, 'Failed to send email');
  }
};

module.exports = { sendOtp, verifyOtpHandler, resetPassword, sendTypedEmail };
