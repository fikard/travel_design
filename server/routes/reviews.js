const express = require('express');
const db = require('../db');
const { placeUserStats } = require('../lib/score');
const router = express.Router();

// 某 POI 的评价列表（含本访客 isMine 标记）
router.get('/place/:placeId', (req, res) => {
  const placeId = Number(req.params.placeId);
  const reviews = db.prepare(`
    SELECT r.id, r.visitor_id, r.recommend, r.comment, r.created_at, r.updated_at
    FROM user_reviews r WHERE r.place_id=? ORDER BY r.created_at DESC
  `).all(placeId);
  const dims = db.prepare(`
    SELECT d.review_id, d.dimension, d.score FROM review_dimensions d
    JOIN user_reviews r ON r.id=d.review_id WHERE r.place_id=?
  `).all(placeId);
  const byReview = {};
  dims.forEach(d => { (byReview[d.review_id] = byReview[d.review_id] || []).push({ dimension: d.dimension, score: d.score }); });
  const list = reviews.map(r => ({ ...r, isMine: r.visitor_id === req.visitorId, dimensions: byReview[r.id] || [] }));
  res.json(list);
});

// 我的评价
router.get('/mine', (req, res) => {
  if (!req.visitorId) return res.status(401).json({ error: 'visitor id required' });
  const rows = db.prepare(`
    SELECT r.id, r.place_id, r.recommend, r.comment, r.created_at, r.updated_at,
      p.name AS place_name, p.city_code, p.type, p.cover, p.official_score
    FROM user_reviews r JOIN places p ON p.id = r.place_id
    WHERE r.visitor_id=? ORDER BY r.updated_at DESC
  `).all(req.visitorId);
  res.json(rows);
});

// 提交/更新本人对某 POI 的评价（一人一评，upsert）
router.post('/', (req, res) => {
  const { placeId, recommend, comment, dimensions } = req.body;
  if (!req.visitorId) return res.status(401).json({ error: 'visitor id required' });
  const place = db.prepare('SELECT id, official_score FROM places WHERE id=?').get(placeId);
  if (!place) return res.status(404).json({ error: 'place not found' });
  if (!['worthit','general','no'].includes(recommend)) return res.status(400).json({ error: 'invalid recommend' });
  if (!Array.isArray(dimensions) || dimensions.length === 0) return res.status(400).json({ error: 'dimensions required' });
  const bad = dimensions.find(d => !d.dimension || typeof d.score !== 'number' || d.score < 1 || d.score > 5);
  if (bad) return res.status(400).json({ error: 'invalid dimension score' });
  if (typeof comment === 'string' && comment.length > 500) return res.status(400).json({ error: 'comment too long' });

  const existing = db.prepare('SELECT id FROM user_reviews WHERE visitor_id=? AND place_id=?').get(req.visitorId, placeId);
  let reviewId;
  if (existing) {
    db.prepare('UPDATE user_reviews SET recommend=?, comment=?, updated_at=datetime("now") WHERE id=?')
      .run(recommend, comment || '', existing.id);
    db.prepare('DELETE FROM review_dimensions WHERE review_id=?').run(existing.id);
    reviewId = existing.id;
  } else {
    reviewId = db.prepare('INSERT INTO user_reviews (visitor_id, place_id, recommend, comment) VALUES (?,?,?,?)')
      .run(req.visitorId, placeId, recommend, comment || '').lastInsertRowid;
  }
  const insDim = db.prepare('INSERT INTO review_dimensions (review_id, dimension, score) VALUES (?,?,?)');
  dimensions.forEach(d => insDim.run(reviewId, d.dimension, d.score));

  res.json({ id: reviewId, stats: placeUserStats(placeId) });
});

// 删除本人对某 POI 的评价
router.delete('/place/:placeId', (req, res) => {
  if (!req.visitorId) return res.status(401).json({ error: 'visitor id required' });
  const placeId = Number(req.params.placeId);
  const review = db.prepare('SELECT id FROM user_reviews WHERE visitor_id=? AND place_id=?').get(req.visitorId, placeId);
  if (!review) return res.status(404).json({ error: 'review not found' });
  db.prepare('DELETE FROM review_dimensions WHERE review_id=?').run(review.id);
  db.prepare('DELETE FROM user_reviews WHERE id=?').run(review.id);
  res.json({ deleted: true, stats: placeUserStats(placeId) });
});

module.exports = router;
