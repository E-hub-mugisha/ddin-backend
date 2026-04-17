const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([
    { id: 1, name: "Web Design", description: "Custom websites", price: 50000, icon: "🌐" },
    { id: 2, name: "SEO", description: "Search optimization", price: 30000, icon: "📈" },
    { id: 3, name: "Branding", description: "Logo & identity", price: 40000, icon: "🎨" },
  ]);
});

module.exports = router;