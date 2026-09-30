# 全国旅游地图 Web 应用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个面向大众游客的轻量全栈 Web 应用，以「省级下钻」方式在全国地图上展示各地特色景点、美食、游玩项目及多维官方评分。

**Architecture:** Vue3+Vite 前端（ECharts 省级下钻地图）通过 REST API 访问 Express+SQLite 后端；GeoJSON 取自公共地图接口并缓存至 `web/public/geo/`。

**Tech Stack:** Node.js, Express, better-sqlite3, cors, supertest；Vite, Vue3, vue-router, Element Plus, ECharts；GeoJSON 源 DataV.GeoAtlas。

---

## 目录结构（最终形态）

```text
/workspace
├─ docs/superpowers/          # 设计文档与计划
├─ server/
│  ├─ package.json
│  ├─ db.js                    # better-sqlite3 连接 + schema 初始化
│  ├─ seed.js                  # 灌入示例数据
│  ├─ app.js                   # Express 应用（导出便于测试）
│  ├─ index.js                 # 启动入口
│  ├─ routes/
│  │  ├─ provinces.js
│  │  ├─ cities.js
│  │  ├─ places.js
│  │  ├─ topics.js
│  │  └─ search.js
│  └─ tests/
│     ├─ provinces.test.js
│     ├─ cities.test.js
│     ├─ places.test.js
│     ├─ topics.test.js
│     └─ search.test.js
└─ web/
   ├─ package.json, vite.config.js, index.html
   ├─ public/geo/
   │  ├─ china.json            # 全国省级 GeoJSON
   │  └─ <provinceAdcode>.json  # 省内市级 GeoJSON（例 510000.json）
   └─ src/
      ├─ main.js
      ├─ App.vue
      ├─ router/index.js
      ├─ api/index.js          # 请求封装
      ├─ components/
      │  ├─ ChinaMap.vue
      │  ├─ ProvinceMap.vue
      │  ├─ ScoreRadar.vue
      │  └─ PlaceCard.vue
      └─ views/
         ├─ HomeView.vue
         ├─ ProvinceView.vue
         ├─ CityView.vue
         ├─ PlaceDetailView.vue
         ├─ TopicsView.vue
         ├─ TopicDetailView.vue
         └─ SearchView.vue
```

---

## 约定（贯穿所有任务）

- 省份 `code` = 行政区划 adcode（如四川省 510000）；城市 `code` = adcode。
- 城市页不依赖市级 GeoJSON：以 POI 卡片列表为主。
- 综合分 = 各维度等权平均，服务端在返回 place 详情时计算 `avgScore`。
- 前端通过 `/api`（vite proxy 到后端 3000）访问。
- 所有 commit 消息用 `feat:` / `fix:` 前缀，遵循新建仓库风格，每次只暂存对应的具体文件。

---

## Task 1: 后端脚手架与数据库 schema

**Files:**
- Create: `server/package.json`
- Create: `server/db.js`
- Create: `server/app.js`
- Create: `server/index.js`

- [ ] **Step 1: 初始化 server 包**

Run:
```bash
mkdir -p /workspace/server && cd /workspace/server && npm init -y
```

- [ ] **Step 2: 安装依赖**

```bash
npm i express better-sqlite3 cors
npm i -D nodemon supertest
```

- [ ] **Step 3: 写入数据库封装 `server/db.js`**

```js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'tourism.db');
const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS provinces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  province_code TEXT NOT NULL,
  lat REAL, lng REAL
);
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('scenic','food','activity')),
  name TEXT NOT NULL,
  city_code TEXT NOT NULL,
  category TEXT,
  summary TEXT,
  address TEXT,
  lat REAL, lng REAL,
  cover TEXT,
  tags TEXT,
  body TEXT,
  official_score REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS dimensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL,
  dimension TEXT NOT NULL,
  score REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  cover TEXT,
  type TEXT
);
CREATE TABLE IF NOT EXISTS topic_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  place_id INTEGER NOT NULL,
  rank INTEGER
);
`);

module.exports = db;
```

- [ ] **Step 4: 写入 Express 应用 `server/app.js` 与 `server/index.js`**

`server/app.js`:
```js
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
module.exports = app;
```

`server/index.js`:
```js
const app = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on :${PORT}`));
```

- [ ] **Step 5: 启动验证**

Run:
```bash
cd /workspace/server && node index.js & sleep 1 && curl -s http://localhost:3000/api/health
```
Expected: `{"ok":true}`

- [ ] **Step 6: Commit**

```bash
git add server && git commit -m "feat: backend scaffold with sqlite schema and express app"
```

---

## Task 2: seed 示例数据

**Files:**
- Create: `server/seed.js`

- [ ] **Step 1: 写入 seed 脚本 `server/seed.js`**

