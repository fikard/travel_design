# 众投评价体系（匿名评价）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有全国旅游地图 Web 应用加入匿名众投评价：游客以浏览器访客 ID 对 POI 进行维度打分、文字评论与推荐档位评价，评分与官方分加权（官方 0.4 + 用户 0.6）聚合展示。

**Architecture:** 后端新增 `user_reviews` + `review_dimensions` 表与 `/api/reviews` 路由，扩展 `GET /api/places/:id` 返回聚合字段；前端新增访客 ID 工具、评价 API 封装、详情页「用户口碑」区块与「我的评价」页。

**Tech Stack:** Node.js, Express, better-sqlite3, supertest；Vite, Vue3, vue-router, Element Plus, axios, ECharts。

---

## 现状约定（沿用既有工程）

- 后端：`/workspace/server`，`db.js`（better-sqlite3 schema）、`app.js`（挂路由）、`routes/*.js`、`tests/*.test.js`（jest+supertest，测试前 `require('../seed')`）。
- 前端：`/workspace/web/src/api/index.js`（axios 封装 baseURL `/api`）、`router/index.js`（懒加载）、`views/PlaceDetailView.vue`（详情页）。
- 维度模板：`dimensions` 表存官方维度（景点：风景/趣味/性价比/服务；美食：口味/环境/服务/性价比；项目：刺激度/性价比/安全/体验）。用户评价维度沿用同一套名称。
- 评分聚合：`finalScore = official × 0.4 + userAvg × 0.6`；无用户评价时回退官方分。
- 访客 ID：前端 localStorage `visitor_id` 存 UUID，请求头 `X-Visitor-Id` 传递；写操作缺 visitor 返回 401。
- 提交身份沿用 `git -c user.name="Trae Dev" -c user.email="dev@trae.local" commit ...`，只暂存具体文件，不用 `git add -A`。

---

## Task 1: 数据库 schema 扩展（user_reviews + review_dimensions）

**Files:**
- Modify: `server/db.js`

- [ ] **Step 1: 在 `server/db.js` 的表创建语句末尾追加两张表**

在 `db.exec(...)` 的模板字符串中，`topic_places` 表定义之后、闭合反引号之前，追加：

```sql
CREATE TABLE IF NOT EXISTS user_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  place_id INTEGER NOT NULL,
  recommend TEXT NOT NULL CHECK(recommend IN ('worthit','general','no')),
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (visitor_id, place_id)
);
CREATE TABLE IF NOT EXISTS review_dimensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,
  dimension TEXT NOT NULL,
  score REAL NOT NULL CHECK(score BETWEEN 1 AND 5)
);
```

- [ ] **Step 2: 删除旧库并验证 schema 生效**

```bash
cd /workspace/server && rm -f tourism.db && node seed.js && node -e "const db=require('./db'); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(r=>r.name).join(','))"
```
Expected: 输出包含 `user_reviews,review_dimensions`。

- [ ] **Step 3: Commit**

```bash
git add server/db.js
git -c user.name="Trae Dev" -c user.email="dev@trae.local" commit -m "feat: add user_reviews and review_dimensions tables"
```

---

## Task 2: 访客身份中间件、评分聚合工具与 reviews 路由

**Files:**
- Create: `server/middleware/visitor.js`
- Create: `server/lib/score.js`
- Create: `server/routes/reviews.js`
- Modify: `server/app.js`

- [ ] **Step 1: 创建访客中间件 `server/middleware/visitor.js`**

```js
// 从 X-Visitor-Id 头解析访客标识；写操作（POST/DELETE）要求必带
module.exports = (req, res, next) => {
  const visitor = (req.headers['x-visitor-id'] || '').trim();
  req.visitorId = visitor || null;
  if (!visitor && (req.method === 'POST' || req.method === 'DELETE')) {
    return res.status(401).json({ error: 'visitor id required' });
  }
  next();
};
```

- [ ] **Step 2: 创建评分聚合工具 `server/lib/score.js`**

```js
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
```

- [ ] **Step 3: 创建 reviews 路由 `server/routes/reviews.js`**

```js
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
```

- [ ] **Step 4: 挂载中间件与路由到 `server/app.js`**

```js
app.use(require('./middleware/visitor'));      // 置于业务路由之前
app.use('/api/reviews', require('./routes/reviews'));
```

