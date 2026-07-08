# 定价系统分析：ModelRatio/ModelPrice vs Ability.PricePerToken

## 1. 概述

New-API 中存在**两套完全独立的定价系统**，服务于不同的目的。理解这两套系统的关系是后续开发（成本路由、余额监控、价格同步）的基础。

---

## 2. 两套定价系统对比

| 维度 | ModelRatio / ModelPrice | Ability.PricePerToken / PricePerRequest |
|------|------------------------|-----------------------------------------|
| **用途** | **收用户多少钱**（计费/扣配额） | **上游收我们多少钱**（路由选择） |
| **作用域** | 系统全局，所有渠道共享 | 每个渠道独立 |
| **存储** | `setting/ratio_setting/` 内存 RWMap | 数据库 `channels` 表和 `abilities` 表 |
| **设置方式** | 管理员 UI → JSON 字符串 | 渠道编辑器 API / `channel-price-editor.py` |
| **消费位置** | `relay/helper/price.go` → `service/text_quota.go` → 最终用户扣费 | `model/channel_cache.go` → `pkg/routing/.cost.go` → 路由评分 |
| **是否可互相推导** | **不能** | |

### 2.1 关键区别

同一个 `gpt-4o` 的例子：

```
ModelRatio["gpt-4o"] = 1          ← 对所有用户都一样（卖价）
渠道 A: PriceMapping["gpt-4o"] = 0.01  ← 渠道 A 的买价
渠道 B: PriceMapping["gpt-4o"] = 0.02  ← 渠道 B 的买价（贵一倍）
```

成本路由比较的是**买价**（渠道 A vs 渠道 B），而 ModelRatio/ModelPrice 是**卖价**。两套系统独立存在，不可互相推导。

---

## 3. ModelRatio/ModelPrice 系统详解

### 3.1 数据存储

位于 `setting/ratio_setting/` 目录，共 6 个文件。所有映射均为 `types.RWMap[string, float64]` — 线程安全的泛型映射，支持 JSON 序列化。

**核心映射：**

| 映射 | 文件 | 语义 |
|------|------|------|
| `modelRatioMap` | `model_ratio.go:321` | 每个模型的比率；`1 = $0.002/1K tokens` |
| `modelPriceMap` | `model_ratio.go:320` | 每次调用的价格（非 token 端点） |
| `completionRatioMap` | `model_ratio.go:322` | 输出/输入价格乘数 |
| `groupRatioMap` | `group_ratio.go:18` | 用户组倍率 |
| `cacheRatioMap` | `cache_ratio.go:127` | 缓存命中折扣 |
| `imageRatioMap` | `model_ratio.go:653` | 图像 token 倍率 |
| `audioRatioMap` | `model_ratio.go:654` | 音频输入倍率 |

**持久化方式：** 管理员通过 UI 编辑 JSON 字符串 → `types.LoadFromJsonStringWithCallback()` 解析并存入全局 RWMap。没有数据库表，完全在内存中管理。

**默认值：** `setting/ratio_setting/model_ratio.go:26-266` 硬编码了约 240 个模型的默认 ratio，在 `InitRatioSettings()` 时加载。

### 3.2 计费公式

两个互斥模式，由 `usePrice` 标志控制：

#### 模式 A：基于 ModelPrice（非 token 端点）

```go
quota = ModelPrice * QuotaPerUnit * GroupRatio
// 用于: dall-e, midjourney, suno, sora 等
```

#### 模式 B：基于 ModelRatio（token 端点）

```go
promptQuota     = baseTokens + cachedTokens*cacheRatio + imageTokens*imageRatio
completionQuota = completionTokens * completionRatio
quota           = (promptQuota + completionQuota) * ModelRatio * GroupRatio
// 用于: 聊天、补全、嵌入等
```

#### 模式 C：TieredExpr（分层表达式）

```go
quotaBeforeGroup = exprOutput / 1_000_000 * QuotaPerUnit
// 使用 pkg/billingexpr/ 引擎
```

### 3.3 核心常量

```go
QuotaPerUnit = 500_000  // 1 美元 = 500,000 配额
```

含义：`$0.002 / 1K tokens` → `ModelRatio = 1` → 1K tokens 消耗 1,000 配额 → 价值 $0.002。

---

## 4. Ability.PricePerToken 系统详解（成本路由）

### 4.1 数据模型

**`model/channel.go`** 相关字段：

```go
type Channel struct {
    PricePerToken   *float64 `json:"price_per_token"`   // 渠道默认 per-token 价格
    PricePerRequest *float64 `json:"price_per_request"`  // 渠道默认 per-request 价格
    PriceMapping    *string  `json:"price_mapping" gorm:"type:text"`  // 逐模型覆盖（JSON）
}
```

**`model/ability.go`** 相关字段：

