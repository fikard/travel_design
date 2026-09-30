// tests/cities.test.js
const request = require('supertest');
const app = require('../app');
require('../seed');

test('GET /api/cities/:code 返回城市与 POI 列表', async () => {
  const res = await request(app).get('/api/cities/510100');
  expect(res.statusCode).toBe(200);
  expect(res.body.name).toBe('成都市');
  expect(Array.isArray(res.body.places)).toBe(true);
  expect(res.body.places.length).toBeGreaterThan(0);
});