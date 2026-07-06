# HotAI 智能路由策略设计

## 1. 设计目标

在 New API 现有静态路由（Priority + Weight）基础上，增加**动态决策**能力，使路由选择不再仅依赖管理员手动配置，而是能根据渠道的实时健康状态、延迟、成本和历史表现自动做出最优选择。

## 2. 路由决策流程（HotAI 增强版）

```
用户请求
  │
  ▼
现有路径: Token 绑定 → Affinity 命中 → CacheGetRandomSatisfiedChannel
                                                   │
                                                   ▼
                                    ┌─────────────────────────────┐
                                    │   HotAI 增强选择层            │
                                    │                              │
                                    │  候选渠道列表 (同 Priority)    │
                                    │     │                        │
                                    │     ▼                        │
                                    │  Phase 1: 熔断过滤            │
                                    │  ──────────────────          │
                                    │  排除滑动窗口错误率 > 阈值    │
                                    │  排除半开状态 (按比例放行)    │
                                    │                              │
                                    │  Phase 2: 健康评分            │
                                    │  ──────────────────          │
                                    │  评分 = f(延迟, 成本,         │
                                    │         成功率, 余额)         │
                                    │                              │
                                    │  Phase 3: 加权随机            │
                                    │  ──────────────────          │
                                    │  按评分加权随机选择            │
                                    │                              │
                                    └─────────────────────────────┘
```

## 3. 熔断器设计 (Circuit Breaker)

### 3.1 状态模型

```
                  ┌──────────┐
         ┌──────►│  CLOSED   │◄───────┐
         │       │  (正常)   │        │
         │       └─────┬─────┘        │
         │             │              │
         │     错误率 > 阈值           │
         │             │       错误率 < 阈值
         │             ▼              │
         │       ┌──────────┐         │
         │       │   OPEN   │─────────┘
         │       │ (断开)   │
         │       └─────┬─────┘
         │             │
         │      超时后进入
         │             │
         │             ▼
         │       ┌──────────┐
         └───────│ HALF-OPEN│
                 │ (半开)   │
                 └──────────┘
```

### 3.2 滑动窗口

- 窗口长度：60 秒（可配）
- 桶粒度：10 秒（6 个桶组成滑动窗口）
- 窗口内总请求数 ≥ 10 时才触发熔断评估

### 3.3 触发条件

| 参数 | 默认值 | 范围 | 说明 |
|------|--------|------|------|
| `error_threshold` | 50% | 0-100 | 窗口内错误率 > 此值 → OPEN |
| `min_request_count` | 10 | 1-∞ | 窗口内请求数 ≥ 此值才评估 |
| `open_timeout_ms` | 30000 | 1000-∞ | OPEN 状态持续时间，过后 → HALF-OPEN |
| `half_open_max_requests` | 3 | 1-10 | HALF-OPEN 状态下最大放行请求数 |
| `half_open_success_threshold` | 2 | 1-5 | HALF-OPEN 内连续成功数 ≥ 此值 → CLOSED |

### 3.4 实现位置

- 新增 `pkg/circuitbreaker/` 包
- 每个 Channel 一个 breaker 实例
- 在 `channel_cache.go:GetRandomSatisfiedChannel()` 过滤阶段调用 `breaker.Allow()`
- 在 `controller/relay.go` 的 `processChannelError()` / 成功路径调用 `breaker.MarkSuccess()` / `breaker.MarkFailure()`

### 3.5 数据结构

```go
type ChannelBreaker struct {
    mu            sync.RWMutex
    state         BreakerState           // CLOSED / OPEN / HALF-OPEN
    window        *slidingWindow         // 滑动窗口
    openStartedAt int64                  // 进入 OPEN 的时间戳
    
    // 配置（从 Option 表加载）
    errorThreshold         float64
    minRequestCount        int64
    openTimeoutMs          int64
    halfOpenMaxRequests    int
    halfOpenSuccessCount   int
}

type slidingWindow struct {
    buckets [6]windowBucket   // 60s / 6 = 10s per bucket
    curIdx  int
    curTs   int64
}

type windowBucket struct {
    requestCount int64
    errorCount   int64
}
```

## 4. 延迟感知路由

### 4.1 设计

Channel 已有 `ResponseTime int` 字段（毫秒），当前主要由手动/定时渠道测试更新。延迟感知路由第一版先使用该字段作为保守信号，在**同 Priority 层内**调整选择概率。

> 数据来源校准：如果后续希望使用真实业务请求延迟，而不是渠道测试延迟，需要在 relay 成功/失败记录中补充 `channel_id` 维度，或在请求结束时按渠道更新独立的延迟统计。不要直接假设现有 `perf_metrics` 已经具备渠道级时间序列。

### 4.2 算法

