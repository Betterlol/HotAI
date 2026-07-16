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

### 2.2 分类处理（Phase 4 特化 + Phase 4.2 修复）

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
        // Phase 4.2 修复：401/403 也应记录并 retry
        circuitbreaker.MarkFailure(channel.Id)
        channelsuccessrate.Record(channel.Id, false)
        if releaseSelectedChannel {
            channellimiter.Release(channel.Id)
        }
        if retryParam.GetRetry() < common.RetryTimes {
            continue  // retry 其他渠道
        }
        break  // 所有渠道试过，返回 401/403
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
| **401** | AuthError | ✅ | ✅ | ✅（retry 其他渠道，除非全部试过） | 成功则 200，全部失败返回 401 |
| **403** | AuthError | ✅ | ✅ | ✅（retry 其他渠道，除非全部试过） | 成功则 200，全部失败返回 403 |
| **500** | 5xx | ✅ | ✅ | ✅（根据 `ShouldRetryByStatusCode`） | 成功则 200，耗尽返回 500 |
| **502** | 5xx | ✅ | ✅ | ✅ | 成功则 200，耗尽返回 502 |
| **503** | 5xx | ✅ | ✅ | ✅ | 成功则 200，**多渠道全部失败统一返回 503** |
| **504** | Timeout | ✅ | ✅ | ❌（`IsAlwaysSkipRetryStatusCode`） | **单渠道超时保留 504，多渠道全部失败统一 503** |

---

## 三、Phase 4.2 修复：401/403 应 retry 其他渠道

### 3.1 原有问题（Phase 4）

```go
// controller/relay.go:267-274 (Phase 4 原代码)
if types.IsAuthError(newAPIError) {
    processChannelError(c, chErr, newAPIError)
    if releaseSelectedChannel {
        channellimiter.Release(channel.Id)
    }
    break  // ← 问题：直接返回，不 retry
}
```

**问题：**
1. 不 retry 其他渠道 — 一个渠道 401 导致用户请求失败，即使其他渠道健康
2. 不记熔断/成功率 — 问题渠道不会被路由规避

### 3.2 Phase 4.2 修复

```go
// controller/relay.go:267-278 (Phase 4.2 修复后)
if types.IsAuthError(newAPIError) {
    chErr := *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan())
    processChannelError(c, chErr, newAPIError)
    circuitbreaker.MarkFailure(channel.Id)           // ✅ 记录失败
    channelsuccessrate.Record(channel.Id, false)     // ✅ 记录成功率
    if releaseSelectedChannel {
        channellimiter.Release(channel.Id)
    }
    if retryParam.GetRetry() < common.RetryTimes {
        continue  // ✅ retry 其他渠道
    }
    break
}
```

### 3.3 修复后行为

```
渠道 A 返回 401/403
    │
    ├─ 记录熔断：circuitbreaker.MarkFailure(1)
    ├─ 记录成功率：channelsuccessrate.Record(1, false)
    ├─ 释放限流：channellimiter.Release(1)
    ├─ processChannelError（日志/通知）
    │
    └─ retryParam < RetryTimes?
          ├─ 是 → continue（选择渠道 B）
          └─ 否 → break（所有渠道试过，返回 401/403）
```

### 3.4 为什么 401/403 应该记录熔断/成功率？

| 维度 | 429 不记录合理 | 401/403 应记录 |
|------|---------------|---------------|
| **暂时性** | 429 是临时的，延迟后会恢复 | 401/403 通常是 Key 失效，不会自动恢复 |
| **渠道健康** | 健康渠道被限流不应惩罚 | 持续 401 的渠道就是不健康，应该被规避 |
| **路由准确性** | 记录 429 会导致路由偏移 | 记录 401 能让路由自动避开问题渠道 |
| **恢复预期** | 429 之后自动恢复 | 401 需要人工干预（换 Key） |

### 3.5 用户侧 401/403 不需要改

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
│ - 401/403: 记录失败 → retry（Phase 4.2）│
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
| **处理方式** | 直接返回 | **Phase 4.2 修复：记录失败并 retry 其他渠道** |
| **429 处理** | 直接返回（用户限流） | delay → retry 其他渠道 ✅ |
| **503 处理** | 无可用渠道时返回 | **多渠道全部失败统一返回 503** |

**核心结论：**
- 用户侧的 401/403 处理是正确的（直接返回）
- Phase 4.2 修复了渠道侧 401/403 的处理：现在会记录熔断/成功率，并 retry 其他渠道
- 仅当所有渠道都失败时，才返回 503
