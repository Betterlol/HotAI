# HotAI 后端实现路线图

## 优先级排序依据

1. **依赖前置**：下游功能依赖上游先完成
2. **独立价值**：能否独立上线，不对现有功能产生影响
3. **实现成本**：估算人天，低成本的先做
4. **可观测性优先**：先能看清系统，再做优化

## 实施前置约束

所有二开项默认遵循以下约束，避免影响现有生产行为：

| 约束 | 要求 |
|------|------|
| 默认关闭 | 新路由、新熔断、新告警默认通过 Option/环境变量关闭，灰度启用 |
| 可回滚 | 每个 Phase 能独立上线和关闭，不依赖一次性大改 |
| 数据库兼容 | 迁移必须同时兼容 SQLite、MySQL、PostgreSQL；新增列优先走 GORM AutoMigrate / AddColumn 模式 |
| 指标基数 | Prometheus 不记录用户、Token、request_id 等高基数标签 |
| 计费一致 | 成本感知只影响路由选择，不改变最终用户扣费逻辑 |
| 测试闭环 | 每个 Phase 完成后至少执行对应故障切换用例，并把结果补回 `10-failover-test-plan.md` |

## Phase 0：可配置项（0 代码改动，立即生效）

源自 `06-gap-analysis.md` 的 C-01～C-07。

| 序号 | 项目 | 操作 | 优先级 |
|------|------|------|--------|
| C-01 | 启用 RetryTimes > 0 | 后台设置页面修改 | P0 |
| C-02 | 启用渠道自动测试 + 配置频率 | 环境变量 `CHANNEL_TEST_ENABLED=true` | P0 |
| C-03 | 配置自动禁用状态码范围 | 后台设置页面 | P1 |
| C-04 | 配置 Channel Affinity 规则 | 后台设置页面 | P1 |
| C-05 | 启用自动恢复 | `AutomaticEnableChannelEnabled=true` | P1 |
| C-06 | 为关键模型配 2+ 渠道 | 渠道管理页面 | P0 |
| C-07 | 多 Key 供应商启用 Multi-Key 模式 | 渠道编辑页面 | P2 |

**建议**：Phase 0 应在上线第一天完成。

## Phase 1：可观测性基建（先能看清系统）

### S-04 健康检查端点 (0.5d)

| 项目 | 内容 |
|------|------|
| 文件 | 新增 `controller/health.go` |
| 路由 | `GET /api/health` |
| 返回值 | `{"status":"ok","db":"ok","redis":"ok","uptime":"12h"}` |
| 依赖 | 无 |

### S-02 Prometheus /metrics 端点 (1.5d)

| 项目 | 内容 |
|------|------|
| 文件 | 新增 `controller/metrics.go` |
| 路由 | `GET /api/metrics` |
| 依赖 | `go get prometheus/client_golang` |
| 指标 | 请求量、延迟直方图、成功率、活跃连接数、Go runtime |
| 前提 | 需与 Relay 主流程集成（`controller/relay.go` 的 `RecordRelaySample` 处） |

### S-03 JSON 结构化日志 (1d)

| 项目 | 内容 |
|------|------|
| 文件 | 修改 `logger/logger.go` |
| 配置 | 环境变量 `LOG_FORMAT=json` 或 `text`（默认 text，向后兼容） |
| 输出 | 每行 JSON: `{"level":"info","time":"...","request_id":"...","msg":"..."}` |

### S-05 延迟百分位追踪 (2d)

| 项目 | 内容 |
|------|------|
| 文件 | 新增 `pkg/perf_metrics/percentile.go` |
| 依赖 | `go get github.com/HdrHistogram/hdrhistogram-go` |
| 存储 | `perf_metrics` 表增加 p50/p90/p95/p99 列 |
| 输出 | `GET /api/perf-metrics?percentiles=true` |

**Phase 1 总计**：~5 天

**交付物**：
- ✅ 可以部署 Prometheus + Grafana 监控大屏
- ✅ 日志可以被 Loki/ELK 采集
- ✅ 后端有标准健康检查
- ✅ Perf metrics 支持 P95/P99 分析

## Phase 2：熔断与延迟感知路由

### S-01 延迟感知路由 (1d)

