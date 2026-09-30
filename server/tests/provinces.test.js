// tests/provinces.test.js
const request = require('supertest');
const app = require('../app');
require('../seed');

test('GET /api/provinces 返回含 POI 数量的省份列表', async () => {
  const res = await request(app).get('/api/provinces');
  expect(res.statusCode).toBe(200);
  expect(res.body.length).toBeGreaterThanOrEqual(30);
  expect(res.body[0]).toHaveProperty('name');
  expect(res.body[0]).toHaveProperty('poiCount');
});

test('GET /api/provinces/:code 返回省份及城市聚合', async () => {
  const res = await request(app).get('/api/provinces/510000');
  expect(res.statusCode).toBe(200);
  expect(res.body.name).toBe('四川省');
  expect(Array.isArray(res.body.cities)).toBe(true);
});