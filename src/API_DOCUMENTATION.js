/**
 * ============================================================
 * Yogkart Healthcare — API Documentation
 * Email · OTP · Google Auth · Social Auth
 * ============================================================
 * Version  : 2.0.0
 * Base URL  : http://localhost:3000/api
 * Auth      : Bearer <accessToken>  (Authorization header)
 * ============================================================
 */

// ╔══════════════════════════════════════════════════════════════╗
// ║              SECTION 1 — PACKAGE INSTALLATION               ║
// ╚══════════════════════════════════════════════════════════════╝

/*
  npm install nodemailer google-auth-library

  nodemailer       → Gmail se email bhejne ke liye
  google-auth-library → Google idToken verify karne ke liye
*/

// ╔══════════════════════════════════════════════════════════════╗
// ║              SECTION 2 — .env VARIABLES                     ║
// ╚══════════════════════════════════════════════════════════════╝

/*
  # ── Email ────────────────────────────────────────────────────
  MAIL_USER=yogkarthealthcare@gmail.com
  MAIL_PASS=YD%7w3@xH7!SUf

  # ── Google OAuth ─────────────────────────────────────────────
  GOOGLE_CLIENT_ID=your_google_oauth2_client_id.apps.googleusercontent.com

  # ── JWT (existing) ───────────────────────────────────────────
  JWT_SECRET=your_jwt_secret
  JWT_REFRESH_SECRET=your_refresh_secret
  JWT_EXPIRES_IN=7d
  JWT_REFRESH_EXPIRES_IN=30d

  # ── App ───────────────────────────────────────────────────────
  FRONTEND_URL=http://localhost:4200
  BCRYPT_ROUNDS=12
  NODE_ENV=development
*/

// ╔══════════════════════════════════════════════════════════════╗
// ║              SECTION 3 — FILE STRUCTURE                     ║
// ╚══════════════════════════════════════════════════════════════╝

/*
  src/
  ├── controllers/
  │   ├── auth.controller.js            (existing — no changes)
  │   ├── otp.controller.js             ✅ NEW
  │   ├── google-auth.controller.js     ✅ NEW
  │   └── social-auth.controller.js     ✅ UPDATED (welcome email added)
  ├── routes/
  │   └── auth.routes.js                ✅ UPDATED (new routes added)
  └── utils/
      ├── email.service.js              ✅ NEW
      └── otp.store.js                  ✅ NEW
*/


// ╔══════════════════════════════════════════════════════════════╗
// ║              SECTION 4 — EMAIL SERVICE                      ║
// ╚══════════════════════════════════════════════════════════════╝

/*
  FILE: src/utils/email.service.js
  Import: const { sendEmail } = require('../utils/email.service');

  ┌─────────────────────────────────────────────────────────────┐
  │ sendEmail({ type, to, data })                               │
  └─────────────────────────────────────────────────────────────┘

  Parameters:
    type  {string}  — Email type (see table below)
    to    {string}  — Recipient email address
    data  {object}  — Template-specific data

  Returns: Promise<{ messageId: string }>

  ┌───────────────────┬────────────────────────────────────────────┐
  │ type              │ data fields required                       │
  ├───────────────────┼────────────────────────────────────────────┤
  │ otp               │ { otp, name? }                             │
  │ password_reset    │ { otp, name? }                             │
  │ welcome           │ { name }                                   │
  │ order_confirmation│ { name, orderId, items[], total, address? }│
  │ order_shipped     │ { name, orderId, trackingId?, courier?,    │
  │                   │   estimatedDate? }                         │
  │ order_delivered   │ { name, orderId }                          │
  │ password_changed  │ { name }                                   │
  └───────────────────┴────────────────────────────────────────────┘

  items[] shape:  { name: string, qty: number, price: number }
*/

