# 可观测性：监控、日志与指标

## 一、请求日志

### 应用日志 (logger/)

- 框架: 基于 Go 标准库 `log` + Gin Writer
- 级别: INFO / WARN / ERR / DEBUG
- 格式: `[LEVEL] 时间 | request-id | 消息`
- 输出: stdout/stderr + 可选文件轮转（`--log-dir`）
- 轮转: 达到 100 万行自动滚动
- **无结构化日志**（无 JSON 输出，无法被 Logstash/Fluentd 高效采集）

### HTTP 请求日志 (middleware/logger.go)

每个 HTTP 请求自动记录：
```
[GIN] 2026/07/02 - 15:04:05 | api | request-id | 200 | 1.234s | 1.2.3.4 | POST /v1/chat/completions
```

### 数据库日志表 (model/log.go)

```sql
CREATE TABLE logs (
    id                INT       PRIMARY KEY,
    user_id           INT       INDEX,
    created_at        BIGINT    INDEX,
    type              INT       INDEX,     -- 0=unknown, 1=topup, 2=consume, 3=manage, 4=system, 5=error, 6=refund, 7=login
    content           TEXT,
    username          VARCHAR   INDEX,
    token_name        VARCHAR   INDEX,
    model_name        VARCHAR   INDEX,
    quota             INT,
    prompt_tokens     INT,
    completion_tokens INT,
    use_time          INT,                 -- 请求耗时 (秒)
    is_stream         BOOL,
    channel_id        INT       INDEX,
    channel_name      VARCHAR,             -- 查询时通过缓存/独立查询填充
    token_id          INT       INDEX,
    group             VARCHAR   INDEX,
    ip                VARCHAR   INDEX,     -- 仅在用户开启 RecordIpLog 时记录
    request_id        VARCHAR(64) INDEX,
    upstream_request_id VARCHAR(128) INDEX,
    other             TEXT                 -- JSON: admin_info, op, audit_info, reject_reason, stream_status
);
```

- 存储在独立的 `LOG_DB`（可与主库相同，也可独立 SQLite/MySQL/PostgreSQL/ClickHouse）
- ClickHouse 支持 TTL 自动清理
- 每次代理请求生成一条 consume log
- 错误请求生成 error log
- 管理操作生成 manage log

### 已有日志 API

| 端点 | 鉴权 | 功能 |
|------|------|------|
| `GET /api/log/` | Admin | 查询日志列表（按类型/时间/模型/用户/渠道过滤） |
| `GET /api/log/self` | User | 查询当前用户日志 |
| `GET /api/log/stat` | Admin | 聚合统计：总 quota/RPM/TPM |
| `GET /api/log/self/stat` | User | 当前用户聚合统计 |

## 二、性能指标 (Perf Metrics)

### 指标采集

`pkg/perf_metrics/metrics.go`

```go
type Sample struct {
    Model        string   // 模型名
    Group        string   // 分组
    LatencyMs    int64    // 总延迟 (ms)
    TtftMs       int64    // 首 Token 延迟 (ms)
    HasTtft      bool     // 是否采集了 TTFT
    Success      bool     // 是否成功
    OutputTokens int64    // 输出 Token 数
    GenerationMs int64    // 生成耗时 (ms)
}
```

采集时机: `controller/relay.go:244-248` — 在主流程结束后调用 `perfmetrics.RecordRelaySample()`

### 存储

双写策略:
1. **内存热桶 (hotBuckets)**: `sync.Map` + `atomic`，按 `(model, group, bucket_ts)` 聚簇
2. **Redis**: 活跃桶实时计数，过期时间 1 小时
3. **DB 持久化**: 定期 `flushLoop()` 将热桶数据写入 `perf_metrics` 表

