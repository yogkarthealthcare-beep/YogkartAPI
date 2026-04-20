const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/product.controller');

// Public routes
router.get('/banners',          ctrl.getBanners);
router.get('/featured',         ctrl.getFeatured);
router.get('/',                 ctrl.getProducts);
router.get('/:slug',            ctrl.getProduct);
router.get('/:slug/related',    ctrl.getRelated);

module.exports = router;
