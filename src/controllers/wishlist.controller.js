const { query } = require('../config/database');
const { success, error } = require('../utils/response');

const PRODUCT_FIELDS = `
  p.id, p.name, p.slug, p.category_id AS category, p.brand,
  p.price, p.original_price, p.discount, p.rating, p.review_count,
  p.stock, p.thumbnail, p.images, p.is_featured, p.is_new,
  p.is_best_seller, p.tags, p.pack_size, p.prescription
`;

// ── GET /api/wishlist ──────────────────────────────────
const getWishlist = async (req, res) => {
  try {
    const result = await query(
      `SELECT ${PRODUCT_FIELDS}, w.created_at AS wishlisted_at
       FROM wishlists w
       JOIN products p ON p.id = w.product_id
       WHERE w.user_id = $1 AND p.is_active = TRUE
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    return success(res, { wishlist: result.rows, count: result.rows.length });
  } catch (err) {
    return error(res, 'Failed to fetch wishlist');
  }
};

// ── POST /api/wishlist/:productId ──────────────────────
const toggleWishlist = async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);

    // Check if already wishlisted
    const existing = await query(
      'SELECT id FROM wishlists WHERE user_id = $1 AND product_id = $2',
      [req.user.id, productId]
    );

    if (existing.rows.length > 0) {
      // Remove
      await query('DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2',
        [req.user.id, productId]);
      return success(res, { wishlisted: false }, 'Removed from wishlist');
    } else {
      // Add
      await query('INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)',
        [req.user.id, productId]);
      return success(res, { wishlisted: true }, 'Added to wishlist');
    }
  } catch (err) {
    console.error('toggleWishlist error:', err);
    return error(res, 'Failed to update wishlist');
  }
};

// ── DELETE /api/wishlist ───────────────────────────────
const clearWishlist = async (req, res) => {
  try {
    await query('DELETE FROM wishlists WHERE user_id = $1', [req.user.id]);
    return success(res, null, 'Wishlist cleared');
  } catch (err) {
    return error(res, 'Failed to clear wishlist');
  }
};

module.exports = { getWishlist, toggleWishlist, clearWishlist };