```
在同 Priority 层内:
  1. 收集所有候选渠道的 ResponseTime
  2. 计算延迟得分: latencyScore = min(1, baseLatency / max(channel.ResponseTime, 1))
     其中 baseLatency = 候选渠道中最小的 ResponseTime（最快渠道得分 = 1）
     较慢渠道得分 < 1，线性衰减；ResponseTime 为空或为 0 时按中性得分处理
  3. 最终权重 = 配置权重 × 延迟得分 × 成功率系数
```

### 4.3 实现位置

修改 `model/channel_cache.go:GetRandomSatisfiedChannel()`，在 `targetPriority` 层内选择时增加延迟加权逻辑。

### 4.4 配置项

```go
type LatencyAwareRoutingConfig struct {
    Enabled       bool    // 是否启用（默认 false，向后兼容）
    WeightFactor  float64 // 延迟对最终权重的贡献度 (0-1, 默认 0.3)
    BaseLatencyMs int64   // 基准延迟 (默认 1000ms)
}
```

## 5. 成本感知路由

### 5.1 数据模型扩展

在 `Ability` 表或渠道级新增成本字段：

```go
// 方案 A: 扩展 Ability 表（推荐，因为定价可能按分组+模型+渠道变化）
type Ability struct {
    // ...现有字段
    PricePerToken  *float64 `json:"price_per_token"`  // 每 token 单价 (USD)
    PricePerRequest *float64 `json:"price_per_request"` // 每次请求固定费用 (USD)
}

// 方案 B: 扩展 Channel 表
type Channel struct {
    // ...现有字段
    PricePerToken  *float64 `json:"price_per_token"`
    PricePerRequest *float64 `json:"price_per_request"`
}
```

> 价格体系校准：New API 已有模型倍率、分组倍率、缓存倍率和表达式计费能力。成本感知路由中的价格字段只用于“渠道选择评分”，不能替代最终计费。实现时需要明确优先级：优先读取现有计费配置可推导出的渠道成本；只有无法表达渠道差异时，再扩展 `Ability` 或 `Channel` 的成本字段。

### 5.2 选择算法

在同 Priority + 延迟评分后，进一步按成本加权：

```
costScore = minPrice / channelPrice
  其中 minPrice = 候选渠道中的最低单价
  最便宜的渠道 costScore = 1，其他 < 1

最终权重 = 配置权重 × 延迟得分 × 成本得分 × 成功率系数
```

### 5.3 配置

```go
type CostAwareRoutingConfig struct {
    Enabled      bool    // 默认 false
    CostWeight   float64 // 成本权重 (0-1, 默认 0.2)
}
```

## 6. 动态权重调整

### 6.1 设计

不是取代管理员配置的 Weight，而是**在运行时微调**选择概率。每轮缓存同步时，根据历史表现自动调整。

### 6.2 算法

```
per-channel weight_adjustment:
  1. 取过去 1 小时的性能数据（从渠道级指标 + ResponseTime）
  2. 计算:
     - successRate = 成功率
     - avgLatency  = 平均延迟
     - penalty     = (1 - successRate) * 100 + (avgLatency / baseLatency) * 10
  3. 调整系数 = max(0.1, 1.0 - penalty)
  4. 有效权重 = 配置权重 × 调整系数
```

### 6.3 实现位置

- 修改 `InitChannelCache()` / `SyncChannelCache()`，在构建 `group2model2channels` 之前计算调整系数
- 调整系数不持久化，每次同步重新计算
- 若第一阶段尚未补齐渠道级成功率，可先只使用 `ResponseTime` 做轻量调整，避免用模型/分组级成功率误伤同模型下的健康渠道

## 7. 综合评分公式

```
ChannelScore = Weight × LatencyScore^α × CostScore^β × SuccessRate^γ

其中:
  Weight          = 管理员配置的 Weight
  LatencyScore    = baseLatency / channel.ResponseTime
  CostScore       = minPrice / channel.Price
  SuccessRate     = 滑动窗口成功率 (0-1)
  α, β, γ         = 可配置指数（控制各维度影响力，默认 α=0.3, β=0.2, γ=2.0）
```

## 8. 修改文件清单

| 文件 | 改动 |
|------|------|
| `pkg/circuitbreaker/breaker.go` | 新增：滑动窗口熔断器实现 |
| `pkg/circuitbreaker/window.go` | 新增：滑动窗口桶 |
| `model/channel_cache.go` | 修改：`GetRandomSatisfiedChannel()` 增加熔断过滤 + 延迟/成本加权 |
| `model/ability.go` | 修改：新增 `PricePerToken`, `PricePerRequest` 字段 |
| `controller/relay.go` | 修改：成功/失败时通知 breaker |
| `service/channel.go` | 修改：`ShouldDisableChannel()` 与 breaker 集成 |
| `setting/operation_setting/` | 新增：熔断/延迟路由/成本路由的 Option 配置 |
| `common/init.go` | 修改：初始化 breaker + 加载配置 |
