// tests/places.test.js
const request = require('supertest');
const app = require('../app');
require('../seed');
test('GET /api/places/:id 返回详情含维度与综合分', async () => {
  const city = await request(app).get('/api/cities/510100');
  const id = city.body.places[0].id;
  const res = await request(app).get('/api/places/' + id);
  expect(res.statusCode).toBe(200);
  expect(res.body.name).toBeTruthy();
  expect(Array.isArray(res.body.dimensions)).toBe(true);
  expect(typeof res.body.avgScore).toBe('number');
});