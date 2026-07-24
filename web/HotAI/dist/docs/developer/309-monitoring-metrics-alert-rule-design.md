# 监控与告警设计

## 1. Prometheus 指标端点

### 1.1 设计

新增 `/api/metrics` 端点，暴露 Prometheus 格式指标，兼容标准监控栈（Prometheus + Grafana）。

### 1.2 实现方案

使用 `prometheus/client_golang`，通过 `promauto` 自动注册到默认 Registry：

```go
// pkg/prometheus_metrics/metrics.go
var (
    requestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "hotai_requests_total",
            Help: "Total relay requests by model, group, channel, and status.",
        },
        []string{"model", "group", "channel", "status"},
    )
    requestDurationMs = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "hotai_requests_duration_ms",
            Help:    "Relay request latency in milliseconds.",
            Buckets: []float64{50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000},
        },
        []string{"model", "group", "channel"},
    )
)
```

### 1.3 采集时机

在 `perfmetrics.RecordRelaySample()` 调用处同步记录 Prometheus 指标，不阻塞请求路径：

```go
// pkg/perf_metrics/metrics.go:RecordRelaySample
prometheusmetrics.RecordRelaySample(info, success, outputTokens)
```

### 1.4 路由注册

```go
// router/relay-router.go
router.GET("/api/metrics", controller.MetricsHandler)
```

handler 为 `promhttp.Handler()` 的薄包装：

```go
// controller/metrics.go
func GetMetrics(c *gin.Context) {
    promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}
```

### 1.5 安全策略

`/api/metrics` 会暴露模型、渠道状态、请求量和错误率，生产环境不应默认公网裸露。推荐默认关闭，通过 `METRICS_ENABLED=true` 开启；开启后至少满足一种保护方式：

| 方式 | 说明 |
|------|------|
| 内网访问 | 仅允许 Prometheus 所在内网或反向代理白名单访问 |
| 独立 Token | 使用 `METRICS_TOKEN`，Prometheus scrape 时携带 Header |
| Basic Auth | 由 Nginx / Caddy / 网关层提供认证 |

## 2. 延迟百分位追踪

### 2.1 设计

在现有 `perf_metrics` 系统的基础上，增加 P50/P90/P95/P99 延迟追踪，而不是仅存平均值。数据在内存中按桶聚合，定期刷新到 DB。

### 2.2 实现方案

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

独立后台 goroutine `AutomaticallyUpdateChannels(frequency)`，按指定间隔遍历所有已启用、非多 Key 的渠道，通过各供应商 API 查询余额。

### 3.3 余额获取

不同供应商余额获取方式不同：

| 供应商类型 | 余额获取方式 | 实现 |
|-----------|-------------|------|
| OpenAI | `GET /v1/dashboard/billing/credit_grants` | 已有 `channel.Balance` 字段 |
| Azure | `GET /v1/billing` | 需适配 |
| DeepSeek | `GET /user/balance` | 需适配 |
| 阿里(通义) | `GET /v1/checkbalance` | 需适配 |
| 其他 | 手动输入余额 | `channel.Balance` 手动更新 |

### 3.4 告警规则

余额低于配置阈值时，通过 Email/Webhook/Bark 通知 Root 用户，同一渠道 24 小时内不重复告警。余额 ≤ 0 时自动禁用渠道。

## 4. 告警规则引擎

### 4.1 设计思路

不使用复杂的规则引擎（如 Drools），而是用**可配置的定时检查任务**，根据 perf_metrics + logs 数据判断。

### 4.2 告警数据流

```
perf_metrics (DB)          ─┐
logs (DB)                   ├──→ AlertChecker (定时 1 分钟) ──→ NotifyRootUser
Prometheus (实时)          ─┘
                              ↑
渠道余额 (Channel.Balance)  ──┘
```

### 4.3 实现机制

- 使用项目已有的 `ScheduledSystemTaskHandler` 框架，注册为 `alert_check` 类型
- 运行在 Master 节点，通过 DB 租约跨实例去重
- 每次检查结果写入 `system_tasks` 表，可追溯历史执行记录
- 通知走 Root 用户的配置渠道，支持 Email / Webhook / Bark / Gotify 四种通知方式
