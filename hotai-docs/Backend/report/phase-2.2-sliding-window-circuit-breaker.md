# Phase 2.2 滑动窗口熔断完成总结

## 范围

对应路线图 `12-implementation-roadmap.md` 的 L-01 滑动窗口熔断器。

目标是用可配置的滑动窗口错误率熔断替代简单的一次失败立即禁用，让渠道在短期异常时先进入内存熔断状态，避免过度修改持久化渠道状态。

## 完成内容

- 新增 `pkg/circuitbreaker` 包，实现每渠道独立 breaker。
- 支持状态流转：
  - `CLOSED`
  - `OPEN`
  - `HALF_OPEN`
- 支持滑动窗口桶统计：
  - `window_seconds`
  - `bucket_seconds`
  - `min_request_count`
  - `error_threshold`
- 支持半开探测参数：
  - `open_timeout_seconds`
  - `half_open_max_requests`
  - `half_open_success_threshold`
- 新增 `setting/operation_setting/circuit_breaker_setting.go` 配置项，默认关闭。
- 在 `model/channel_cache.go` 选路阶段过滤 OPEN 或 HALF_OPEN 已满的渠道。
- 在 `controller/relay.go` 的成功和失败路径记录熔断样本。
- 已补齐关键兼容语义：当熔断器启用时，relay 错误不再触发旧的立即自动禁用逻辑，避免和滑动窗口熔断重复生效。

## 验证情况

已执行：

```bash
go test ./pkg/circuitbreaker ./model ./controller ./service ./setting/operation_setting
```

相关包测试通过。

## 完成度评估

完成度：核心完成。

已满足路线图要求：

- 新增熔断器包。
- 实现 CLOSED / OPEN / HALF_OPEN。
- 参数可通过 Option 配置。
- 接入选路和 relay 主流程。
- 默认关闭，向后兼容。
- 启用熔断时已停止旧的立即自动禁用路径。

## 已知限制

- 当前实现把滑动窗口桶放在 `breaker.go` 中，没有拆成独立 `window.go`。这是结构差异，不影响功能。
- 半开恢复测试目前使用短暂 `time.Sleep`，后续可以注入 clock 降低时间型测试的不稳定性。
- 错误样本口径仍需结合线上策略校准，例如哪些本地错误或 skip-retry 错误应排除在熔断统计外。

## 后续建议

- 补充 Phase 2 故障切换实测记录到 `10-failover-test-plan.md`。
- 为 breaker 增加状态观测指标，便于 Grafana 面板展示当前 OPEN 渠道数量。
- 如需对不可恢复错误继续持久化禁用，可新增明确白名单，而不是复用旧的所有自动禁用规则。
