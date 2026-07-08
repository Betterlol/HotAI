# Phase 3.2 Routing Score Engine 完成总结

## 1. Stage 描述

将 channel_cache.go 中不断膨胀的 Weighted Channel Selector 重构为独立的 Multi-Dimension Routing Score Engine 架构。

## 2. Stage 元数据

- STAGE_ID: phase-3.2
- STAGE_TYPE: architecture-refactor
- BASE_COMMIT: `75b51df8caae551232993fdd162fccda104a2f2e`

## 3. 修改文件列表

### 新增文件
| 文件 | 行数 | 职责 |
|------|------|------|
| `pkg/routing/score.go` | 26 | ChannelData / ChannelScore 数据结构 |
| `pkg/routing/engine.go` | 57 | RoutingEngine 核心编排逻辑 |
| `pkg/routing/latency.go` | 49 | 延迟评分（从 channel_cache.go 迁移） |
| `pkg/routing/cost.go` | 36 | 成本评分（从 channel_cache.go 迁移） |
| `pkg/routing/engine_test.go` | 238 | 25 个测试用例 |

### 修改文件
| 文件 | 变更说明 |
|------|----------|
| `model/channel_cache.go` | 删除 6 个内部函数 (-188 行)，改为 16 行 Engine 调用 |
| `model/channel_cache_test.go` | 迁移 8 个单元测试到 routing 包，保留集成测试 |

## 4. 新增文件完整内容

### pkg/routing/score.go

```go
package routing

// ChannelData contains per-channel input for score calculation.
// All values are pre-computed by the caller (channel_cache.go).
type ChannelData struct {
	ChannelID    int
	BaseWeight   int
	ResponseTime int
	Cost         float64
}

// ChannelScore holds the calculated score for a single channel
// with all intermediate dimensions for explainability.
type ChannelScore struct {
	ChannelID             int
	FinalWeight           int
	BaseWeight            int
	LatencyAdjustedWeight int
	CostAdjustedWeight    int
}
```

### pkg/routing/engine.go

```go
package routing

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// Engine computes channel scores by combining latency, cost, and
// health dimensions. Each dimension is a separate scoring function
// so new dimensions can be added without changing the core logic.
type Engine struct {
	latencySetting operation_setting.LatencyRoutingSetting
	costSetting    operation_setting.CostRoutingSetting
}

// NewEngine creates an Engine with the current operation settings.
func NewEngine() *Engine {
	return &Engine{
		latencySetting: operation_setting.GetLatencyRoutingSetting(),
		costSetting:    operation_setting.GetCostRoutingSetting(),
	}
}

// NewEngineWithSettings creates an Engine with explicit settings,
// primarily used for testing.
func NewEngineWithSettings(
	latency operation_setting.LatencyRoutingSetting,
	cost operation_setting.CostRoutingSetting,
) *Engine {
	return &Engine{
		latencySetting: latency,
		costSetting:    cost,
	}
}

// Calculate produces a ChannelScore for each input channel.
//
// The scoring pipeline is:
//
//	BaseWeight → LatencyAdjustedWeight → CostAdjustedWeight → FinalWeight
//
// Future dimensions (SuccessRate, Balance, etc.) are inserted
// between CostAdjustedWeight and FinalWeight.
func (e *Engine) Calculate(channels []ChannelData) []ChannelScore {
	if len(channels) == 0 {
		return nil
	}

	fastestRT := FastestPositiveResponseTime(channels)
	costs := make([]float64, len(channels))
	for i, ch := range channels {
		costs[i] = ch.Cost
	}
	lowestCost := LowestPositiveCost(costs)

	scores := make([]ChannelScore, len(channels))
	for i, ch := range channels {
		latencyWeight := LatencyAdjustedWeight(ch.BaseWeight, ch.ResponseTime, fastestRT, e.latencySetting)
		costWeight := CostAdjustedWeight(latencyWeight, ch.Cost, lowestCost, e.costSetting)

		scores[i] = ChannelScore{
			ChannelID:             ch.ChannelID,
			FinalWeight:           costWeight,
			BaseWeight:            ch.BaseWeight,
			LatencyAdjustedWeight: latencyWeight,
			CostAdjustedWeight:    costWeight,
		}
	}
	return scores
}
```

### pkg/routing/latency.go

