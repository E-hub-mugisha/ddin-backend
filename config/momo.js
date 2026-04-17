// backend/config/momo.js
// This file handles all communication with the MTN MoMo API

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.MOMO_BASE_URL;
const SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY;
const API_USER = process.env.MOMO_API_USER;
const API_KEY = process.env.MOMO_API_KEY;
const ENVIRONMENT = process.env.MOMO_ENVIRONMENT; // 'sandbox' or 'production'

// Step 1: Get an access token from MoMo
async function getAccessToken() {
  // Encode credentials as Base64 (API_USER:API_KEY)
  const credentials = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');

  const response = await axios.post(
    `${BASE_URL}/collection/token/`,
    {},
    {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      },
    }
  );

  return response.data.access_token;
}

// Step 2: Request a payment from a phone number
async function requestPayment({ referenceId, phoneNumber, amount, currency, note }) {
  const token = await getAccessToken();

  await axios.post(
    `${BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount: String(amount),
      currency: currency || 'EUR', // Use EUR for sandbox, RWF for production
      externalId: referenceId,
      payer: {
        partyIdType: 'MSISDN',   // MSISDN = phone number
        partyId: phoneNumber,
      },
      payerMessage: note || 'Payment for service',
      payeeNote: note || 'Service payment',
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': ENVIRONMENT,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  // MoMo returns 202 (Accepted) — payment is now pending on the user's phone
  return { success: true, referenceId };
}

// Step 3: Check the status of a payment
async function checkPaymentStatus(referenceId) {
  const token = await getAccessToken();

  const response = await axios.get(
    `${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Target-Environment': ENVIRONMENT,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      },
    }
  );

  return response.data; // { status: 'SUCCESSFUL' | 'FAILED' | 'PENDING', ... }
}

module.exports = { requestPayment, checkPaymentStatus };