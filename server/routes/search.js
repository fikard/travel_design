// routes/search.js
const express = require('express');
const db = require('../db');
const router = express.Router();
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  res.json(db.prepare(`SELECT id, type, name, city_code, category, summary, official_score,
    (SELECT AVG(score) FROM dimensions d WHERE d.place_id=pl.id) AS avgScore
    FROM places pl WHERE name LIKE ? OR category LIKE ? OR tags LIKE ?`)
    .all(like, like, like));
});
module.exports = router;