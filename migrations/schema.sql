-- =====================================================
-- YOGKART DATABASE SCHEMA
-- Run: node src/migrations/run.js
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ── Users ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         CITEXT UNIQUE NOT NULL,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'customer',  -- customer | admin
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ── Refresh Tokens ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- ── Categories ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         VARCHAR(50) PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  icon       VARCHAR(50),
  color      VARCHAR(20),
  sort_order INTEGER DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Products ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  slug             VARCHAR(255) UNIQUE NOT NULL,
  category_id      VARCHAR(50) REFERENCES categories(id),
  subcategory      VARCHAR(100),
  brand            VARCHAR(100) NOT NULL,
  price            DECIMAL(10,2) NOT NULL,
  original_price   DECIMAL(10,2) NOT NULL,
  discount         INTEGER DEFAULT 0,
  rating           DECIMAL(3,2) DEFAULT 0,
  review_count     INTEGER DEFAULT 0,
  stock            INTEGER NOT NULL DEFAULT 0,
  images           TEXT[] DEFAULT '{}',
  thumbnail        TEXT,
  description      TEXT,
  key_benefits     TEXT[] DEFAULT '{}',
  ingredients      TEXT,
  dosage           TEXT,
  side_effects     TEXT,
  is_featured      BOOLEAN DEFAULT FALSE,
  is_new           BOOLEAN DEFAULT FALSE,
  is_best_seller   BOOLEAN DEFAULT FALSE,
  tags             TEXT[] DEFAULT '{}',
  prescription     BOOLEAN DEFAULT FALSE,
  manufacturer     VARCHAR(255),
  country_of_origin VARCHAR(100),
  pack_size        VARCHAR(100),
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_slug        ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active   ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_tags        ON products USING GIN(tags);

-- Full text search
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vector);

-- Auto update search vector
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english', COALESCE(NEW.name, '')) ||
    to_tsvector('english', COALESCE(NEW.brand, '')) ||
    to_tsvector('english', COALESCE(NEW.description, '')) ||
    to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_search ON products;
CREATE TRIGGER trg_product_search
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();

-- ── Wishlist ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlists(user_id);

-- ── Addresses ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(20) NOT NULL,
  line1       TEXT NOT NULL,
  line2       TEXT,
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  pincode     VARCHAR(10) NOT NULL,
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- ── Orders ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              VARCHAR(20) PRIMARY KEY,  -- YK + timestamp
  user_id         UUID NOT NULL REFERENCES users(id),
  status          VARCHAR(30) NOT NULL DEFAULT 'confirmed',
  subtotal        DECIMAL(10,2) NOT NULL,
  discount        DECIMAL(10,2) DEFAULT 0,
  delivery_fee    DECIMAL(10,2) DEFAULT 0,
  tax             DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  payment_method  VARCHAR(30) NOT NULL,
  payment_status  VARCHAR(20) DEFAULT 'paid',
  address_name    VARCHAR(100),
  address_phone   VARCHAR(20),
  address_line1   TEXT,
  address_city    VARCHAR(100),
  address_state   VARCHAR(100),
  address_pincode VARCHAR(10),
  expected_delivery TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id   ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders(created_at DESC);

-- ── Order Items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    VARCHAR(20) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  name        VARCHAR(255) NOT NULL,   -- snapshot at order time
  thumbnail   TEXT,
  pack_size   VARCHAR(100),
  quantity    INTEGER NOT NULL,
  price       DECIMAL(10,2) NOT NULL,  -- price at order time
  total       DECIMAL(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ── Updated At trigger ─────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated    ON users;
DROP TRIGGER IF EXISTS trg_products_updated ON products;
DROP TRIGGER IF EXISTS trg_orders_updated   ON orders;

CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
