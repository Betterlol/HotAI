# Phase 3.1 成本感知路由完成总结

## 范围

对应路线图 `12-implementation-roadmap.md` 的 L-02 成本感知路由。

目标是在现有 Priority + Weight + 延迟加权的基础上，在同 Priority 层内引入渠道的价格信号，优先选择更便宜的渠道，以降低上游调用成本，同时默认关闭以保持生产兼容。

关键设计：每个 (渠道, 模型) 对独立定价，路由时按请求的模型评估各渠道对应模型的价格。

## 完成内容

### 配置（默认关闭）

- 新增 `setting/operation_setting/cost_routing_setting.go`：
  - `enabled`：默认 `false`。
  - `cost_weight`：默认 `0.2`，范围归一到 `0..1`，控制成本对最终权重的贡献度。

### 数据模型扩展

- `model/channel.go`：
  - `PricePerToken *float64`、`PricePerRequest *float64`：渠道默认价格，兜底使用。
  - `PriceMapping *string`（JSON）：逐模型独立定价。格式：
    ```json
    {"gpt-4o": {"price_per_token": 0.001}, "claude-3": {"price_per_token": 0.015, "price_per_request": 0.05}}
    ```
- `model/ability.go`：同步新增价格字段，新增 `RoutingCost()` 方法和 `routingCost()` 辅助函数。
- `model/ability.go`：新增 `getModelPrice(channel, model)` 函数，优先读 `PriceMapping` 中的模型级价格，没有再退到渠道默认价。
- `AddAbilities`、`UpdateAbilities` 和 `DeleteAbilities` 全部使用 `getModelPrice`，确保新建/更新渠道时每个 Ability 获得正确的逐模型价格。

### 选路集成

- `model/channel_cache.go`：增加全局缓存 `channelCostIndex map[string]map[string]map[int]float64`，在 `InitChannelCache()` 同步时从 Ability 表构建。
- `adjustedChannelWeights()` 增加 `group` 和 `model` 参数，从缓存获取每渠道每模型成本并叠加 `costAdjustedWeight()`。
- 新增 `costAdjustedWeight()`：按 `minPrice / channelPrice` 比率缩放权重，`CostWeight` 控制混合强度。
- 价格 nil 或 <=0 时按中性权重处理（不影响无价格渠道）。
- 兼容非缓存选路路径（`GetChannel`）：该路径不做延迟/成本加权，不受影响。

### 配置测试

- `setting/operation_setting/cost_routing_setting_test.go`：默认关闭 + 边界值钳位。

### 选路权重测试

- `model/channel_cache_test.go`：
  - `TestCostAdjustedWeightDisabledKeepsBaseWeight`：关闭时不调整。
  - `TestCostAdjustedWeightPenalizesExpensiveChannel`：贵渠道权重衰减。
  - `TestCostAdjustedWeightBlendsWithConfiguredWeight`：`CostWeight` 混合生效。
  - `TestAdjustedChannelWeightsApplyAbilityCosts`：集成测试验证 `adjustedChannelWeights` 按成本索引正确调整。

### API 权限分类

- `controller/channel_authz.go`：`price_per_token`、`price_per_request`、`price_mapping` 归入 `channelNonSensitiveFields`，设 `ChannelWrite` 权限即可编辑。

### 交互式价格编辑脚本

- 新增 `scripts/sh/channel-price-editor.py`，复用现有 API Client 模式：
  - 登录 → 列出渠道
  - 选择渠道 → 展示各模型当前独立价格
  - 设置渠道默认价（兜底）
  - **逐模型设置独立价格**：每个模型可设不同的 `price_per_token` / `price_per_request`
  - 留空 = 不覆盖，输入 0 = 显式零价
  - 添加新模型时可同步设价格
  - 最终写入 `PriceMapping` JSON，自动同步到 Ability 表

### 测试流程文档

- 新增 `scripts/sh/backend/Phase-3.1-cost-routing.md`
  - 基线配置
  - 创建两个渠道 + 脚本逐模型设置不同价格
  - 关闭时基线测试（分布均匀）
  - 开启后验证便宜模型概率更高
  - `cost_weight` 调参观察
  - 灰度建议和回滚

## 验证情况

已执行：

```bash
go test ./model ./controller ./setting/operation_setting
go test ./model ./controller ./middleware ./service ./setting/operation_setting ./pkg/channel_limiter ./pkg/circuitbreaker ./common
```

全部包测试通过。

## 完成度评估

完成度：第一版完成。

已满足路线图要求：

- `model/ability.go` 增加价格字段（`PricePerToken`、`PricePerRequest`）。
- `model/channel.go` 增加默认价格字段和 `PriceMapping` 逐模型覆盖。
- 选路时按 `minPrice / channelPrice` 加权。
- `CostAwareRoutingConfig` 配置（默认关闭，向后兼容）。
- 延迟感知作为前置条件已上线，成本作为第二维度叠加。

## 已知限制

- 当前使用 Ability 表中每个 (group, model, channel) 组合的静态价格，没有考虑计费表达式的动态价格或实时倍率变化。如果需要更精确的成本信号，后续可集成 `pricing.go` 中的模型倍率/分组倍率运算。
- 所有价格非必填，默认为 nil，不影响现有渠道运营。
- 没有前端输入框（需通过 `channel-price-editor.py` 脚本或直接 PUT API 写入）。

## 后续建议

- 补充前端渠道编辑页的逐模型价格输入（复用 `model_mapping` 编辑器的模式）。
- 灰度上线后观察成本变化，调整默认 `cost_weight`。
- 在 Phase 3.3 动态权重中叠加成功率信号，形成完整的 `Weight × Latency × Cost × SuccessRate` 综合评分。
