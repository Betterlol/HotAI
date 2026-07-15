# 渠道选择机制

## 数据模型

### Channel（渠道）
```
type Channel struct {
    Id          int       // 主键
    Type        int       // 供应商类型 (OpenAI/Claude/Gemini/...)
    Key         string    // API Key (单 Key 模式) 或 JSON 数组 (多 Key 模式)
    Status      int       // 1=启用, 2=手动禁用, 3=自动禁用
    Name        string    // 渠道名称
    Weight      *uint     // 权重 (同一 Priority 内加权随机)
    Priority    *int64    // 优先级 (越高越优先选择)
    Models      string    // 支持的模型列表 (逗号分隔)
    Group       string    // 所属分组 (逗号分隔)
    AutoBan     *int      // 是否启用自动禁用
    ModelMapping *string  // 模型名映射 (JSON)
    BaseURL     *string   // 上游 API 地址
    TestModel   *string   // 测试用模型
    ResponseTime int      // 最近响应时间 (ms)
    // ... (详见 model/channel.go:23-60)
}
```

### Ability（能力表 — 渠道与模型的关联）
```
type Ability struct {
    Group     string   // 分组名 (PK)
    Model     string   // 模型名 (PK)
    ChannelId int      // 渠道 ID (PK)
    Enabled   bool     // 是否启用
    Priority  *int64   // 优先级 (从 Channel 复制)
    Weight    uint     // 权重 (从 Channel 复制)
    Tag       *string  // 标签
}
```

Ability 表是渠道选择的底层数据源。当创建/更新渠道时，根据 `Channel.Models` + `Channel.Group` 自动生成 Ability 记录。

## 选择流程（详细）

```
Distribute() 中间件
  │
  ├─ Token 指定了 specific_channel_id？
  │   └─ 是 → 直接使用指定渠道，跳过选择
  │
  ├─ Channel Affinity 命中？
  │   └─ 是 → 使用亲和性缓存的渠道
  │
  └─ CacheGetRandomSatisfiedChannel()
      │
      ├─ Token group = "auto"？
      │   └─ 是 → 遍历用户的 auto_groups，逐组尝试
      │
      ├─ GetRandomSatisfiedChannel(group, model, retry, path)
      │   │
      │   ├─ 从内存缓存 group2model2channels 查找
      │   │   └─ key: group → model → []channel_id (按 Priority 降序)
      │   │
      │   ├─ 精确模型名查找 → 未命中 → normalized 模型名查找
      │   │
      │   ├─ RequestPath 过滤 (仅 Advanced Custom 渠道)
      │   │
      │   ├─ 收集唯一 Priority 值，降序排列
      │   │   └─ retry=0 → 最高 Priority
      │   │   └─ retry=1 → 次高 Priority
      │   │   └─ retry=n → 第 n 层 Priority
      │   │
      │   └─ 在目标 Priority 内加权随机选择
      │       └─ 每个渠道 weight → 随机范围
      │       └─ 全部 weight=0 → 等概率
      │       └─ 平均 weight<10 → 平滑因子 x100
      │
      └─ 返回 Channel 对象
```

## 内存缓存结构

```
group2model2channels (map[string]map[string][]int)
  │
  ├─ "default" → {
  │     "gpt-4" → [3, 1, 5]     ← 渠道 ID 列表，按 Priority 降序
  │     "gpt-3.5-turbo" → [2, 4]
  │   }
  ├─ "vip" → {
  │     "gpt-4" → [1]
  │   }
  └─ ...

channelsIDM (map[int]*Channel)
  ├─ 1 → &Channel{Name:"OpenAI-直连", Status:1, Priority:100, Weight:10, ...}
  ├─ 2 → &Channel{Name:"Azure-备用", Status:1, Priority:50, Weight:5, ...}
  └─ ...
```

缓存每 `SyncFrequency` 秒（默认 30s）从 DB 全量刷新。

## Channel Affinity（路由亲和性）

目的：同一会话/同一用户请求固定路由到同一渠道（如 caching 场景）。

### 配置规则
```json
{
  "enabled": true,
  "default_ttl_seconds": 3600,
  "max_entries": 100000,
  "rules": [
    {
      "name": "codex cli trace",
      "model_regex": [".*"],
      "key_sources": [{"type": "gjson", "path": "prompt_cache_key"}],
      "ttl_seconds": 600,
      "skip_retry_on_failure": false,
      "include_rule_name": true
    }
  ]
}
```

### 触发条件
- Model 名匹配 `model_regex`
- Path 匹配 `path_regex`（可选）
- User-Agent 包含 `user_agent_include`（可选）
- 至少一个 `key_sources` 成功提取到非空值
- `value_regex` 匹配提取值（可选）

### Key Source 类型
| 类型 | 说明 | 示例 |
|------|------|------|
| `context_int` | 从 Gin Context 取 int 值 | `user_id` |
| `context_string` | 从 Gin Context 取 string 值 | `token_name` |
| `request_header` | 从 HTTP Header 取 | `X-Request-Id` |
| `gjson` | 从请求 JSON body 取 | `prompt_cache_key` |

### 缓存实现
- HybridCache (Memory `hot.HotCache` + Redis)
- 命中时直接使用上次渠道，跳过随机选择
- 请求成功后在 `Distribute()` 末尾写入缓存

## 跨组重试 (Auto Group)

当 Token group 为 `"auto"` 时：
1. 获取用户可用分组列表 `autoGroups`
2. 从第一个分组开始，按 Priority 逐级尝试
3. 当前分组所有 Priority 用完 → 切换到下一分组
4. 支持 `ContextKeyAutoGroupIndex` 持久化当前进度
5. 支持 `ContextKeyAutoGroupRetryIndex` 跟踪当前分组起始 retry 计数

## 多 Key 渠道

当 Channel 配置多条 API Key 时：
- **Random 模式**: 每次随机选一条启用的 Key
- **Polling 模式**: 轮询选择，线程安全（per-channel mutex）
- Key 可独立禁用而不影响渠道整体
