# HotAI 状态码来源与处理方式分析

## 一、用户侧状态码（进入 relay 之前）

### 1.1 401 Unauthorized

**来源：** `middleware/auth.go:TokenAuth()`

| 场景 | 具体原因 | 处理方式 |
|------|---------|---------|
| 用户 Token 无效 | `ValidateUserToken` 返回 `ErrTokenInvalid` | 立即返回 401，中断请求 |
| 用户 Token 过期 | `ExpiredTime < now` 且 `ExpiredTime != -1` | 标记 token 为 expired，返回 401 |
| 用户 Token 额度耗尽 | `RemainQuota <= 0` 且 `UnlimitedQuota=false` | 标记 token 为 exhausted，返回 401 |
| 数据库错误 | `ValidateUserToken` 返回 `ErrDatabase` | 返回 500（`common_database_error`） |

**关键点：** 用户侧 401 在 `TokenAuth` 中间件就被拦截，**根本不会进入 relay retry 循环**。

---

### 1.2 403 Forbidden

**来源：** 多个中间件

| 场景 | 来源文件 | 处理方式 |
|------|---------|---------|
| 用户被封禁 | `middleware/auth.go` - `userEnabled == false` | 立即返回 403 |
| Token IP 限制 | `middleware/auth.go` - `allow_ips` 校验失败 | 立即返回 403 |
| 分组访问 denied | `middleware/distributor.go` - `GroupAccessDenied` | 立即返回 403 |
| Token 无权访问分组 | `middleware/auth.go` - `GetUserUsableGroups` 校验失败 | 立即返回 403 |
| 渠道被禁用 | `middleware/distributor.go` - `ChannelDisabled` | 立即返回 403 |
| Token 无权使用模型 | `middleware/distributor.go` - `TokenModelForbidden` | 立即返回 403 |

**关键点：** 用户侧 403 同样在 relay 之前拦截，**不会进入 retry 循环**。

---

### 1.3 429 Too Many Requests

**来源：** `middleware/model-rate-limit.go:ModelRequestRateLimit()`

| 场景 | 处理方式 |
|------|---------|
| 模型请求频率超过 `ModelRequestRateLimitCount` | 返回 429，中断请求 |

**关键点：** 这是**用户级限流**，不是渠道侧限流。在 relay 之前拦截。

---

### 1.4 503 Service Unavailable

**来源：** `middleware/distributor.go:Distribute()`

| 场景 | 处理方式 |
|------|---------|
| `GetRandomSatisfiedChannel` 返回错误 | 返回 503，`ErrorCodeModelNotFound` |
| 无可用渠道（`channel == nil`） | 返回 503，`ErrorCodeModelNotFound` |
| 并发限流器满（`limiter.Acquire == false`） | 返回 503，`ErrorCodeModelNotFound` |

**关键点：** 503 表示**没有可用渠道**，在 relay 之前就直接返回。

---

### 1.5 400 Bad Request

**来源：** `controller/relay.go` 和 `middleware/distributor.go`

| 场景 | 处理方式 |
|------|---------|
| 请求体读取失败 | 返回 400/413 |
| 请求验证失败（模型名缺失等） | 返回 400 |
| Playground 请求解析失败 | 返回 400 |

---

### 1.6 系统性能检查

**来源：** `middleware/performance.go:SystemPerformanceCheck()`

| 场景 | 处理方式 |
|------|---------|
| CPU/内存/磁盘超过阈值 | 返回 503（`system_cpu_overloaded` 等） |

---

## 二、渠道侧状态码（relay retry 循环内）

### 2.1 来源

渠道侧状态码来自**上游供应商**的原始 HTTP 响应，经过各 provider adaptor 的 `DoResponse` 解析后，包装为 `types.NewAPIError` 返回。

```go
// 简化流程
relayHandler(c, info) → adaptor.DoRequest() → upstream HTTP response
                       → adaptor.DoResponse() → NewAPIError{StatusCode: upstream.StatusCode}
                       → 返回到 controller/relay.go retry loop
```

**注意：** 渠道侧返回的是**上游原始状态码**，不是平台自定义状态码。

---

### 2.2 分类处理（Phase 4 特化）

在 `controller/relay.go` 的 retry loop 中：

```go
for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
    channel, channelErr := getChannel(c, relayInfo, retryParam)
    // ...
    newAPIError = relayHandler(c, relayInfo)
    
    if newAPIError == nil {
        // 成功
        return
    }
    
    // Phase 4 分类处理
    if types.IsRateLimit(newAPIError) {
        // 429: 不记熔断/成功率 → delay → retry
    }
    
    if types.IsAuthError(newAPIError) {
        // 401/403: 不记熔断/成功率 → break（直接返回）
    }
    
    // 其他（500/502/503/504 等）
    circuitbreaker.MarkFailure(channel.Id)
    channelsuccessrate.Record(channel.Id, false)
    // → shouldRetry 决定是否重试
}
```

