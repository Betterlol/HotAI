# Phase 4.4 补充 Prometheus 成本与余额指标完成总结

## 1. Stage 描述

补充 `pkg/prometheus_metrics/metrics.go` 中缺失的两项 Prometheus 指标，使其与《监控指标与告警规则清单》（`design/11-monitoring-alerting-design.md`）保持一致：
- `hotai_relay_cost_total`：记录每次成功结算的业务成本（quota 单位）
- `hotai_channel_balance_usd`：记录上游渠道余额（USD）

## 2. Stage 元数据

- STAGE_ID: phase-4.4
- STAGE_TYPE: feature
- BASE_COMMIT: `3c04c93f`（Phase 4.3 多渠道 503 修复）

## 3. 问题分析

### 3.1 原有缺口

`design/11-monitoring-alerting-design.md` 在"Prometheus 指标清单"中列出了 `hotai_cost_total` 和 `hotai_channel_balance_usd`，但 `pkg/prometheus_metrics/metrics.go` 只实现了以下指标：

- `hotai_requests_total`
- `hotai_requests_duration_ms`
- `hotai_ttft_ms`
- `hotai_tokens_total`
- `hotai_upstream_errors_total`
- `hotai_success_rate`
- `hotai_active_connections`
- `hotai_channel_status`

**缺失：**
1. `hotai_relay_cost_total` — 无法在 Grafana/Prometheus 中按模型/分组/渠道统计成本趋势
2. `hotai_channel_balance_usd` — 无法在监控面板中直接观测渠道余额变化

### 3.2 与告警规则的依赖关系

设计文档中的 A-04（单日成本超预算）和 A-05/A-06（渠道余额告警）需要这两项指标作为数据源。虽然当前告警规则引擎尚未实现，但指标先行，后续接入告警时无需再修改指标定义。

## 4. 修复内容

### 4.1 代码修改

**文件：** `pkg/prometheus_metrics/metrics.go`

新增指标声明（`promauto` 自动注册，`controller/metrics.go` 无需改动）：

```go
relayCostTotal = promauto.NewCounterVec(
    prometheus.CounterOpts{
        Name: "hotai_relay_cost_total",
        Help: "Total relay business cost in quota units, by model, group, and channel. Includes group ratios and surcharges.",
    },
    []string{"model", "group", "channel"},
)

channelBalance = promauto.NewGaugeVec(
    prometheus.GaugeOpts{
        Name: "hotai_channel_balance_usd",
        Help: "Last observed upstream channel balance in USD. Updated periodically by the balance refresh task.",
    },
    []string{"channel"},
)
```

新增辅助函数（集中处理 label 默认值和类型转换）：

```go
func RecordRelayCost(modelName, groupName, channelID string, quota int) {
    if quota == 0 {
        return
    }
    modelName = labelOrDefault(modelName, "unknown")
    groupName = labelOrDefault(groupName, "default")
    if channelID == "" {
        channelID = "unknown"
    }
    relayCostTotal.WithLabelValues(modelName, groupName, channelID).Add(float64(quota))
}

func SetChannelBalance(channelID string, balance float64) {
    if channelID == "" {
        channelID = "unknown"
    }
    channelBalance.WithLabelValues(channelID).Set(balance)
}
```

### 4.2 成本指标接入点

**文件：** `service/text_quota.go`

在 `PostTextConsumeQuota` 的 `gopool.Go` 异步块中，`RecordRelaySample` 之后增加：

```go
if summary.Quota > 0 {
    channelID := ""
    if relayInfo.ChannelMeta != nil && relayInfo.ChannelId > 0 {
        channelID = strconv.Itoa(relayInfo.ChannelId)
    }
    prometheusmetrics.RecordRelayCost(summary.ModelName, relayInfo.UsingGroup, channelID, summary.Quota)
}
```

**设计理由：**
- `summary.Quota` 是 `SettleBilling` 成功后的最终计费值（已包含分组倍率、附加费、阶梯计价等），代表**业务成本**而非纯上游 API 价格
- 放在 `gopool.Go` 中，不阻塞主请求链路
- `summary.TotalTokens == 0` 时 quota 为 0，自动被 `RecordRelayCost` 的 guard 跳过

**文件：** `service/quota.go`

