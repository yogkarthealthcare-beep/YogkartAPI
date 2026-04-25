// routes/payments.js  –  Add to your existing Express app
// npm install razorpay paytm-pg-node-sdk @phonepe/pg-node-sdk

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const Razorpay = require('razorpay');

// ── Razorpay instance ─────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ════════════════════════════════════════════════════════════
//  RAZORPAY
// ════════════════════════════════════════════════════════════

// POST /api/payments/razorpay/create-order
router.post('/razorpay/create-order', async (req, res) => {
  try {
    const { amount, currency, receipt } = req.body;  // amount in paise

    const rzpOrder = await razorpay.orders.create({
      amount,
      currency: currency ?? 'INR',
      receipt,
    });

    // Save to DB: { orderId, razorpayOrderId, status: 'pending' }
    const dbOrderId = `YK-${Date.now()}`;

    res.json({
      orderId:         dbOrderId,
      razorpayOrderId: rzpOrder.id,
      amount:          rzpOrder.amount,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not create Razorpay order', error: err.message });
  }
});

// POST /api/payments/razorpay/verify
router.post('/razorpay/verify', async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body      = razorpay_order_id + '|' + razorpay_payment_id;
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Update DB: mark order as PAID, store razorpay_payment_id
    res.json({ success: true, orderId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  PAYTM
// ════════════════════════════════════════════════════════════

// POST /api/payments/paytm/initiate
router.post('/paytm/initiate', async (req, res) => {
  try {
    const { amount, address } = req.body;
    const orderId = `PAYTM-${Date.now()}`;

    // Paytm Transaction Token API
    const PaytmChecksum = require('paytmchecksum');

    const paytmParams = {
      body: {
        requestType:   'Payment',
        mid:           process.env.PAYTM_MID,
        websiteName:   'WEBSTAGING',
        orderId,
        callbackUrl:   `${process.env.APP_URL}/api/payments/paytm/callback`,
        txnAmount:     { value: (amount / 100).toFixed(2), currency: 'INR' },
        userInfo:      { custId: address?.name ?? 'CUST001' },
      }
    };

    const checksum = await PaytmChecksum.generateSignatureByString(
      JSON.stringify(paytmParams.body),
      process.env.PAYTM_MERCHANT_KEY
    );

    paytmParams.head = { signature: checksum };

    const resp = await fetch(
      `https://securegw-stage.paytm.in/theia/api/v1/initiateTransaction?mid=${process.env.PAYTM_MID}&orderId=${orderId}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(paytmParams) }
    ).then(r => r.json());

    res.json({
      txnToken: resp.body.txnToken,
      orderId,
      mid:      process.env.PAYTM_MID,
      amount:   (amount / 100).toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ message: 'Paytm initiation failed', error: err.message });
  }
});

// POST /api/payments/paytm/callback  (Paytm redirects here after payment)
router.post('/paytm/callback', (req, res) => {
  const { ORDERID, STATUS, TXNAMOUNT } = req.body;
  if (STATUS === 'TXN_SUCCESS') {
    // Update DB, then redirect to frontend success page
    res.redirect(`${process.env.FRONTEND_URL}/payment/success?orderId=${ORDERID}`);
  } else {
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed?orderId=${ORDERID}`);
  }
});

// ════════════════════════════════════════════════════════════
//  PHONEPE
// ════════════════════════════════════════════════════════════

// POST /api/payments/phonepe/initiate
router.post('/phonepe/initiate', async (req, res) => {
  try {
    const { amount, address } = req.body;
    const merchantTransactionId = `PPE-${Date.now()}`;

    const payload = {
      merchantId:            process.env.PHONEPE_MERCHANT_ID,
      merchantTransactionId,
      merchantUserId:        'YK_USER_001',
      amount,                // in paise
      redirectUrl:           `${process.env.APP_URL}/api/payments/phonepe/callback/${merchantTransactionId}`,
      redirectMode:          'REDIRECT',
      callbackUrl:           `${process.env.APP_URL}/api/payments/phonepe/callback/${merchantTransactionId}`,
      mobileNumber:          address?.phone ?? '',
      paymentInstrument:     { type: 'PAY_PAGE' }
    };

    const base64  = Buffer.from(JSON.stringify(payload)).toString('base64');
    const string  = base64 + '/pg/v1/pay' + process.env.PHONEPE_SALT_KEY;
    const sha256  = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + '###' + process.env.PHONEPE_SALT_INDEX;

    const ppResp = await fetch('https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-VERIFY':      checksum,
        'X-MERCHANT-ID': process.env.PHONEPE_MERCHANT_ID,
      },
      body: JSON.stringify({ request: base64 })
    }).then(r => r.json());

    const redirectUrl = ppResp?.data?.instrumentResponse?.redirectInfo?.url;
    res.json({ redirectUrl, merchantTransactionId });
  } catch (err) {
    res.status(500).json({ message: 'PhonePe initiation failed', error: err.message });
  }
});

// GET /api/payments/phonepe/callback/:txnId
router.get('/phonepe/callback/:txnId', (req, res) => {
  const { txnId } = req.params;
  // Verify status via PhonePe status API, update DB
  res.redirect(`${process.env.FRONTEND_URL}/payment/success?orderId=${txnId}`);
});

// ════════════════════════════════════════════════════════════
//  PAYPAL
// ════════════════════════════════════════════════════════════

// POST /api/payments/paypal/verify
router.post('/paypal/verify', async (req, res) => {
  try {
    const { captureId } = req.body;

    // Get PayPal access token
    const tokenResp = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method:  'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
        ).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    }).then(r => r.json());

    // Verify capture
    const capture = await fetch(
      `https://api-m.sandbox.paypal.com/v2/payments/captures/${captureId}`,
      { headers: { 'Authorization': `Bearer ${tokenResp.access_token}` } }
    ).then(r => r.json());

    if (capture.status === 'COMPLETED') {
      const orderId = `YK-PP-${Date.now()}`;
      // Save to DB, mark as paid
      res.json({ success: true, orderId });
    } else {
      res.status(400).json({ success: false, message: 'PayPal capture not completed' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

// ── In app.js / server.js: ────────────────────────────────────────────────
// const paymentRoutes = require('./routes/payments');
// app.use('/api/payments', paymentRoutes);
