// tests/topics.test.js
const request = require('supertest');
const app = require('../app');
require('../seed');
test('GET /api/topics 返回专题列表', async () => {
  const res = await request(app).get('/api/topics');
  expect(Array.isArray(res.body)).toBe(true);
});
test('GET /api/topics/:id 返回专题内 POI（按 rank）', async () => {
  const list = await request(app).get('/api/topics');
  const id = list.body[0].id;
  const res = await request(app).get('/api/topics/' + id);
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body.places)).toBe(true);
});