| 项目 | 内容 |
|------|------|
| 文件 | 修改 `model/channel_cache.go:GetRandomSatisfiedChannel()` |
| 逻辑 | 同 Priority 层内按 `channel.ResponseTime` 加权随机 |
| 配置 | `LatencyAwareRoutingConfig` (Option 表) |
| 前提 | 渠道 ResponseTime 已由定时测试自动更新；如需真实请求延迟，需要先补渠道级统计 |
| 兼容 | 默认关闭，开启后不影响现有配置 |

### L-01 滑动窗口熔断器 (1w)

| 项目 | 内容 |
|------|------|
| 文件 | 新增 `pkg/circuitbreaker/` 包（breaker.go + window.go） |
| 集成 | 修改 `channel_cache.go` + `controller/relay.go` |
| 状态 | CLOSED → OPEN → HALF-OPEN |
| 参数 | 错误率阈值、窗口大小、半开放行数（全部可配） |
| 兼容 | 默认关闭，开启后取代现有 `ShouldDisableChannel` 的立即禁用逻辑 |

### L-07 渠道并发限流 (2-3d)

| 项目 | 内容 |
|------|------|
| 文件 | 新增 `pkg/channel_limiter/` |
| 逻辑 | per-channel 最大并发数控制，超过排队或拒绝 |
| 配置 | 每渠道 `MaxConcurrentRequests` 字段 |

**Phase 2 总计**：~10-12 天

**交付物**：
- ✅ 渠道选择时考虑延迟，不总是选最高 Priority
- ✅ 滑动窗口熔断替代简单的一次失败就禁用
- ✅ 单渠道不会被打爆

## Phase 3：成本感知与动态权重

### S-06 渠道余额监控 (1d)

| 项目 | 内容 |
|------|------|
| 文件 | 修改 `controller/channel-test.go` |
| 依赖 | 实现各供应商余额查询 API 适配 |
| 通知 | 余额低于阈值 → 管理员通知 |
| 兼容 | 不影响现有渠道测试逻辑 |

### L-02 成本感知路由 (3-5d)

| 项目 | 内容 |
|------|------|
| 文件 | `model/ability.go` 增加价格字段 |
| 迁移 | `model/channel.go` 可能增加默认价格 |
| 逻辑 | 选择时按 `minPrice / channelPrice` 加权 |
| 配置 | `CostAwareRoutingConfig` (Option 表) |
| 前提 | Phase 1 的延迟感知先上线，成本作为第二维度叠加 |

### L-03 动态权重调整 (3-5d)

| 项目 | 内容 |
|------|------|
| 文件 | 修改 `model/channel_cache.go:InitChannelCache()` |
| 逻辑 | 缓存同步时根据历史成功率+延迟调整 scores |
| 存储 | 不持久化，只在内存中调整 |
| 前提 | Phase 1 的 perf_metrics 或日志查询提供足够历史数据；若尚无渠道维度，先不启用成功率调整 |

**Phase 3 总计**：~10 天

**交付物**：
- ✅ 选渠道时会考虑单价，成本降低
- ✅ 渠道权重根据表现自动微调
- ✅ 余额不足自动告警

## Phase 4：故障切换规则特化

**背景**：当前所有失败一视同仁走通用熔断路径：`MarkFailure → Record(false) → processChannelError → shouldRetry`。429（限流）、401/403（鉴权）、timeout 被同等处理。实际场景中应差异化对待：

- **429** 是临时限流，不应记入熔断/成功率（否则拉低渠道评分导致路由偏移）
- **401/403** 是 Key 失效，重试无意义，应立即跳过而非重试拖慢响应
- 分类判断应在 **`MarkFailure`/`Record` 之前**，而不是在 `processChannelError` 里面

### F-01 错误类型分类 + 差异化处理 (2d)

| 错误类型 | 熔断记录 | 成功率记录 | 重试 | 说明 |
|----------|----------|-----------|------|------|
| 429 (限流) | ❌ 不记 | ❌ 不记 | ✅ 等待后重试 | 限流是临时状态，不应影响评分 |
| 401/403 (鉴权) | ❌ 不记 | ❌ 不记 | ❌ 不复试，立即跳过 | Key 无效，重试多少次都一样 |
| timeout | ✅ 记 | ✅ 记 | ✅ 重试 | 超时可能是渠道问题 |
| 5xx | ✅ 记 | ✅ 记 | ✅ 重试 | 服务端异常 |
| 余额不足 | ✅ 记 | ✅ 记 | ❌ | 已有逻辑复用 |

