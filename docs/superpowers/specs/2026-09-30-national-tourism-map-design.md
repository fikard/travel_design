# 全国旅游地图 Web 应用 — 设计文档

日期：2026-09-30
状态：已确认（方案 A）

## 1. 背景与目标

构建一个面向普通大众游客的 Web 应用，在全国地图上按「省级下钻」方式展示各地特色旅游内容：

- 三类 POI：景点（scenic）、美食（food）、游玩项目（activity）
- 编辑推荐专题榜（必吃榜、必打卡 TOP 等）
- 多维度评分（官方评分）
- 攻略正文内容

MVP 范围为「可浏览的地图门户」，不含用户注册登录与用户众投评价（后续迭代）。

## 2. 产品决策（已与用户确认）

| 维度 | 决策 |
|------|------|
| 目标用户 | 普通游客/大众用户 |
| 数据来源 | 官方维护（MVP 阶段），为后续众投扩展预留 |
| 地图交互 | 省级下钻式：全国 → 省份 → 城市 → POI |
| 评分体系 | 多维度评分，综合分 = 加权平均 |
| 内容组织 | 景点/美食/项目三分类 + 编辑推荐专题榜 + 攻略正文 |
| 范围 | 先做浏览门户 MVP（无账号体系） |
| 技术栈 | 轻量全栈（方案 A） |

## 3. 技术架构（方案 A）

- **前端**：Vite + Vue3 + Vue Router + Element Plus + ECharts
- **后端**：Node.js + Express + better-sqlite3（SQLite）
- **地图**：ECharts 中国/省市 GeoJSON，免费、无需 Mapbox token
- **数据**：结构化 SQLite 表 + seed 灌入各省示例数据

前后端分离，后端提供 REST API，前端通过 API 获取数据。

## 4. 页面结构与路由

顶部导航：Logo + 分类入口（景点/美食/项目）+ 搜索框 + 专题榜。

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 全国总览 | ECharts 中国地图，按省级 POI 数量热力配色 |
| `/province/:id` | 省份页 | 省级地图（按市聚合）+ 分类筛选 + 专题榜入口 |
| `/city/:id` | 城市页 | 城市地图 POI 标记 + 右侧列表（按评分排序） |
| `/place/:id` | POI 详情页 | 多维度雷达图、攻略正文、标签、封面、基础信息 |
| `/topics` | 专题榜列表 | 编辑推荐专题 |
| `/topic/:id` | 专题详情页 | 专题内 POI 排序列表 |
| `/search` | 搜索 | 全站 POI 搜索 |

## 5. 数据模型（SQLite）

```text
provinces
  id, code, name

cities
  id, code, name, province_id(→provinces), lat, lng

places（POI）
  id, type('scenic'|'food'|'activity'), name, city_id(→cities),
  category, summary, address, lat, lng, cover, tags(JSON), body(攻略正文),
  official_score(0-5), created_at

dimensions（多维度评分）
  id, place_id(→places), dimension(varchar), score(0-5)
  维度按类型区分：
    景点 scenic：风景 / 趣味 / 性价比 / 服务
    美食 food  ：口味 / 环境 / 服务 / 性价比
    项目 activity：刺激度 / 性价比 / 安全 / 体验

topics（专题）
  id, title, summary, cover, type

topic_places（专题—POI 关联）
  id, topic_id(→topics), place_id(→places), rank
```

综合分由各维度加权平均实时计算（前端展示）；表内 `official_score` 保留为独立官方综合分用于排序。

## 6. 后端 REST API

- `GET /api/provinces` — 省份列表（含 POI 数量用于热力）
- `GET /api/provinces/:id` — 省份详情 + 该省城市聚合统计
- `GET /api/cities/:id` — 城市详情 + 该类 POI 列表（按评分排序）
- `GET /api/places/:id` — POI 详情（含维度评分、攻略、所属专题）
- `GET /api/places?city=&type=` — POI 筛选/排序
- `GET /api/search?q=` — 全站 POI 搜索
- `GET /api/topics` / `GET /api/topics/:id` — 专题

## 7. 地图下钻流程

1. 全国页点击省份 → 跳转省份页
2. 省份页点击市 → 跳转城市页
3. 城市页点击 POI 标记 → 跳转 POI 详情页
   全程使用 ECharts + 免费省市 GeoJSON，无需 token。

## 8. 多维度评分呈现

- 详情页用雷达图展示各维度分，综合分 = 维度加权平均
- 明确标注「官方评分」
- 专题榜按综合分/官方分排序呈现

## 9. 项目目录结构

```text
/workspace
├─ server/                  # 后端 Express
│  ├─ db.js                 # better-sqlite3 初始化 + schema
│  ├─ seed.js               # 灌入各省示例数据
│  ├─ routes/               # provinces / cities / places / topics / search
│  └─ tests/                # API 单测 (supertest)
└─ web/                     # 前端 Vite + Vue3
   ├─ src/
   │  ├─ router/            # 路由
   │  ├─ views/             # 全国/省份/城市/详情/专题/搜索 页
   │  ├─ components/        # 地图组件、评分雷达图等
   │  └─ api/               # 请求封装
   └─ public/geo/           # 省市 GeoJSON
```

## 10. 测试与验证

- 后端：supertest 对主要 API 做单测
- 前端：基础渲染验证
- 闭环验证：seed 数据可跑通 全国 → 省份 → 城市 → POI 详情 的下钻

## 11. 范围外（后续迭代）

- 用户注册登录
- 用户众投评价 / 打分 / 收藏
- 真实 PoI 第三方数据源接入