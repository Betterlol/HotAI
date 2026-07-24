# 监控指标与告警规则清单

## 1. Prometheus 指标清单

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `hotai_requests_total` | Counter | `model, group, channel, status` | 总请求数，按状态码分类 |
| `hotai_requests_duration_ms` | Histogram | `model, group, channel` | 请求延迟分布（桶: 50/100/200/500/1000/2000/5000/10000/30000） |
| `hotai_ttft_ms` | Histogram | `model, group, channel` | 首 Token 延迟分布（桶: 50/100/200/500/1000/2000/5000） |
| `hotai_tokens_total` | Counter | `model, group, channel, type` | Token 消耗量（type=prompt/completion/total） |
| `hotai_relay_cost_total` | Counter | `model, group, channel` | 累计业务成本（内部 quota 单位） |
| `hotai_success_rate` | Gauge | `model, group, channel` | 滑动窗口成功率（最近 5 分钟） |
| `hotai_channel_status` | Gauge | `channel` | 渠道状态（1=启用, 2=手动禁用, 3=自动禁用） |
| `hotai_channel_balance_usd` | Gauge | `channel` | 渠道余额（USD） |
| `hotai_active_connections` | Gauge | - | 当前活跃 HTTP 连接数 |
| `hotai_upstream_errors_total` | Counter | `model, channel, status_code` | 上游错误计数，按状态码细分（401/429/500/502/503/504） |
| `go_*` | - | - | Go runtime 标准指标（goroutines, GC, memory） |

### 标签基数控制

- `channel` 标签优先使用 `channel_id`，避免渠道名变更导致时间序列膨胀
- 不把 `user_id`、`token_id`、`request_id`、完整错误消息作为标签
- `model` 使用规范化后的模型名，避免别名产生多条时间序列
- 高基数明细保留在 `logs` / `quota_data` / `perf_metrics` 中查询

## 2. 延迟百分位追踪

`perf_metrics` 表在原有平均值基础上，增加以下百分位字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `p50_latency_ms` | BIGINT | 第 50 百分位延迟（毫秒） |
| `p90_latency_ms` | BIGINT | 第 90 百分位延迟（毫秒） |
| `p95_latency_ms` | BIGINT | 第 95 百分位延迟（毫秒） |
| `p99_latency_ms` | BIGINT | 第 99 百分位延迟（毫秒） |

数据来源：HdrHistogram 内存聚合，定期刷新到 DB。

## 3. 告警规则清单

| 规则 ID | 名称 | 条件 | 严重度 | 通知方式 | 实现状态 |
|---------|------|------|--------|----------|----------|
| A-01 | 成功率下降 | 最近 5 分钟整体成功率 < 阈值 (默认 95%) | P1 | Email + Webhook | ✅ 已实现 |
| A-02 | 模型全面不可用 | 某模型最近 5 分钟全部请求失败 (request_count > 0, success_count = 0) | P1 | Email + Webhook + Bark | ✅ 已实现 |
| A-03 | 渠道超时率过高 | 某渠道 5 分钟内超时率 > 30% | P2 | Email | ⬜ 待实现 |
| A-04 | 单日成本超预算 | 当日累计 cost > 预算阈值 | P2 | Email | ⬜ 待实现 |
| A-05 | 渠道余额不足 | 渠道余额 < low_balance_threshold (默认 $10) | P2 | Email | ✅ 已实现 |
| A-06 | 渠道余额严重不足 | 渠道余额 < critical_balance_threshold (默认 $1) | P1 | Email + Bark | ✅ 已实现 |
| A-07 | 请求量异常 | 最近 5 分钟请求量 > 日均 3σ | P3 | Email | ⬜ 待实现 |
| A-08 | P95 延迟突增 | P95 延迟 > 上周同期的 2 倍 | P2 | Email | ⬜ 待实现 |

## 4. 通知渠道清单

| 通知方式 | 实现状态 | 说明 |
|----------|----------|------|
| Email (SMTP) | ✅ 已实现 | 标准 SMTP，支持 SSL/TLS/STARTTLS |
| Webhook (HMAC-SHA256) | ✅ 已实现 | JSON POST，可选签名头 |
| Bark (iOS) | ✅ 已实现 | GET 请求推送 |
| Gotify | ✅ 已实现 | POST JSON 消息 |
| 飞书机器人 | ⬜ 待实现 | Webhook URL 配置 |
| 钉钉机器人 | ⬜ 待实现 | Webhook URL 配置 |
| 企业微信机器人 | ⬜ 待实现 | Webhook URL 配置 |
| Slack Webhook | ⬜ 待实现 | Webhook URL 配置 |

## 5. 告警配置项（已实现）

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `alert_setting.enabled` | bool | false | 总开关 |
| `alert_setting.success_rate_drop_enabled` | bool | true | A-01 开关 |
| `alert_setting.model_unavailable_enabled` | bool | true | A-02 开关 |
| `alert_setting.success_rate_threshold` | float64 | 95 | A-01 阈值（百分比） |
| `balance_warning_setting.enabled` | bool | false | 余额告警总开关 |
| `balance_warning_setting.threshold` | float64 | 10.0 | 余额告警阈值（USD） |

## 6. 关联代码文件

| 文件 | 说明 |
|------|------|
| `pkg/prometheus_metrics/metrics.go` | Prometheus 指标定义与记录 |
| `controller/metrics.go` | `/api/metrics` 端点 |
| `controller/health.go` | `/api/health` 健康检查端点 |
| `pkg/perf_metrics/metrics.go` | 性能指标聚合与百分位追踪 |
| `controller/alert_check.go` | A-01/A-02 告警检查定时任务 |
| `setting/operation_setting/alert_setting.go` | 告警配置项 |
| `setting/operation_setting/balance_warning_setting.go` | 余额告警配置项 |
| `controller/channel-billing.go` | 余额检查与通知 |
| `service/user_notify.go` | 通知分发（Email/Webhook/Bark/Gotify） |
| `service/notify-limit.go` | 通知限流 |
| `router/relay-router.go` | 路由注册 |
