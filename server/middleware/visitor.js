// 从 X-Visitor-Id 头解析访客标识；写操作（POST/DELETE）要求必带
module.exports = (req, res, next) => {
  const visitor = (req.headers['x-visitor-id'] || '').trim();
  req.visitorId = visitor || null;
  if (!visitor && (req.method === 'POST' || req.method === 'DELETE')) {
    return res.status(401).json({ error: 'visitor id required' });
  }
  next();
};
