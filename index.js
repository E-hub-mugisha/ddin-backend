// backend/server.js — Main entry point
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json()); // Parse JSON request bodies

// ── Routes ────────────────────────────────────────────────
app.use('/api/services',  require('./routes/services'));
app.use('/api/payments',  require('./routes/payments'));

// Health check
app.get('/', (req, res) => {
  res.json({ message: '🚀 MoMo Payment API is running' });
});

// ── Start Server ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.MOMO_ENVIRONMENT}`);
});