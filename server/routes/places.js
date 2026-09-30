// routes/places.js
const express = require('express');
const db = require('../db');
const { placeUserStats, finalScore } = require('../lib/score');
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
  const stats = placeUserStats(p.id);
  const myReview = req.visitorId ? db.prepare(`
    SELECT id, recommend, comment, updated_at FROM user_reviews WHERE visitor_id=? AND place_id=?
  `).get(req.visitorId, p.id) || null : null;
  res.json({
    ...p, tags, dimensions, avgScore, topics,
    userAvgScore: stats.userAvg,
    userReviewCount: stats.count,
    finalScore: finalScore(p.official_score, stats.userAvg),
    myReview
  });
});
module.exports = router;