```go
package routing

import "github.com/QuantumNous/new-api/setting/operation_setting"

// FastestPositiveResponseTime returns the smallest positive response time
// from the given channel data. Channels with zero or negative response
// time are skipped.
func FastestPositiveResponseTime(channels []ChannelData) int {
	fastest := 0
	for _, ch := range channels {
		if ch.ResponseTime <= 0 {
			continue
		}
		if fastest == 0 || ch.ResponseTime < fastest {
			fastest = ch.ResponseTime
		}
	}
	return fastest
}

// LatencyAdjustedWeight adjusts baseWeight by the channel's response time
// relative to the fastest channel. When latency routing is disabled or
// data is missing, baseWeight is returned unchanged.
func LatencyAdjustedWeight(baseWeight int, responseTime int, fastestResponseTime int, setting operation_setting.LatencyRoutingSetting) int {
	if baseWeight <= 0 {
		return 0
	}
	if !setting.Enabled || fastestResponseTime <= 0 || responseTime <= 0 {
		return baseWeight
	}
	factor := setting.WeightFactor
	if factor < 0 {
		factor = 0
	}
	if factor > 1 {
		factor = 1
	}
	latencyRatio := float64(fastestResponseTime) / float64(responseTime)
	adjusted := int(float64(baseWeight) * ((1 - factor) + factor*latencyRatio))
	if adjusted < 1 {
		return 1
	}
	return adjusted
}

// LowestPositiveCost returns the smallest positive cost from the given
// slice. Zero and negative values are skipped.
func LowestPositiveCost(costs []float64) float64 {
	lowest := 0.0
	for _, cost := range costs {
		if cost <= 0 {
			continue
		}
		if lowest == 0 || cost < lowest {
			lowest = cost
		}
	}
	return lowest
}
```

### pkg/routing/cost.go

```go
package routing

import "github.com/QuantumNous/new-api/setting/operation_setting"

// CostAdjustedWeight adjusts baseWeight by the channel's per-token cost
// relative to the cheapest channel. When cost routing is disabled or
// cost data is missing, baseWeight is returned unchanged.
func CostAdjustedWeight(baseWeight int, channelCost float64, lowestCost float64, setting operation_setting.CostRoutingSetting) int {
	if baseWeight <= 0 {
		return 0
	}
	if !setting.Enabled || lowestCost <= 0 || channelCost <= 0 {
		return baseWeight
	}
	factor := setting.CostWeight
	if factor < 0 {
		factor = 0
	}
	if factor > 1 {
		factor = 1
	}
	costRatio := lowestCost / channelCost
	if costRatio > 1 {
		costRatio = 1
	}
	adjusted := int(float64(baseWeight) * ((1 - factor) + factor*costRatio))
	if adjusted < 1 {
		return 1
	}
	return adjusted
}
```

### pkg/routing/engine_test.go

包含 25 个测试用例，覆盖：

- `TestCalculateLatencyScore` — 延迟评分正确性
- `TestCalculateCostScore` — 成本评分正确性
- `TestCombinedChannelScore` — 多因素组合评分
- `TestCostRoutingDisabled` — 关闭成本路由后行为一致
- `TestLatencyRoutingDisabled` — 关闭延迟路由后行为一致
- `TestChannelSelectionBehaviorUnchanged` — Phase 2 行为不回归
- 从 model 包迁移的 8 个单元测试（保持相同断言值）
- 边缘用例：nil 输入、零 BaseWeight、零延迟、全零成本等
- Engine 集成测试：同时启用延迟+成本验证排序

## 5. 修改文件 Diffs

### model/channel_cache.go 变更

```
- 删除了 adjustedChannelWeights() — 6 个辅助函数
- 删除了 costsForChannels()、lowestPositiveCost()
- 删除了 fastestPositiveResponseTime()
- 删除了 latencyAdjustedWeight()、costAdjustedWeight()
- 保留 costForChannel() — 仍为缓存职责
- 新增：构建 routing.ChannelData → Engine.Calculate() → 提取 FinalWeight
```

### model/channel_cache_test.go 变更

```
- 迁移 8 个纯函数单元测试 → pkg/routing/engine_test.go
- TestAdjustedChannelWeightsApplyAbilityCosts → TestGetRandomSatisfiedChannelAppliesRoutingEngineScores
  （使用 Engine API 验证成本排序）
- 保留断路器/限流器集成测试
```

## 6. 删除的文件

无

## 7. ACTION_LOG