---

### 2.3 各状态码处理方式

| 状态码 | 分类 | 是否记熔断 | 是否记成功率 | 是否重试其他渠道 | 最终返回 |
|--------|------|-----------|-------------|-----------------|---------|
| **429** | RateLimit | ❌ | ❌ | ✅（delay 后 retry） | 成功则 200，超限后返回 429 |
| **401** | AuthError | ❌ | ❌ | ❌（直接 break） | **直接返回 401** |
| **403** | AuthError | ❌ | ❌ | ❌（直接 break） | **直接返回 403** |
| **500** | 5xx | ✅ | ✅ | ✅（根据 `ShouldRetryByStatusCode`） | 成功则 200，耗尽返回 500 |
| **502** | 5xx | ✅ | ✅ | ✅ | 成功则 200，耗尽返回 502 |
| **503** | 5xx | ✅ | ✅ | ✅ | 成功则 200，耗尽返回 503 |
| **504** | Timeout | ✅ | ✅ | ❌（`IsAlwaysSkipRetryStatusCode`） | 直接返回 504 |

---

## 三、核心问题：401/403 不应该 fail-fast

### 3.1 当前问题

```go
// controller/relay.go:267-274
if types.IsAuthError(newAPIError) {
    processChannelError(c, chErr, newAPIError)
    if releaseSelectedChannel {
        channellimiter.Release(channel.Id)
    }
    break  // ← 问题在这里
}
```

**问题：** 渠道侧 401/403 直接 `break`，不 retry 其他渠道。

### 3.2 为什么这是错的？

| 场景 | 实际情况 | 当前行为 | 应该行为 |
|------|---------|---------|---------|
| 渠道 A Key 过期 | 渠道 B/C 完全正常 | 返回 401，用户失败 | retry B/C，可能成功 |
| 渠道 A 账号被封 | 渠道 B/C 使用不同账号 | 返回 401，用户失败 | retry B/C，可能成功 |
| 渠道 A 权限不足 | 渠道 B/C 权限正常 | 返回 403，用户失败 | retry B/C，可能成功 |

### 3.3 正确的处理方式

渠道侧 401/403 应该像 429 一样处理：

```go
if types.IsAuthError(newAPIError) {
    // ❌ 不记熔断/成功率（保持 Phase 4 设计）
    processChannelError(c, chErr, newAPIError)
    if releaseSelectedChannel {
        channellimiter.Release(channel.Id)
    }
    // ✅ 应该 retry 其他渠道，除非已经试过所有渠道
    if retryParam.GetRetry() < common.RetryTimes {
        continue  // retry next channel
    }
    break  // 所有渠道都试过，返回 401/403
}
```

### 3.4 用户侧 401/403 不需要改

用户侧 401/403 在 `TokenAuth` 和 `Distribute` 中间件就被拦截了，不会进入 relay retry loop。渠道侧和用户侧的 401/403 在代码流上是分离的。

---

## 四、状态码流转图

```
用户请求
    │
    ▼
┌─────────────────────────────────────┐
│ 中间件链（用户侧）                    │
│ - TokenAuth: 401/500                 │
│ - Distribute: 403/503                │
│ - ModelRequestRateLimit: 429         │
│ - SystemPerformanceCheck: 503        │
└─────────────────────────────────────┘
    │ 通过中间件
    ▼
┌─────────────────────────────────────┐
│ controller/relay.go retry loop       │
│ (渠道侧状态码)                        │
│ - 429: delay → retry                 │
│ - 401/403: break (当前)              │
│ - 504: break                         │
│ - 500/502/503: retry or break        │
└─────────────────────────────────────┘
    │
    ▼
返回给用户
```

---

## 五、总结

| 维度 | 用户侧 | 渠道侧 |
|------|--------|--------|
| **拦截位置** | 中间件（relay 之前） | relay retry loop |
| **401/403 来源** | Token 无效/过期/权限不足 | 上游供应商 Key 失效/权限不足 |
| **当前处理** | 直接返回 | **直接返回（Phase 4 特化）** |
| **问题** | 无 | ❌ 渠道侧 401/403 应该 retry 其他渠道 |
| **429 处理** | 直接返回（用户限流） | delay → retry 其他渠道 ✅ |
| **503 处理** | 无可用渠道时返回 | 所有渠道耗尽后返回最后错误码 |

**核心结论：** 用户侧的 401/403 处理是正确的（直接返回），但渠道侧的 401/403 处理过度激进，应该允许 retry 其他渠道。