- [ ] **Step 5: 冒烟验证**

```bash
cd /workspace/server && node index.js & sleep 1
curl -s -H "X-Visitor-Id: v1" http://localhost:3000/api/reviews/place/1   # []
curl -s -X POST http://localhost:3000/api/reviews -H "X-Visitor-Id: v1" -H "Content-Type: application/json" \
  -d '{"placeId":1,"recommend":"worthit","comment":"很不错","dimensions":[{"dimension":"风景","score":5},{"dimension":"趣味","score":4}]}'
curl -s -X DELETE http://localhost:3000/api/reviews/place/1 -H "X-Visitor-Id: v1"
```
Expected: GET 返回 `[]`；POST 返回 `{id, stats:{userAvg:4.5,count:1}}`；DELETE 返回 `{deleted:true,stats:{userAvg:null,count:0}}`。

- [ ] **Step 6: Commit**

```bash
git add server/middleware server/routes/reviews.js server/lib server/app.js
git -c user.name="Trae Dev" -c user.email="dev@trae.local" commit -m "feat: visitor middleware and reviews routes"
```

---

## Task 3: reviews 路由单测

**Files:**
- Create: `server/tests/reviews.test.js`

- [ ] **Step 1: 写测试**

```js
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
```

- [ ] **Step 2: 运行确认通过**

```bash
cd /workspace/server && npx jest tests/reviews.test.js -v
```
Expected: 5 个用例 PASS。

- [ ] **Step 3: 清理测试产生的 visitor 数据（重跑 seed 复位）**

```bash
cd /workspace/server && rm -f tourism.db && node seed.js
```

- [ ] **Step 4: Commit**

```bash
git add server/tests/reviews.test.js
git -c user.name="Trae Dev" -c user.email="dev@trae.local" commit -m "test: review api tests"
```

---

## Task 4: 扩展 GET /api/places/:id 聚合字段

**Files:**
- Modify: `server/routes/places.js`

- [ ] **Step 1: 引入 score 工具并扩展响应**

在 `server/routes/places.js` 顶部加 `const { placeUserStats, finalScore } = require('../lib/score');`，并将 GET `/:id` 的 `res.json(...)` 改为：

```js
const stats = placeUserStats(p.id);
const myReview = req.visitorId ? db.prepare(`
  SELECT id, recommend, comment, updated_at FROM user_reviews WHERE visitor_id=? AND place_id=?
`).get(req.visitorId, p.id) : null;
res.json({
  ...p, tags, dimensions, avgScore, topics,
  userAvgScore: stats.userAvg,
  userReviewCount: stats.count,
  finalScore: finalScore(p.official_score, stats.userAvg),
  myReview
});
```

注意：`places.js` 使用 `req.visitorId`，由 Task 2 挂载的 visitor 中间件注入。

- [ ] **Step 2: 冒烟验证聚合**

```bash
cd /workspace/server && node index.js & sleep 1
curl -s -X POST http://localhost:3000/api/reviews -H "X-Visitor-Id: v9" -H "Content-Type: application/json" \
  -d '{"placeId":1,"recommend":"worthit","comment":"好","dimensions":[{"dimension":"风景","score":5},{"dimension":"趣味","score":5}]}' >/dev/null
curl -s http://localhost:3000/api/places/1 -H "X-Visitor-Id: v9" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('official=',j.official_score,'userAvg=',j.userAvgScore,'final=',j.finalScore,'cnt=',j.userReviewCount,'mine=',!!j.myReview)})"
```
Expected: userAvg=5、cnt=1、final=官方×0.4+5×0.6、mine=true。

- [ ] **Step 3: Commit**

```bash
git add server/routes/places.js
git -c user.name="Trae Dev" -c user.email="dev@trae.local" commit -m "feat: place detail aggregation with user score"
```

---

## Task 5: 前端访客 ID 工具与评价 API 封装

**Files:**
- Create: `web/src/utils/visitor.js`
- Modify: `web/src/api/index.js`

- [ ] **Step 1: 创建访客 ID 工具 `web/src/utils/visitor.js`**

```js
const KEY = 'visitor_id';
export function getVisitorId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
      'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(KEY, id);
  }
  return id;
}
```

- [ ] **Step 2: 修改 `web/src/api/index.js` 注入请求头并新增评价 API**

