# 监控与告警设计

## 1. Prometheus 指标端点

### 1.1 设计

新增 `/api/metrics` 端点，暴露 Prometheus 格式指标，兼容标准监控栈（Prometheus + Grafana）。

### 1.2 指标清单

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `hotai_requests_total` | Counter | `model, group, channel, status` | 总请求数，按状态码分类 |
| `hotai_requests_duration_ms` | Histogram | `model, group, channel` | 请求延迟分布（桶: 50/100/200/500/1000/2000/5000/10000/30000） |
| `hotai_ttft_ms` | Histogram | `model, group, channel` | 首 Token 延迟分布（桶: 50/100/200/500/1000/2000/5000） |
| `hotai_tokens_total` | Counter | `model, group, channel, type` | Token 消耗量（type=prompt/completion/total） |
| `hotai_cost_total` | Counter | `model, group, channel` | 累计成本（USD） |
| `hotai_success_rate` | Gauge | `model, group, channel` | 滑动窗口成功率（最近 5 分钟） |
| `hotai_channel_status` | Gauge | `channel_id, channel_name` | 渠道状态（1=启用, 2=手动禁用, 3=自动禁用） |
| `hotai_channel_response_time_ms` | Gauge | `channel_id, channel_name, model` | 渠道响应时间 |
| `hotai_channel_balance_usd` | Gauge | `channel_id, channel_name` | 渠道余额 |
| `hotai_active_connections` | Gauge | - | 当前活跃连接数 |
| `hotai_upstream_errors_total` | Counter | `model, channel, status_code` | 上游错误计数，按状态码细分（401/429/500/502/503/504） |
| `go_*` | - | - | Go runtime 标准指标（goroutines, GC, memory） |

### 1.2.1 标签基数控制

Prometheus 指标需要控制标签基数，避免模型、渠道和用户规模增长后造成内存压力。

- `channel` 标签优先使用稳定的 `channel_id`，`channel_name` 仅用于单独的 info 指标或前端映射展示。
- 不把 `user_id`、`token_id`、`request_id`、完整错误消息作为 Prometheus 标签。
- `model` 需要使用规范化后的模型名，避免同一模型因为别名、映射名产生多条时间序列。
- 高基数明细仍保留在 `logs` / `quota_data` / `perf_metrics` 查询中，Prometheus 只保存聚合监控指标。

### 1.3 实现方案

使用 `prometheus/client_golang`（需 `go get`）：

```go
// controller/metrics.go
package controller

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    requestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "hotai_requests_total",
            Help: "Total number of requests.",
        },
        []string{"model", "group", "channel", "status"},
    )
    requestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "hotai_requests_duration_ms",
            Help:    "Request latency in milliseconds.",
            Buckets: []float64{50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000},
        },
        []string{"model", "group", "channel"},
    )
    // ...
)

func init() {
    prometheus.MustRegister(requestsTotal, requestDuration, ...)
}

func MetricsHandler(c *gin.Context) {
    promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}
```

### 1.4 采集时机

在 `controller/relay.go` 的 `RecordRelaySample()` 调用处同步记录 Prometheus 指标：

```go
// controller/relay.go:244-248 修改
perfmetrics.RecordRelaySample(relayInfo, success, 0)
prometheusMetrics.Record(relayInfo, success, statusCode, outputTokens)
```

### 1.5 路由注册

```go
// router/relay-router.go
router.GET("/api/metrics", controller.MetricsHandler)
// 生产环境建议使用独立 METRICS_TOKEN、Basic Auth 或内网白名单保护
```

### 1.6 安全策略

`/api/metrics` 会暴露模型、渠道状态、请求量和错误率，生产环境不应默认公网裸露。推荐默认关闭，通过 `METRICS_ENABLED=true` 开启；开启后至少满足一种保护方式：

| 方式 | 说明 |
|------|------|
| 内网访问 | 仅允许 Prometheus 所在内网或反向代理白名单访问 |
| 独立 Token | 使用 `METRICS_TOKEN`，Prometheus scrape 时携带 Header |
| Basic Auth | 由 Nginx / Caddy / 网关层提供认证 |