// Usage Examples:
//
// // OTP email
// await sendEmail({
//   type: 'otp',
//   to: 'user@example.com',
//   data: { name: 'Ravi Sharma', otp: '482910' }
// });
//
// // Order confirmation
// await sendEmail({
//   type: 'order_confirmation',
//   to: 'user@example.com',
//   data: {
//     name: 'Priya Singh',
//     orderId: 'YK-20240125',
//     items: [
//       { name: 'Ashwagandha Capsules', qty: 2, price: 499 },
//       { name: 'Triphala Churna',      qty: 1, price: 199 },
//     ],
//     total: 1197,
//     address: '12 Civil Lines, Kanpur, UP 208001'
//   }
// });
//
// // Order shipped
// await sendEmail({
//   type: 'order_shipped',
//   to: 'user@example.com',
//   data: { name: 'Rahul', orderId: 'YK-20240125', trackingId: 'BLR129873', courier: 'Delhivery', estimatedDate: '28 Jan 2025' }
// });


// ╔══════════════════════════════════════════════════════════════╗
// ║              SECTION 5 — OTP APIs                           ║
// ╚══════════════════════════════════════════════════════════════╝

// ┌─────────────────────────────────────────────────────────────┐
// │  POST /api/auth/send-otp                                    │
// │  OTP send karo (rate limited — 10 per 15 min)              │
// └─────────────────────────────────────────────────────────────┘
//
// Request Body:
const sendOtpRequest = {
  email: "user@example.com",     // required
  type:  "email_verify"          // "email_verify" | "password_reset"  (default: email_verify)
};
//
// Success Response 200:
const sendOtpResponse = {
  success: true,
  message: "OTP sent successfully. Valid for 10 minutes.",
  data: null
};
//
// Error Response 400:
const sendOtpError = {
  success: false,
  message: "Invalid type. Use: email_verify, password_reset"
};


// ┌─────────────────────────────────────────────────────────────┐
// │  POST /api/auth/verify-otp                                  │
// │  OTP verify karo                                            │
// └─────────────────────────────────────────────────────────────┘
//
// Request Body:
const verifyOtpRequest = {
  email:   "user@example.com",
  otp:     "482910",
  purpose: "email_verify"        // "email_verify" | "password_reset" | "login"
};
//
// ── purpose: email_verify ──────────────────────────────────────
// Response 200:
const verifyOtpResponseEmailVerify = {
  success: true,
  message: "Email verified successfully.",
  data: { verified: true }
};
//
// ── purpose: password_reset ────────────────────────────────────
// Response 200:
const verifyOtpResponsePasswordReset = {
  success: true,
  message: "OTP verified. You may now reset your password.",
  data: { resetGranted: true }
};
//
// ── purpose: login (passwordless) ─────────────────────────────
// Response 200:
const verifyOtpResponseLogin = {
  success: true,
  message: "OTP verified. Login successful.",
  data: {
    user: { id: "1", name: "Ravi Sharma", email: "ravi@example.com", phone: null, role: "user", avatar: null },
    accessToken:  "eyJhbGciOiJIUzI1NiIs...",
    refreshToken: "eyJhbGciOiJIUzI1NiIs..."
  }
};
//
// Error Response 400:
const verifyOtpError = {
  success: false,
  message: "Invalid OTP"  // OR "OTP expired" OR "Too many attempts"
};


// ┌─────────────────────────────────────────────────────────────┐
// │  POST /api/auth/reset-password                              │
// │  New password set karo (only after verify-otp              │
// │  with purpose: password_reset)                             │
// └─────────────────────────────────────────────────────────────┘
//
// Request Body:
const resetPasswordRequest = {
  email:       "user@example.com",
  newPassword: "NewSecure@123"
};
//
// Success Response 200:
const resetPasswordResponse = {
  success: true,
  message: "Password reset successfully. Please login.",
  data: null
};


// ╔══════════════════════════════════════════════════════════════╗
// ║           SECTION 6 — GOOGLE AUTH API                       ║
// ╚══════════════════════════════════════════════════════════════╝

// ┌─────────────────────────────────────────────────────────────┐
// │  POST /api/auth/google                                      │
// │  Frontend se Firebase Google idToken bhejo                 │
// └─────────────────────────────────────────────────────────────┘
//
// Request Body:
const googleAuthRequest = {
  idToken: "eyJhbGciOiJSUzI1NiIsImtpZCI..."  // Firebase Google Sign-In se mila idToken
};
//
// Success Response 200:
const googleAuthResponse = {
  success: true,
  message: "Google login successful",  // OR "Account created successfully via Google"
  data: {
    user: {
      id: "42",
      name: "Ravi Sharma",
      email: "ravi@gmail.com",
      phone: null,
      role: "user",
      avatar: "https://lh3.googleusercontent.com/..."
    },
    accessToken:  "eyJhbGciOiJIUzI1NiIs...",
    refreshToken: "eyJhbGciOiJIUzI1NiIs..."
  }
};
//
// Error 400:
const googleAuthError = {
  success: false,
  message: "Invalid or expired Google token"
};

