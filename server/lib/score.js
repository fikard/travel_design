const db = require('../db');

// 某 POI 的用户平均分、评价数；无评价时 userAvg 为 null
function placeUserStats(placeId) {
  const row = db.prepare(`
    SELECT AVG(d.score) AS userAvg, COUNT(DISTINCT r.id) AS cnt
    FROM user_reviews r JOIN review_dimensions d ON d.review_id = r.id
    WHERE r.place_id=?
  `).get(placeId);
  return { userAvg: row.userAvg === null ? null : Math.round(row.userAvg * 10) / 10, count: row.cnt };
}

// 综合分：官方 0.4 + 用户 0.6；无用户评价回退官方分
function finalScore(official, userAvg) {
  if (userAvg === null) return official === null ? null : Math.round(official * 10) / 10;
  const base = official === null ? userAvg : official * 0.4 + userAvg * 0.6;
  return Math.round(base * 10) / 10;
}

module.exports = { placeUserStats, finalScore };