```js
const db = require('./db');

const provinces = [
  ['110000','北京市'],['120000','天津市'],['130000','河北省'],['140000','山西省'],
  ['150000','内蒙古自治区'],['210000','辽宁省'],['220000','吉林省'],['230000','黑龙江省'],
  ['310000','上海市'],['320000','江苏省'],['330000','浙江省'],['340000','安徽省'],
  ['350000','福建省'],['360000','江西省'],['370000','山东省'],['410000','河南省'],
  ['420000','湖北省'],['430000','湖南省'],['440000','广东省'],['450000','广西壮族自治区'],
  ['460000','海南省'],['500000','重庆市'],['510000','四川省'],['520000','贵州省'],
  ['530000','云南省'],['540000','西藏自治区'],['610000','陕西省'],['620000','甘肃省'],
  ['630000','青海省'],['640000','宁夏回族自治区'],['650000','新疆维吾尔自治区'],
  ['710000','台湾省'],['810000','香港特别行政区'],['820000','澳门特别行政区']
];
const insP = db.prepare('INSERT OR REPLACE INTO provinces (code,name) VALUES (?,?)');
provinces.forEach(p => insP.run(...p));

const insC = db.prepare('INSERT OR REPLACE INTO cities (code,name,province_code,lat,lng) VALUES (?,?,?,?,?)');
const insPlace = db.prepare(`INSERT INTO places
  (type,name,city_code,category,summary,address,lat,lng,cover,tags,body,official_score)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const insDim = db.prepare('INSERT INTO dimensions (place_id,dimension,score) VALUES (?,?,?)');

const demo = {
  '110000': { code:'110000', name:'北京市', province:'110000', lat:39.9, lng:116.4,
    places:[
      { type:'scenic', name:'故宫博物院', category:'历史古迹', summary:'明清皇宫，世界文化遗产',
        address:'北京市东城区景山前街4号', lat:39.916, lng:116.397, official:4.8,
        tags:['历史','打卡','必去'], body:'故宫又称紫禁城，是明清两代的皇家宫殿……',
        dims:{风景:4.9, 趣味:4.7, 性价比:4.6, 服务:4.5} },
      { type:'food', name:'全聚德烤鸭', category:'京菜', summary:'百年老字号挂炉烤鸭',
        address:'北京市东城区前门大街30号', lat:39.899, lng:116.398, official:4.5,
        tags:['烤鸭','老字号'], body:'全聚德始创于1864年，果木挂炉烤鸭皮酥肉嫩……',
        dims:{口味:4.8, 环境:4.3, 服务:4.4, 性价比:3.9} }
    ] },
  '510100': { code:'510100', name:'成都市', province:'510000', lat:30.57, lng:104.06,
    places:[
      { type:'scenic', name:'大熊猫繁育研究基地', category:'自然生态', summary:'近距离观国宝大熊猫',
        address:'成都市成华区熊猫大道1375号', lat:30.736, lng:104.131, official:4.9,
        tags:['熊猫','亲子'], body:'基地内有大熊猫和小熊猫等，建议早晨前往……',
        dims:{风景:4.7, 趣味:4.9, 性价比:4.5, 服务:4.6} },
      { type:'food', name:'陈麻婆豆腐', category:'川菜', summary:'麻婆豆腐发源地',
        address:'成都市青羊区西玉龙街197号', lat:30.663, lng:104.065, official:4.6,
        tags:['川菜','豆腐'], body:'麻辣鲜香，豆腐嫩滑，是川菜代表……',
        dims:{口味:4.8, 环境:4.0, 服务:4.2, 性价比:4.4} }
    ] },
  '440100': { code:'440100', name:'广州市', province:'440000', lat:23.13, lng:113.26,
    places:[
      { type:'activity', name:'珠江夜游', category:'水上观光', summary:'夜赏花城两岸灯光',
        address:'广州市越秀区天字码头', lat:23.11, lng:113.27, official:4.4,
        tags:['夜游','江景'], body:'乘船夜游珠江，两岸建筑灯火璀璨……',
        dims:{刺激度:3.8, 性价比:4.0, 安全:4.8, 体验:4.5} }
    ] },
  '530700': { code:'530700', name:'丽江市', province:'530000', lat:26.87, lng:100.23,
    places:[
      { type:'scenic', name:'玉龙雪山', category:'自然风光', summary:'纳西族神山，冰川公园',
        address:'丽江市玉龙纳西族自治县', lat:27.09, lng:100.18, official:4.8,
        tags:['雪山','高海拔'], body:'玉龙雪山是北半球最南端的大雪山……',
        dims:{风景:5.0, 趣味:4.4, 性价比:4.1, 服务:4.3} }
    ] } };

for (const c of Object.values(demo)) {
  insC.run(c.code, c.name, c.province, c.lat, c.lng);
  c.places.forEach(p => {
    const r = insPlace.run(p.type, p.name, c.code, p.category, p.summary, p.address,
      p.lat, p.lng, p.cover || '', JSON.stringify(p.tags), p.body, p.official);
    for (const [dim, sc] of Object.entries(p.dims)) insDim.run(r.lastInsertRowid, dim, sc);
  });
}
// 为无示范城市的省补一个占位城市，保证全国地图非空
const allProv = db.prepare('SELECT code FROM provinces').all();
allProv.forEach(pr => {
  if (!db.prepare('SELECT 1 FROM cities WHERE province_code=?').get(pr.code)) {
    insC.run(pr.code + '01', pr.name + '示例市', pr.code, null, null);
  }
});

