// ── routes/auth.routes.js ─────────────────────────────────────────────────────
const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const ctrl       = require('../controllers/auth.controller');
const socialCtrl = require('../controllers/social-auth.controller');
const googleCtrl = require('../controllers/google-auth.controller');
const otpCtrl    = require('../controllers/otp.controller');

const { protect }  = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

// ── Standard auth ─────────────────────────────────────────────────────────────
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name 2-100 chars'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Min 6 chars'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone'),
], validate, ctrl.register);

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password required'),
], validate, ctrl.login);

router.post('/refresh',                          ctrl.refresh);
router.post('/logout',                           ctrl.logout);
router.post('/logout-all',   protect,            ctrl.logoutAll);
router.get ('/me',           protect,            ctrl.me);
router.put ('/me',           protect, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name required'),
], validate, ctrl.updateMe);
router.put ('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Min 6 characters'),
], validate, ctrl.changePassword);

// ── OTP ───────────────────────────────────────────────────────────────────────
router.post('/send-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('type').optional().isIn(['email_verify', 'password_reset']).withMessage('Invalid type'),
], validate, otpCtrl.sendOtp);

router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('purpose').optional().isIn(['email_verify', 'password_reset', 'login']).withMessage('Invalid purpose'),
], validate, otpCtrl.verifyOtpHandler);

router.post('/reset-password', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('newPassword').isLength({ min: 6 }).withMessage('Min 6 chars'),
], validate, otpCtrl.resetPassword);

// ── Social Login ──────────────────────────────────────────────────────────────
router.post('/social-login', [
  body('email').isEmail().withMessage('Invalid email'),
  body('name').notEmpty().withMessage('Name required'),
  body('provider').isIn(['google', 'facebook', 'linkedin']).withMessage('Invalid provider'),
], validate, socialCtrl.socialLogin);

// ── Google idToken verify ──────────────────────────────────────────────────────
router.post('/google', [
  body('idToken').notEmpty().withMessage('idToken is required'),
], validate, googleCtrl.googleLogin);

module.exports = router;