## 2. 延迟百分位追踪

### 2.1 设计

在现有 `perf_metrics` 系统的基础上，增加 P50/P90/P95/P99 延迟追踪，而不是仅存平均值。

### 2.2 实现方案

**方案：HDR Histogram（推荐）**

使用 `HdrHistogram` 在内存中维护最近 N 分钟的延迟分布，定期落盘：

```go
import "github.com/HdrHistogram/hdrhistogram-go"

type PercentileTracker struct {
    mu         sync.Mutex
    histograms map[bucketKey]*hdrhistogram.Histogram
    // 精度: 1ms ~ 60000ms, 2 位有效数字
}

func (t *PercentileTracker) Record(latencyMs int64, key bucketKey) {
    t.mu.Lock()
    defer t.mu.Unlock()
    h, ok := t.histograms[key]
    if !ok {
        h = hdrhistogram.New(1, 60000, 2)
        t.histograms[key] = h
    }
    h.RecordValue(latencyMs)
}

func (t *PercentileTracker) SnapshotAndReset(key bucketKey) Percentiles {
    // 返回并重置 histogram
}

type Percentiles struct {
    P50 int64
    P90 int64
    P95 int64
    P99 int64
}
```

### 2.3 数据模型扩展

```sql
ALTER TABLE perf_metrics ADD COLUMN p50_latency_ms BIGINT DEFAULT 0;
ALTER TABLE perf_metrics ADD COLUMN p90_latency_ms BIGINT DEFAULT 0;
ALTER TABLE perf_metrics ADD COLUMN p95_latency_ms BIGINT DEFAULT 0;
ALTER TABLE perf_metrics ADD COLUMN p99_latency_ms BIGINT DEFAULT 0;
```

实际迁移应沿用项目现有 GORM/AutoMigrate 模式，并确认 SQLite、MySQL、PostgreSQL 都能重复执行不报错；SQLite 场景只使用 `ADD COLUMN` 类兼容变更。

### 2.4 API 扩展

```go
// GET /api/perf-metrics?model=X&group=Y&hours=N&percentiles=true
// 返回增加 p50_latency_ms, p90_latency_ms, p95_latency_ms, p99_latency_ms
```

## 3. 渠道余额监控

### 3.1 设计

新增定时任务，定期检查所有已启用渠道的余额，低于阈值时通知管理员。

### 3.2 触发方式

在现有 `performChannelTests()` 中扩展，改为 `performChannelTestsAndBalanceCheck()`。

### 3.3 余额获取

不同供应商余额获取方式不同：

| 供应商类型 | 余额获取方式 | 实现 |
|-----------|-------------|------|
| OpenAI | `GET /v1/dashboard/billing/credit_grants` | 已有 `channel.Balance` 字段 |
| Azure | `GET /v1/billing` | 需实现 |
| DeepSeek | `GET /user/balance` | 需适配 |
| 阿里(通义) | `GET /v1/checkbalance` | 需适配 |
| 其他 | 手动输入余额 | `channel.Balance` 手动更新 |

### 3.4 配置项

```go
type BalanceMonitorConfig struct {
    Enabled        bool    // 是否启用
    CheckInterval   int     // 检查间隔（分钟，默认 60）
    LowBalanceThreshold float64 // 余额低于此值时告警（USD, 默认 10.0）
    CriticalBalanceThreshold float64 // 严重低余额告警（USD, 默认 1.0）
}
```

## 4. 告警规则

### 4.1 规则引擎设计

不使用复杂的规则引擎（如 Drools），而是用**可配置的定时检查任务**，根据 perf_metrics + logs 数据判断。

### 4.2 告警规则清单

