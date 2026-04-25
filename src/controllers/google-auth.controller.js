/**
 * ============================================================
 * Google Auth Controller
 * ============================================================
 * Frontend (Angular) → Firebase Google Sign-In → idToken milta hai
 * Ye idToken backend ko bhejta hai → hum verify karte hain
 * Fir social login logic same hai
 *
 * POST /api/auth/google
 * Body: { idToken: string }
 *
 * Requires: npm install google-auth-library
 * .env:     GOOGLE_CLIENT_ID=your_google_oauth_client_id
 * ============================================================
 */

const { OAuth2Client } = require('google-auth-library');
const bcrypt           = require('bcryptjs');
const { query }        = require('../config/database');
const { generateAccessToken, generateRefreshToken, saveRefreshToken } = require('../utils/jwt');
const { sendEmail }    = require('../utils/email.service');
const { success, badRequest, error } = require('../utils/response');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── POST /api/auth/google ────────────────────────────────────────────────────
const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return badRequest(res, 'Google idToken is required');

    // ── Step 1: Verify Google token ────────────────────────────────────────
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyErr) {
      console.error('Google token verify failed:', verifyErr.message);
      return badRequest(res, 'Invalid or expired Google token');
    }

    const payload = ticket.getPayload();
    const { sub: uid, email, name, picture: avatar, email_verified } = payload;

    if (!email_verified) return badRequest(res, 'Google account email is not verified');
    if (!email || !name)  return badRequest(res, 'Could not retrieve email/name from Google');

    // ── Step 2: Check existing user ────────────────────────────────────────
    const exists = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase().trim()]
    );

    let user;
    let isNewUser = false;

    if (exists.rows.length > 0) {
      // CASE A: Existing user — login
      user = exists.rows[0];

      // Avatar update agar pehle nahi tha
      if (avatar && !user.avatar) {
        await query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, user.id]);
        user.avatar = avatar;
      }
    } else {
      // CASE B: Naya user — register
      isNewUser = true;
      const randomPassword = `Ggl@${uid.slice(0, 8)}#${Date.now().toString(36)}`;
      const passwordHash   = await bcrypt.hash(randomPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      const result = await query(
        `INSERT INTO users (name, email, phone, password_hash, avatar, provider, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id, name, email, phone, role, avatar, created_at`,
        [name.trim(), email.toLowerCase().trim(), null, passwordHash, avatar || null, 'google']
      );
      user = result.rows[0];

      // Welcome email
      sendEmail({ type: 'welcome', to: email, data: { name: user.name } }).catch(console.error);
    }

    // ── Step 3: Tokens ─────────────────────────────────────────────────────
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, refreshToken);

    return success(res, {
      user: {
        id:     user.id,
        name:   user.name,
        email:  user.email,
        phone:  user.phone  || null,
        role:   user.role,
        avatar: user.avatar || null,
      },
      accessToken,
      refreshToken,
    }, isNewUser ? 'Account created successfully via Google' : 'Google login successful');

  } catch (err) {
    console.error('Google login error:', err);
    return error(res, 'Google authentication failed');
  }
};

module.exports = { googleLogin };
