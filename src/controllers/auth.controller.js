const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const {
  generateAccessToken, generateRefreshToken,
  saveRefreshToken, verifyRefreshToken, revokeRefreshToken, revokeAllUserTokens,
} = require('../utils/jwt');
const { success, created, error, unauthorized, badRequest } = require('../utils/response');

// ── POST /api/auth/register ────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check existing user
    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return badRequest(res, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const result = await query(
      `INSERT INTO users (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, role, created_at`,
      [name.trim(), email.toLowerCase().trim(), phone || null, passwordHash]
    );

    const user = result.rows[0];
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, refreshToken);

    return created(res, {
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      accessToken,
      refreshToken,
    }, 'Account created successfully');
  } catch (err) {
    console.error('Register error:', err);
    return error(res, 'Registration failed');
  }
};

// ── POST /api/auth/login ───────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return unauthorized(res, 'Invalid email or password');
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return unauthorized(res, 'Invalid email or password');
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, refreshToken);

    return success(res, {
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      accessToken,
      refreshToken,
    }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Login failed');
  }
};

// ── POST /api/auth/refresh ─────────────────────────────
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return badRequest(res, 'Refresh token required');

    const decoded = await verifyRefreshToken(refreshToken);

    const result = await query(
      'SELECT id, name, email, phone, role FROM users WHERE id = $1 AND is_active = TRUE',
      [decoded.id]
    );
    if (result.rows.length === 0) return unauthorized(res, 'User not found');

    const user = result.rows[0];
    await revokeRefreshToken(refreshToken);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, newRefreshToken);

    return success(res, { accessToken: newAccessToken, refreshToken: newRefreshToken }, 'Token refreshed');
  } catch (err) {
    return unauthorized(res, 'Invalid or expired refresh token');
  }
};

// ── POST /api/auth/logout ──────────────────────────────
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await revokeRefreshToken(refreshToken);
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    return error(res, 'Logout failed');
  }
};

// ── POST /api/auth/logout-all ──────────────────────────
const logoutAll = async (req, res) => {
  try {
    await revokeAllUserTokens(req.user.id);
    return success(res, null, 'Logged out from all devices');
  } catch (err) {
    return error(res, 'Logout failed');
  }
};

// ── GET /api/auth/me ───────────────────────────────────
const me = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    return success(res, { user: result.rows[0] });
  } catch (err) {
    return error(res, 'Failed to fetch profile');
  }
};

// ── PUT /api/auth/me ───────────────────────────────────
const updateMe = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const result = await query(
      `UPDATE users SET name=$1, phone=$2, updated_at=NOW()
       WHERE id=$3
       RETURNING id, name, email, phone, role`,
      [name.trim(), phone || null, req.user.id]
    );
    return success(res, { user: result.rows[0] }, 'Profile updated');
  } catch (err) {
    return error(res, 'Profile update failed');
  }
};

// ── PUT /api/auth/change-password ─────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return badRequest(res, 'Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
    await revokeAllUserTokens(req.user.id);

    return success(res, null, 'Password changed. Please login again.');
  } catch (err) {
    return error(res, 'Password change failed');
  }
};

// ── POST /api/auth/social/:provider ───────────────────
// Google / Facebook social login
// Email exist karta hai → seedha login
// Nahi karta → register karke login
const socialLogin = async (req, res) => {
  try {
    const { uid, email, name, photoUrl, accessToken: firebaseToken } = req.body;
    const provider = req.params.provider; // "google" | "facebook"

    if (!email || !name || !uid) {
      return badRequest(res, 'name, email aur uid required hain');
    }

    const emailClean = email.toLowerCase().trim();

    // ── Step 1: Email already exist karta hai? ─────────
    const exists = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [emailClean]
    );

    let user;

    if (exists.rows.length > 0) {
      // ── CASE A: Purana user — seedha login ────────────
      user = exists.rows[0];

      // Avatar update karo agar pehle nahi tha
      if (photoUrl && !user.avatar) {
        await query(
          'UPDATE users SET avatar = $1, updated_at = NOW() WHERE id = $2',
          [photoUrl, user.id]
        );
        user.avatar = photoUrl;
      }

    } else {
      // ── CASE B: Naya user — register karo ─────────────
      // Social users ke liye random secure password hash
      // (user kabhi directly use nahi karega)
      const autoPassword = `Yk@${uid.slice(0, 8)}#9${Date.now().toString(36)}`;
      const passwordHash = await bcrypt.hash(autoPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      // avatar column exist karta hai schema mein? Haan — add karo
      const result = await query(
        `INSERT INTO users (name, email, phone, password_hash, avatar, provider)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, email, phone, role, avatar, created_at`,
        [name.trim(), emailClean, null, passwordHash, photoUrl || null, provider || 'google']
      );
      user = result.rows[0];
    }

    // ── Step 2: JWT tokens generate karo ──────────────
    const newAccessToken  = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, newRefreshToken);

    return success(res, {
      user: {
        id:     user.id,
        name:   user.name,
        email:  user.email,
        phone:  user.phone  || null,
        role:   user.role,
        avatar: user.avatar || photoUrl || null,
      },
      accessToken:  newAccessToken,
      refreshToken: newRefreshToken,
    }, exists.rows.length > 0 ? 'Login successful' : 'Account created successfully');

  } catch (err) {
    console.error('Social login error:', err);
    return error(res, 'Social login failed');
  }
};

module.exports = { register, login, refresh, logout, logoutAll, me, updateMe, changePassword, socialLogin };