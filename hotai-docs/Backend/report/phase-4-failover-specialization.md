# Phase 4 故障切换规则特化完成总结

## 1. Stage 描述

针对不同上游错误类型（429 限流、401/403 鉴权、超时、5xx 服务端）制定差异化的熔断、成功率记录和重试策略，替代"所有失败一视同仁"的通用处理路径。

## 2. Stage 元数据

- STAGE_ID: phase-4
- STAGE_TYPE: feature
- COMMITS:
  - `6647fa9` — 基础错误分类 + 主 Relay 路径分流 + retry_setting 配置
  - `6d5f278` — context-aware 退避 + RelayTask 错误分类
  - `4e69523` — RelayTask 完整分流对齐

## 3. 修改文件列表

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `types/error_classification.go` | `IsRateLimit()`、`IsAuthError()`、`IsTimeout()` 分类函数 |
| 新增 | `types/error_classification_test.go` | 3 个测试：`TestIsRateLimit`、`TestIsAuthError`、`TestIsTimeout` |
| 新增 | `setting/operation_setting/retry_setting.go` | `RateLimitRetryInterval`（默认 1s）、`RateLimitRetryTimes`（默认 3）|
| 修改 | `controller/relay.go` | 主 Relay + RelayTask 双路径分流改造 |

## 4. 核心改造

### 问题

改造前，所有 relay 失败都走同一条路径：

```
relayError → circuitbreaker.MarkFailure → channelsuccessrate.Record(false)
          → processChannelError → shouldRetry
```

导致 429（上游限流）污染熔断窗口和成功率评分，**一个正常渠道因为瞬间限流被路由规避**。

### 处理流程（改造后）

```
relayError
  │
  ├─ IsRateLimit(429)
  │     → ❌ 不记熔断/成功率
  │     → processChannelError（告警/日志）
  │     → context-aware delay → retry（或超限后 break）
  │
  ├─ IsAuthError(401/403)
  │     → ❌ 不记熔断/成功率
  │     → processChannelError（告警/日志）
  │     → ❌ 不重试，立即 break
  │
  └─ (timeout/5xx/其他)
        → MarkFailure → Record(false) → processError → shouldRetry
```

### 分类函数

| 函数 | 判断依据 | 用途 |
|------|----------|------|
| `IsRateLimit(err)` | `StatusCode == 429` | 跳过熔断/成功率，延迟重试 |
| `IsAuthError(err)` | `StatusCode 401/403` 或 `errorCode == ChannelInvalidKey/AccessDenied` | 跳过熔断/成功率，立即跳过 |
| `IsTimeout(err)` | `StatusCode 504/408` 或 `errorCode == DoRequestFailed/ResponseTimeExceeded` | 记入熔断，重试 |

### 配置项

| 配置 | 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|------|
| `retry_setting` | `ratelimit_retry_interval` | int (ms) | `1000` | 429 重试等待间隔 |
| | `ratelimit_retry_times` | int | `3` | 429 最大重试次数 |

### 两次迭代修正

**v1（`6d5f278`）— Time.Sleep → context-aware select：**
```
// Before: goroutine stuck even if client disconnected
time.Sleep(delay)
continue

// After: respect client context cancellation
select {
case <-c.Request.Context().Done():
    return  // Client gone — don't waste resources
case <-time.After(delay):
    continue
}
```
防止高并发下客户端断开后 goroutine 堆积导致 OOM。

**v1（`6d5f278`）— RelayTask 基础分类：**
首次扩展分类判断到 RelayTask（异步任务 Midjourney/Suno/Kling 等）路径。

**v2（`4e69523`）— RelayTask 完整分流：**
v1 的 RelayTask 路径在 429/401 分流后直接 `continue`，缺少退避和 fail-fast 控制。v2 对齐到与主 Relay 完全一致的行为：

```
RelayTask 路径:
  IsRateLimit → context-aware delay → continue retry
  IsAuthError → release → break（fail-fast）
  其他        → MarkFailure → Record(false) → processError
```

## 5. 测试结果

```
go test ./types/ ./controller/ ./model/ ./pkg/... -count=1

所有包: PASS
```

| 测试 | 覆盖 |
|------|------|
| `TestIsRateLimit` | 429 = true, 500 = false, nil = false |
| `TestIsAuthError` | 401 = true, 403 = true, invalid_key = true, access_denied = true, 429 = false, nil = false |
| `TestIsTimeout` | 504 = true, 408 = true, do_request_failed = true, response_time_exceeded = true, 502 = false, nil = false |

## 6. 后续建议

路线图中剩余的 Phase 5 项（Canary 发布 / OpenTelemetry 追踪 / 流式切换）投入产出比较低且需求不明确，建议根据实际生产需要再决定是否推进。
