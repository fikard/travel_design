# 众投评价体系（第一阶段：匿名评价）— 设计文档

日期：2026-09-30
状态：已确认（方案 A：独立评价表）
前置：全国旅游地图 MVP 已上线（Express+SQLite + Vue3 前端）

## 1. 背景与目标

为现有「全国旅游地图」应用补齐用户侧评价能力：游客无需注册即可对 POI 进行多维度打分、文字评论与推荐档位评价，评分与官方分加权聚合后在全站展示，形成「官方 + 用户口碑」双源评分体系。

第一阶段**不做账号体系与图片上传**（范围外，后续迭代）。采用匿名访客标识（浏览器 localStorage 生成 UUID）实现一人一评与「我的评价」能力，为第二阶段账号体系预留 `user_id` 平滑迁移路径。

## 2. 产品决策（已与用户确认）

| 维度 | 决策 |
|------|------|
| 账号体系 | 第一阶段匿名（访客 ID），账号体系第二阶段 |
| 评分聚合 | 官方分 × 0.4 + 用户平均分 × 0.6 |
| 评价内容 | 维度打分（必选）+ 文字评论 + 推荐档位 |
| 图片上传 | 第一阶段不含 |
| 实现方案 | 方案 A：独立评价表（user_reviews + review_dimensions） |

## 3. 数据模型（SQLite 新增）

```text
user_reviews
  id INTEGER PK
  visitor_id TEXT NOT NULL          # 前端 localStorage UUID
  place_id INTEGER NOT NULL         # → places.id
  recommend TEXT NOT NULL           # 'worthit' | 'general' | 'no'（值得去/一般/不推荐）
  comment TEXT                      # 文字评论（可空）
  created_at TEXT
  updated_at TEXT
  唯一约束 (visitor_id, place_id)   # 一人一评，幂等 upsert

review_dimensions
  id INTEGER PK
  review_id INTEGER NOT NULL        # → user_reviews.id
  dimension TEXT NOT NULL           # 维度名，对齐 places 类型维度模板
  score REAL NOT NULL               # 1-5
```

访问者标识：前端首次访问生成 UUID 存 localStorage，作为 `X-Visitor-Id` 请求头随 API 传递。第二阶段加账号后新增 `user_reviews.user_id` 字段（可为空），与 visitor_id 兼容并存。

## 4. 评分聚合规则

- 用户平均分 `userAvgScore` = 该 POI 全部有效评价的维度分均值
- 综合分 `finalScore` = 官方分 × 0.4 + 用户平均分 × 0.6
- 无用户评价时 `finalScore` 回退为官方分
- 详情页展示三套数：官方分、用户口碑分（userAvgScore）、综合分（finalScore），并标注权重

## 5. 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reviews` | 提交/更新评价（visitor+place 幂等 upsert；body: placeId, recommend, comment, dimensions[]) |
| GET | `/api/reviews/place/:placeId` | 某 POI 评价列表（含本访客 myReview 标记） |
| DELETE | `/api/reviews/place/:placeId` | 删除本人评价 |
| GET | `/api/reviews/mine` | 我的评价列表（按 X-Visitor-Id） |
| GET | `/api/places/:id` | 扩展字段：userAvgScore、finalScore、userReviewCount、myReview |

身份解析中间件：从 `X-Visitor-Id` 头读取 visitor（缺失则视为游客，只读不写）。

## 6. 前端交互

- 详情页新增「用户口碑」区块：
  - 评分统计卡：官方分 / 用户口碑分 / 综合分三数 + 评价数
  - 用户评价列表（推荐档位、维度分、文字、时间）
- 「我来评价」交互（状态机）：
  - 未评价：展示表单（推荐档位单选 + 维度滑块 1-5 + 文字评论）
  - 已评价：展示我的评价 + 「修改 / 删除」按钮
- 提交后详情页聚合实时刷新
- 顶栏新增「我的评价」入口 → 新路由 `/my-reviews`：本人所有评价列表（可改/删）

## 7. 测试与验证

- 后端：reviews 路由单测（提交 / 一人一评去重 / 更新 / 删除 / 聚合计算 / 回退逻辑）
- 端到端：浏览器匿名评价 → 详情页聚合更新 → 我的评价页 → 修改/删除

## 8. 范围外（第二阶段）

- 注册登录账号体系（user_id 字段迁移）
- 评价图片上传（存储与风控）
- 评价内容审核 / 举报
- 用户评分对排行榜、专题榜排序的接入（综合分排序沿用官方分或后续切换）