const insT = db.prepare('INSERT INTO topics (title,summary,cover,type) VALUES (?,?,?,?)');
const t = insT.run('全国必打卡 TOP', '各地人气与评分最高的景点合集', '', 'scenic');
const insTP = db.prepare('INSERT INTO topic_places (topic_id,place_id,rank) VALUES (?,?,?)');
const topScenic = db.prepare('SELECT id FROM places WHERE type="scenic" ORDER BY official_score DESC LIMIT 10').all();
topScenic.forEach((row,i)=> insTP.run(t.lastInsertRowid, row.id, i+1));

console.log('seed done');
```

- [ ] **Step 2: 运行 seed**

Run:
```bash
cd /workspace/server && rm -f tourism.db && node seed.js
```
Expected: 输出 `seed done`。

- [ ] **Step 3: 验证数据量**

Run:
```bash
cd /workspace/server && node -e "const db=require('./db');console.log(db.prepare('SELECT COUNT(*) c FROM provinces').get(),db.prepare('SELECT COUNT(*) c FROM cities').get(),db.prepare('SELECT COUNT(*) c FROM places').get());"
```
Expected: 省份 34，cities ≥ 32，places ≥ 6。

- [ ] **Step 4: Commit**

```bash
git add server/seed.js && git commit -m "feat: seed demo tourism data"
```

---

## Task 3: 省份 API

**Files:**
- Create: `server/routes/provinces.js`
- Create: `server/tests/provinces.test.js`
- Modify: `server/app.js`

- [ ] **Step 1: 写测试**

```js
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
```

- [ ] **Step 2: 配置 jest 并确认失败**

在 `server/package.json` 加 `"scripts": { "test": "jest" }`，Run:
```bash
cd /workspace/server && npx jest tests/provinces.test.js
```
Expected: FAIL（404，路由未实现）。

- [ ] **Step 3: 实现路由**

```js
// routes/provinces.js
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.code, p.name, COUNT(pl.id) AS poiCount
    FROM provinces p
    LEFT JOIN cities c ON c.province_code = p.code
    LEFT JOIN places pl ON pl.city_code = c.code
    GROUP BY p.code ORDER BY p.code
  `).all();
  res.json(rows);
});

router.get('/:code', (req, res) => {
  const p = db.prepare('SELECT * FROM provinces WHERE code=?').get(req.params.code);
  if (!p) return res.status(404).json({ error: 'province not found' });
  const cities = db.prepare(`
    SELECT c.code, c.name, c.lat, c.lng,
      (SELECT COUNT(*) FROM places pl WHERE pl.city_code = c.code) AS placeCount
    FROM cities c WHERE c.province_code=? ORDER BY c.code
  `).all(req.params.code);
  res.json({ ...p, cities });
});
module.exports = router;
```

- [ ] **Step 4: 挂载到 `server/app.js`**

```js
app.use('/api/provinces', require('./routes/provinces'));
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd /workspace/server && npx jest tests/provinces.test.js
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/routes server/app.js server/tests && git commit -m "feat: province list and detail API"
```

---

## Task 4: 城市 API

**Files:**
- Create: `server/routes/cities.js`
- Create: `server/tests/cities.test.js`
- Modify: `server/app.js`

- [ ] **Step 1: 测试**

```js
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
```

- [ ] **Step 2: 运行确认失败（404）**

- [ ] **Step 3: 实现**

```js
// routes/cities.js
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/:code', (req, res) => {
  const c = db.prepare('SELECT * FROM cities WHERE code=?').get(req.params.code);
  if (!c) return res.status(404).json({ error: 'city not found' });
  const type = req.query.type;
  let sql = `SELECT pl.id, pl.type, pl.name, pl.category, pl.city_code, pl.summary,
    pl.lat, pl.lng, pl.cover, pl.official_score,
    (SELECT AVG(score) FROM dimensions d WHERE d.place_id = pl.id) AS avgScore
    FROM places pl WHERE pl.city_code=?`;
  const params = [req.params.code];
  if (type) { sql += ' AND pl.type=?'; params.push(type); }
  sql += ' ORDER BY avgScore DESC';
  res.json({ ...c, places: db.prepare(sql).all(...params) });
});
module.exports = router;
```

- [ ] **Step 4: 挂载并测试通过**

```js
// app.js
app.use('/api/cities', require('./routes/cities'));
```
```bash
cd /workspace/server && npx jest tests/cities.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes server/app.js server/tests && git commit -m "feat: city detail API with filtered places"
```

---

## Task 5: POI 详情 API 与搜索 API

**Files:**
- Create: `server/routes/places.js`
- Create: `server/routes/search.js`
- Create: `server/tests/places.test.js`
- Create: `server/tests/search.test.js`
- Modify: `server/app.js`

- [ ] **Step 1: 测试**