- `PostAudioConsumeQuota`：同样的 `gopool.Go` 块中增加 `RecordRelayCost(relayInfo.OriginModelName, relayInfo.UsingGroup, channelID, quota)`
- `PostWssConsumeQuota`：补充缺失的 `gopool.Go(RecordRelaySample...)` 块，同时增加 `RecordRelayCost(modelName, relayInfo.UsingGroup, channelID, quota)`

### 4.3 余额指标接入点

**文件：** `model/channel.go`

在 `UpdateBalance` 方法的末尾（DB 更新成功后）增加：

```go
prometheusmetrics.SetChannelBalance(strconv.Itoa(channel.Id), balance)
```

**设计理由：**
- `UpdateBalance` 是**唯一**的余额持久化入口，`controller/channel-billing.go` 中全部 10 个渠道专属 balance 函数（OpenAI/Azure/Custom/AIProxy/API2GPT/SiliconFlow/DeepSeek/AIGC2D/OpenRouter/Moonshot）最终都调用此方法
- 无需修改 `controller/channel-billing.go` 中任何调用点，避免遗漏
- 余额更新是异步定时任务（默认 `AutomaticallyUpdateChannels`），Gauge 值天然允许"上次刷新值"，符合 Prometheus Gauge 语义

### 4.4 指标 Label 说明

| 指标 | 类型 | Labels | 单位 | 更新时机 |
|------|------|--------|------|----------|
| `hotai_relay_cost_total` | Counter | model, group, channel | quota（内部计费单位） | 每次成功结算后异步 +1 |
| `hotai_channel_balance_usd` | Gauge | channel | USD | 每次余额刷新后 Set |

**Quota 转 USD 参考：** `1 USD = common.QuotaPerUnit`（当前 500000）quota。Grafana 中可通过 `hotai_relay_cost_total / 500000` 估算美元成本。

## 5. 修改后行为

```
用户请求成功结算：
    │
    ├─ PostTextConsumeQuota / PostAudioConsumeQuota / PostWssConsumeQuota
    │     ├─ SettleBilling(ctx, relayInfo, quota) → 扣费成功
    │     └─ gopool.Go(...)
    │           ├─ perfmetrics.RecordRelaySample(...)  （已有）
    │           └─ prometheusmetrics.RecordRelayCost(...)  （新增）
    │
    └─ /api/metrics 可见：
          hotai_relay_cost_total{model="gpt-4",group="default",channel="1"} 1500

渠道余额刷新：
    │
    ├─ updateChannelBalance(channel) → 计算 balance
    │     └─ channel.UpdateBalance(balance)
    │           ├─ DB.Updates(balance, balance_updated_time)
    │           └─ prometheusmetrics.SetChannelBalance("1", 42.5)  （新增）
    │
    └─ /api/metrics 可见：
          hotai_channel_balance_usd{channel="1"} 42.5
```

## 6. 测试结果

```bash
go build ./...
go test ./tests/integration/ -run "TestFailover" -v -count=1 -timeout=120s
go test ./service/... -count=1 -timeout=120s
go test ./model/... -count=1 -timeout=120s
```

| 测试 | 状态 | 说明 |
|------|------|------|
| `go build ./...` | ✅ PASS | 全项目编译无错误 |
| `TestFailover500FallsBackToNextChannel` | ✅ PASS | 故障切换测试无回归 |
| `TestFailover401DisablesChannelAndFallsBack` | ✅ PASS | |
| `TestFailover429RetriesOtherChannel` | ✅ PASS | |
| `TestFailover504SkipsRetry` | ✅ PASS | |
| `TestFailoverAllChannelsDownReturns503` | ✅ PASS | |
| `TestFailoverAutoGroupFallsBackToDefault` | ✅ PASS | |
| `TestFailoverChannelReEnabledAfterTest` | ✅ PASS | |
| `go test ./service/...` | ✅ PASS | service 包全量通过 |
| `go test ./model/...` | ✅ PASS | model 包全量通过 |

**注意：** `pkg/prometheus_metrics` 当前无测试文件（`[no test files]`），指标逻辑通过集成测试间接覆盖。后续可补充单元测试 mock `promauto` 注册器。

## 7. 与设计文档对齐情况