保留既有 getProvinces 等导出，在文件顶部加 import 并新增导出：

```js
import { getVisitorId } from '../utils/visitor';
http.interceptors.request.use(cfg => { cfg.headers['X-Visitor-Id'] = getVisitorId(); return cfg; });

export const getPlaceReviews = (placeId) => http.get('/reviews/place/' + placeId).then(r=>r.data);
export const submitReview = (payload) => http.post('/reviews', payload).then(r=>r.data);
export const deleteReview = (placeId) => http.delete('/reviews/place/' + placeId).then(r=>r.data);
export const getMyReviews = () => http.get('/reviews/mine').then(r=>r.data);
```

- [ ] **Step 3: 验证无编译错误**

```bash
cd /workspace/web && npm run build > /tmp/build.log 2>&1; tail -5 /tmp/build.log
```
Expected: 构建成功（chunk 体积警告忽略）。

- [ ] **Step 4: Commit**

```bash
git add web/src/utils web/src/api/index.js
git -c user.name="Trae Dev" -c user.email="dev@trae.local" commit -m "feat: visitor id util and review api client"
```

---

## Task 6: 详情页「用户口碑」区块 + 我来评价表单

**Files:**
- Create: `web/src/components/ReviewSection.vue`
- Modify: `web/src/views/PlaceDetailView.vue`

- [ ] **Step 1: 创建 `web/src/components/ReviewSection.vue`**

```vue
<template>
  <div class="review-section">
    <h3>用户口碑</h3>
    <div class="score-cards" v-if="place">
      <div class="card"><div class="num">{{ (place.official_score||0).toFixed(1) }}</div><div>官方分</div></div>
      <div class="card"><div class="num">{{ (place.userAvgScore||0).toFixed(1) }}</div><div>用户口碑</div></div>
      <div class="card"><div class="num">{{ (place.finalScore||0).toFixed(1) }}</div><div>综合分（官方40%+口碑60%）</div></div>
      <div class="card"><div class="num">{{ place.userReviewCount||0 }}</div><div>评价数</div></div>
    </div>

    <!-- 我来评价：未评价态 -->
    <div class="my-review" v-if="!myReview">
      <h4>我来评价</h4>
      <el-radio-group v-model="recommend">
        <el-radio-button value="worthit">值得去</el-radio-button>
        <el-radio-button value="general">一般</el-radio-button>
        <el-radio-button value="no">不推荐</el-radio-button>
      </el-radio-group>
      <div class="dims">
        <div v-for="d in dimensionNames" :key="d" class="dim">
          <span>{{ d }}</span>
          <el-rate v-model="draft[d]" show-score score-template="{value}" :max="5" />
        </div>
      </div>
      <el-input v-model="comment" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="写点什么…" />
      <el-button type="primary" style="margin-top:10px" :disabled="!canSubmit" @click="submit">提交评价</el-button>
    </div>

    <!-- 我的评价：可修改/删除 -->
    <div class="my-review" v-else>
      <h4>我的评价（{{ recommendLabel(myReview.recommend) }}）</h4>
      <p>{{ myReview.comment || '（无文字评论）' }}</p>
      <el-button size="small" @click="startEdit">修改</el-button>
      <el-button size="small" type="danger" @click="remove">删除</el-button>
    </div>

    <!-- 评价列表 -->
    <div class="reviews" v-if="reviews.length">
      <div v-for="r in reviews" :key="r.id" class="review-item">
        <div class="head"><b>{{ recommendLabel(r.recommend) }}</b>
          <span class="time">{{ r.created_at }}</span></div>
        <div class="dims-line">
          <el-tag v-for="d in r.dimensions" :key="d.dimension" size="small"
            style="margin-right:4px">{{ d.dimension }} {{ d.score }}</el-tag>
        </div>
        <p>{{ r.comment || '（无文字评论）' }}</p>
        <span v-if="r.isMine" class="mine">我</span>
      </div>
    </div>
    <el-empty v-else description="还没有用户评价" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import { getPlaceReviews, submitReview, deleteReview } from '../api';
const props = defineProps({ place: Object });
const emit = defineEmits(['changed']);
const reviews = ref([]);
const myReview = computed(()=> props.place.myReview || null);
const dimensionNames = computed(()=> (props.place.dimensions||[]).map(d=>d.dimension));
const recommend = ref('worthit');
const comment = ref('');
const draft = ref({});
const editing = ref(false);

function recommendLabel(v){ return { worthit:'值得去', general:'一般', no:'不推荐' }[v] || v; }
const canSubmit = computed(()=> recommend.value && dimensionNames.value.every(d=>draft.value[d] > 0));
async function loadReviews(){ reviews.value = await getPlaceReviews(props.place.id); }
function startEdit(){
  editing.value = true;
  recommend.value = myReview.value.recommend;
  comment.value = myReview.value.comment || '';
  dimensionNames.value.forEach(d => { draft.value[d] = draft.value[d] || 5; });
}
async function submit(){
  const dimensions = dimensionNames.value.map(d => ({ dimension: d, score: draft.value[d] }));
  await submitReview({ placeId: props.place.id, recommend: recommend.value, comment: comment.value, dimensions });
  emit('changed'); await loadReviews();
}
async function remove(){
  await deleteReview(props.place.id);
  emit('changed'); await loadReviews();
}
onMounted(loadReviews);
</script>
<style scoped>
.review-section{ background:#fff; border-radius:8px; padding:16px; margin-top:12px; }
.score-cards{ display:flex; gap:12px; flex-wrap:wrap; margin:12px 0; }
.card{ flex:1; min-width:120px; border:1px solid #eee; border-radius:8px; padding:12px; text-align:center; }
.card .num{ font-size:20px; color:#f57c00; font-weight:700; }
.my-review{ border:1px dashed #ccc; border-radius:8px; padding:12px; margin:12px 0; }
.dims{ margin:10px 0; }
.dim{ display:flex; align-items:center; gap:12px; margin-bottom:6px; }
.review-item{ border-bottom:1px solid #f0f0f0; padding:10px 0; }
.mine{ color:#1f9b6c; font-size:12px; }
.time{ color:#999; font-size:12px; margin-left:8px; }
</style>
```

