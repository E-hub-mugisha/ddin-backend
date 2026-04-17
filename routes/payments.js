const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const BASE_URL = process.env.MOMO_ENVIRONMENT === 'production'
  ? 'https://proxy.momoapi.mtn.com'
  : 'https://sandbox.momoapi.mtn.com';

const SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY;
const API_USER = process.env.MOMO_API_USER;
const API_KEY = process.env.MOMO_API_KEY;

// ── Helper: get access token ──────────────────────────────
async function getAccessToken() {
  const credentials = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const res = await fetch(`${BASE_URL}/collection/token/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
    },
  });
  if (!res.ok) throw new Error('Failed to get access token');
  const data = await res.json();
  return data.access_token;
}

// ── POST /api/payments/initiate ───────────────────────────
router.post('/initiate', async (req, res) => {
  const { serviceId, phoneNumber } = req.body;

  if (!serviceId || !phoneNumber) {
    return res.status(400).json({ error: 'serviceId and phoneNumber are required' });
  }

  // Look up the service price (replace with DB lookup later)
  const services = {
    1: { name: 'Web Design', price: 50000 },
    2: { name: 'SEO', price: 30000 },
    3: { name: 'Branding', price: 40000 },
  };
  const service = services[serviceId];
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const referenceId = uuidv4();

  try {
    const token = await getAccessToken();

    const momoRes = await fetch(`${BASE_URL}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': process.env.MOMO_ENVIRONMENT || 'sandbox',
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(service.price),
        currency: 'RWF',
        externalId: String(serviceId),
        payer: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber.replace(/^0/, '250'), // convert 07x to 2507x
        },
        payerMessage: `Payment for ${service.name}`,
        payeeNote: `Service ID ${serviceId}`,
      }),
    });

    if (!momoRes.ok) {
      const err = await momoRes.text();
      console.error('MoMo error:', err);
      return res.status(502).json({ error: 'Payment request failed' });
    }

    res.json({ referenceId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/payments/status/:referenceId ─────────────────
router.get('/status/:referenceId', async (req, res) => {
  const { referenceId } = req.params;

  try {
    const token = await getAccessToken();

    const momoRes = await fetch(`${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Target-Environment': process.env.MOMO_ENVIRONMENT || 'sandbox',
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      },
    });

    if (!momoRes.ok) return res.status(502).json({ error: 'Failed to fetch status' });

    const data = await momoRes.json();
    // MoMo returns: PENDING | SUCCESSFUL | FAILED
    res.json({ status: data.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;