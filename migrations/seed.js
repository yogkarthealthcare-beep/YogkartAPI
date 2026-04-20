const { pool } = require('../src/config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const categories = [
  { id: 'supplements',   name: 'Supplements',    icon: 'science',        color: '#16a34a', sort_order: 1 },
  { id: 'vitamins',      name: 'Vitamins',        icon: 'medication',     color: '#0284c7', sort_order: 2 },
  { id: 'personal-care', name: 'Personal Care',   icon: 'spa',            color: '#7c3aed', sort_order: 3 },
  { id: 'nutrition',     name: 'Nutrition',        icon: 'restaurant',     color: '#ea580c', sort_order: 4 },
  { id: 'ayurvedic',     name: 'Ayurvedic',        icon: 'local_florist',  color: '#d97706', sort_order: 5 },
  { id: 'juices',        name: 'Juices',           icon: 'local_bar',      color: '#dc2626', sort_order: 6 },
  { id: 'superfoods',    name: 'Superfoods',       icon: 'eco',            color: '#059669', sort_order: 7 },
  { id: 'diabetic-care', name: 'Diabetic Care',   icon: 'monitor_heart',  color: '#db2777', sort_order: 8 },
];

const products = [
  {
    name: 'Ashwagandha KSM-66 Root Extract',
    slug: 'ashwagandha-ksm66-root-extract',
    category_id: 'supplements',
    subcategory: 'adaptogen',
    brand: 'Himalayan Organics',
    price: 549,
    original_price: 799,
    discount: 31,
    rating: 4.5,
    review_count: 2847,
    stock: 250,
    images: ['https://images.pexels.com/photos/4021775/pexels-photo-4021775.jpeg'],
    thumbnail: 'https://images.pexels.com/photos/4021775/pexels-photo-4021775.jpeg',
    description: 'Premium KSM-66 Ashwagandha root extract standardized to 5% withanolides.',
    key_benefits: ['Reduces stress & anxiety', 'Boosts energy & stamina', 'Improves sleep quality', 'Enhances immunity'],
    dosage: '1-2 capsules daily with milk or water',
    is_featured: true,
    is_best_seller: true,
    tags: ['ashwagandha', 'stress', 'adaptogen', 'ayurvedic'],
    pack_size: '60 Capsules',
    manufacturer: 'Himalayan Organics Pvt Ltd',
    country_of_origin: 'India',
  },
  {
    name: 'Whey Protein Isolate - Chocolate',
    slug: 'whey-protein-isolate-chocolate',
    category_id: 'supplements',
    subcategory: 'protein',
    brand: 'MuscleBlaze',
    price: 2799,
    original_price: 3499,
    discount: 20,
    rating: 4.6,
    review_count: 5621,
    stock: 180,
    images: ['https://images.pexels.com/photos/3621168/pexels-photo-3621168.jpeg'],
    thumbnail: 'https://images.pexels.com/photos/3621168/pexels-photo-3621168.jpeg',
    description: '27g protein per serving. 90% protein by weight with zero added sugar.',
    key_benefits: ['27g protein per scoop', 'Rapid muscle recovery', 'Zero added sugar', 'Rich in BCAAs'],
    dosage: '1 scoop (33g) with 200ml water post workout',
    is_featured: true,
    is_best_seller: true,
    tags: ['protein', 'whey', 'muscle', 'gym'],
    pack_size: '1 kg',
    manufacturer: 'MuscleBlaze Sports Nutrition Pvt Ltd',
    country_of_origin: 'India',
  },
  {
    name: 'Vitamin D3 + K2 (2000 IU)',
    slug: 'vitamin-d3-k2-2000iu',
    category_id: 'vitamins',
    subcategory: 'vitamin-d',
    brand: 'HealthVit',
    price: 349,
    original_price: 499,
    discount: 30,
    rating: 4.4,
    review_count: 1923,
    stock: 400,
    images: ['https://images.pexels.com/photos/139398/thermometer-headache-pain-pills-139398.jpeg'],
    thumbnail: 'https://images.pexels.com/photos/139398/thermometer-headache-pain-pills-139398.jpeg',
    description: 'Vitamin D3 with K2 for optimal calcium absorption and bone health.',
    key_benefits: ['Strong bones & teeth', 'Boosts immunity', 'Supports heart health', 'Improves mood'],
    dosage: '1 softgel daily with meal',
    is_featured: true,
    is_new: true,
    tags: ['vitamin-d', 'vitamin-k2', 'bones', 'immunity'],
    pack_size: '60 Softgels',
    manufacturer: 'HealthVit Pharma Pvt Ltd',
    country_of_origin: 'India',
  },
  {
    name: 'Omega-3 Fish Oil 1000mg',
    slug: 'omega3-fish-oil-1000mg',
    category_id: 'supplements',
    subcategory: 'omega',
    brand: 'WOW Life Science',
    price: 449,
    original_price: 599,
    discount: 25,
    rating: 4.3,
    review_count: 3104,
    stock: 320,
    images: ['https://images.pexels.com/photos/3683053/pexels-photo-3683053.jpeg'],
    thumbnail: 'https://images.pexels.com/photos/3683053/pexels-photo-3683053.jpeg',
    description: 'Triple-strength omega-3 with 600mg EPA+DHA per capsule.',
    key_benefits: ['Heart health support', 'Brain & cognitive function', 'Reduces inflammation', 'Joint health'],
    dosage: '2 capsules daily after meals',
    is_featured: false,
    is_best_seller: true,
    tags: ['omega3', 'fish-oil', 'heart', 'brain'],
    pack_size: '60 Capsules',
    manufacturer: 'WOW Life Science Pvt Ltd',
    country_of_origin: 'India',
  },
  {
    name: 'Multivitamin for Women',
    slug: 'multivitamin-for-women',
    category_id: 'vitamins',
    subcategory: 'multivitamin',
    brand: 'Carbamide Forte',
    price: 599,
    original_price: 799,
    discount: 25,
    rating: 4.5,
    review_count: 2187,
    stock: 200,
    images: ['https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg'],
    thumbnail: 'https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg',
    description: '43 nutrients including iron, biotin, folate, and antioxidants specially formulated for women.',
    key_benefits: ['43 essential nutrients', 'Hormonal balance', 'Skin & hair health', 'Energy boost'],
    dosage: '1 tablet daily with breakfast',
    is_featured: true,
    is_new: true,
    tags: ['multivitamin', 'women', 'iron', 'biotin'],
    pack_size: '60 Tablets',
    manufacturer: 'Carbamide Forte Lifesciences',
    country_of_origin: 'India',
  },
  {
    name: 'Neem Face Wash with Tulsi',
    slug: 'neem-face-wash-tulsi',
    category_id: 'personal-care',
    subcategory: 'skin-care',
    brand: 'Khadi Natural',
    price: 199,
    original_price: 249,
    discount: 20,
    rating: 4.2,
    review_count: 876,
    stock: 500,
    images: ['https://images.pexels.com/photos/3321416/pexels-photo-3321416.jpeg'],
    thumbnail: 'https://images.pexels.com/photos/3321416/pexels-photo-3321416.jpeg',
    description: 'Ayurvedic neem & tulsi face wash that removes impurities and controls acne.',
    key_benefits: ['Controls acne & pimples', 'Deep cleansing', 'Natural ayurvedic formula', 'Suitable for all skin types'],
    dosage: 'Apply on wet face, massage gently, rinse',
    is_featured: false,
    is_new: true,
    tags: ['neem', 'face-wash', 'acne', 'ayurvedic', 'tulsi'],
    pack_size: '200 ml',
    manufacturer: 'Khadi Natural Pvt Ltd',
    country_of_origin: 'India',
  },
  {
    name: 'Moringa Superfood Powder',
    slug: 'moringa-superfood-powder',
    category_id: 'superfoods',
    subcategory: 'superfood',
    brand: 'Organic India',
    price: 399,
    original_price: 499,
    discount: 20,
    rating: 4.4,
    review_count: 1432,
    stock: 150,
    images: ['https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg'],
    thumbnail: 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg',
    description: '100% pure organic moringa leaf powder. Rich in iron, calcium & antioxidants.',
    key_benefits: ['Rich in iron & calcium', 'Antioxidant powerhouse', 'Boosts energy naturally', 'Supports detox'],
    dosage: '1 tsp in smoothie, juice or water daily',
    is_featured: true,
    is_best_seller: false,
    tags: ['moringa', 'superfood', 'organic', 'iron'],
    pack_size: '100g',
    manufacturer: 'Organic India Pvt Ltd',
    country_of_origin: 'India',
  },
  {
    name: 'Diabetic Care Juice - Karela Jamun',
    slug: 'diabetic-care-juice-karela-jamun',
    category_id: 'diabetic-care',
    subcategory: 'juice',
    brand: 'Patanjali',
    price: 299,
    original_price: 350,
    discount: 15,
    rating: 4.1,
    review_count: 654,
    stock: 300,
    images: ['https://images.pexels.com/photos/775031/pexels-photo-775031.jpeg'],
    thumbnail: 'https://images.pexels.com/photos/775031/pexels-photo-775031.jpeg',
    description: 'Natural karela & jamun juice blend that helps maintain healthy blood sugar levels.',
    key_benefits: ['Helps control blood sugar', 'Natural & preservative-free', 'Rich in antioxidants', 'No added sugar'],
    dosage: '30ml diluted in water before meals',
    is_featured: false,
    is_best_seller: false,
    tags: ['diabetic', 'karela', 'jamun', 'blood-sugar'],
    pack_size: '1 Litre',
    manufacturer: 'Patanjali Ayurved Ltd',
    country_of_origin: 'India',
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');
    await client.query('BEGIN');

    // Categories
    for (const cat of categories) {
      await client.query(`
        INSERT INTO categories (id, name, icon, color, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE
        SET name=$2, icon=$3, color=$4, sort_order=$5
      `, [cat.id, cat.name, cat.icon, cat.color, cat.sort_order]);
    }
    console.log(`  ✅ ${categories.length} categories inserted`);

    // Products
    for (const p of products) {
      await client.query(`
        INSERT INTO products (
          name, slug, category_id, subcategory, brand,
          price, original_price, discount, rating, review_count, stock,
          images, thumbnail, description, key_benefits,
          dosage, is_featured, is_new, is_best_seller, tags,
          pack_size, manufacturer, country_of_origin
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
          $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
        )
        ON CONFLICT (slug) DO UPDATE
        SET price=$6, stock=$11, is_featured=$17, updated_at=NOW()
      `, [
        p.name, p.slug, p.category_id, p.subcategory, p.brand,
        p.price, p.original_price, p.discount, p.rating, p.review_count, p.stock,
        p.images, p.thumbnail, p.description, p.key_benefits,
        p.dosage, p.is_featured, p.is_new || false, p.is_best_seller || false, p.tags,
        p.pack_size, p.manufacturer, p.country_of_origin,
      ]);
    }
    console.log(`  ✅ ${products.length} products inserted`);

    // Demo admin user
    const hash = await bcrypt.hash('admin123', 12);
    await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, ['Admin User', 'admin@yogkart.com', '9999999999', hash, 'admin']);
    console.log('  ✅ Admin user created (admin@yogkart.com / admin123)');

    await client.query('COMMIT');
    console.log('✅ Seeding complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