- [ ] **Step 2: 修改 `web/src/views/PlaceDetailView.vue`**

模板 `.body`（攻略介绍）之后追加 `<ReviewSection :place="place" @changed="reload" />`；script 改为：

```vue
<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getPlace } from '../api';
import ScoreRadar from '../components/ScoreRadar.vue';
import ReviewSection from '../components/ReviewSection.vue';
const route = useRoute(); const place = ref(null);
async function reload(){ place.value = await getPlace(route.params.id); }
onMounted(reload);
</script>
```

- [ ] **Step 3: 浏览器验证**（启动前后端）打开某 POI 详情页：
  - 用户口碑评分卡显示官方/用户/综合/评价数
  - 未评价时出现「我来评价」表单，选择推荐档位 + 打分 + 评论，提交后刷新显示「我的评价」
  - 出现评价列表

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ReviewSection.vue web/src/views/PlaceDetailView.vue
git -c user.name="Trae Dev" -c user.email="dev@trae.local" commit -m "feat: review section on place detail"
```

---

## Task 7: 「我的评价」页与顶栏入口

**Files:**
- Create: `web/src/views/MyReviewsView.vue`
- Modify: `web/src/router/index.js`
- Modify: `web/src/App.vue`

- [ ] **Step 1: 创建 `web/src/views/MyReviewsView.vue`**

```vue
<template>
  <div>
    <h2>我的评价</h2>
    <div v-for="r in reviews" :key="r.id" class="item">
      <div class="head">
        <router-link :to="'/place/'+r.place_id"><b>{{ r.place_name }}</b></router-link>
        <el-tag size="small" :type="tagType(r.recommend)">{{ recommendLabel(r.recommend) }}</el-tag>
        <span class="time">{{ r.updated_at }}</span>
      </div>
      <p>{{ r.comment || '（无文字评论）' }}</p>
      <el-button size="small" @click="edit(r)">修改</el-button>
      <el-button size="small" type="danger" @click="remove(r)">删除</el-button>
    </div>
    <el-empty v-if="!reviews.length" description="你还没有评价过任何地点" />
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getMyReviews, deleteReview } from '../api';
const router = useRouter();
const reviews = ref([]);
function recommendLabel(v){ return { worthit:'值得去', general:'一般', no:'不推荐' }[v] || v; }
function tagType(v){ return { worthit:'success', general:'info', no:'danger' }[v] || ''; }
async function load(){ reviews.value = await getMyReviews(); }
function edit(r){ router.push({ path:'/place/'+r.place_id, query:{ editReview:'1' } }); }
async function remove(r){
  await deleteReview(r.place_id);
  await load();
}
onMounted(load);
</script>
<style scoped>
.item{ background:#fff; border:1px solid #eee; border-radius:8px; padding:12px; margin-bottom:12px; }
.head{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.time{ color:#999; font-size:12px; }
</style>
```

- [ ] **Step 2: 注册路由 `web/src/router/index.js`**，routes 数组追加：

```js
{ path: '/my-reviews', component: () => import('../views/MyReviewsView.vue') },
```

- [ ] **Step 3: 顶栏加入口 `web/src/App.vue`**，在 `</nav>` 内（「专题榜」后）追加：

```vue
<router-link to="/my-reviews">我的评价</router-link>
```

- [ ] **Step 4: 浏览器验证**：顶栏「我的评价」→ 列表展示本人评价；删除后消失。

- [ ] **Step 5: Commit**

```bash
git add web/src/views/MyReviewsView.vue web/src/router/index.js web/src/App.vue
git -c user.name="Trae Dev" -c user.email="dev@trae.local" commit -m "feat: my reviews page and nav entry"
```

---

## Task 8: 端到端闭环验证（headless 浏览器）

**Files:**（无新增，验证为主；必要时修复）

- [ ] **Step 1: 重启并复位数据**

```bash
cd /workspace/server && rm -f tourism.db && node seed.js
for p in 3000 5173; do for pid in $(lsof -ti tcp:$p 2>/dev/null); do kill -9 $pid 2>/dev/null; done; done
(cd /workspace/server && nohup node index.js > /tmp/server.log 2>&1 &)
(cd /workspace/web && nohup npm run dev -- --host --port 5173 --strictPort > /tmp/webdev.log 2>&1 &)
sleep 8
curl -s http://localhost:5173/api/health   # {"ok":true}
```

- [ ] **Step 2: 运行完整后端测试**

```bash
cd /workspace/server && npx jest
```
Expected: 全部用例 PASS（含既有 7 例 + 新增 reviews 5 例）。

- [ ] **Step 3: headless 浏览器闭环（Playwright/Puppeteer，若不可用则退回 curl 断言并说明）**

验证链路（截图留证，`/tmp/e2e/reviews-*.png`）：
1. 打开 `http://localhost:5173/place/` 某 POI 详情页，页面含「用户口碑」与「我来评价」
2. 选择推荐档位「值得去」、给每个维度打分、填评论，点「提交评价」
3. 断言页面出现「我的评价」且评价列表出现该条；详情页综合分更新为 官方×0.4+用户×0.6
4. 顶栏进入「我的评价」页，断言包含该 POI 评价；点「删除」后列表为空
5. 详情页「用户口碑」评价数为 0，综合分回退官方分

- [ ] **Step 4: 修复发现的问题并 Commit**

```bash
git add -A
git -c user.name="Trae Dev" -c user.email="dev@trae.local" commit -m "fix: end-to-end reviews fixes"
```
（若无修复则跳过本步，保持工作树干净。）

---

## Self-Review 结论（已自查）

- **Spec 覆盖**：数据模型(T1)、聚合规则(T2 lib/score + T4)、后端 API 四接口(T2)、身份解析(T2 中间件)、前端详情页口碑区块与表单(T6)、我的评价页(T7)、测试(T3)、端到端(T8)。覆盖设计文档第 3-7 节。
- **占位符检查**：无 TBD/TODO；每步含完整代码与命令。
- **类型/命名一致性**：`visitor_id/X-Visitor-Id`、`recommend('worthit'|'general'|'no')`、`userAvgScore/finalScore/userReviewCount/myReview` 字段在 T2/T4/T6/T8 一致；`submitReview(payload)/deleteReview(placeId)/getMyReviews()/getPlaceReviews(placeId)` 在 T5 定义、T6/T7 使用一致；`require('../lib/score')` 路径一致。
- **可执行性**：`req.visitorId` 由 app.js 中间件在 T2 注入，T4 places 路由依赖其存在（T2 在 T4 前完成）；jest 测试与既有 `require('../seed')` 模式一致；lsof 按端口清进程避开自匹配。