// routes/cities.js
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/:code', (req, res) => {
  const c = db.prepare('SELECT * FROM cities WHERE code=?').get(req.params.code);
  if (!c) return res.status(404).json({ error: 'city not found' });
  const type = req.query.type;
  let sql = `SELECT pl.id, pl.type, pl.name, pl.category, pl.city_code, pl.summary,
    pl.lat, pl.lng, pl.cover, pl.official_score,
    (SELECT AVG(score) FROM dimensions d WHERE d.place_id = pl.id) AS avgScore
    FROM places pl WHERE pl.city_code=?`;
  const params = [req.params.code];
  if (type) { sql += ' AND pl.type=?'; params.push(type); }
  sql += ' ORDER BY avgScore DESC';
  res.json({ ...c, places: db.prepare(sql).all(...params) });
});
module.exports = router;