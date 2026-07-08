# Phase 2.1 延迟感知路由完成总结

## 范围

对应路线图 `12-implementation-roadmap.md` 的 S-01 延迟感知路由。

目标是在现有 Priority + Weight 路由基础上，在同 Priority 层内引入渠道延迟信号，降低高延迟渠道被选中的概率，同时默认关闭以保持生产兼容。

## 完成内容

- 在 `model/channel_cache.go:GetRandomSatisfiedChannel()` 中接入同 Priority 层内延迟加权。
- 使用 `Channel.ResponseTime` 作为第一版延迟信号，符合 `09-routing-design.md` 中“先使用渠道测试延迟”的约束。
- 新增 `setting/operation_setting/latency_routing_setting.go` 配置项：
  - `enabled`：默认 `false`。
  - `weight_factor`：默认 `0.3`，范围归一到 `0..1`。
- 保留管理员配置的基础 `Weight`，延迟仅作为混合因子，不改变 Priority 分层语义。
- 对 `ResponseTime <= 0` 的渠道按中性权重处理，避免历史数据缺失导致不可选。
- 新增/更新单元测试覆盖：
  - 关闭配置时保持原权重。
  - 慢通道权重衰减。
  - `weight_factor` 混合生效。
  - 缺失延迟样本不惩罚。

## 验证情况

已执行：

```bash
go test ./model ./setting/operation_setting
```

相关包测试通过。

## 完成度评估

完成度：基本完成。

已满足路线图要求：

- 修改 `GetRandomSatisfiedChannel()`。
- 同 Priority 层内按 `ResponseTime` 调整随机权重。
- 配置默认关闭。
- 不影响现有配置和 Priority 语义。

## 已知限制

- 当前使用渠道缓存中的 `ResponseTime`，不是实时业务请求延迟。
- 真实业务延迟接入需要先补渠道级请求统计，不能直接假设现有 `perf_metrics` 已具备渠道级时间序列。
- 当前测试主要覆盖权重计算，后续可补一个概率分布或确定性随机源测试来证明低延迟渠道选择概率更高。

## 后续建议

- 在 Phase 3 动态权重中叠加成功率和成本信号。
- 如果要使用真实请求延迟，先补渠道维度统计或按请求结束更新独立延迟指标。