```sql
CREATE TABLE perf_metrics (
    id                INT       PRIMARY KEY,
    model_name        VARCHAR(128),
    group             VARCHAR(64),
    bucket_ts         BIGINT,              -- 桶起始时间 (Unix ts)
    request_count     BIGINT,
    success_count     BIGINT,
    total_latency_ms  BIGINT,
    ttft_sum_ms       BIGINT,
    ttft_count        BIGINT,
    output_tokens     BIGINT,
    generation_ms     BIGINT,
    UNIQUE KEY (model_name, group, bucket_ts)
);
```

### 支持的 API

| 端点 | 鉴权 | 返回数据 |
|------|------|----------|
| `GET /api/perf-metrics/summary?hours=N` | User | 各模型的 avg_latency/success_rate/avg_tps |
| `GET /api/perf-metrics?model=X&group=Y&hours=N` | User | 指定模型的分组时间序列数据 |

### 缺失的指标

| 指标 | 现状 | 需要 |
|------|------|------|
| P50/P90/P95/P99 延迟 | 只有平均值 | 需要百分位分布 |
| 4xx/5xx 细分 | 只分成功/失败 | 需要按状态码分布 |
| 请求体大小/响应体大小 | 不记录 | 无法分析流量 |
| 每渠道延迟 | 只存了 `channel.ResponseTime` | 需要可查询的渠道延迟时间序列 |
| 活跃连接数 | 只有简单 atomic 计数器 | 缺少细分 |

## 三、系统监控

### 系统性能检查 (`middleware/performance.go`)

- CPU 使用率阈值（超限返回 503）
- 内存使用率阈值
- 磁盘使用率阈值
- 无告警：超限后只返回 503，不主动通知

### Pyroscope 持续性能分析 (`common/pyro.go`)

- 可选，通过 `PYROSCOPE_URL` 启用
- 支持：CPU / 内存分配 / Goroutine / Mutex / Block 分析

### PProf (`main.go:153-159`)

- 可选，通过 `ENABLE_PPROF=true` 启用
- 端口 8005

### 系统实例 (`model/system_instance.go`)

- 每个实例向 `system_instances` 表上报心跳
- 显示在多实例管理页面

## 四、告警机制

### 现有告警

| 告警类型 | 方式 | 触发 |
|----------|------|------|
| 渠道禁用通知 | NotifyRootUser (Email/Webhook/Bark/Gotify) | 渠道被自动禁用时 |
| 渠道测试完成 | NotifyRootUser | 定时渠道测试完成后 |
| 额度预警 | 用户级通知 | 用户余额低于阈值 |

### 通知方式
- Email (SMTP)
- Webhook (HMAC-SHA256 签名)
- Bark (iOS 推送)
- Gotify (自托管推送)

### 缺失的告警

| 场景 | 当前行为 | 应该做 |
|------|----------|--------|
| 整体成功率下降 | 无告警 | 5 分钟内成功率 < 95% → 通知 |
| 某渠道超时率过高 | 渠道被自动禁用，但不一定通知 | 超时率 > 20% → P2 告警 |
| 单日成本超预算 | 无 | 日成本 > 阈值 → 通知 |
| 某模型全部渠道不可用 | 用户收到 503，管理员无通知 | 所有渠道连续失败 → P1 告警 |
| 系统资源超限 | 只返回 503 | 资源超限 → 通知管理员 |

## 五、用量数据 (`model/usedata.go`)

`quota_data` 表按小时聚合：
```sql
CREATE TABLE quota_data (
    user_id    INT  INDEX,
    username   VARCHAR INDEX,
    model_name VARCHAR INDEX,
    created_at BIGINT INDEX,
    use_group  VARCHAR,
    token_id   INT,
    channel_id INT,
    node_name  VARCHAR,
    token_used INT,
    count      INT,
    quota      INT
);
```

API:
- `GET /api/data/` — 用量概览
- `GET /api/data/self` — 当前用户用量
- `GET /api/data/users` — 用户用量排行
- `GET /api/data/flow` — 流量趋势
- `GET /api/data/flow/self` — 用户流量趋势
