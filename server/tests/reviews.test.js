const request = require('supertest');
const app = require('../app');
require('../seed');

const H = { 'X-Visitor-Id': 'visitor-test-001' };

test('提交评价后 POI 评价列表含本人评价', async () => {
  const city = await request(app).get('/api/cities/510100');
  const placeId = city.body.places[0].id;
  const post = await request(app).post('/api/reviews').set(H)
    .send({ placeId, recommend: 'worthit', comment: '非常棒', dimensions: [{ dimension: '风景', score: 5 }, { dimension: '趣味', score: 4 }] });
  expect(post.statusCode).toBe(200);
  expect(post.body.stats.userAvg).toBe(4.5);
  const list = await request(app).get(`/api/reviews/place/${placeId}`).set(H);
  expect(list.body.length).toBe(1);
  expect(list.body[0].isMine).toBe(true);
});

test('同一访客重复提交同一 POI 幂等更新（仍一条）', async () => {
  const city = await request(app).get('/api/cities/510100');
  const placeId = city.body.places[0].id;
  await request(app).post('/api/reviews').set(H)
    .send({ placeId, recommend: 'general', comment: '还行', dimensions: [{ dimension: '风景', score: 3 }] });
  const list = await request(app).get(`/api/reviews/place/${placeId}`).set(H);
  expect(list.body.length).toBe(1);
  expect(list.body[0].recommend).toBe('general');
});

test('缺 visitor 头时写操作返回 401', async () => {
  const res = await request(app).post('/api/reviews')
    .send({ placeId: 1, recommend: 'worthit', comment: '', dimensions: [{ dimension: '风景', score: 4 }] });
  expect(res.statusCode).toBe(401);
});

test('删除本人评价后列表为空', async () => {
  const city = await request(app).get('/api/cities/510100');
  const placeId = city.body.places[0].id;
  const del = await request(app).delete(`/api/reviews/place/${placeId}`).set(H);
  expect(del.statusCode).toBe(200);
  const list = await request(app).get(`/api/reviews/place/${placeId}`).set(H);
  expect(list.body.length).toBe(0);
});

test('GET /api/reviews/mine 返回本人全部评价', async () => {
  const city = await request(app).get('/api/cities/510100');
  const placeId = city.body.places[0].id;
  await request(app).post('/api/reviews').set(H)
    .send({ placeId, recommend: 'worthit', comment: '推荐', dimensions: [{ dimension: '风景', score: 5 }] });
  const mine = await request(app).get('/api/reviews/mine').set(H);
  expect(mine.statusCode).toBe(200);
  expect(mine.body.length).toBeGreaterThanOrEqual(1);
});
