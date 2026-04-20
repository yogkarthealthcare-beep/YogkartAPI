const { query, getClient } = require('../config/database');
const { success, created, notFound, error, paginated, forbidden } = require('../utils/response');

const generateOrderId = () => {
  const ts = Date.now().toString().slice(-8);
  return `YK${ts}`;
};

// ── POST /api/orders ───────────────────────────────────
const placeOrder = async (req, res) => {
  const client = await getClient();
  try {
    const {
      items, subtotal, discount = 0, delivery_fee = 0, tax = 0, total,
      payment_method, address,
    } = req.body;

    if (!items || items.length === 0) {
      return error(res, 'No items in order', 400);
    }

    await client.query('BEGIN');

    const orderId = generateOrderId();
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + 5);

    // Insert order
    await client.query(
      `INSERT INTO orders (
        id, user_id, status, subtotal, discount, delivery_fee, tax, total,
        payment_method, payment_status,
        address_name, address_phone, address_line1, address_city, address_state, address_pincode,
        expected_delivery
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        orderId, req.user.id, 'confirmed',
        subtotal, discount, delivery_fee, tax, total,
        payment_method, 'paid',
        address.name, address.phone, address.line1,
        address.city, address.state, address.pincode,
        expectedDelivery,
      ]
    );

    // Insert order items & update stock
    for (const item of items) {
      // Fetch product snapshot
      const productRes = await client.query(
        'SELECT id, name, thumbnail, pack_size, price, stock FROM products WHERE id = $1',
        [item.product_id]
      );
      if (productRes.rows.length === 0) throw new Error(`Product ${item.product_id} not found`);

      const product = productRes.rows[0];
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const itemTotal = product.price * item.quantity;

      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, thumbnail, pack_size, quantity, price, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orderId, product.id, product.name, product.thumbnail, product.pack_size, item.quantity, product.price, itemTotal]
      );

      // Decrement stock
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, product.id]
      );
    }

    await client.query('COMMIT');

    // Return full order
    const order = await getOrderById(orderId, req.user.id);
    return created(res, { order }, 'Order placed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('placeOrder error:', err);
    return error(res, err.message || 'Failed to place order');
  } finally {
    client.release();
  }
};

// ── GET /api/orders ────────────────────────────────────
const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE o.user_id = $1';
    const params = [req.user.id];
    if (status) {
      where += ` AND o.status = $2`;
      params.push(status);
    }

    const countRes = await query(`SELECT COUNT(*) FROM orders o ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const ordersRes = await query(
      `SELECT o.*,
        json_agg(json_build_object(
          'id', oi.id, 'product_id', oi.product_id, 'name', oi.name,
          'thumbnail', oi.thumbnail, 'pack_size', oi.pack_size,
          'quantity', oi.quantity, 'price', oi.price, 'total', oi.total
        )) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${where}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return paginated(res, ordersRes.rows, total, page, limit);
  } catch (err) {
    console.error('getOrders error:', err);
    return error(res, 'Failed to fetch orders');
  }
};

// ── GET /api/orders/:id ────────────────────────────────
const getOrder = async (req, res) => {
  try {
    const order = await getOrderById(req.params.id, req.user.id);
    if (!order) return notFound(res, 'Order not found');
    return success(res, { order });
  } catch (err) {
    return error(res, 'Failed to fetch order');
  }
};

// ── PUT /api/orders/:id/cancel ─────────────────────────
const cancelOrder = async (req, res) => {
  const client = await getClient();
  try {
    const orderRes = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (orderRes.rows.length === 0) return notFound(res, 'Order not found');

    const order = orderRes.rows[0];
    if (['delivered', 'cancelled'].includes(order.status)) {
      return error(res, `Cannot cancel order with status: ${order.status}`, 400);
    }

    await client.query('BEGIN');

    // Restore stock
    const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    for (const item of items.rows) {
      await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.product_id]);
    }

    await client.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [order.id]
    );

    await client.query('COMMIT');
    return success(res, null, 'Order cancelled successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('cancelOrder error:', err);
    return error(res, 'Failed to cancel order');
  } finally {
    client.release();
  }
};

// ── Helper ─────────────────────────────────────────────
const getOrderById = async (orderId, userId) => {
  const result = await query(
    `SELECT o.*,
      json_agg(json_build_object(
        'id', oi.id, 'product_id', oi.product_id, 'name', oi.name,
        'thumbnail', oi.thumbnail, 'pack_size', oi.pack_size,
        'quantity', oi.quantity, 'price', oi.price, 'total', oi.total
      )) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1 AND o.user_id = $2
     GROUP BY o.id`,
    [orderId, userId]
  );
  return result.rows[0] || null;
};

module.exports = { placeOrder, getOrders, getOrder, cancelOrder };
