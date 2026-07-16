# Phase 4.3 多渠道全部失败统一返回 503 完成总结

## 1. Stage 描述

修复多渠道全部失败时的响应状态码不一致问题：统一返回 503 Service Unavailable，而不是最后一个渠道的上游错误码。

## 2. Stage 元数据

- STAGE_ID: phase-4.3
- STAGE_TYPE: bugfix
- BASE_COMMIT: `c17a2cd4`（Phase 4.2 401/403 retry 修复）

## 3. 问题分析

### 3.1 原有行为

当多个渠道依次失败后，返回**最后一个渠道的上游错误码**：

```
渠道 A → 500（newAPIError = 500）
渠道 B → 500（newAPIError 被覆盖为 500）
循环结束 → 返回 500
```

**问题：**
1. 返回码不稳定 — 取决于重试顺序和最后一个渠道的上游状态
2. 用户困惑 — 500 和 503 对用户来说都是"请求失败"，但语义不同
3. 细节丢失 — 上游错误信息本可通过 `/api/log/` 查看，没必要在响应中保留

### 3.2 与测试计划的差异

| 项目 | 测试计划预期 | 实际行为 |
|------|-------------|---------|
| 返回状态码 | 503 | 最后一个渠道的错误码（500/502/504 等） |
| 错误消息 | `no available channel` | 上游原始错误消息 |
| 触发条件 | 所有渠道失败 | 所有渠道失败 |

## 4. 修复内容

### 4.1 代码修改

**文件：** `controller/relay.go`

```go
// When multiple channels were attempted and all failed, unify the response
// to 503 so callers see a stable "no available channel" error instead of
// the last upstream status code. Upstream details are still available via
// /api/log/.
if newAPIError != nil && retryParam.GetRetry() > 0 {
    newAPIError = types.NewErrorWithStatusCode(
        errors.New("no available channel"),
        types.ErrorCodeModelNotFound,
        http.StatusServiceUnavailable,
    )
}
```

**关键判断：** `retryParam.GetRetry() > 0` 确保只有**实际发生了重试（多渠道尝试）**时才统一返回 503。单渠道失败（如 504 不重试）保留原始错误码。

### 4.2 测试更新

**文件：** `tests/integration/failover_e2e_test.go`

- `TestFailoverAllChannelsDownReturns500` 重命名为 `TestFailoverAllChannelsDownReturns503`
- 断言从 `http.StatusInternalServerError` 更新为 `http.StatusServiceUnavailable`

## 5. 修复后行为

```
多渠道全部失败：
    │
    ├─ 渠道 A → 500
    ├─ 渠道 B → 500（retryParam > 0）
    │
    └─ 循环结束
          └─ newAPIError = 503（统一）
                ├─ StatusCode: 503
                ├─ ErrorCode: ErrorCodeModelNotFound
                └─ Message: "no available channel"

单渠道失败（如 504）：
    └─ newAPIError = 504（保留原始错误码）
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
| `TestFailover504SkipsRetry` | ✅ PASS | 504 → no retry → 504（单渠道保留原始码） |
| `TestFailoverAllChannelsDownReturns503` | ✅ PASS | 全部 500 → 统一 503 |
| `TestFailoverAutoGroupFallsBackToDefault` | ✅ PASS | auto → default → 200 |
| `TestFailoverChannelReEnabledAfterTest` | ✅ PASS | 自动恢复（依赖 runner） |

全量测试：`go test ./...` 全部通过，无回归。

## 7. 与 Phase 4/4.2 行为对比

| 场景 | Phase 4 | Phase 4.2 | Phase 4.3 |
|------|---------|-----------|-----------|
| 渠道 A 401，B 正常 | 401 fail-fast | 401 → retry → B(200) | 不变 |
| 渠道 A 429，B 正常 | 429 → retry → B(200) | 429 → retry → B(200) | 不变 |
| 渠道 A 504 | 504 → 返回 504 | 504 → 返回 504 | 不变 |
| A/B 都 500 | 返回 500 | 返回 500 | **统一 503** |

## 8. 设计决策

### 8.1 为什么保留单渠道失败的原始错误码？

单渠道失败时（如 504 不重试），用户应该知道具体是什么错误：
- 504 → 超时
- 500 → 服务端错误
- 502 → 网关错误

这些信息对用户排查问题有价值。

### 8.2 为什么多渠道失败要统一 503？

多渠道失败时，具体是哪个渠道的什么错误已经不重要了，重要的是"没有可用渠道"：
- 统一 503 语义明确
- 行为稳定，不随重试顺序变化
- 上游细节可通过 `/api/log/` 查看

### 8.3 判断条件：`retryParam.GetRetry() > 0`

| 场景 | retryParam | 返回 |
|------|-----------|------|
| 单渠道 504（不重试） | 0 | 504（原始码） |
| 单渠道 500（重试次数已耗尽） | 1 | 503（统一） |
| 多渠道全部失败 | 1+ | 503（统一） |

## 9. 后续建议

1. **考虑可配置性**：如果用户希望看到具体错误码，可以新增配置项控制是否统一 503
2. **错误消息标准化**：当前返回 `"no available channel"`，可考虑在 `i18n` 中增加多语言支持
3. **监控告警**：统一 503 后，可以通过监控 503 比例来检测渠道健康度

## 10. 修改文件清单

| 文件 | 变更 |
|------|------|
| `controller/relay.go` | 多渠道全部失败时统一返回 503 |
| `tests/integration/failover_e2e_test.go` | TC-05 重命名并更新断言为 503 |
| `branch_doc/hotai-docs/Backend/design/status-code-analysis.md` | 更新状态码处理表格和总结 |
| `branch_doc/hotai-docs/Backend/design/10-failover-test-plan.md` | 更新 TC-05 预期和实际执行