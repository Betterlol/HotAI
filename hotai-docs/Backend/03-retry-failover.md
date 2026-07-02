# 重试与容错机制

## 重试循环

位置: `controller/relay.go:191-237`

```go
for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
    channel, channelErr := getChannel(c, relayInfo, retryParam)
    // 执行代理请求
    newAPIError = relayHandler(c, relayInfo)
    if newAPIError == nil {
        return  // 成功直接返回
    }
    processChannelError(c, ..., newAPIError)  // 可能自动禁用渠道
    if !shouldRetry(c, newAPIError, ...) {
        break
    }
}
```

关键参数：
- `common.RetryTimes`: 默认 `0`（不重试），可通过环境变量/配置修改
- 每次重试 increment `retry` 参数 → 选择**下一级 Priority** 的渠道（不是重试同一渠道）
- 跨组重试时，当前组所有 Priority 用完 → 切换到下一个 Group

## 重试决策逻辑 `shouldRetry()`

位置: `controller/relay.go:325-355`

```
shouldRetry(c, err, remainingRetries)
  │
  ├─ err == nil → false
  ├─ ChannelAffinity 配置了 SkipRetryOnFailure → false
  ├─ IsChannelError(err) → true (渠道级别错误总是重试)
  ├─ IsSkipRetryError(err) → false (跳过重试的错误标记)
  ├─ remainingRetries <= 0 → false
  ├─ 绑定特定渠道 (specific_channel_id) → false
  ├─ StatusCode 2xx → false
  ├─ StatusCode <100 or >599 → true
  ├─ ErrorCode 在 alwaysSkipRetryCodes 中 → false (如 ErrorCodeBadResponseBody)
  └─ 按 StatusCodeRanges 判断:
      └─ RetryRange: 100-199, 300-399, 401-407, 409-499, 500-503, 505-523, 525-599
      └─ AlwaysSkip: 504, 524
```

### 可配置的 Status Code Ranges

`setting/operation_setting/status_code_ranges.go`

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `AutomaticDisableStatusCodeRanges` | `401` | 这些状态码会触发渠道自动禁用 |
| `AutomaticRetryStatusCodeRanges` | 见上 | 这些状态码范围会触发重试 |

两者都可通过后台设置页面配置（字符串格式：`401,500-503`）。

## 渠道自动禁用（Circuit Breaker）

位置: `service/channel.go:45-65`

```go
func ShouldDisableChannel(err *types.NewAPIError) bool {
    if !common.AutomaticDisableChannelEnabled { return false }
    if types.IsChannelError(err) { return true }
    if types.IsSkipRetryError(err) { return false }
    if operation_setting.ShouldDisableByStatusCode(err.StatusCode) { return true }
    // AC 自动机关键词匹配 (如 "credit balance too low", "insufficient_quota")
    return AcSearch(lowerMessage, AutomaticDisableKeywords, true)
}
```

禁用动作:
1. `model.UpdateChannelStatus()` → 渠道状态改为 `ChannelStatusAutoDisabled` (3)
2. 同步更新内存缓存 `CacheUpdateChannelStatus()`
3. 从 `group2model2channels` 移除该渠道
4. 通知管理员

自动启用:
- `ShouldEnableChannel()`: 渠道状态为 AutoDisabled 且测试成功 → 重新启用
- 通过定时 `ChannelTest` 任务检测恢复

## 渠道自动测试

位置: `controller/channel-test.go:907-1016`

### 测试模式

| 模式 | 行为 | 配置 |
|------|------|------|
| `scheduled_all` | 定时测试所有启用的渠道 | `auto_test_channel_minutes` |
| `passive_recovery` | 只测试已自动禁用的渠道 | `ChannelTestModePassiveRecovery` |

### 测试流程

```
performChannelTests()
  ├─ 遍历渠道列表
  │   ├─ 跳过手动禁用的渠道
  │   ├─ testChannel() → 模拟一次真实请求
  │   │   ├─ 使用渠道的 TestModel（或第一个模型）
  │   │   ├─ 通过 Adaptor 发起完整请求
  │   │   └─ 记录响应时间
  │   │
  │   ├─ 失败/超阈值 → DisableChannel()
  │   ├─ 已禁用但现在成功 → EnableChannel()
  │   └─ UpdateResponseTime()
  │
  └─ 通知 root 用户测试完成
```

### 禁用阈值
- `ChannelDisableThreshold`: 默认 5.0 秒（环境变量 `CHANNEL_DISABLE_THRESHOLD`）
- 响应时间超过此阈值 → 自动禁用

## 现有容错能力总结

| 能力 | 状态 | 说明 |
|------|------|------|
| 按 Priority 降级 | ✅ 已有 | retry 递增选更低优先级 |
| 跨组降级 (auto group) | ✅ 已有 | 组内优先级用完自动切换 |
| Channel Affinity 亲和性 | ✅ 已有 | 同会话/同用户固定路由 |
| 自动禁用 (关键词匹配) | ✅ 已有 | AC 自动机匹配错误消息 |
| 自动禁用 (状态码) | ✅ 已有 | 默认 401，可配置 |
| 定时渠道测试 | ✅ 已有 | 可选 scheduled_all / passive_recovery |
| 定时自动启用 | ✅ 已有 | 测试通过后自动恢复 |
| 多 Key 切换 | ✅ 已有 | Random/Polling 模式 |
| 预扣费 + 退款 | ✅ 已有 | 失败自动退款 |

| 缺失能力 | 影响 | 实现难度 |
|----------|------|----------|
| 延迟感知路由 | 不能根据响应时间动态选择最快渠道 | 中（需改造 selection 逻辑） |
| 成本感知路由 | 不能按渠道单价选最便宜的 | 中（需扩展 Ability 成本字段） |
| 滑动窗口熔断 | 没有半开状态，没有错误率滑动窗口 | 高 |
| 自适应重试 | 没有 exponential backoff / jitter | 低 |
| 流式连接重连 | SSE/WS 断开后无法转到其他渠道 | 高 |
