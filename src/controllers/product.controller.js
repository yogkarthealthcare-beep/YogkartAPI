const { query } = require('../config/database');
const { success, notFound, error, paginated } = require('../utils/response');

// Product fields to always select
const PRODUCT_FIELDS = `
  p.id, p.name, p.slug, p.category_id AS category, p.subcategory, p.brand,
  p.price, p.original_price, p.discount, p.rating, p.review_count, p.stock,
  p.images, p.thumbnail, p.description, p.key_benefits,
  p.ingredients, p.dosage, p.side_effects,
  p.is_featured, p.is_new, p.is_best_seller, p.tags,
  p.prescription, p.manufacturer, p.country_of_origin, p.pack_size,
  p.created_at
`;

// ── GET /api/products ──────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const {
      category, search, sort = 'relevance',
      page = 1, limit = 12,
      min_price, max_price, min_rating,
      featured, new: isNew, bestseller,
    } = req.query;

    const conditions = ['p.is_active = TRUE'];
    const params = [];
    let paramIdx = 1;

    if (category) {
      conditions.push(`p.category_id = $${paramIdx++}`);
      params.push(category);
    }

    if (min_price) {
      conditions.push(`p.price >= $${paramIdx++}`);
      params.push(parseFloat(min_price));
    }

    if (max_price) {
      conditions.push(`p.price <= $${paramIdx++}`);
      params.push(parseFloat(max_price));
    }

    if (min_rating) {
      conditions.push(`p.rating >= $${paramIdx++}`);
      params.push(parseFloat(min_rating));
    }

    if (featured === 'true') {
      conditions.push('p.is_featured = TRUE');
    }

    if (isNew === 'true') {
      conditions.push('p.is_new = TRUE');
    }

    if (bestseller === 'true') {
      conditions.push('p.is_best_seller = TRUE');
    }

    // Full text search
    let searchRank = '';
    if (search && search.trim()) {
      const tsQuery = search.trim().split(/\s+/).join(' & ');
      conditions.push(`(
        p.search_vector @@ to_tsquery('english', $${paramIdx})
        OR p.name ILIKE $${paramIdx + 1}
        OR p.brand ILIKE $${paramIdx + 1}
      )`);
      params.push(tsQuery);
      params.push(`%${search.trim()}%`);
      paramIdx += 2;
      searchRank = `, ts_rank(p.search_vector, to_tsquery('english', '${tsQuery.replace(/'/g, "''")}')) AS rank`;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortMap = {
      'price-asc':  'p.price ASC',
      'price-desc': 'p.price DESC',
      'rating':     'p.rating DESC',
      'newest':     'p.created_at DESC',
      'popular':    'p.review_count DESC',
      'relevance':  search ? 'rank DESC' : 'p.is_featured DESC, p.review_count DESC',
    };
    const orderBy = sortMap[sort] || sortMap['relevance'];

    // Count
    const countResult = await query(
      `SELECT COUNT(*) FROM products p ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    // Paginated results
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit));
    params.push(offset);

    const result = await query(
      `SELECT ${PRODUCT_FIELDS} ${searchRank}
       FROM products p
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    return paginated(res, result.rows, total, page, limit);
  } catch (err) {
    console.error('getProducts error:', err);
    return error(res, 'Failed to fetch products');
  }
};

// ── GET /api/products/:slug ────────────────────────────
const getProduct = async (req, res) => {
  try {
    const result = await query(
      `SELECT ${PRODUCT_FIELDS} FROM products p WHERE p.slug = $1 AND p.is_active = TRUE`,
      [req.params.slug]
    );
    if (result.rows.length === 0) return notFound(res, 'Product not found');
    return success(res, { product: result.rows[0] });
  } catch (err) {
    return error(res, 'Failed to fetch product');
  }
};

