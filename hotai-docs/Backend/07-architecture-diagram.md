# 平台架构图

## 说明

用户请求（Web/API）通过 Nginx（可选）进入 Gin HTTP 服务。经过中间件链处理后，由 Distribute 中间件选择渠道，Controller 协调计费与重试，Relay Adaptor 转换协议并转发到上游 AI 供应商。监控数据（perf_metrics、logs）异步写入数据库。

数据流方向：**用户 → 接入层 → 应用层(Middleware) → 路由层(Distribute) → 代理层(Relay) → 上游供应商**

```mermaid
graph TB
    subgraph 用户层["用户层"]
        Web["Web 前端<br/>(Embedded React SPA)"]
        API["API 调用方<br/>(cURL / SDK / Agent)"]
        Playground["Playground<br/>(浏览器测试)"]
    end

    subgraph 接入层["接入层 (可选)"]
        Nginx["Nginx 反向代理<br/>HTTPS / 负载均衡"]
    end

    subgraph 应用层["应用层 — Gin 中间件链"]
        MW_Recovery["Recovery<br/>panic 恢复"]
        MW_ReqID["RequestId<br/>注入请求 ID"]
        MW_I18n["I18n<br/>国际化"]
        MW_Logger["SetUpLogger<br/>HTTP 日志"]
        MW_Session["Session<br/>Cookie 会话"]

        subgraph Relay_MW["代理请求中间件 (按路由分组)"]
            MW_Perf["SystemPerformanceCheck<br/>CPU/内存/磁盘"]
            MW_Token["TokenAuth<br/>API Key 鉴权"]
            MW_RateLimit["ModelRequestRateLimit<br/>限流"]
            MW_Distribute["Distribute<br/>渠道选择 ★"]
        end
    end

    subgraph 路由层["路由层 — Controller"]
        C_Relay["Relay()<br/>主代理协调"]
        C_Task["RelayTask()<br/>异步任务"]
        C_MJ["RelayMidjourney<br/>Midjourney 代理"]
    end

    subgraph 服务层["服务层 — Service + Model"]
        S_Channel["Channel 服务<br/>禁用/启用/通知"]
        S_Affinity["ChannelAffinity<br/>路由亲和性缓存"]
        S_Billing["Billing<br/>计费/预扣费/退款"]
        S_Log["Log 记录<br/>请求日志/错误日志"]
    end

    subgraph 代理层["代理层 — Relay Adaptors"]
        A_OpenAI["OpenAI Adaptor"]
        A_Claude["Claude Adaptor"]
        A_Gemini["Gemini Adaptor"]
        A_Azure["Azure Adaptor"]
        A_Others["其他 37+ Adaptors<br/>(DeepSeek/Qwen/...)"]
        A_Custom["Advanced Custom<br/>自定义适配"]
    end

    subgraph 数据层["数据层"]
        DB[("主数据库<br/>SQLite/MySQL/Pg")]
        LogDB[("日志数据库<br/>SQLite/MySQL/Pg/ClickHouse")]
        Redis[("Redis<br/>缓存/限流")]
        MCache["内存缓存<br/>group2model2channels<br/>(每 30s 刷新)"]
    end

    subgraph 上游层["上游 AI 供应商"]
        Up_OpenAI["OpenAI / Azure"]
        Up_Claude["Anthropic Claude"]
        Up_Gemini["Google Gemini"]
        Up_Domestic["国内模型<br/>DeepSeek/Qwen/GLM/..."]

        Up_Other["其他供应商<br/>Cohere/Mistral/xAI/..."]
    end

    subgraph 后台任务["后台定时任务"]
        Task_Test["ChannelTest<br/>渠道自动测试"]
        Task_Cache["SyncChannelCache<br/>缓存同步"]
        Task_Options["SyncOptions<br/>配置同步"]
        Task_Policy["PolicySync<br/>权限策略同步"]
        Task_Perf["PerfFlush<br/>指标落盘"]
        Task_Quota["QuotaData<br/>用量聚合"]
    end

    subgraph 监控侧["监控侧"]
        PerfMetrics["PerfMetrics<br/>性能指标 API"]
        Pyro["Pyroscope<br/>持续性能分析"]
        PProf["pprof<br/>(可选 :8005)"]
        LogAPI["Log API<br/>日志查询/统计"]
        DataAPI["Data API<br/>用量看板"]
    end

    %% 用户层 → 接入层
    Web --> Nginx
    API --> Nginx
    Playground --> Nginx

    %% 接入层 → 应用层
    Nginx --> MW_Recovery
    MW_Recovery --> MW_ReqID
    MW_ReqID --> MW_I18n
    MW_I18n --> MW_Logger
    MW_Logger --> MW_Session
    MW_Session --> Relay_MW

    %% 代理中间件链路
    MW_Perf --> MW_Token
    MW_Token --> MW_RateLimit
    MW_RateLimit --> MW_Distribute

    %% 应用层 → 路由层
    Relay_MW --> C_Relay
    Relay_MW --> C_Task
    Relay_MW --> C_MJ

    %% 路由层 → 服务层
    C_Relay --> S_Channel
    C_Relay --> S_Affinity
    C_Relay --> S_Billing
    C_Relay --> S_Log

    %% 路由层 → 代理层
    C_Relay --> A_OpenAI
    C_Relay --> A_Claude
    C_Relay --> A_Gemini
    C_Relay --> A_Azure
    C_Relay --> A_Others
    C_Relay --> A_Custom

    %% 代理层 → 上游
    A_OpenAI --> Up_OpenAI
    A_Claude --> Up_Claude
    A_Gemini --> Up_Gemini
    A_Azure --> Up_OpenAI
    A_Others --> Up_Other
    A_Custom --> Up_Domestic

    %% 数据层连接
    DB --- MCache
    S_Affinity -.-> Redis
    S_Affinity -.-> MCache
    S_Log -.-> LogDB
    C_Relay -.-> DB

    %% 后台任务
    Task_Test -.-> DB
    Task_Cache -.-> DB
    Task_Cache -.-> MCache
    Task_Options -.-> DB
    Task_Policy -.-> DB
    Task_Perf -.-> DB
    Task_Quota -.-> LogDB

    %% 监控
    PerfMetrics -.-> DB
    LogAPI -.-> LogDB
    DataAPI -.-> LogDB
```

## 请求链路文字说明

1. 用户通过 Web 管理界面或 API 调用（cURL/SDK）发送请求
2. 可选经过 Nginx 反向代理（HTTPS 终端、负载均衡）
3. Gin 中间件链依次处理：panic 恢复 → 注入 request-id → 国际化 → 请求日志 → Session
4. 代理路径（`/v1/*`）经过鉴权（TokenAuth）→ 限流（ModelRequestRateLimit）→ **渠道选择（Distribute）**
5. Distribute 读取内存缓存 `group2model2channels`，按 Priority + Weight 选渠道，注入渠道配置到 Context
6. Controller.Relay() 预扣费后进入重试循环，调用对应 Provider Adaptor 转换请求并转发到上游
7. 成功 → 结算计费、记录 consume log、写入亲和性缓存
8. 失败 → 判断是否禁止渠道 → 判断是否重试（切换下一优先级渠道）
9. 后台周期性任务：同步渠道缓存/配置/权限策略，渠道自动测试与恢复，性能指标落盘，用量数据聚合