**文件：**
| 文件 | 变更 |
|------|------|
| `types/error_classification.go` | [新增] `IsRateLimit()`、`IsAuthError()`、`IsTimeout()` 分类函数 |
| `controller/relay.go` | MarkFailure/Record 前插入分类判断，分流处理路径 |
| `setting/operation_setting/retry_setting.go` | [新增] `ratelimit_retry_interval`、`ratelimit_retry_times` 配置 |

**处理流程（修改后）：**
```
relayError
  │
  ├─ IsRateLimit(429) ─→ ❌不记熔断/成功率 → wait → retry
  ├─ IsAuthError(401/403) ─→ ❌不记熔断/成功率 → ❌不重试 → break
  └─ (timeout/5xx/余额) ─→ MarkFailure → Record(false) → processError → shouldRetry
```

**Phase 4 总计**：~2 天（F-02/F-03 合并入 F-01，F-04 测试贯穿执行）

## Phase 5：高级特性（原 Phase 4）

### L-04 渠道灰度发布 (3-5d)

新渠道逐步放量：先 5% 流量 → 稳定后 20% → 全量。

| 项目 | 内容 |
|------|------|
| 文件 | 修改 `pkg/routing/` 评分引擎 |
| 逻辑 | 新增 `CanaryPercent` 字段，按百分比放量；结合成功率评分自动回滚 |

### L-05 OpenTelemetry 分布式追踪 (1w+)

| 项目 | 内容 |
|------|------|
| 依赖 | `go get go.opentelemetry.io/otel` |
| Span | 覆盖 full request lifecycle：Auth → Distribute → Relay → Adaptor → Upstream |
| 集成 | 与现有 `request_id` 关联 |

### L-06 流式连接故障切换 (1w+)

| 项目 | 内容 |
|------|------|
| 场景 | SSE 流中断后自动切换到备用渠道 |
| 难度 | 高，流式响应已部分发送，切换涉及消息对齐 |

**Phase 5 总计**：~3w

## 实施总览

```
Phase 0: 可配置项                                  立即
    C-01~C-07: Retry/Test/Affinity/AutoBan
         │
Phase 1: 可观测性基建                              Week 1-2
    S-04: 健康检查端点 (0.5d)
    S-02: Prometheus 端点 (1.5d)
    S-03: JSON 日志 (1d)
    S-05: 延迟百分位 (2d)
         │
Phase 2: 熔断 + 延迟感知路由                        Week 3-4
    S-01: 延迟感知路由 (1d)
    L-01: 滑动窗口熔断 (1w)
    L-07: 渠道并发限流 (2-3d)
         │
Phase 3: 成本感知 + 动态权重                       Week 5-6
    S-06: 渠道余额监控 (1d)
    L-02: 成本感知路由 (3-5d)
    L-03: 动态权重调整 (3-5d)
         │
Phase 4: 故障切换规则特化 [新增]                   Week 7-8
    F-01: 错误类型分类 (1d)
    F-02: 差异化重试与降级 (2d)
    F-03: 可配置重试参数 (1d)
    F-04: 故障切换测试执行 (2d)
         │
Phase 5: 高级特性 [原 Phase 4]                     Week 9-12
    L-04: 灰度发布 (3-5d)
    L-05: 分布式追踪 (1w+)
    L-06: 流式连接故障切换 (1w+)
         │
贯穿始终: 故障切换测试
    10-failover-test-plan.md 中的 TC-01~TC-07
    每个 Phase 完成后执行对应测试
```

## 故障切换测试时间节点

| 阶段 | 测试内容 | 文件 |
|------|---------|------|
| Phase 0 完成后 | TC-01: 单渠道失败降级 | `03-retry-failover.md` |
| Phase 1 完成后 | TC-04: 超时跳过 + 监控验证 | 新增监控面板验证 |
| Phase 2 完成后 | TC-02: 鉴权禁用 + TC-03: 限流重试 + TC-05: 全渠道挂 | 熔断器效果验证 |
| Phase 3 完成后 | TC-06: 恢复启用 + TC-07: 跨组降级 | 完整流程验证 |
| Phase 4 完成后 | 全部 TC-01~TC-07 重新执行，补充特化策略验证 | `10-failover-test-plan.md` |
| Phase 5 完成后 | 灰度 + 追踪 + 流式切换端到端验证 | — |
