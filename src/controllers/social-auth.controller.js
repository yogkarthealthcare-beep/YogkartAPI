/**
 * ============================================================
 * Social Auth Controller — Google · Facebook · LinkedIn
 * ============================================================
 * POST /api/auth/social-login
 * Body: { name, email, provider, avatar, uid }
 *
 * Email exist kare → login
 * Nahi kare        → register + welcome email + login
 * ============================================================
 */

const bcrypt        = require('bcryptjs');
const { query }     = require('../config/database');
const { generateAccessToken, generateRefreshToken, saveRefreshToken } = require('../utils/jwt');
const { sendEmail } = require('../utils/email.service');
const { success, badRequest, error } = require('../utils/response');

// ── POST /api/auth/social-login ──────────────────────────────────────────────
const socialLogin = async (req, res) => {
  try {
    const { name, email, provider, avatar, uid } = req.body;

    if (!email || !name) return badRequest(res, 'Name and email are required');

    // ── Step 1: Email exist karta hai? ─────────────────────────────────────
    const exists = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase().trim()]
    );

    let user;
    let isNewUser = false;

    if (exists.rows.length > 0) {
      // CASE A: Purana user — seedha login
      user = exists.rows[0];
      if (avatar && !user.avatar) {
        await query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, user.id]);
        user.avatar = avatar;
      }
    } else {
      // CASE B: Naya user — register
      isNewUser = true;
      const randomPassword = `Yk@${uid ? uid.slice(0, 8) : Math.random().toString(36).slice(2, 10)}#9${Date.now().toString(36)}`;
      const passwordHash   = await bcrypt.hash(randomPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      const result = await query(
        `INSERT INTO users (name, email, phone, password_hash, avatar, provider, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id, name, email, phone, role, avatar, created_at`,
        [
          name.trim(),
          email.toLowerCase().trim(),
          null,
          passwordHash,
          avatar || null,
          provider || 'google',
        ]
      );
      user = result.rows[0];

      // Welcome email — async, non-blocking
      sendEmail({ type: 'welcome', to: email, data: { name: user.name } })
        .catch(e => console.error('Welcome email error:', e.message));
    }

    // ── Step 2: Tokens ──────────────────────────────────────────────────────
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
    }, isNewUser ? 'Account created successfully' : 'Login successful');

  } catch (err) {
    console.error('Social login error:', err);
    return error(res, 'Social login failed');
  }
};

module.exports = { socialLogin };
