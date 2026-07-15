# 请求链路与架构

## 整体架构

```
┌─────────────┐     ┌──────────┐     ┌─────────────────────┐     ┌──────────────┐
│  Web 前端    │     │  CLI/API │     │     用户请求         │     │  Playground  │
│ (Embedded    │     │  调用方  │     │ (cURL/SDK/Agent)    │     │  (浏览器)    │
│  React SPA)  │     │          │     │                     │     │              │
└──────┬───────┘     └─────┬────┘     └─────────┬───────────┘     └──────┬───────┘
       │                   │                    │                        │
       ▼                   ▼                    ▼                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                           Gin HTTP Server (:PORT)                             │
│                                                                               │
│  Middleware 链 (全局):                                                         │
│  ┌─────────┐ ┌──────────┐ ┌──────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ │
 │  │Recovery │ │RequestId │ │PoweredBy│ │I18n    │ │SetUpLogger│ │CookieSess │ │
│  └─────────┘ └──────────┘ └──────┘ └──────────┘ └───────────┘ └───────────┘ │
│                                                                               │
│  路由分组:                                                                     │
│  ├─ /api/*        → 管理/用户 API (认证: session/token + UserAuth/AdminAuth) │
│  ├─ /v1/*         → AI 模型代理 (认证: TokenAuth + Distribute)               │
│  ├─ /v1beta/*     → Gemini 兼容代理                                          │
│  ├─ /mj/*         → Midjourney 代理                                          │
│  ├─ /dashboard/*  → OpenAI 兼容计费端点                                       │
│  └─ /*            → 前端静态资源和 SPA                                        │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 代理请求全链路（核心路径）

```
用户请求 (POST /v1/chat/completions)
  │
  ▼
1. SystemPerformanceCheck()      ← 检查 CPU/内存/磁盘是否过载，过载返回 503
  │
  ▼
2. TokenAuth()                   ← 验证 API Key (sk-xxx)，解析用户/分组/额度
  │  ├─ 提取 Authorization: Bearer sk-xxx
  │  ├─ 从 Redis/内存缓存查找 Token 信息
  │  ├─ 校验 Token 状态/额度/过期/IP 白名单
  │  └─ 设置 ContextKey：user_id, token_id, group, token_group
  │
  ▼
3. ModelRequestRateLimit()       ← 按模型的限流检查
  │
  ▼
4. Distribute()                  ← 【渠道选择核心中间件】
  │  ├─ getModelRequest()        ← 从 JSON body/路径中提取 model name
  │  ├─ (可选) Token 级模型限制检查
  │  │
  │  ├─ Channel Affinity 检查    ← 如果有同会话亲和性缓存，直接复用上次的渠道
  │  │   └─ GetPreferredChannelByAffinity()
  │  │       ├─ 按 rule 匹配 (model regex / path regex / UA)
  │  │       ├─ 从 HybridCache (memory+Redis) 查找亲和性 key → channel_id
  │  │       └─ 命中 → 跳过随机选择
  │  │
  │  └─ CacheGetRandomSatisfiedChannel()  ← 随机选择渠道
  │      └─ GetRandomSatisfiedChannel(group, model, retry, path)
  │          ├─ 从内存缓存 group2model2channels 查找候选渠道
  │          ├─ RequestPath 过滤 (Advanced Custom 渠道)
  │          ├─ 按 Priority 降序排列 → 根据 retry 参数选优先级层
  │          ├─ 同一优先级内加权随机选择
  │          └─ 返回 Channel 对象
  │
  ▼
5. SetupContextForSelectedChannel()  ← 把渠道信息注入 Context
  │  ├─ channel_id, channel_type, channel_name
  │  ├─ API Key (多Key 渠道中选一条)
  │  ├─ Base URL, Model Mapping, Param/Header Override
  │  └─ 供应商特定配置 (Azure version, etc.)
  │
  ▼
6. Controller.Relay()            ← 【主代理逻辑】
  │  ├─ GenRelayInfo()           ← 构造 RelayInfo (model/API type/endpoint)
  │  ├─ 敏感内容检查
  │  ├─ Token 预估 + 计费
  │  ├─ PreConsumeBilling()      ← 预扣费
  │  │
  │  └─ Retry 循环 (0 ~ RetryTimes):
  │      ├─ getChannel()         ← 重试时重新选渠道 (下一个 Priority)
  │      ├─ 构建请求体
  │      ├─ GetAdaptor(apiType) → Provider Adaptor
  │      │   ├─ ConvertOpenAIRequest()   ← 转换请求格式
  │      │   ├─ DoRequest()              ← 向上游发送 HTTP 请求
  │      │   └─ DoResponse()             ← 解析响应 + 计费
  │      │
  │      ├─ 成功 → RecordChannelAffinity() + 返回响应
  │      │
  │      └─ 失败:
  │          ├─ processChannelError()    ← 可能自动禁用渠道
  │          ├─ shouldRetry()            ← 判断是否重试
  │          └─ 继续循环
```

## 关键文件索引

| 组件 | 文件 | 行号 |
|------|------|------|
| 路由注册 | `router/relay-router.go` | 13-201 |
| 渠道选择中间件 | `middleware/distributor.go` | 32-170 |
| 渠道选择核心逻辑 | `model/channel_cache.go` | 108-203 |
| 渠道选择服务层 | `service/channel_select.go` | 84-163 |
| 渠道亲和性 | `service/channel_affinity.go` | 550-740 |
| 代理主控逻辑 | `controller/relay.go` | 68-249 |
| 重试决策 | `controller/relay.go` | 325-355 |
| 渠道禁用 | `service/channel.go` | 19-33 |
| Provider Adaptor 接口 | `relay/channel/adapter.go` | 15-32 |
| 渠道模型 | `model/channel.go` | 23-60 |
| Ability 模型 | `model/ability.go` | 18-26 |
| 系统启动 | `main.go` | 51-216 |
| 缓存刷新 | `model/channel_cache.go` | 26-106 |

## 现有 Provider Adaptor（41 个）

OpenAI / Anthropic / Gemini / Azure / AWS Bedrock / Baidu / Baidu V2 / Ali (Qwen) / Tencent / VolcEngine (Doubao) / DeepSeek / Moonshot / Zhipu / Zhipu 4V / Minimax / SiliconFlow / Cohere / Perplexity / Cloudflare / Coze / Dify / Jina / Mistral / Ollama / Replicate / xAI (Grok) / Palm / Codex / LingyiWanwu / Ai360 / MokaAI / OpenRouter / Xinference / Submodel / Advanced Custom / 以及 Suno/Kling/Jimeng/VertexAI/Vidu/Sora 等任务适配器
