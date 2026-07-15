# 配置系统

## 三层配置架构

### 1. 环境变量

`.env` 文件或系统环境变量。关键配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SQL_DSN` | `new-api.db` | 主数据库 DSN |
| `LOG_SQL_DSN` | (同 SQL_DSN) | 日志数据库 DSN |
| `REDIS_CONN_STRING` | (空) | Redis 连接串 |
| `CHANNEL_TEST_FREQUENCY` | (空) | 渠道测试频率（分钟），设置即启用 |
| `CHANNEL_TEST_ENABLED` | `false` | 渠道测试开关 |
| `MEMORY_CACHE_ENABLED` | `true` | 内存缓存开关 |
| `SYNC_FREQUENCY` | `30` | 缓存同步频率（秒） |
| `BATCH_UPDATE_ENABLED` | `false` | 批量写入开关 |
| `PYROSCOPE_URL` | (空) | Pyroscope 持续性能分析 |

### 2. 数据库 Option 表

`Option` 表存储 300+ 键值对，通过后台管理页面可视化配置。

> 注意：`RetryTimes`、`ChannelDisableThreshold`、`AutomaticDisableChannelEnabled`、`AutomaticEnableChannelEnabled` 等配置项也通过 Option 表加载（非环境变量），可在后台"系统设置"页面修改。

**操作设置 (`setting/operation_setting/`):**

| 模块 | 文件 | 关键配置项 |
|------|------|-----------|
| 通用 | `general_setting.go` | 注册/登录/验证码/通知设置 |
| 配额 | `quota_setting.go` | 单位配额、新用户赠送、邀请奖励 |
| Token | `token_setting.go` | 每用户最大 Token 数 |
| 监控 | `monitor_setting.go` | 渠道测试模式/频率/开关 |
| 状态码 | `status_code_ranges.go` | 禁用状态码范围、重试状态码范围 |
| 渠道亲和性 | `channel_affinity_setting.go` | 亲和性规则/TTL/容量 |
| 支付 | `payment_setting.go` | Stripe/Creem/Waffo 支付配置 |
| 签到 | `checkin_setting.go` | 每日签到配额 |

**倍率设置 (`setting/ratio_setting/`):**

| 配置 | 说明 |
|------|------|
| completion_ratio | 模型补全倍率 |
| group_ratio | 分组倍率 (如 vip 组 0.8 = 8 折) |
| cache_ratio | 缓存命中折扣 |
| image_ratio | 图片生成倍率 |
| audio_ratio | 音频倍率 |
| embedding_ratio | 向量化倍率 |

**系统设置 (`setting/system_setting/`):**
- 主题配置（Logo/平台名/页脚）
- OAuth 配置（GitHub/LinuxDO/Discord/OIDC）
- 法律文档（服务条款/隐私政策）
- WebAuthn/Passkey 设置

### 3. 渠道级配置 (JSON 列)

每个 Channel 记录的 JSON 字段：

| 字段 | 说明 |
|------|------|
| `ModelMapping` | 请求模型名 → 上游模型名映射 |
| `StatusCodeMapping` | 上游状态码 → 本地状态码映射 |
| `ParamOverride` | 请求参数覆盖 |
| `HeaderOverride` | HTTP Header 覆盖 |
| `Setting` | 供应商特定设置 |
| `OtherSettings` | Azure 版本、Advanced Custom 配置等 |

## 后台管理可配置项

通过前端界面可配置的路由/监控相关项：

| 页面 | 可配置内容 |
|------|-----------|
| 渠道管理 | 创建/编辑/删除渠道，设置 Type/Key/Model/Group/Priority/Weight/AutoBan/ModelMapping/StatusCodeMapping/ParamOverride/HeaderOverride |
| 模型管理 | 注册模型元数据，设置分组/倍率/计费模式/端点 |
| 用户管理 | 设置用户分组 (group)、角色、额度 |
| Token 管理 | 设置 Token 分组/模型限制/IP 白名单/额度 |
| 系统设置 | 日志开关、限额、渠道亲和性规则、重试/禁用状态码范围、渠道测试模式/频率 |
| 倍率设置 | 模型倍率、分组倍率、缓存折扣 |
| 监控 | 性能指标 (CPU/内存/磁盘) 阈值 |