```go
type Ability struct {
    // (Group, Model, ChannelId) 联合主键
    PricePerToken   *float64 `json:"price_per_token"`
    PricePerRequest *float64 `json:"price_per_request"`
}

func (ability *Ability) RoutingCost() float64 {
    return routingCost(ability.PricePerToken, ability.PricePerRequest)
}
```

### 4.2 价格查找链（`model/channel_cache.go`）

```
costForChannel(group, model, channel):
  1. channelCostIndex[group][model][channelId]  // 从 Ability 表构建的缓存
  2. fallback: routingCost(channel.PricePerToken, channel.PricePerRequest)
```

注意：**从不查询 ModelRatio 或 ModelPrice**。

### 4.3 PriceMapping 格式

```json
{
  "gpt-4o":      {"price_per_token": 0.01, "price_per_request": 0},
  "gpt-4o-mini": {"price_per_token": 0.005, "price_per_request": 0}
}
```

`getModelPrice()`（`model/ability.go:215`）优先读 `PriceMapping` 中的模型级价格，没有再退到渠道默认价。

---

## 5. FetchUpstreamRatios 详解

### 5.1 数据来源

位于 `controller/ratio_sync.go`，支持 4 种上游数据格式：

#### 类型 1：`/api/ratio_config`（内部 peer-to-peer）

包含 `model_ratio`、`completion_ratio`、`cache_ratio`、`model_price` 等键值对。直接写入 RWMap。

#### 类型 2：`/api/pricing`（内部 peer-to-peer）

Pricing 对象数组：
```go
{
    model_name: "gpt-4o",
    quota_type: 0,  // 0=per-token ratio, 1=per-call price
    model_ratio: 1,
    model_price: 0,
    completion_ratio: 1,
    cache_ratio: 0,
    image_ratio: 0,
    audio_ratio: 0,
    billing_mode: "",
    billing_expr: ""
}
```

解包到各映射后重新组装。

#### 类型 3：OpenRouter `/v1/models`

`convertOpenRouterToRatioData()`（`ratio_sync.go:724`）

OpenRouter API 返回包含 `pricing` 字段的模型列表：

```json
{
  "id": "deepseek/deepseek-chat",
  "pricing": {
    "prompt": 0.0000015,     // $/token
    "completion": 0.000002,  // $/token
    "image": 0,
    "request": 0
  }
}
```

**当前转换（→ ModelRatio）：**
```go
model_ratio = prompt_price * 1000 * USD
// 其中 USD = 500
// = 0.0000015 * 1000 * 500 = 0.75
```

**我们可以做（→ PriceMapping）：**
```go
price_per_token = prompt_price  // 直接用原始值
// = 0.0000015
```

#### 类型 4：models.dev `/api.json`

`convertModelsDevToRatioData()`（`ratio_sync.go:906`）

```json
{
  "provider": "DeepSeek",
  "model": "deepseek-chat",
  "inputCost": 0.15,   // $/1M tokens
  "outputCost": 0.3    // $/1M tokens
}
```

**当前转换（→ ModelRatio）：**
```go
model_ratio = inputCost * USD / 1000
// = 0.15 * 500 / 1000 = 0.075
```

**我们可以做（→ PriceMapping）：**
```go
price_per_token = inputCost / 1_000_000  // 转成 per-token 单位
// = 0.15 / 1000000 = 0.00000015
```

### 5.2 同步结果对比

| 上游 | 当前产出（ModelRatio/ModelPrice） | 潜在产出（PricePerToken） |
|------|----------------------------------|--------------------------|
| OpenRouter | `model_ratio = prompt_price × 500,000` | `price_per_token = prompt_price` |
| models.dev | `model_ratio = inputCost × 500 / 1000` | `price_per_token = inputCost / 1_000_000` |
| 官方预置 | `model_ratio` 直接 | 需要额外处理 |

---

## 6. 两套系统数据流对比图

```
┌─────────────────────────────────────────────────────────────┐
│                      上游定价数据                             │
│  (OpenRouter / models.dev / 官方预置 / P2P 同步)            │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌─────────────────┐   ┌──────────────────────┐
│ ModelRatio/Price │   │ PricePerToken/Request│
│ (系统级，卖价)   │   │ (渠道级，买价)       │
├─────────────────┤   ├──────────────────────┤
│ 当前已实现       │   │ 尚未实现自动填充      │
│ FetchUpstream-   │   │                      │
│ Ratios → RWMap   │   │ 当前只能 by:         │
│ → billing        │   │ 1. 手动 API PUT      │
│                  │   │ 2. channel-price-     │
│                  │   │    editor.py 脚本     │
└─────────────────┘   └──────────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────┐   ┌──────────────────────┐
│ relay/helper/   │   │ pkg/routing/.cost.go │
│ price.go →      │   │ → channel_cache.go   │
│ 最终用户扣费     │   │ → 路由评分           │
└─────────────────┘   └──────────────────────┘
```

