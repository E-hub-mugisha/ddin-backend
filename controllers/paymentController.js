// backend/controllers/paymentController.js
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const momo = require('../config/momo');

// POST /api/payments/initiate
// Called when user enters their phone number and clicks Pay
const initiatePayment = async (req, res) => {
  const { serviceId, phoneNumber } = req.body;

  // --- Validation ---
  if (!serviceId || !phoneNumber) {
    return res.status(400).json({ success: false, message: 'Service and phone number are required' });
  }

  // Phone must be 10 digits (Rwandan format: 07XXXXXXXX)
  const cleanPhone = phoneNumber.replace(/\s+/g, '');
  if (!/^(07[2389])\d{7}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, message: 'Enter a valid Rwandan phone number (e.g. 0781234567)' });
  }

  try {
    // 1. Get the service from DB
    const [services] = await db.query('SELECT * FROM services WHERE id = ?', [serviceId]);
    if (services.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    const service = services[0];

    // 2. Generate a unique reference ID for this transaction
    const referenceId = uuidv4();

    // 3. Save transaction as PENDING in DB
    await db.query(
      `INSERT INTO transactions (service_id, service_name, phone_number, amount, momo_reference_id, momo_status)
       VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [service.id, service.name, cleanPhone, service.price, referenceId]
    );

    // 4. Send payment request to MoMo API
    // In sandbox: use international format without +, e.g. 250781234567
    const intlPhone = '250' + cleanPhone.substring(1); // 07X -> 250 7X

    await momo.requestPayment({
      referenceId,
      phoneNumber: intlPhone,
      amount: service.price,
      currency: 'EUR',         // Use EUR for sandbox! Switch to RWF for production
      note: `Payment for ${service.name}`,
    });

    // 5. Respond to frontend — payment request sent, now user must approve on phone
    res.json({
      success: true,
      message: 'Payment request sent! Please check your phone to approve.',
      referenceId,
      amount: service.price,
      serviceName: service.name,
    });

  } catch (error) {
    console.error('MoMo payment error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment initiation failed. Please try again.' });
  }
};

// GET /api/payments/status/:referenceId
// Called by frontend to poll and check if payment was approved
const checkStatus = async (req, res) => {
  const { referenceId } = req.params;

  try {
    // 1. Check status from MoMo API
    const momoStatus = await momo.checkPaymentStatus(referenceId);
    const status = momoStatus.status; // 'SUCCESSFUL', 'FAILED', 'PENDING'

    // 2. Update our DB record if status changed
    if (status === 'SUCCESSFUL' || status === 'FAILED') {
      await db.query(
        'UPDATE transactions SET momo_status = ? WHERE momo_reference_id = ?',
        [status, referenceId]
      );
    }

    res.json({ success: true, status, referenceId });

  } catch (error) {
    console.error('Status check error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Could not check payment status' });
  }
};

// GET /api/payments - Get all transactions (admin view)
const getAllTransactions = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM transactions ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
};

module.exports = { initiatePayment, checkStatus, getAllTransactions };