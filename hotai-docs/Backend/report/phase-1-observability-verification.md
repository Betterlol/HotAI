# Phase 1 可观测性验证记录

## 1. 验证目标

验证 Phase 1.1～Phase 1.4 已落地的后端可观测性基础能力：

- 健康检查端点：`GET /api/health`
- Prometheus 指标端点：`GET /api/metrics`
- JSON 结构化日志：`LOG_FORMAT=json` 或后台 `LogFormat=json`
- 延迟百分位追踪：`P50/P90/P95/P99`

## 2. 本地自动化测试

已新增测试覆盖：

| 能力 | 测试文件 | 验证内容 |
|------|---------|----------|
| 健康检查 | `controller/observability_test.go` | 返回 `status/db/uptime/version/memory` |
| Metrics 端点 | `controller/observability_test.go` | 返回 Prometheus 文本，包含 `hotai_active_connections` |
| 业务 JSON 日志 | `logger/logger_test.go` | `logger.LogInfo()` 输出 JSON 字段 |
| HTTP JSON 日志 | `middleware/logger_test.go` | Gin 请求日志输出 JSON 字段 |
| 延迟百分位 | `pkg/perf_metrics/percentile_test.go` | 验证 nearest-rank 百分位计算和 bucket drain |
| 百分位持久化 | `model/perf_metric_test.go` | 验证 `perf_metrics` 表保存 P50/P90/P95/P99 |

推荐验证命令：

```bash
go test ./controller ./logger ./middleware ./model ./pkg/http_stats ./pkg/prometheus_metrics ./pkg/perf_metrics
```

## 3. 部署后接口验证

假设后端服务地址为：

```bash
export HOTAI_API_BASE="https://your-domain.example.com"
```

### 3.1 健康检查

```bash
curl -s "$HOTAI_API_BASE/api/health"
```

预期返回示例：

```json
{
  "status": "ok",
  "uptime": "1h2m3s",
  "version": "v0.0.0",
  "db": "ok",
  "redis": "ok",
  "memory": "enabled"
}
```

说明：

- `status=ok`：DB 和 Redis 均正常。
- `status=degraded`：DB 或已启用 Redis 异常。
- Redis 未启用时，`redis` 字段会省略。

### 3.2 Prometheus 指标

```bash
curl -s "$HOTAI_API_BASE/api/metrics" | grep '^hotai_'
```

预期至少能看到：

```text
hotai_active_connections 1
```

在有 relay 请求后，还应出现：

```text
hotai_requests_total{model="...",group="...",channel="...",status="200"} 1
hotai_requests_duration_ms_bucket{model="...",group="...",channel="...",le="1000"} 1
hotai_success_rate{model="...",group="...",channel="..."} 100
hotai_tokens_total{model="...",group="...",channel="...",type="completion"} ...
```

## 4. JSON 日志验证

### 4.1 启用方式

任选其一：

```bash
LOG_FORMAT=json
```

或后台配置：

```text
LogFormat = json
```

然后：

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api
docker compose -f docker-compose.dev.yml logs -f new-api
curl -s "$HOTAI_API_BASE/api/health"
```

### 4.2 业务日志预期格式

```json
{"level":"INFO","time":"2026-07-06T12:00:00Z","request_id":"SYSTEM","msg":"..."}
```

### 4.3 HTTP 请求日志预期格式

```json
{
  "level": "INFO",
  "time": "2026-07-06T12:00:00Z",
  "request_id": "req_xxx",
  "route_tag": "api",
  "status": 200,
  "latency_ms": 12,
  "client_ip": "1.2.3.4",
  "method": "GET",
  "path": "/api/health",
  "msg": "GET /api/health"
}
```

## 5. 当前可展示结论

Phase 1.1～Phase 1.4 已经支持基础可观测性闭环：

- 服务健康状态可被外部探针检查。
- Prometheus 可以采集 HotAI 自定义业务指标和 Go runtime 指标。
- 日志可以切换为结构化 JSON，便于 Loki / ELK / Fluent Bit 采集。
- relay 请求成功率、延迟、TTFT、Token、错误状态码已有指标入口。
- `perf_metrics` 时间序列支持 `p50_latency_ms`、`p90_latency_ms`、`p95_latency_ms`、`p99_latency_ms`。