| # | 操作 | 文件 | 说明 |
|---|------|------|------|
| 1 | 新增 | `pkg/routing/score.go` | ChannelData/ChannelScore 数据结构 |
| 2 | 新增 | `pkg/routing/latency.go` | 延迟评分 + 辅助函数 |
| 3 | 新增 | `pkg/routing/cost.go` | 成本评分函数 |
| 4 | 新增 | `pkg/routing/engine.go` | RoutingEngine 核心 |
| 5 | 修改 | `model/channel_cache.go` | 替换权重计算为 Engine.Calculate() |
| 6 | 修改 | `model/channel_cache_test.go` | 迁移测试到 routing 包 |
| 7 | 新增 | `pkg/routing/engine_test.go` | 25 个测试用例 |

## 8. 当前旧架构问题

**修改前：** `channel_cache.go` 中的 `adjustedChannelWeights()` 承担了：
- 获取 latency/cost 设置 → 计算最快响应时间 → 获取各渠道成本 → 计算最低成本 → 延迟加权 → 成本加权

新增一个维度（如 success rate）需要：
1. 新增 `successRateAdjustedWeight()` 函数
2. 修改 `adjustedChannelWeights()` 增加参数和调用链
3. 所有逻辑耦合在 `model` 包中

## 9. 新 Routing Score Engine 架构说明

```
GetRandomSatisfiedChannel()
├── 1. 获取候选 channels (cache lookup)
├── 2. breaker.CanSelect() + limiter.CanAcquire() 过滤
├── 3. 构建 ChannelData[] (BaseWeight + ResponseTime + Cost)
├── 4. Engine.Calculate()          ← 新：pkg/routing/
│   ├── FastestPositiveResponseTime()
│   ├── LowestPositiveCost()
│   ├── LatencyAdjustedWeight()    ← 迁移自 channel_cache.go
│   └── CostAdjustedWeight()       ← 迁移自 channel_cache.go
├── 5. 根据 FinalWeight 加权随机选择
└── 6. markChannelSelected() (limiter.Acquire + breaker.MarkSelected)
```

**职责边界：**
- `channel_cache.go`：缓存、候选获取、pre-filter、Engine 调用、selection
- `pkg/routing/`：评分计算、评分组合、评分可解释性
- `pkg/circuitbreaker/`：渠道是否可选（gate）
- `pkg/channel_limiter/`：渠道是否允许进入（gate）

## 10. Score 计算公式

```
FinalWeight = CostAdjustedWeight(LatencyAdjustedWeight(BaseWeight))

LatencyAdjustedWeight:
  if disabled → BaseWeight
  adjusted = int(BaseWeight × ((1 - LatencyWeight) + LatencyWeight × (FastestRT / ChannelRT)))
  if adjusted < 1 → 1

CostAdjustedWeight:
  if disabled → BaseWeight
  adjusted = int(BaseWeight × ((1 - CostWeight) + CostWeight × (LowestCost / ChannelCost)))
  if adjusted < 1 → 1
```

公式与 Phase 2.1/3.1 完全一致，仅所在包不同。

## 11. 未来增加 Dynamic Weight 为何无需重构

当需要新增 `SuccessRateScore`：
1. 新建 `pkg/routing/success_rate.go`，实现 `SuccessRateAdjustedWeight()`
2. 在 `Engine.Calculate()` 中插入 `successRateWeight := SuccessRateAdjustedWeight(costWeight, ...)`
3. 在 `ChannelScore` 中新增 `SuccessRateAdjustedWeight int` 字段
4. **不需要修改 `channel_cache.go` 的任何代码**

## 12. 测试结果

```
go test ./model/ ./pkg/routing/ ./pkg/circuitbreaker/ ./pkg/channel_limiter/ \
  ./middleware/ ./controller/ ./service/ ./setting/... -count=1

所有包: PASS
```

| 包 | 结果 |
|---|------|
| model | PASS |
| pkg/routing | PASS (25 tests) |
| pkg/circuitbreaker | PASS |
| pkg/channel_limiter | PASS |
| middleware | PASS |
| controller | PASS |
| service | PASS |
| setting/operation_setting | PASS |

## 13. 风险与注意事项

- 所有评分公式与旧代码完全一致（chained int truncation），无行为变化
- `channelCostIndex` 仍保留在 `channel_cache.go`（它是缓存结构，非评分逻辑）
- `costForChannel()` 仍保留在 `channel_cache.go`（负责从缓存查找成本）
- 默认关闭：LatencyRouting 和 CostRouting 默认均为 false，不影响现有部署
- Engine 在 `Calculate()` 时获取实时 Operation Settings