| 规则 ID | 名称 | 条件 | 严重度 | 通知方式 | 实现方式 |
|---------|------|------|--------|----------|----------|
| A-01 | 成功率下降 | 最近 5 分钟整体成功率 < 95% | P1 | Email + Webhook | 新增 `controller/alert_check.go` 定时执行 |
| A-02 | 模型全面不可用 | 某模型最近 5 分钟全部渠道失败 | P1 | Email + Webhook + Bark | 检查渠道级指标或 logs 中各渠道 success_count=0 |
| A-03 | 渠道超时率过高 | 某渠道 5 分钟内超时率 > 30% | P2 | Email | 检查 logs 表中 use_time > threshold 的比例 |
| A-04 | 单日成本超预算 | 当日累计 cost > 预算阈值 | P2 | Email | 新增每日 cost 计数器，基于 quota_data 或 Redis |
| A-05 | 渠道余额不足 | 渠道余额 < low_balance_threshold | P2 | Email | 定时余额检查任务 |
| A-06 | 渠道余额严重不足 | 渠道余额 < critical_balance_threshold | P1 | Email + Bark | 同上 |
| A-07 | 请求量异常 | 最近 5 分钟请求量 > 日均 3σ | P3 | Email | 对比历史基线 |
| A-08 | P95 延迟突增 | P95 延迟 > 上周同期的 2 倍 | P2 | Email | 基于 perf_metrics 或 Prometheus |

### 4.3 告警数据流

```
perf_metrics (DB)          ─┐
logs (DB)                   ├──→ AlertChecker (定时 1 分钟) ──→ NotifyRootUser
Prometheus (实时)          ─┘
                              ↑
渠道余额 (Channel.Balance)  ──┘
```

### 4.4 通知增强

在现有 NotifyRootUser 基础上增加：

| 通知方式 | 实现状态 | 新增需求 |
|----------|----------|----------|
| Email (SMTP) | ✅ 已有 | - |
| Webhook (HMAC-SHA256) | ✅ 已有 | - |
| Bark (iOS) | ✅ 已有 | - |
| Gotify | ✅ 已有 | - |
| **飞书机器人** | ❌ 新增 | Webhook URL 配置 |
| **钉钉机器人** | ❌ 新增 | Webhook URL 配置 |
| **企业微信机器人** | ❌ 新增 | Webhook URL 配置 |
| **Slack Webhook** | ❌ 新增 | Webhook URL 配置 |

### 4.5 配置管理

```go
// setting/operation_setting/alert_setting.go
type AlertSetting struct {
    // 规则开关
    SuccessRateDropEnabled      bool    // A-01
    ModelUnavailableEnabled     bool    // A-02
    ChannelTimeoutRateEnabled   bool    // A-03
    DailyCostOverBudgetEnabled  bool    // A-04
    BalanceLowEnabled           bool    // A-05, A-06
    RequestVolumeAnomalyEnabled bool    // A-07
    LatencySpikeEnabled         bool    // A-08

    // 阈值
    SuccessRateThreshold        float64 // 默认 95
    ChannelTimeoutRateThreshold float64 // 默认 30 (%)
    DailyBudgetUSD              float64 // 日预算
    LowBalanceThresholdUSD      float64 // 默认 10
    CriticalBalanceThresholdUSD float64 // 默认 1

    // 通知
    NotifyChannels              []string // email, webhook, bark, gotify, feishu, dingtalk, wecom, slack
}
```

## 5. 修改文件清单

| 文件 | 改动 |
|------|------|
| `go.mod` | 新增依赖: `prometheus/client_golang`, `hdrhistogram-go` |
| `controller/metrics.go` | 新增：Prometheus handler |
| `pkg/perf_metrics/types.go` | 修改：`BucketPoint` 增加 P50/P90/P95/P99 |
| `pkg/perf_metrics/metrics.go` | 修改：`Record()` 增加 HdrHistogram 记录 |
| `pkg/perf_metrics/percentile.go` | 新增：HdrHistogram 包装器 |
| `controller/alert_check.go` | 新增：告警检查定时任务 |
| `controller/alert_notify.go` | 新增：告警通知格式化与分发 |
| `controller/channel-test.go` | 修改：扩展余额检查 |
| `router/relay-router.go` | 修改：注册 `/api/metrics` 路由 |
| `setting/operation_setting/alert_setting.go` | 新增：告警配置项 |
| `model/log.go` | 可能修改：增加成本记录字段 |
| `common/init.go` | 修改：启动告警检查协程 |