// ── GET /api/products/:slug/related ───────────────────
const getRelated = async (req, res) => {
  try {
    const product = await query(
      'SELECT id, category_id FROM products WHERE slug = $1', [req.params.slug]
    );
    if (product.rows.length === 0) return notFound(res, 'Product not found');

    const { id, category_id } = product.rows[0];
    const result = await query(
      `SELECT ${PRODUCT_FIELDS} FROM products p
       WHERE p.category_id = $1 AND p.id != $2 AND p.is_active = TRUE
       ORDER BY p.rating DESC LIMIT 6`,
      [category_id, id]
    );
    return success(res, { products: result.rows });
  } catch (err) {
    return error(res, 'Failed to fetch related products');
  }
};

// ── GET /api/categories ────────────────────────────────
const getCategories = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, COUNT(p.id)::int AS count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
       WHERE c.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.sort_order`,
      []
    );
    return success(res, { categories: result.rows });
  } catch (err) {
    return error(res, 'Failed to fetch categories');
  }
};

// ── GET /api/products/featured ─────────────────────────
const getFeatured = async (req, res) => {
  try {
    // Pehle is_featured = TRUE wale lo
    let result = await query(
      `SELECT ${PRODUCT_FIELDS} FROM products p
       WHERE p.is_featured = TRUE AND p.is_active = TRUE
       ORDER BY p.review_count DESC LIMIT 8`,
      []
    );

    // Agar koi featured product nahi hai to top products lo (review_count se)
    if (result.rows.length === 0) {
      result = await query(
        `SELECT ${PRODUCT_FIELDS} FROM products p
         WHERE p.is_active = TRUE
         ORDER BY p.review_count DESC, p.created_at DESC
         LIMIT 8`,
        []
      );
    }

    return success(res, result.rows);
  } catch (err) {
    console.error('Featured error:', err);
    return error(res, 'Failed to fetch featured products');
  }
};

// ── GET /api/products/bestsellers ──────────────────────
const getBestSellers = async (req, res) => {
  try {
    // Pehle is_best_seller = TRUE wale lo
    let result = await query(
      `SELECT ${PRODUCT_FIELDS} FROM products p
       WHERE p.is_best_seller = TRUE AND p.is_active = TRUE
       ORDER BY p.review_count DESC LIMIT 8`,
      []
    );

    // Agar koi bestseller nahi hai to top rated products lo
    if (result.rows.length === 0) {
      result = await query(
        `SELECT ${PRODUCT_FIELDS} FROM products p
         WHERE p.is_active = TRUE
         ORDER BY p.review_count DESC, p.rating DESC
         LIMIT 8`,
        []
      );
    }

    return success(res, result.rows);
  } catch (err) {
    console.error('Bestsellers error:', err);
    return error(res, 'Failed to fetch bestsellers');
  }
};

// ── GET /api/products/banners ──────────────────────────
const getBanners = async (req, res) => {
  // Static banners (can be moved to DB later)
  const banners = [
    {
      id: 1,
      title: "Nature's Best. Science Perfected.",
      subtitle: 'Premium Ayurvedic & Healthcare Products',
      cta: 'Shop Now', ctaLink: '/products',
      image: 'https://images.pexels.com/photos/3735149/pexels-photo-3735149.jpeg?w=1200',
      bgColor: '#064e3b', badge: 'Upto 40% OFF',
    },
    {
      id: 2,
      title: 'Boost Your Immunity Naturally',
      subtitle: 'Handpicked Herbs & Supplements',
      cta: 'Explore', ctaLink: '/products?category=supplements',
      image: 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?w=1200',
      bgColor: '#1e3a5f', badge: 'New Arrivals',
    },
    {
      id: 3,
      title: 'Pure. Organic. Certified.',
      subtitle: 'Trusted by 1 Lakh+ Customers',
      cta: 'Shop Vitamins', ctaLink: '/products?category=vitamins',
      image: 'https://images.pexels.com/photos/3683053/pexels-photo-3683053.jpeg?w=1200',
      bgColor: '#3b1f5e', badge: null,
    },
  ];
  return success(res, { banners });
};

module.exports = { getProducts, getProduct, getRelated, getCategories, getFeatured, getBestSellers, getBanners };