```js
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
```
```js
// tests/search.test.js
const request = require('supertest');
const app = require('../app');
require('../seed');
test('GET /api/search?q=熊猫 返回匹配 POI', async () => {
  const res = await request(app).get('/api/search?q=%E7%86%8A%E7%8C%AB');
  expect(res.statusCode).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: 实现**

```js
// routes/places.js
const express = require('express');
const db = require('../db');
const router = express.Router();
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM places WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'place not found' });
  const dimensions = db.prepare('SELECT dimension, score FROM dimensions WHERE place_id=?').all(p.id);
  const dimCount = dimensions.length;
  const avgScore = dimCount ? Math.round(dimensions.reduce((s,d)=>s+d.score,0)/dimCount*10)/10 : null;
  let tags = []; try { tags = JSON.parse(p.tags||'[]'); } catch(e) {}
  const topics = db.prepare(
    'SELECT t.id, t.title FROM topic_places tp JOIN topics t ON t.id=tp.topic_id WHERE tp.place_id=?'
  ).all(p.id);
  res.json({ ...p, tags, dimensions, avgScore, topics });
});
module.exports = router;
```
```js
// routes/search.js
const express = require('express');
const db = require('../db');
const router = express.Router();
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  res.json(db.prepare(`SELECT id, type, name, city_code, category, summary, official_score,
    (SELECT AVG(score) FROM dimensions d WHERE d.place_id=pl.id) AS avgScore
    FROM places pl WHERE name LIKE ? OR category LIKE ? OR tags LIKE ?`)
    .all(like, like, like));
});
module.exports = router;
```

- [ ] **Step 5: 挂载并测试**

```js
// app.js
app.use('/api/places', require('./routes/places'));
app.use('/api/search', require('./routes/search'));
```
```bash
cd /workspace/server && npx jest tests/places.test.js tests/search.test.js
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/routes server/app.js server/tests && git commit -m "feat: place detail and search API"
```

---

## Task 6: 专题 API

**Files:**
- Create: `server/routes/topics.js`
- Create: `server/tests/topics.test.js`
- Modify: `server/app.js`

- [ ] **Step 1: 测试（先失败后通过）**

```js
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
```

- [ ] **Step 3: 实现**

```js
// routes/topics.js
const express = require('express');
const db = require('../db');
const router = express.Router();
router.get('/', (req, res) => res.json(db.prepare('SELECT * FROM topics ORDER BY id').all()));
router.get('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM topics WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'topic not found' });
  const places = db.prepare(`
    SELECT pl.id, pl.type, pl.name, pl.city_code, pl.category, pl.summary, pl.cover,
      pl.official_score,
      (SELECT AVG(score) FROM dimensions d WHERE d.place_id=pl.id) AS avgScore,
      tp.rank
    FROM topic_places tp JOIN places pl ON pl.id=tp.place_id
    WHERE tp.topic_id=? ORDER BY tp.rank`).all(t.id);
  res.json({ ...t, places });
});
module.exports = router;
```

- [ ] **Step 5: 挂载、测试通过后 Commit**

```js
// app.js
app.use('/api/topics', require('./routes/topics'));
```
```bash
cd /workspace/server && npx jest tests/topics.test.js
git add server/routes server/app.js server/tests && git commit -m "feat: topics API"
```

---

## Task 7: 前端脚手架与依赖

**Files:**
- Create: `web/`（Vite Vue 模板）

- [ ] **Step 1: 创建 Vite + Vue 项目**

```bash
cd /workspace && npm create vite@latest web -- --template vue
cd web && npm install
npm i vue-router@4 element-plus echarts axios
```

- [ ] **Step 2: 清理模板默认视图**

删除 `web/src/components/HelloWorld.vue`。

- [ ] **Step 3: 配置构建代理 `web/vite.config.js`**

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  plugins: [vue()],
  server: { proxy: { '/api': 'http://localhost:3000' } }
});
```

- [ ] **Step 4: 验证启动**

Run:
```bash
cd /workspace/web && npm run dev > /tmp/web.log 2>&1 &
sleep 4 && tail -5 /tmp/web.log
```
Expected: Vite dev server 提示已启动。

- [ ] **Step 5: Commit**

```bash
git add web && git commit -m "feat: scaffold vite vue web app"
```

---

## Task 8: 路由与整体布局 + API 客户端

**Files:**
- Create: `web/src/router/index.js`
- Create: `web/src/api/index.js`
- Modify: `web/src/main.js`
- Modify: `web/src/App.vue`

- [ ] **Step 1: 创建 `web/src/api/index.js`**

```js
import axios from 'axios';
const http = axios.create({ baseURL: import.meta.env.VITE_API_BASE || '/api' });
export const getProvinces = () => http.get('/provinces').then(r=>r.data);
export const getProvince = (code) => http.get('/provinces/'+code).then(r=>r.data);
export const getCity = (code, type) => http.get('/cities/'+code,{params:{type}}).then(r=>r.data);
export const getPlace = (id) => http.get('/places/'+id).then(r=>r.data);
export const getTopics = () => http.get('/topics').then(r=>r.data);
export const getTopic = (id) => http.get('/topics/'+id).then(r=>r.data);
export const searchPlaces = (q) => http.get('/search',{params:{q}}).then(r=>r.data);
export default http;
```