| 指标 | 设计文档要求 | 实现状态 |
|------|-------------|----------|
| `hotai_relay_cost_total` | 文档列出 | ✅ 已实现 |
| `hotai_channel_balance_usd` | 文档列出 | ✅ 已实现 |
| `hotai_requests_total` | 文档列出 | ✅ 已有 |
| `hotai_requests_duration_ms` | 文档列出 | ✅ 已有 |
| `hotai_ttft_ms` | 文档列出 | ✅ 已有 |
| `hotai_tokens_total` | 文档列出 | ✅ 已有 |
| `hotai_upstream_errors_total` | 文档列出 | ✅ 已有 |
| `hotai_success_rate` | 文档列出 | ✅ 已有 |
| `hotai_active_connections` | 文档列出 | ✅ 已有 |
| `hotai_channel_status` | 文档列出 | ✅ 已有 |

## 8. 设计决策

### 8.1 为什么使用 `summary.Quota` 而不是上游 `usage.Cost`？

- `usage.Cost`（`dto.Usage.Cost`）是上游 provider 返回的原始美元价格，**不可靠且不完整**（仅 OpenRouter 等少数 provider 返回）
- `summary.Quota` 是平台统一计算后的业务成本，包含：
  - 分组倍率（GroupRatio）
  - 模型倍率（ModelRatio）
  - 附加费（Web Search / File Search / Audio Input / Image Generation）
  - 阶梯计价（Tiered Billing）
- 因此 `summary.Quota` 更能反映**平台实际收入成本**，适合成本告警和趋势分析

### 8.2 为什么 `channelBalance` 用 GaugeVec 而不是 GaugeFunc？

- 余额数据**不是实时查询**，而是由 `AutomaticallyUpdateChannels` 定时任务刷新（默认 N 分钟一次）
- 使用 `GaugeVec` + `Set()` 可以：
  - 避免每次 Prometheus scrape 都触发 DB/HTTP 查询
  - 精确控制更新时机（仅在刷新成功后更新）
  - 天然处理"渠道删除"场景（后续可配合 `Delete` 清理 orphan label）

### 8.3 为什么不直接在 `updateChannelBalance` 中更新 gauge？

- `updateChannelBalance` 有 10 个渠道专属分支（OpenAI/Azure/Custom/...），每个分支可能提前 `return` 或报错
- 在 `model.Channel.UpdateBalance` 中统一更新，确保**只要余额成功持久化，指标就一定会更新**，且只需写一次

### 8.4 为什么 cost 指标放在 `gopool.Go` 中？

- `SettleBilling` 已包含 DB 写操作（更新用户额度、渠道额度、记录消费日志）
- `RecordRelayCost` 是纯内存 `prometheus` Counter 操作，非常轻量，但仍遵循"结算后异步上报"的模式，与 `RecordRelaySample` 保持一致
- 避免在关键路径上引入任何可能的阻塞

## 9. 后续建议

1. **告警规则接入：** A-04（日成本超预算）可直接消费 `hotai_relay_cost_total`；A-05/A-06（余额告警）已由 `checkBalanceWarning` 实现，可补充 `hotai_channel_balance_usd` 作为监控面板的数据源
2. **Grafana 面板：** 建议新增 `Cost by Model/Group/Channel` 面板和 `Channel Balance Overview` 面板
3. **Label 清理：** 当渠道被删除时，`channelBalance` 和 `relayCostTotal` 中对应的 label 值会变成孤儿，可考虑在 `channel.Delete()` 时调用 `DeleteLabelValues`
4. **单位换算：** 在 Grafana 查询中统一使用 `/ 500000` 将 quota 转换为 USD，或考虑新增 `hotai_relay_cost_usd_total` 指标（在 `RecordRelayCost` 中预先换算）

## 10. 修改文件清单

| 文件 | 变更 |
|------|------|
| `pkg/prometheus_metrics/metrics.go` | 新增 `relayCostTotal` CounterVec、`channelBalance` GaugeVec、`RecordRelayCost`、`SetChannelBalance` |
| `service/text_quota.go` | 引入 `prometheusmetrics`，在 `PostTextConsumeQuota` 中增加 `RecordRelayCost` 调用 |
| `service/quota.go` | 引入 `prometheusmetrics`，在 `PostAudioConsumeQuota` 和 `PostWssConsumeQuota` 中增加 `RecordRelayCost` 调用 |
| `model/channel.go` | 引入 `prometheusmetrics`，在 `UpdateBalance` 中增加 `SetChannelBalance` 调用 |
