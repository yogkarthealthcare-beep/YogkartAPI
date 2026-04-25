// ── POST /api/auth/social-login ────────────────────────────────────────────
// Google / Facebook / LinkedIn social login handler
// Ek hi endpoint — email exist kare to login, nahi to register + login
//
// Request body:
//   { name, email, provider, avatar, uid }
//
// Response: same as /api/auth/login
// ───────────────────────────────────────────────────────────────────────────

const socialLogin = async (req, res) => {
  try {
    const { name, email, provider, avatar, uid } = req.body;

    if (!email || !name) {
      return badRequest(res, 'Name and email are required');
    }

    // ── Step 1: Email exist karta hai? ──────────────────────────────────────
    const exists = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase().trim()]
    );

    let user;

    if (exists.rows.length > 0) {
      // ── CASE A: Purana user — seedha login karo ───────────────────────────
      user = exists.rows[0];

      // Avatar update karo agar pehla nahi tha
      if (avatar && !user.avatar) {
        await query(
          'UPDATE users SET avatar = $1 WHERE id = $2',
          [avatar, user.id]
        );
        user.avatar = avatar;
      }

    } else {
      // ── CASE B: Naya user — register karo ────────────────────────────────
      // Social users ke liye random secure password generate karo
      // (User kabhi directly use nahi karega — forgot password se change kar sakta hai)
      const randomPassword = `Yk@${uid ? uid.slice(0, 8) : Math.random().toString(36).slice(2, 10)}#9${Date.now().toString(36)}`;
      const passwordHash = await bcrypt.hash(randomPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      const result = await query(
        `INSERT INTO users (name, email, phone, password_hash, avatar, provider)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, email, phone, role, avatar, created_at`,
        [
          name.trim(),
          email.toLowerCase().trim(),
          null,
          passwordHash,
          avatar || null,
          provider || 'google'
        ]
      );

      user = result.rows[0];
    }

    // ── Step 2: Tokens generate karo ────────────────────────────────────────
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, refreshToken);

    return success(res, {
      user: {
        id:     user.id,
        name:   user.name,
        email:  user.email,
        phone:  user.phone,
        role:   user.role,
        avatar: user.avatar || null,
      },
      accessToken,
      refreshToken,
    }, exists.rows.length > 0 ? 'Login successful' : 'Account created successfully');

  } catch (err) {
    console.error('Social login error:', err);
    return error(res, 'Social login failed');
  }
};

module.exports = { socialLogin };
