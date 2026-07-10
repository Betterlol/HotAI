# Phase 3.4 Dynamic Weight Adjustment (Success Rate) 完成总结

## 1. Stage 描述

在 Routing Engine 中新增成功率评分维度，根据渠道历史请求成功率动态调整权重，使路由能自动规避不稳定渠道。

## 2. Stage 元数据

- STAGE_ID: phase-3.4
- STAGE_TYPE: feature
- BASE_COMMIT: `9937321b`（Phase 3.3 fix）

## 3. 修改文件清单

### 新增文件
| 文件 | 行数 | 职责 |
|------|------|------|
| `pkg/channel_successrate/successrate.go` | 87 | per-channel 滑动窗口成功率跟踪器 |
| `pkg/channel_successrate/successrate_test.go` | 99 | 7 个测试用例 |
| `pkg/routing/success_rate.go` | 46 | `SuccessRateAdjustedWeight` + `FillSuccessRate` |
| `setting/operation_setting/success_rate_routing_setting.go` | 37 | 配置项定义 |

### 修改文件
| 文件 | 变更说明 |
|------|----------|
| `pkg/routing/score.go` | `ChannelData` 加 `SuccessRate` 字段，`ChannelScore` 加 `SuccessRateAdjustedWeight` |
| `pkg/routing/engine.go` | `Engine` 加 `successRateSetting`，`Calculate` 管道插入成功率评分 |
| `controller/relay.go` | 成功/失败路径调用 `channelsuccessrate.Record()` |
| `model/channel_cache.go` | `ChannelData` 构建后调用 `routing.FillSuccessRate()` |
| `pkg/routing/engine_test.go` | 新增 5 个成功率测试用例 |

## 4. 架构设计

### 数据流

```
controller/relay.go
  relay 完成 → circuit breaker + channelsuccessrate.Record(id, success)
  relay 失败 → circuit breaker + channelsuccessrate.Record(id, failure)
    │
    ▼
pkg/channel_successrate/
  内存 sliding window (5min)
  GetSuccessRate(channelID) → float64 [0,1] 或 -1(数据不足)
    │
    ▼
model/channel_cache.go
  FillSuccessRate(inputs) → 为每个 ChannelData 注入 SuccessRate
    │
    ▼
pkg/routing/engine.go
  Calculate()
    ├─ SuccessRateAdjustedWeight(costWeight, rate, setting)
    └─ FinalWeight = successRateWeight
```

### 成功率跟踪器

```go
pkg/channel_successrate/
  Record(channelID, success bool)    // 记录一次成功/失败
  GetSuccessRate(channelID) float64  // 查询 [0,1]，-1 表示数据不足
  ResetForTest()                     // 测试用
  SetWindowDuration(d time.Duration) // 测试用
  SetMinTotal(n int64)              // 测试用
```

实现：`sync.Map` keyed by channelID，每个 channel 独立 `{total, success, started}`，超过 window 时长自动重置。

### 评分公式

```
SuccessRateFactor (success_rate_routing_setting.enabled = true 时生效):
  data < min_samples → 1.0           (数据不足，不惩罚)
  ratio = successRate                (0~1, 100%=1, 50%=0.5)
  adjusted = (1 - weight_factor) + weight_factor × ratio
  SuccessRateAdjustedWeight = int(costWeight × adjusted)
```

### 完整管道

```
FinalWeight = BaseWeight × LatencyFactor × CostFactor × SuccessRateFactor × HealthFactor

各维度均为 [0,1] 区间的因子，关闭时 = 1.0（中性），
乘法组合确保多维度同时处罚时效果叠加。
```

## 5. 配置项

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enabled` | bool | `false` | 默认关闭，灰度启用 |
| `weight_factor` | float64 `[0,1]` | `0.3` | 成功率信号对权重的贡献度 |
| `window_minutes` | int | `5` | 滑动窗口时间（分） |
| `min_samples` | int | `10` | 最少请求数，不足时不调整 |

## 6. 测试结果

```
go test ./pkg/channel_successrate/ ./pkg/routing/ ./controller/ ./model/ ./... -count=1

所有包: PASS
```

### 新增测试

| 测试 | 验证内容 |
|------|----------|
| `TestRecordAndGetSuccessRate` | 全部成功 → rate=1.0 |
| `TestGetSuccessRatePartial` | 2/3 成功 → rate=2/3 |
| `TestGetSuccessRateInsufficientData` | 样本 < min_total → -1 |
| `TestGetSuccessRateNoRecords` | 无记录 → -1 |
| `TestGetSuccessRateZeroChannelID` | channelID<=0 → -1 |
| `TestWindowExpiration` | 窗口过期后重置 → -1 |
| `TestMultipleChannels` | 多 channel 独立追踪 |
| `TestEngineCalculateWithSuccessRate` | Engine 集成：高成功率 > 低成功率 |
| `TestSuccessRateAdjustedWeightDisabled` | 关闭时保持 baseWeight |
| `TestSuccessRateAdjustedWeightPenalizesLowRate` | 50% 成功 → weight × 0.5 |
| `TestSuccessRateAdjustedWeightInsufficientData` | -1 时保持 baseWeight |
| `TestSuccessRateAdjustedWeightBlendsWithFactor` | factor=0.3, rate=0.5 → weight × 0.85 |

## 7. 设计决策

### 为什么要新包，不复用 circuitbreaker？

| 维度 | circuitbreaker | channelsuccessrate |
|------|---------------|-------------------|
| 输出 | 二值（OPEN/CLOSED） | 连续值 [0,1] |
| 用途 | 完全阻止选择 | 调整权重，不阻止 |
| 数据可见性 | 私有（`windowCounts`） | 公开（`GetSuccessRate`） |
| 语义 | 熔断 = 不要用 | 评分 = 低分但可选 |

### 冷启动处理

数据不足（`total < min_samples`）时返回 `-1`，评分函数直接返回 baseWeight。确保新上线渠道不会被歧视。

## 8. 最终 git log

```
b286c101 [phase-3.4][feature] Dynamic weight adjustment via success rate scoring
```
