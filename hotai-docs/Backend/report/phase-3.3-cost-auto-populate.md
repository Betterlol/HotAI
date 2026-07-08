# Phase 3.3 Cost Auto-Populate 完成总结

## 1. Stage 描述

实现成本自动填充功能：将系统级 `ModelRatio`/`ModelPrice` 定价数据通过 ModelMapping 解析后，以上游模型名作为 key 写入渠道的 `PriceMapping`，使成本路由能够区分不同渠道的真实上游成本。

## 2. Stage 元数据

- STAGE_ID: phase-3.3
- STAGE_TYPE: feature
- BASE_COMMIT: `c41d5082`（Phase 3.2 Routing Score Engine）

## 3. 修改文件列表

### 新增文件
| 文件 | 行数 | 职责 |
|------|------|------|
| `controller/channel_pricing_sync.go` | 183 | 核心同步逻辑 + `resolveModelMapping` 辅助函数 |

### 修改文件
| 文件 | 变更说明 |
|------|----------|
| `router/channel-router.go` | +2 行：注册两条新路由 |
| `model/ability.go` | +`resolveUpstreamModel`（链式解析 + 循环检测），`getModelPrice` 改用上游模型名查 PriceMapping |

## 4. 关键修复记录

### v1 Bug：系统 ModelRatio 全局统一，无法区分渠道间成本差异

**问题：** 通过系统 `ModelRatio` 推导价格，所有渠道对同一模型得到相同定价，成本路由无法发挥作用。

### v2 Bug：PriceMapping 使用用户外部名做 key，与成本路由查询不匹配

**问题：** `PriceMapping` 以用户外部名（如 `"gpt-4o"`）为 key 存储，成本路由查询时 `getModelPrice(channel, model)` 中的 `model` 也是外部名。当渠道有 ModelMapping（如 `{"gpt-4o": "gpt-4o-2024-08-06"}`）时两者一致，但实际应以上游模型名为 key，因为：

- 成本与上游模型关联（支付的是上游价格）
- 不同渠道对同一外部名可能映射到不同上游模型
- 同一上游模型名可能被多个外部名指向

**修复：** 统一使用上游模型名作 `PriceMapping` 的 key，sync 和查询都通过 ModelMapping 解析：

```
sync 时:  "gpt-4o" → ModelMapping → "gpt-4o-2024-08-06" → PriceMapping key = "gpt-4o-2024-08-06"
查询时:  getModelPrice(ch, "gpt-4o") → resolveUpstreamModel → "gpt-4o-2024-08-06" → PriceMapping["gpt-4o-2024-08-06"]
```

## 5. 核心架构

### 数据流

```
ModelRatio / ModelPrice（系统全局定价）
    ↓
syncChannelPricing(channel)
    ├─ resolveModelMapping(channel)
    ├─ 对每个 modelName:
    │     ├─ 有 ModelMapping → 用上游模型名
    │     └─ 无 ModelMapping → 直接用外部名
    ├─ 在 ModelRatio/ModelPrice 中查找上游模型
    └─ 写入 PriceMapping（key = 上游模型名）
    ↓
channel.PriceMapping = {"gpt-4o-2024-08-06": {"price_per_token": 0.000002}, ...}
    ↓
getModelPrice(channel, "gpt-4o")
    ├─ resolveUpstreamModel("gpt-4o") → "gpt-4o-2024-08-06"
    ├─ PriceMapping["gpt-4o-2024-08-06"] → price_per_token
    └─ → routingCost() → 成本路由比较
```

### 核心函数

| 函数 | 位置 | 职责 |
|------|------|------|
| `syncChannelPricing()` | `controller/channel_pricing_sync.go` | 遍历渠道模型，构建 PriceMapping |
| `resolveModelMapping()` | `controller/channel_pricing_sync.go` | 解析 `channel.ModelMapping` JSON → `map[string]string` |
| `resolveUpstreamModel()` | `model/ability.go` | 链式解析 ModelMapping，深度 ≤ 10（防循环） |
| `getModelPrice()` | `model/ability.go` | 先解析上游模型名，再查 PriceMapping |

## 6. API 端点

| 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|
| POST | `/api/channel/:id/sync_pricing` | ChannelOperate | 同步单个渠道定价 |
| POST | `/api/channel/sync_pricing` | ChannelOperate | 同步所有渠道定价 |

## 7. 测试结果

```
go test ./controller/ ./router/ ./model/ ./pkg/... ./middleware/ ./service/ ./setting/... -count=1

所有包: PASS
```

| 包 | 结果 |
|---|------|
| controller | PASS |
| router | PASS |
| model | PASS |
| pkg/routing | PASS |
| pkg/circuitbreaker | PASS |
| pkg/channel_limiter | PASS |
| middleware | PASS |
| service | PASS |
| setting/... | PASS |

## 8. 最终 git log

```
9937321b [phase-3.3][fix] PriceMapping keyed by upstream model name
c17a55ed [phase-3.3][feature] Cost Auto-Populate: sync system ModelRatio...
```
