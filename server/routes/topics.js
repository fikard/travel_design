// routes/topics.js
const express = require('express');
const db = require('../db');
const router = express.Router();
router.get('/', (req, res) => res.json(db.prepare('SELECT * FROM topics ORDER BY id').all()));
router.get('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM topics WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'topic not found' });
  const places = db.prepare(`
    SELECT pl.id, pl.type, pl.name, pl.city_code, pl.category, pl.summary, pl.cover,
      pl.official_score,
      (SELECT AVG(score) FROM dimensions d WHERE d.place_id=pl.id) AS avgScore,
      tp.rank
    FROM topic_places tp JOIN places pl ON pl.id=tp.place_id
    WHERE tp.topic_id=? ORDER BY tp.rank`).all(t.id);
  res.json({ ...t, places });
});
module.exports = router;