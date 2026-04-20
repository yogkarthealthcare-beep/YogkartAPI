# Yogkart Backend API

Node.js + Express + PostgreSQL + JWT

## 🚀 Setup

```bash
# 1. Install dependencies
npm install

# 2. Environment setup
cp .env.example .env
# .env mein apna DB password aur JWT secret fill karo

# 3. PostgreSQL mein database create karo
psql -U postgres
CREATE DATABASE yogkart_db;
\q

# 4. Tables create karo (migrations run karo)
npm run migrate

# 5. Sample data insert karo
npm run seed

# 6. Server start karo
npm run dev      # development (nodemon)
npm start        # production
```

## 📋 API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | New account create karo |
| POST | `/api/auth/login` | ❌ | Login karo |
| POST | `/api/auth/refresh` | ❌ | Access token refresh karo |
| POST | `/api/auth/logout` | ❌ | Logout (refresh token revoke) |
| POST | `/api/auth/logout-all` | ✅ | Sab devices se logout |
| GET | `/api/auth/me` | ✅ | Apna profile dekho |
| PUT | `/api/auth/me` | ✅ | Profile update karo |
| PUT | `/api/auth/change-password` | ✅ | Password change karo |

### Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | ❌ | Products list (filter + sort + paginate) |
| GET | `/api/products/featured` | ❌ | Featured products |
| GET | `/api/products/banners` | ❌ | Home banners |
| GET | `/api/products/:slug` | ❌ | Product detail |
| GET | `/api/products/:slug/related` | ❌ | Related products |

**Query params for `/api/products`:**
- `category` — category id (supplements, vitamins, etc.)
- `search` — full text search
- `sort` — price-asc, price-desc, rating, newest, popular
- `page`, `limit` — pagination
- `min_price`, `max_price`
- `min_rating`
- `featured=true`, `new=true`, `bestseller=true`

### Categories
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | ❌ | All categories with product count |

### Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | ✅ | Order place karo |
| GET | `/api/orders` | ✅ | Apne saare orders |
| GET | `/api/orders/:id` | ✅ | Order detail |
| PUT | `/api/orders/:id/cancel` | ✅ | Order cancel karo |

### Wishlist
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/wishlist` | ✅ | Wishlist dekho |
| POST | `/api/wishlist/:productId` | ✅ | Toggle (add/remove) |
| DELETE | `/api/wishlist` | ✅ | Poori wishlist clear karo |

## 📦 Request/Response Examples

### Register
```json
POST /api/auth/register
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "password": "password123",
  "phone": "9876543210"
}

Response:
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "name": "Rahul Sharma", "email": "...", "role": "customer" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### Place Order
```json
POST /api/orders
Authorization: Bearer <accessToken>
{
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ],
  "subtotal": 1447,
  "discount": 0,
  "delivery_fee": 0,
  "tax": 72,
  "total": 1519,
  "payment_method": "upi",
  "address": {
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "line1": "123 MG Road",
    "city": "Lucknow",
    "state": "Uttar Pradesh",
    "pincode": "226001"
  }
}
```

## 🗂️ Project Structure
```
yogkart_backend/
├── src/
│   ├── index.js                    ← Server entry point
│   ├── config/database.js          ← PostgreSQL pool
│   ├── middleware/
│   │   ├── auth.middleware.js      ← JWT protect, adminOnly
│   │   └── validate.middleware.js  ← express-validator errors
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── product.controller.js
│   │   ├── order.controller.js
│   │   └── wishlist.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── product.routes.js
│   │   ├── category.routes.js
│   │   ├── order.routes.js
│   │   └── wishlist.routes.js
│   └── utils/
│       ├── jwt.js                  ← Token generate/verify/revoke
│       └── response.js             ← Standard API response helpers
├── migrations/
│   ├── schema.sql                  ← All PostgreSQL tables
│   ├── run.js                      ← Migration runner
│   └── seed.js                     ← Sample data
├── .env.example
└── package.json
```
