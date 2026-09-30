// routes/places.js
const express = require('express');
const db = require('../db');
const router = express.Router();
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM places WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'place not found' });
  const dimensions = db.prepare('SELECT dimension, score FROM dimensions WHERE place_id=?').all(p.id);
  const dimCount = dimensions.length;
  const avgScore = dimCount ? Math.round(dimensions.reduce((s,d)=>s+d.score,0)/dimCount*10)/10 : null;
  let tags = []; try { tags = JSON.parse(p.tags||'[]'); } catch(e) {}
  const topics = db.prepare(
    'SELECT t.id, t.title FROM topic_places tp JOIN topics t ON t.id=tp.topic_id WHERE tp.place_id=?'
  ).all(p.id);
  res.json({ ...p, tags, dimensions, avgScore, topics });
});
module.exports = router;