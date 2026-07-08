# Phase 2.3 渠道并发限流完成总结

## 范围

对应路线图 `12-implementation-roadmap.md` 的 L-07 渠道并发限流。

目标是限制单个渠道同时处理的请求数量，避免某个渠道被瞬时并发打爆，并在选路时跳过已满通道。

## 完成内容

- 新增 `pkg/channel_limiter` 包，按 `channel_id` 维护 in-flight 请求数。
- 提供基础接口：
  - `CanAcquire(channelID)`
  - `Acquire(channelID)`
  - `Release(channelID)`
  - `InFlight(channelID)`
- 新增 `setting/operation_setting/channel_limiter_setting.go` 配置项：
  - `enabled`：默认 `false`。
  - `max_concurrent_requests`：默认 `0`，表示不限制。
- 在 `model/channel_cache.go` 随机选路阶段跳过已满渠道。
- 在 `middleware/distributor.go` 对直接指定渠道、亲和渠道等非随机选路路径补充限流检查。
- 在 `controller/relay.go` 和 `RelayTask` 的成功、失败、请求体读取失败路径释放占用，覆盖重试场景。
- 新增 limiter 单元测试和选路跳过满载通道测试。

## 验证情况

已执行：

```bash
go test ./pkg/channel_limiter ./setting/operation_setting ./model ./controller ./middleware
```

相关包测试通过。

## 完成度评估

完成度：第一版完成。

已满足路线图要求：

- 新增 `pkg/channel_limiter`。
- 实现 per-channel 当前并发计数。
- 超过限制时拒绝或跳过该渠道。
- 默认关闭，向后兼容。

## 已知限制

- 路线图描述的是每渠道 `MaxConcurrentRequests` 字段；当前实现是全局 `channel_limiter_setting.max_concurrent_requests`，尚未支持每渠道差异化配置。
- 亲和渠道命中后如果该渠道已满，目前会直接返回无可用渠道，而不是回退到其他随机渠道。
- `Release` 当前依赖实时配置状态；如果请求期间配置从启用改为禁用，可能留下旧 in-flight 计数，后续重新启用时影响判断。

## 后续建议

- 优先调整 `Release`，使释放不依赖当前配置开关，只按 channel 计数扣减。
- 对亲和渠道满载场景增加 fallback，避免还有其他可用渠道时直接 503。
- 如需严格按路线图验收，后续增加渠道级 `MaxConcurrentRequests` 配置，并让全局配置作为默认值。