- [ ] **Step 2: 创建 `web/src/router/index.js`**

```js
import { createRouter, createWebHistory } from 'vue-router';
const routes = [
  { path: '/', component: () => import('../views/HomeView.vue') },
  { path: '/province/:code', component: () => import('../views/ProvinceView.vue') },
  { path: '/city/:code', component: () => import('../views/CityView.vue') },
  { path: '/place/:id', component: () => import('../views/PlaceDetailView.vue') },
  { path: '/topics', component: () => import('../views/TopicsView.vue') },
  { path: '/topic/:id', component: () => import('../views/TopicDetailView.vue') },
  { path: '/search', component: () => import('../views/SearchView.vue') },
];
export default createRouter({ history: createWebHistory(), routes });
```

- [ ] **Step 3: 修改 `web/src/main.js`**

```js
import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
createApp(App).use(router).use(ElementPlus).mount('#app');
```

- [ ] **Step 4: 修改 `web/src/App.vue`**

```vue
<template>
  <div class="app">
    <header class="topbar">
      <router-link to="/" class="logo">游迹地图</router-link>
      <nav><router-link to="/">地图总览</router-link>
        <router-link to="/topics">专题榜</router-link></nav>
      <el-input v-model="q" placeholder="搜索景点/美食/项目" clearable
        style="width:220px" @keyup.enter="doSearch" @clear="doSearch" />
    </header>
    <main><router-view /></main>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
const q = ref('');
const router = useRouter();
function doSearch(){ router.push({ path:'/search', query:{ q: q.value } }); }
</script>
<style>
body{ margin:0; font-family: system-ui, sans-serif; background:#fafafa; }
.topbar{ display:flex; align-items:center; gap:24px; padding:12px 24px;
  background:#fff; border-bottom:1px solid #eee; }
.logo{ font-weight:700; font-size:18px; color:#1f9b6c; text-decoration:none; }
nav a{ margin-right:16px; color:#333; text-decoration:none; }
main{ max-width:1100px; margin:0 auto; padding:20px; }
</style>
```

- [ ] **Step 5: 验证无编译错误**（重建 dev 后 tail 日志）

- [ ] **Step 6: Commit**

```bash
git add web/src && git commit -m "feat: router, layout and api client"
```

---

## Task 9: 下载省市 GeoJSON

**Files:**
- Create: `web/public/geo/china.json`
- Create: 若干 `web/public/geo/<adcode>.json`

- [ ] **Step 1: 下载全国省级 GeoJSON（DataV.GeoAtlas）**

```bash
mkdir -p /workspace/web/public/geo
curl -fsSL -o /workspace/web/public/geo/china.json \
  "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json"
wc -c /workspace/web/public/geo/china.json
```
Expected: 文件非空（数百 KB）。

- [ ] **Step 2: 下载示例省份市级 GeoJSON**

```bash
for code in 110000 510000 440000 530000; do
  curl -fsSL -o /workspace/web/public/geo/$code.json \
    "https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json"
done
ls -la /workspace/web/public/geo/
```
`_full.json` = 本级+下级合并边界，用于省→市下钻。

- [ ] **Step 3: Commit**

```bash
git add web/public/geo && git commit -m "feat: geo geojson data for map drilling"
```
（若沙箱离线无法下载，跳过下载步骤，并在执行时用代理/预置 GeoJSON 接入，不阻塞下钻闭环。）

---

## Task 10: 全国总览页（ChinaMap）

**Files:**
- Create: `web/src/views/HomeView.vue`
- Create: `web/src/components/ChinaMap.vue`

- [ ] **Step 1: 创建 `web/src/components/ChinaMap.vue`**

```vue
<template><div ref="el" style="width:100%;height:560px"></div></template>
<script setup>
import * as echarts from 'echarts';
import { onMounted, ref, watch, defineEmits } from 'vue';
const props = defineProps({ data: { type: Array, default: () => [] } });
const emit = defineEmits(['navigate']);
const el = ref(null); let chart;
async function render(){
  if (!chart) chart = echarts.init(el.value);
  try {
    const geo = await (await fetch('/geo/china.json')).json();
    echarts.registerMap('china', geo);
  } catch(e) { return; }
  chart.clear();
  chart.setOption({
    tooltip: { trigger: 'item' },
    visualMap: { min:0, max: Math.max(...props.data.map(d=>d.poiCount),10), left:'left',
      inRange:{ color:['#e0f4ea','#1f9b6c'] } },
    series: [{ type:'map', map:'china', roam:true, label:{show:true,fontSize:9},
      data: props.data.map(d=>({ name:d.name, value:d.poiCount, code:d.code })) }]
  });
  chart.off('click');
  chart.on('click', p => { emit('navigate', p.data && p.data.code); });
}
onMounted(render);
watch(()=>props.data, render, { deep:true });
</script>
```

