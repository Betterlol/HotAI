# 学生 D：后端架构优化、智能监控与智能路由

> 一句话：让平台"看得清健康状况、做得出路由决策、扛得住渠道故障"。

---

## 现有能力（先搞清楚有什么）

New API 后端路由/监控方面已经有的能力：

**路由：**
- 基于 Priority 的优先级选择（先选高 Priority 的渠道）
- 同一 Priority 内加权随机（Weight 权重）
- 跨组重试（Auto group 用户逐组降级）
- Channel Affinity（路由亲和性，同一会话固定渠道）
- AutoBan（连续失败自动禁用渠道）
- 多 Key 轮询/随机（单渠道多条 API Key）
- ChannelTest 定时任务（自动测试+恢复渠道）

**监控：**
- perf_metrics 表（每分钟聚合请求量/延迟/成功率/TTFT/Token）
- logs 表（每次调用的完整记录，包含 model/token/延迟/渠道等）
- quota_data 表（按小时聚合用量数据）
- 系统资源监控（CPU/内存/磁盘超限自动 503）
- Pyroscope 接入（持续性能分析）
- 后台管理页面已有日志查看/统计数据 API

---

## 真正的任务（不是画图写文档混日子）

### 第一阶段：摸底（半天）

读代码，不是写报告。回答以下问题：

| 问题 | 关键文件 |
|------|----------|
| 请求从哪里进来？经过哪些 middleware？ | `router/relay-router.go`, `middleware/distributor.go` |
| 渠道是怎么选出来的？ | `model/channel_cache.go:GetRandomSatisfiedChannel()`, `service/channel_select.go` |
| 选错了怎么重试？ | `controller/relay.go:Relay() retry loop` |
| 出错了怎么熔断？ | `service/channel.go:DisableChannel()`, `ShouldDisableChannel()` |
| 日志/指标存了哪些数据？ | `model/log.go`, `model/perf.go` |
| 后台能配什么？ | `setting/operation_setting/` 下的配置文件 |

产出：这 6 个问题能口头回答清楚即可，不写长篇文档。

### 第二阶段：架构图（半天）

画一张实用的图，不是给 PPT 用的，是给团队沟通用的。覆盖：

```
用户 → Nginx? → Gin → Middleware(限流/鉴权/Distribute) → Controller → Relay Adaptor → Upstream Provider
                                                              ↓
                                                          Model(DB/Redis)
```

不需要精美，Draw.io / 手绘 / Mermaid 都行。附带一段 300 字以内的请求链路说明。

### 第三阶段：配置优化（1-2 天）⭐ 核心

这才是 Week 1 真正有价值的事。把现有系统的能力配到最佳：

| 动作 | 对应配置项 | 现状 |
|------|-----------|------|
| 每个模型配至少 2 个渠道，不同 Priority | 渠道创建时设置 | 需要手动做 |
| 启 AutoBan + 调阈值 | Channel.AutoBan, operation_setting ChannelDisableThreshold | 默认已开，阈值可能需要调 |
| 启 ChannelTest 定时检测 | operation_setting auto_test_channel_minutes | 默认未启用 |
| 配 RetryTimes > 0 | common.RetryTimes（需要通过环境变量或配置） | 默认 0（不重试） |
| 配 StatusCodeRanges（哪些错误码重试） | operation_setting 中 status_code 配置 | 有默认值 |
| Multi-Key 渠道（如果同一供应商有多条 Key） | Channel.Key 字段用 JSON 数组 | 需创建 |
| Channel Affinity 规则 | operation_setting channel_affinity | 只有默认 codex/claude 规则 |

产出：一份《配置检查清单》（done list）+ staging 环境实际验证通过的截图。

### 第四阶段：故障切换验证（半天）

利用已有能力做真实测试，不是写测试计划：

| # | 场景 | 操作 | 预期 |
|---|------|------|------|
| 1 | 主动下线渠道 | 后台禁用渠道 A | 请求路由到渠道 B，用户无感 |
| 2 | 模拟超时 | 在渠道上设超长超时或用坏 Key | 触发重试，自动切换 |
| 3 | 全渠道不可用 | 禁用所有渠道 | 返回 503 或友好提示，不崩 |

产出：每个场景的截图/日志 + 一句话结论。

### 第五阶段：Backlog（半天）

整理出真正需要二开的事项，分三类：

| 分类 | 例子 | 估算 |
|------|------|------|
| 配置能解决的 | 调整 RetryTimes/ChannelTest 频率 | 0d |
| 短期二开（1-2 天） | 延迟感知路由（选择时考虑 ResponseTime） | 2d |
| 长期优化 | 滑动窗口熔断、成本感知路由、灰度发布 | 1w+ |

产出：一个表格/文档，后续 Week 2-3 推进。

---

## Week 1 时间安排

| 天 | 上午 | 下午 |
|----|------|------|
| Day 1 | 摸底：读 routing/monitoring 代码 | 画架构图初稿 |
| Day 2 | 配置优化：多渠道 + Priority | 配置优化：Affinity + Retry + ChannelTest |
| Day 3 | 配置优化：补齐 + 验证 | 故障切换测试 |
| Day 4 | Backlog 整理 | 余力推进短期二开 / 协助其他同学 |
| Day 5 | 周度汇总 + Demo 准备 | 验收 |

---

## 协作要点（不废话）

| 找谁 | 要什么 | 给什么 |
|------|--------|--------|
| A（DevOps） | 确认 staging 地址、日志路径、数据库 | 配置建议、日志格式需求 |
| B（模型接入） | 接入的模型列表、测试 Key | 路由策略需要的渠道分组 |
| C（前端） | 用量/成本页面需要展示什么指标 | perf_metrics API 说明 |
| E（运营） | FAQ 中需要解释哪些错误场景 | 错误码含义、重试/限流说明 |

---

## Week 1 验收标准

- [ ] 能讲清楚完整请求链路（用户 → 平台 → upstream → 返回）
- [ ] staging 环境配好了多渠道冗余，手动禁用任一渠道后请求仍能返回成功
- [ ] 至少完成了 3 种故障场景的实际测试并有记录
- [ ] 知道哪些监控数据已经有了、哪些需要二开
- [ ] Backlog 已整理，区分了配置项/短期二开/长期优化
