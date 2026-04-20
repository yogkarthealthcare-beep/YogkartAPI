const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/wishlist.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect); // All wishlist routes require auth

router.get('/',                    ctrl.getWishlist);
router.post('/:productId',         ctrl.toggleWishlist);
router.delete('/',                 ctrl.clearWishlist);

module.exports = router;