---

## 7. 余额监控系统

### 7.1 现有基础设施

位于 `controller/channel-billing.go`，是独立于定价系统的能力。

**已实现的供应商余额查询：**

| 供应商 | 端点 | 行号 |
|--------|------|------|
| OpenAI-compatible | `GET /v1/dashboard/billing/subscription` + `/usage` | 359 |
| CloseAI | `GET /dashboard/billing/credit_grants` | 169 |
| OpenAI-SB | `GET /sb-api/user/status` | 185 |
| AIProxy | `GET /aiproxy.io/api/report/getUserOverview` | 207 |
| API2GPT | `GET /dashboard/billing/credit_grants` | 227 |
| SiliconFlow | `GET /v1/user/info` | 243 |
| DeepSeek | `GET https://api.deepseek.com/user/balance` | 265 |
| AIGC2D | `GET /dashboard/billing/credit_grants` | 294 |
| OpenRouter | `GET /v1/credits` | 309 |
| Moonshot | `GET /v1/users/me/balance` | 325 |

**未实现的供应商（"尚未实现"）：** Azure、Anthropic、Baidu、Zhipu、Ali、Xunfei、360、Gemini、Perplexity、LingYiWanWu、AWS、Cohere、MiniMax、Dify、Jina、Cloudflare、Vertex、Mistral、MokaAI、VolcEngine、BaiduV2、Xinference、xAI、Coze、AdvancedCustom 等（约 30+ 类型）。

### 7.2 现有功能

- `Channel.Balance` 字段（`model/channel.go:37`，单位 USD）
- `Channel.BalanceUpdatedTime`（`model/channel.go:38`）
- `router/channel-router.go:48`: `GET /api/channel/update_balance`（全量刷新）
- `router/channel-router.go:49`: `GET /api/channel/update_balance/:id`（单渠道刷新）
- `controller/channel-billing.go:498`: `AutomaticallyUpdateChannels(frequency)` 定期 goroutine 自动刷新
- 余额 ≤ 0 时自动禁用渠道

---

## 8. 关系与结论

### 8.1 两套定价系统的关系

**ModelRatio/ModelPrice 和 Ability.PricePerToken 服务于不同目的，不可互相替代：**

| | ModelRatio/ModelPrice | Ability.PricePerToken |
|---|---|---|
| 回答的问题 | "这个模型收用户多少钱？" | "这个渠道买这个模型多少钱？" |
| 变化因素 | 运营定价策略 | 上游供应商定价、折扣、合同 |
| 跨渠道 | 系统全局固定 | 每个渠道可能不同 |

这也是为什么 Phase 3.1 成本路由不是多余实现——它解决的是 ModelRatio 系统从未设计解决的问题。

### 8.2 自动填充的可行性

**可以**从 FetchUpstreamRatios 的原始数据中提取每 token 美元价格，转换为渠道级 `PriceMapping`：

```
OpenRouter:   prompt_price ($/token) → PriceMapping[model].price_per_token
models.dev:   inputCost / 1,000,000   → PriceMapping[model].price_per_token
```

**但需要解决映射问题：** 上游数据中的 provider 名称（如 `"deepseek"`、`"openai"`）需要映射到内部 `ChannelType` 常量（如 `43`、`1`）。

### 8.3 与余额监控的关系

两个方向共享同一个基础设施需求——与上游供应商通信获取元数据——但它们解决不同的问题：
- **定价同步** = 知道每个模型多少钱（配置时，一次性）
- **余额监控** = 知道账户还剩多少钱（运行时，持续性）

两者可以共享供应商端点映射，但实现是独立的。

---

## 9. 参考资料

| 文件 | 内容 |
|------|------|
| `setting/ratio_setting/model_ratio.go` | ModelRatio/ModelPrice 数据结构和默认值 |
| `setting/ratio_setting/group_ratio.go` | GroupRatio 实现 |
| `setting/ratio_setting/cache_ratio.go` | CacheRatio 实现 |
| `relay/helper/price.go` | ModelPriceHelper 计费入口 |
| `service/text_quota.go` | 配额计算链 |
| `controller/ratio_sync.go` | FetchUpstreamRatios 上游定价同步 |
| `model/ability.go` | Ability 模型和 RoutingCost |
| `model/channel.go` | Channel 价格字段 |
| `model/channel_cache.go` | costForChannel 查找链 |
| `pkg/routing/cost.go` | 成本路由评分函数 |
| `controller/channel-billing.go` | 余额查询基础设施 |
| `scripts/sh/channel-price-editor.py` | 手动价格编辑脚本 |
| `controller/channel_upstream_update.go` | 上游模型列表同步 |
| `constant/channel.go` | 渠道类型常量 |