- [ ] **Step 2: 创建 `web/src/views/HomeView.vue`**

```vue
<template>
  <div>
    <h2>全国特色旅游概览</h2>
    <ChinaMap :data="provinces" @navigate="go" />
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ChinaMap from '../components/ChinaMap.vue';
import { getProvinces } from '../api';
const provinces = ref([]);
const router = useRouter();
onMounted(async ()=> provinces.value = await getProvinces());
function go(code){ if(code) router.push('/province/'+code); }
</script>
```

- [ ] **Step 3: 浏览器验证**：打开首页渲染全国地图热力，点击省份跳转。

- [ ] **Step 4: Commit**

```bash
git add web/src && git commit -m "feat: home china map overview"
```

---

## Task 11: 省份页

**Files:**
- Create: `web/src/components/PlaceCard.vue`
- Create: `web/src/components/ProvinceMap.vue`
- Create: `web/src/views/ProvinceView.vue`

- [ ] **Step 1: 创建 `web/src/components/PlaceCard.vue`**

```vue
<template>
  <router-link class="card" :to="'/place/'+place.id">
    <div class="cover">{{ place.name[0] }}</div>
    <div class="body">
      <div class="row"><b>{{ place.name }}</b>
        <span class="score">{{ ((place.avgScore||place.official_score)||0).toFixed(1) }}</span></div>
      <div class="cat">{{ place.category }} · {{ typeLabel(place.type) }}</div>
      <p class="sum">{{ place.summary }}</p>
    </div>
  </router-link>
</template>
<script setup>
defineProps({ place: Object });
function typeLabel(t){ return {scenic:'景点',food:'美食',activity:'项目'}[t]||''; }
</script>
<style scoped>
.card{ display:flex; gap:12px; border:1px solid #eee; border-radius:8px; padding:12px;
  margin-bottom:12px; text-decoration:none; color:#333; background:#fff; }
.cover{ width:100px; height:70px; background:#1f9b6c; color:#fff; display:flex;
  align-items:center; justify-content:center; font-size:22px; border-radius:6px; }
.score{ color:#f57c00; font-weight:700; }
.cat{ color:#1f9b6c; font-size:13px; margin-top:4px; }
.sum{ color:#666; font-size:13px; margin:4px 0 0; }
</style>
```

- [ ] **Step 2: 创建 `web/src/components/ProvinceMap.vue`**

```vue
<template><div ref="el" style="width:100%;height:480px"></div></template>
<script setup>
import * as echarts from 'echarts';
import { onMounted, ref, watch, defineEmits } from 'vue';
const props = defineProps({ provinceCode: { type:String, default:'' }, cities: {type:Array, default:()=>[]} });
const emit = defineEmits(['navigate']);
const el = ref(null); let chart;
async function render(){
  if (!props.provinceCode || !props.cities.length) return;
  if (!chart) chart = echarts.init(el.value);
  try { const geo = await (await fetch(`/geo/${props.provinceCode}.json`)).json();
        if (geo.name) echarts.registerMap('prov', geo); else return; }
  catch(e){ return; }
  chart.setOption({
    tooltip: { trigger: 'item' },
    visualMap: { min:0, max: Math.max(...props.cities.map(c=>c.placeCount),5), left:'left',
      inRange:{ color:['#e0f4ea','#1f9b6c'] } },
    series: [{ type:'map', map:'prov', roam:true, label:{show:true,fontSize:9},
      data: props.cities.map(c=>({ name:c.name, value:c.placeCount, code:c.code })) }]
  });
  chart.off('click');
  chart.on('click', p => emit('navigate', p.data && p.data.code));
}
onMounted(render);
watch(()=>[props.provinceCode, props.cities], render, { deep:true });
</script>
```

- [ ] **Step 3: 创建 `web/src/views/ProvinceView.vue`**

```vue
<template>
  <div v-if="province">
    <el-breadcrumb separator="/" style="margin-bottom:12px">
      <el-breadcrumb-item :to="{path:'/'}">全国</el-breadcrumb-item>
      <el-breadcrumb-item>{{ province.name }}</el-breadcrumb-item>
    </el-breadcrumb>
    <h2>{{ province.name }}旅游</h2>
    <ProvinceMap :province-code="code" :cities="cities" @navigate="goCity" />
    <div class="city-list">
      <div v-for="c in cities" :key="c.code" class="city" @click="goCity(c.code)">
        <b>{{ c.name }}</b><span> {{ c.placeCount }} 个地点</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getProvince } from '../api';
import ProvinceMap from '../components/ProvinceMap.vue';
const route = useRoute(), router = useRouter();
const code = route.params.code;
const province = ref(null), cities = ref([]);
onMounted(async ()=>{ const d = await getProvince(code); province.value = d; cities.value = d.cities; });
function goCity(c){ if(c) router.push('/city/'+c); }
</script>
<style scoped>
.city-list{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; margin-top:16px; }
.city{ border:1px solid #eee; border-radius:8px; padding:12px; cursor:pointer; background:#fff; }
.city span{ color:#999; font-size:13px; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add web/src && git commit -m "feat: province view with city aggregation"
```