// ── Angular Frontend Implementation ───────────────────────────
//
// Step 1 — angular.json mein Firebase SDK add karo:
// npm install @angular/fire firebase
//
// Step 2 — app.config.ts:
// import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
// import { getAuth, provideAuth } from '@angular/fire/auth';
// provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
// provideAuth(() => getAuth())
//
// Step 3 — auth.service.ts mein Google Sign-In:
//
// import { Auth, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
//
// async loginWithGoogle() {
//   const provider = new GoogleAuthProvider();
//   const result = await signInWithPopup(this.auth, provider);
//   const idToken = await result.user.getIdToken();
//
//   // Backend ko bhejo
//   this.socialLogin('google', {
//     uid:         result.user.uid,
//     email:       result.user.email!,
//     name:        result.user.displayName!,
//     photoUrl:    result.user.photoURL!,
//     accessToken: idToken
//   }).subscribe(...);
// }
//
// -- YA seedha idToken endpoint use karo: --
//
// async loginWithGoogleDirect() {
//   const provider = new GoogleAuthProvider();
//   const result = await signInWithPopup(this.auth, provider);
//   const idToken = await result.user.getIdToken();
//
//   return this.api.post('auth/google', { idToken }).pipe(
//     map(r => r.data),
//     tap(payload => this.persist(payload))
//   );
// }


// ╔══════════════════════════════════════════════════════════════╗
// ║           SECTION 7 — SOCIAL AUTH API                       ║
// ╚══════════════════════════════════════════════════════════════╝

// ┌─────────────────────────────────────────────────────────────┐
// │  POST /api/auth/social-login                                │
// │  Google / Facebook / LinkedIn                               │
// │  (Existing auth.service.ts ka socialLogin() ye use karta)  │
// └─────────────────────────────────────────────────────────────┘
//
// Request Body:
const socialLoginRequest = {
  name:     "Ravi Sharma",
  email:    "ravi@gmail.com",
  provider: "google",              // "google" | "facebook" | "linkedin"
  avatar:   "https://...",         // optional — profile photo URL
  uid:      "firebase_uid_here"    // optional — Firebase UID
};
//
// Success Response 200/201:
const socialLoginResponse = {
  success: true,
  message: "Login successful",     // OR "Account created successfully" for new user
  data: {
    user: {
      id:     "42",
      name:   "Ravi Sharma",
      email:  "ravi@gmail.com",
      phone:  null,
      role:   "user",
      avatar: "https://..."
    },
    accessToken:  "eyJhbGciOiJIUzI1NiIs...",
    refreshToken: "eyJhbGciOiJIUzI1NiIs..."
  }
};
//
// Note: Naya user hai toh welcome email bhi jata hai (async, non-blocking)


// ╔══════════════════════════════════════════════════════════════╗
// ║           SECTION 8 — COMPLETE FLOW EXAMPLES                ║
// ╚══════════════════════════════════════════════════════════════╝

// ── Flow 1: Email Verification on Register ────────────────────
//
// 1. User register karta hai → POST /api/auth/register
// 2. Hum OTP bhejte hain   → POST /api/auth/send-otp { email, type: 'email_verify' }
// 3. User OTP enter karta  → POST /api/auth/verify-otp { email, otp, purpose: 'email_verify' }
// 4. Account verified! ✅

// ── Flow 2: Forgot Password ───────────────────────────────────
//
// 1. User "Forgot Password" pe click karta → POST /api/auth/send-otp { email, type: 'password_reset' }
// 2. OTP milta → POST /api/auth/verify-otp { email, otp, purpose: 'password_reset' }
// 3. Response mein resetGranted: true → POST /api/auth/reset-password { email, newPassword }
// 4. Password changed! ✅  (password_changed alert email bhi jata hai)

