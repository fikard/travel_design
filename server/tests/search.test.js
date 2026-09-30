// tests/search.test.js
const request = require('supertest');
const app = require('../app');
require('../seed');
test('GET /api/search?q=熊猫 返回匹配 POI', async () => {
  const res = await request(app).get('/api/search?q=%E7%86%8A%E7%8C%AB');
  expect(res.statusCode).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
});