---

## Task 12: 城市页

**Files:**
- Create: `web/src/views/CityView.vue`

- [ ] **Step 1: 实现 `web/src/views/CityView.vue`**

```vue
<template>
  <div v-if="city">
    <el-breadcrumb separator="/" style="margin-bottom:12px">
      <el-breadcrumb-item :to="{path:'/'}">全国</el-breadcrumb-item>
      <el-breadcrumb-item :to="{path:'/province/'+backProvince}">上省</el-breadcrumb-item>
      <el-breadcrumb-item>{{ city.name }}</el-breadcrumb-item>
    </el-breadcrumb>
    <h2>{{ city.name }} · {{ typeLabel(type) }}</h2>
    <el-tabs v-model="type" @tab-change="load">
      <el-tab-pane label="全部" value="" />
      <el-tab-pane label="景点" value="scenic" />
      <el-tab-pane label="美食" value="food" />
      <el-tab-pane label="项目" value="activity" />
    </el-tabs>
    <PlaceCard v-for="p in city.places" :key="p.id" :place="p" />
    <el-empty v-if="city.places.length===0" description="暂无内容" />
  </div>
</template>
<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { getCity } from '../api';
import PlaceCard from '../components/PlaceCard.vue';
const route = useRoute();
const city = ref(null), type = ref('');
const backProvince = computed(()=> city.value ? city.value.province_code : '');
function typeLabel(t){ return {scenic:'景点',food:'美食',activity:'项目'}[t]||'全部'; }
async function load(){ city.value = await getCity(route.params.code, type.value); }
onMounted(load);
import { watch } from 'vue';
watch(()=>route.params.code, load);
</script>
```

- [ ] **Step 2: Commit**

```bash
git add web/src && git commit -m "feat: city view with place list and type filter"
```

---

## Task 13: POI 详情页（雷达评分 + 攻略）

**Files:**
- Create: `web/src/components/ScoreRadar.vue`
- Create: `web/src/views/PlaceDetailView.vue`

- [ ] **Step 1: 创建 `web/src/components/ScoreRadar.vue`**

```vue
<template><div ref="el" style="width:100%;height:300px"></div></template>
<script setup>
import * as echarts from 'echarts';
import { onMounted, ref, watch } from 'vue';
const props = defineProps({ dimensions: { type: Array, default: ()=>[] } });
const el = ref(null); let chart;
function render(){
  if (!props.dimensions.length) return;
  if (!chart) chart = echarts.init(el.value);
  chart.setOption({
    radar: { indicator: props.dimensions.map(d=>({name:d.dimension, max:5})) },
    series: [{ type:'radar',
      data:[{ value: props.dimensions.map(d=>d.score),
              areaStyle:{color:'rgba(31,155,108,.3)'} }] }]
  });
}
onMounted(render);
watch(()=>props.dimensions, render, { deep:true });
</script>
```

- [ ] **Step 2: 创建 `web/src/views/PlaceDetailView.vue`**

```vue
<template>
  <div v-if="place">
    <el-breadcrumb separator="/" style="margin-bottom:12px">
      <el-breadcrumb-item :to="{path:'/city/'+place.city_code}">返回城市</el-breadcrumb-item>
    </el-breadcrumb>
    <h2>{{ place.name }}</h2>
    <el-tag v-for="t in place.tags" :key="t" size="small" style="margin-right:6px">{{ t }}</el-tag>
    <p class="score">综合评分：{{ (place.avgScore||0).toFixed(1) }}
      <span style="font-size:12px;color:#999">（官方）</span></p>
    <el-row :gutter="20">
      <el-col :span="12"><ScoreRadar :dimensions="place.dimensions||[]" /></el-col>
      <el-col :span="12">
        <p><b>分类：</b>{{ place.category }}</p>
        <p><b>地址：</b>{{ place.address }}</p>
        <p v-if="place.topics && place.topics.length"><b>入选专题：</b>
          <router-link v-for="tp in place.topics" :key="tp.id" :to="'/topic/'+tp.id"
            style="margin-right:8px">{{ tp.title }}</router-link></p>
      </el-col>
    </el-row>
    <div class="body"><h3>攻略介绍</h3><p>{{ place.body }}</p></div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getPlace } from '../api';
import ScoreRadar from '../components/ScoreRadar.vue';
const route = useRoute(); const place = ref(null);
onMounted(async ()=> place.value = await getPlace(route.params.id));
</script>
<style scoped>
.score{ color:#f57c00; font-size:16px; margin:12px 0; }
.body{ background:#fff; padding:16px; border-radius:8px; margin-top:12px; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add web/src && git commit -m "feat: place detail with radar score and guide"
```

---

## Task 14: 专题榜列表与详情

**Files:**
- Create: `web/src/views/TopicsView.vue`
- Create: `web/src/views/TopicDetailView.vue`

- [ ] **Step 1: 创建 `web/src/views/TopicsView.vue`**

