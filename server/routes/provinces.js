// routes/provinces.js
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.code, p.name, COUNT(pl.id) AS poiCount
    FROM provinces p
    LEFT JOIN cities c ON c.province_code = p.code
    LEFT JOIN places pl ON pl.city_code = c.code
    GROUP BY p.code ORDER BY p.code
  `).all();
  res.json(rows);
});

router.get('/:code', (req, res) => {
  const p = db.prepare('SELECT * FROM provinces WHERE code=?').get(req.params.code);
  if (!p) return res.status(404).json({ error: 'province not found' });
  const cities = db.prepare(`
    SELECT c.code, c.name, c.lat, c.lng,
      (SELECT COUNT(*) FROM places pl WHERE pl.city_code = c.code) AS placeCount
    FROM cities c WHERE c.province_code=? ORDER BY c.code
  `).all(req.params.code);
  res.json({ ...p, cities });
});
module.exports = router;