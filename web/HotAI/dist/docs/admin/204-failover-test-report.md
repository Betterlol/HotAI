# 故障切换测试报告

> 执行方式：集成测试 `tests/integration/failover_e2e_test.go`，使用 `httptest.NewServer` 模拟上游，内存 SQLite 数据库，无真实渠道/运营商依赖。
>
> 执行日期：2026-07-16

## 1. 执行结果

| 用例 | 场景 | 执行结果 | 实际行为 | 与预期差异 |
|------|------|----------|----------|------------|
| TC-01 | 单渠道失败降级 | ✅ PASS | 500 → retry → channel B(200) | 一致 |
| TC-02 | 鉴权失败自动禁用 | ✅ PASS | 401 → retry → channel B(200)，channel A auto_disabled | 一致 |
| TC-03 | 限流重试 | ✅ PASS | 429 → retry(delay≥10ms) → channel B(200) | 一致 |
| TC-04 | 超时不重试 | ✅ PASS | 504 → no retry → 504 | 一致 |
| TC-05 | 全渠道失败统一 503 | ✅ PASS | 全部渠道返回 500 → 统一返回 503 | 一致 |
| TC-06 | 恢复后自动启用 | ⏭️ SKIP | 依赖系统渠道测试 runner，CI 环境未启动 | 本地手动验证通过 |
| TC-07 | 跨组降级 | ✅ PASS | auto group → default group → 200 | 一致 |

### 执行命令

```bash
go test ./tests/integration/ -run "TestFailover" -v -count=1 -timeout=120s
```

## 2. 关键发现

1. **Phase 4.2 401/403 retry 修复**：渠道侧 401/403 现在会记录熔断/成功率，并 retry 其他渠道（除非全部试过）。修复后 TC-02 行为与测试计划预期一致。
2. **多渠道全部失败统一返回 503**：当所有渠道均存在但全部失败时，统一返回 503 + `no available channel`，而不是最后一个渠道的错误码。单渠道失败（如 504）保留原始错误码。
3. **RetryTimes 默认值为 0**：需在测试中显式设置 `common.RetryTimes = N` 才能触发重试。
4. **429 重试间隔**：由 `retry_setting.ratelimit_retry_interval` 控制，Phase 4 实现为 context-aware delay，不会在客户端断开后堆积 goroutine。

## 3. 改进建议

| 维度 | 表现 | 改进建议 |
|------|------|----------|
| 重试决策准确性 | 500/429/401 按预期 retry，504 正确跳过 | - |
| 熔断及时性 | 401 触发自动禁用并记录熔断/成功率 | 建议文档化默认开关状态 |
| 通知有效性 | 自动禁用通知依赖 root user 配置，测试环境可能超出发送限制 | 生产环境需配置 SMTP/Webhook |
| 恢复能力 | 依赖定时渠道测试 runner，测试环境可能未启动 | CI 中可跳过或单独跑 |
| 用户体验 | 429/500 返回上游原始错误码，401 仅在所有渠道失败后返回 | 可考虑统一错误消息格式 |

## 4. 测试文件清单

| 文件 | 说明 |
|------|------|
| `tests/integration/failover_e2e_test.go` | 7 个故障切换集成测试 |
| `tests/integration/suite.go` | 测试套件：`truncateTables` 修复 |
| `tests/integration/main_test.go` | 测试初始化：迁移 + HTTP 客户端 |
| `controller/relay.go` | Phase 4.2 修复：401/403 记录熔断/成功率并 retry 其他渠道 |
