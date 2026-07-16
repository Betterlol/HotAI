# Phase 4.2 401/403 故障切换修复完成总结

## 1. Stage 描述

修复 Phase 4 中 401/403 错误处理过度简化的问题：渠道侧 401/403 不应直接返回给用户，而应记录失败并 retry 其他可用渠道。

## 2. Stage 元数据

- STAGE_ID: phase-4.2
- STAGE_TYPE: bugfix
- BASE_COMMIT: `23f6d7ed`（Phase 4 集成测试）

## 3. 问题分析

### 3.1 Phase 4 原有行为

```go
// controller/relay.go:267-274
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

### 3.2 影响场景

| 场景 | 原有行为 | 合理行为 |
|------|---------|---------|
| 渠道 A Key 过期，B/C 正常 | 返回 401，用户失败 | retry B/C，可能成功 |
| 渠道 A 账号被封，B/C 使用不同账号 | 返回 401，用户失败 | retry B/C，可能成功 |
| 所有渠道都 401 | 返回 401 | 返回 401（正确） |

## 4. 修复内容

### 4.1 代码修改

**文件：** `controller/relay.go`

```go
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

### 4.2 测试更新

**文件：** `tests/integration/failover_e2e_test.go`

- `TestFailover401DisablesChannelAndFallsBack`：
  - 期望状态码从 `401` 改为 `200`（retry 到 channel B 成功）
  - 保持验证 channel A 被自动禁用

## 5. 修复后行为

```
渠道 A 返回 401
    │
    ├─ 记录熔断：circuitbreaker.MarkFailure(1)
    ├─ 记录成功率：channelsuccessrate.Record(1, false)
    ├─ 释放限流：channellimiter.Release(1)
    ├─ processChannelError（日志/通知）
    │
    └─ retryParam < RetryTimes?
          ├─ 是 → continue（选择渠道 B）
          └─ 否 → break（所有渠道试过，返回 401）
```

## 6. 测试结果

```bash
go test ./tests/integration/ -run "TestFailover" -v -count=1 -timeout=120s
```

| 测试 | 状态 | 说明 |
|------|------|------|
| `TestFailover500FallsBackToNextChannel` | ✅ PASS | 500 → retry → B(200) |
| `TestFailover401DisablesChannelAndFallsBack` | ✅ PASS | 401 → retry → B(200)，A auto_disabled |
| `TestFailover429RetriesOtherChannel` | ✅ PASS | 429 → delay → retry → B(200) |
| `TestFailover504SkipsRetry` | ✅ PASS | 504 → no retry → 504 |
| `TestFailoverAllChannelsDownReturns500` | ✅ PASS | 全部 500 → 返回 500 |
| `TestFailoverAutoGroupFallsBackToDefault` | ✅ PASS | auto → default → 200 |
| `TestFailoverChannelReEnabledAfterTest` | ✅ PASS | 自动恢复（依赖 runner） |

全量测试：`go test ./...` 全部通过，无回归。

## 7. 与 Phase 4 行为对比

| 错误码 | Phase 4 行为 | Phase 4.2 行为 |
|--------|-------------|---------------|
| 429 | 不记熔断/成功率 → delay → retry | 不变 |
| 401/403 | **不记熔断/成功率 → break** | **记熔断/成功率 → retry（除非全部试过）** |
| 500/502/503 | 记熔断/成功率 → retry or break | 不变 |
| 504 | 记熔断/成功率 → break | 不变 |

## 8. 后续建议

1. **考虑 401/403 的 retry 次数限制**：当前使用全局 `RetryTimes`，与 500/502 共享。如果希望 401/403 有独立的 retry 次数，可以新增配置项。
2. **渠道自动禁用通知优化**：测试中看到 `failed to notify root user: notification limit exceeded`，生产环境需配置 SMTP/Webhook。
3. **Phase 5 高级特性**：Canary 发布 / OpenTelemetry 追踪 / 流式切换，投入产出比较低，建议根据实际生产需要再决定。

## 9. 修改文件清单

| 文件 | 变更 |
|------|------|
| `controller/relay.go` | 401/403 分支增加熔断/成功率记录 + retry |
| `tests/integration/failover_e2e_test.go` | TC-02 期望改为 200 |
| `branch_doc/hotai-docs/Backend/design/status-code-analysis.md` | 状态码来源分析文档（新增） |