```vue
<template>
  <div>
    <h2>编辑推荐专题榜</h2>
    <div class="grid">
      <router-link v-for="t in topics" :key="t.id" :to="'/topic/'+t.id" class="t-card">
        <div class="cover">{{ t.title[0] }}</div>
        <div><b>{{ t.title }}</b><p>{{ t.summary }}</p></div>
      </router-link>
    </div>
    <el-empty v-if="!topics.length" description="暂无专题" />
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { getTopics } from '../api';
const topics = ref([]);
onMounted(async ()=> topics.value = await getTopics());
</script>
<style scoped>
.grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; }
.t-card{ display:flex; gap:12px; border:1px solid #eee; border-radius:8px; padding:12px;
  text-decoration:none; color:#333; background:#fff; }
.t-card p{ color:#666; font-size:13px; margin:4px 0 0; }
.cover{ width:56px;height:56px;border-radius:8px;background:#1f9b6c;color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:22px; }
</style>
```

- [ ] **Step 2: 创建 `web/src/views/TopicDetailView.vue`**

```vue
<template>
  <div v-if="topic">
    <h2>{{ topic.title }}</h2><p>{{ topic.summary }}</p>
    <div v-for="(p,i) in topic.places" :key="p.id" style="display:flex;align-items:flex-start;gap:8px">
      <span class="rank">{{ i+1 }}</span>
      <div style="flex:1"><PlaceCard :place="p" /></div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getTopic } from '../api';
import PlaceCard from '../components/PlaceCard.vue';
const route = useRoute(); const topic = ref(null);
onMounted(async ()=> topic.value = await getTopic(route.params.id));
</script>
<style scoped>
.rank{ min-width:28px;height:28px;border-radius:50%;background:#1f9b6c;color:#fff;
  display:flex;align-items:center;justify-content:center;margin-top:8px; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add web/src && git commit -m "feat: topics list and detail views"
```

---

## Task 15: 搜索页

**Files:**
- Create: `web/src/views/SearchView.vue`

- [ ] **Step 1: 实现 `web/src/views/SearchView.vue`**

```vue
<template>
  <div>
    <h2>搜索结果：{{ q }}</h2>
    <PlaceCard v-for="p in results" :key="p.id" :place="p" />
    <el-empty v-if="q && !results.length" description="未找到相关内容" />
  </div>
</template>
<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { searchPlaces } from '../api';
import PlaceCard from '../components/PlaceCard.vue';
const route = useRoute(); const q = ref(''); const results = ref([]);
async function load(){ q.value = route.query.q||''; results.value = await searchPlaces(q.value); }
onMounted(load); watch(()=>route.query.q, load);
</script>
```

- [ ] **Step 2: Commit**

```bash
git add web/src && git commit -m "feat: search view"
```

---

## Task 16: 端到端下钻闭环验证

**Files:**（无新增，验证为主）

- [ ] **Step 1: 同时启动后端与前端**

```bash
cd /workspace/server && node index.js > /tmp/server.log 2>&1 &
cd /workspace/web && npm run dev > /tmp/web.log 2>&1 &
sleep 5
```

- [ ] **Step 2: 验证关键 API**

```bash
curl -s http://localhost:3000/api/provinces/510000 | head -c 200; echo
curl -s http://localhost:3000/api/cities/510100 | head -c 200; echo
curl -s "http://localhost:3000/api/search?q=%E7%86%8A%E7%8C%AB" | head -c 200; echo
```
Expected: 返回四川、成都、命中「大熊猫繁育研究基地」。

- [ ] **Step 3: 浏览器走通主链路**（browser_use 子代理）

打开 `http://localhost:5173`：
首页 → 点击四川 → 省份页 → 点击成都 → 城市页列表 → 点击大熊猫基地 → 详情页雷达/攻略/专题正常；顶栏搜索「熊猫」→ 结果页命中；访问 `/topics` → 专题含大熊猫基地。

- [ ] **Step 4: 修复发现问题后 Commit**

```bash
git add -A && git commit -m "fix: end-to-end drill-down fixes"
```

---

## Self-Review 结论（已自查）

- **Spec 覆盖**：三类 POI(T1/T5/T12)、专题榜(T14)、攻略正文(T13)、多维评分(T5/T13)、省级下钻(T10/T11/T12)、搜索(T15)、后端 API(T3-T6)、测试(T3-T6)、GeoJSON(T9)。覆盖设计文档第 3-10 节。
- **占位符检查**：无 TBD/TODO；每步骤含具体代码与命令。
- **类型/命名一致性**：API 返回字段 `poiCount/placeCount/avgScore/dimensions/cities/places/rank` 各 Task 一致；`getCity(code,type)` 在 Task8 定义、Task12 使用一致；省份/城市 `code`=adcode 与 GeoJSON 的 `properties.adcode` 匹配，地图 click 通过 `data` 携带 `code` 传递跳转。
- **可执行性**：省份 GeoJSON `_full.json` 含「本级+下级」，注册 map 后下钻点击城市 adcode 可行；离线时按 Task9 注记用预置 GeoJSON 兜底。