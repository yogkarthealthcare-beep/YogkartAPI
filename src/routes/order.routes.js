const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/order.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

router.use(protect); // All order routes require auth

router.post('/', [
  body('items').isArray({ min: 1 }).withMessage('At least 1 item required'),
  body('items.*.product_id').isInt().withMessage('Invalid product id'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('total').isFloat({ min: 0 }).withMessage('Invalid total'),
  body('payment_method').notEmpty().withMessage('Payment method required'),
  body('address.name').notEmpty().withMessage('Address name required'),
  body('address.phone').notEmpty().withMessage('Address phone required'),
  body('address.line1').notEmpty().withMessage('Address line1 required'),
  body('address.city').notEmpty().withMessage('City required'),
  body('address.state').notEmpty().withMessage('State required'),
  body('address.pincode').isLength({ min: 6, max: 6 }).withMessage('Invalid pincode'),
], validate, ctrl.placeOrder);

router.get('/',        ctrl.getOrders);
router.get('/:id',     ctrl.getOrder);
router.put('/:id/cancel', ctrl.cancelOrder);

module.exports = router;