// ── Flow 3: OTP Login (Passwordless) ─────────────────────────
//
// 1. POST /api/auth/send-otp { email, type: 'email_verify' }
// 2. POST /api/auth/verify-otp { email, otp, purpose: 'login' }
// 3. Response mein accessToken + refreshToken → Logged in! ✅

// ── Flow 4: Google Login (Firebase + Backend) ─────────────────
//
// 1. Frontend: Firebase Google Sign-In → idToken milta hai
// 2. POST /api/auth/google { idToken }
// 3. Backend verify karta → user create ya login karta
// 4. accessToken + refreshToken return ✅
// 5. New user hai toh → welcome email bhi jata hai

// ── Flow 5: Order Email (Controller se call karo) ─────────────
//
// Order place hone ke baad order.controller.js mein:
//
// const { sendEmail } = require('../utils/email.service');
//
// // Order created → confirmation bhejo
// sendEmail({
//   type: 'order_confirmation',
//   to: user.email,
//   data: {
//     name: user.name,
//     orderId: order.id,
//     items: order.items,
//     total: order.total,
//     address: `${order.address.street}, ${order.address.city}`
//   }
// }).catch(console.error);  // non-blocking


// ╔══════════════════════════════════════════════════════════════╗
// ║           SECTION 9 — ROUTE SUMMARY                         ║
// ╚══════════════════════════════════════════════════════════════╝

/*
  Method  Endpoint                    Auth?   Description
  ──────  ──────────────────────────  ──────  ────────────────────────────────
  POST    /api/auth/register          ✗       Email/password register
  POST    /api/auth/login             ✗       Email/password login
  POST    /api/auth/refresh           ✗       Access token refresh
  POST    /api/auth/logout            ✗       Logout (revoke token)
  POST    /api/auth/logout-all        ✅       Logout from all devices
  GET     /api/auth/me                ✅       Get profile
  PUT     /api/auth/me                ✅       Update profile
  PUT     /api/auth/change-password   ✅       Change password

  POST    /api/auth/send-otp          ✗       Send OTP (email_verify | password_reset)
  POST    /api/auth/verify-otp        ✗       Verify OTP (email_verify | password_reset | login)
  POST    /api/auth/reset-password    ✗       Reset password (after OTP verify)

  POST    /api/auth/social-login      ✗       Social login (Google/FB/LinkedIn SDK)
  POST    /api/auth/google            ✗       Google login via idToken (google-auth-library)
*/


// ╔══════════════════════════════════════════════════════════════╗
// ║           SECTION 10 — OTP STORE (Production Notes)         ║
// ╚══════════════════════════════════════════════════════════════╝

/*
  Current implementation: In-memory Map (single server only)

  Production ke liye Redis use karo:
  ─────────────────────────────────
  npm install ioredis

  // otp.store.js mein replace karo:

  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL);

  const saveOtp = async (email, otp) => {
    await redis.setex(`otp:${email}`, 600, JSON.stringify({ otp, attempts: 0 }));
  };

  const verifyOtp = async (email, otp) => {
    const data = await redis.get(`otp:${email}`);
    if (!data) return { valid: false, reason: 'OTP not found or already used' };
    const record = JSON.parse(data);
    if (record.attempts >= 5) {
      await redis.del(`otp:${email}`);
      return { valid: false, reason: 'Too many attempts' };
    }
    record.attempts += 1;
    if (record.otp !== otp.toString()) {
      await redis.set(`otp:${email}`, JSON.stringify(record), 'KEEPTTL');
      return { valid: false, reason: 'Invalid OTP' };
    }
    await redis.del(`otp:${email}`);
    return { valid: true };
  };
*/


// ╔══════════════════════════════════════════════════════════════╗
// ║           SECTION 11 — ERROR CODES                          ║
// ╚══════════════════════════════════════════════════════════════╝

/*
  HTTP Code  Meaning
  ─────────  ────────────────────────────────────────────────────
  200        Success
  201        Created (new user register)
  400        Bad Request — validation error ya invalid OTP
  401        Unauthorized — token missing / invalid / expired
  403        Forbidden — access not allowed
  404        Not Found — user / resource nahi mila
  429        Too Many Requests — rate limit exceeded
  500        Internal Server Error
*/
