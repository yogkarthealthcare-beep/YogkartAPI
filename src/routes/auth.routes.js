// ── routes/auth.routes.js ──────────────────────────────
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl    = require('../controllers/auth.controller');
const otpCtrl = require('../controllers/otp.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password required'),
];

// Social login validation rules
const socialLoginRules = [
  body('uid').notEmpty().withMessage('uid required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('name').trim().isLength({ min: 1 }).withMessage('name required'),
];

router.post('/register',         registerRules,     validate, ctrl.register);
router.post('/login',            loginRules,        validate, ctrl.login);
router.post('/social/:provider', socialLoginRules,  validate, ctrl.socialLogin); // Google / Facebook
router.post('/refresh',                                       ctrl.refresh);
router.post('/logout',                                    ctrl.logout);
router.post('/logout-all',       protect,                ctrl.logoutAll);
router.get('/me',                protect,                ctrl.me);
router.put('/me',                protect, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name required'),
], validate, ctrl.updateMe);
router.put('/change-password',   protect, [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Min 6 characters'),
], validate, ctrl.changePassword);

// ── OTP Routes ─────────────────────────────────────────
// POST /api/auth/send-otp    — email pe OTP bhejo
// POST /api/auth/verify-otp  — OTP verify karo
router.post('/send-otp',   [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
                            validate, otpCtrl.sendOtp);
router.post('/verify-otp', [body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
                             body('otp').isLength({ min: 6, max: 6 }).withMessage('6-digit OTP required')],
                            validate, otpCtrl.verifyOtpHandler);
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Min 6 characters'),
], validate, otpCtrl.resetPassword);

module.exports = router;