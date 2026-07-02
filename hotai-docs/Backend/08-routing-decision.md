# 请求路由决策图

## 说明

Distribute 中间件决定每个请求走哪个渠道。决策顺序：Token 是否绑定特定渠道 → Channel Affinity 是否命中 → 按 Priority 加权随机选择 → 跨组降级。重试时逐级降低 Priority，同一组内所有 Priority 耗尽后切换到下一 Group。

```mermaid
flowchart TD
    Start(["请求到达 /v1/*"]) --> CheckSpecific[Token 绑定了<br/>specific_channel_id?]
    
    CheckSpecific -->|是| UseSpecific[直接使用绑定渠道]
    UseSpecific --> ChannelEnabled{渠道状态<br/>为启用?}
    ChannelEnabled -->|是| SetupContext["注入渠道配置到 Context<br/>(Key/BaseURL/ModelMapping/Override)"]
    ChannelEnabled -->|否| Abort403["返回 403<br/>渠道已禁用"]
    
    CheckSpecific -->|否| ExtractModel["从请求体中提取<br/>model name"]
    ExtractModel --> CheckModelLimit{Token 启用了<br/>模型限制?}
    
    CheckModelLimit -->|是| ModelAllowed{请求模型<br/>在允许列表中?}
    ModelAllowed -->|否| Abort403Model["返回 403<br/>Token 无此模型权限"]
    ModelAllowed -->|是| CheckAffinity
    CheckModelLimit -->|否| CheckAffinity
    
    CheckAffinity["检查 Channel Affinity 缓存"]
    
    CheckAffinity --> AffinityHit{亲和性命中?}
    
    AffinityHit -->|是| AffinityUsable{亲和性渠道<br/>可用且匹配?}
    AffinityUsable -->|是| UseAffinity["直接使用亲和性渠道"]
    UseAffinity --> SetupContext
    
    AffinityUsable -->|否| CheckKeepOnDisabled{配置了<br/>KeepOnChannelDisabled?}
    CheckKeepOnDisabled -->|否| ClearAffinity["清除该亲和性缓存"]
    ClearAffinity --> RandomSelect
    CheckKeepOnDisabled -->|是| RandomSelect
    
    AffinityHit -->|否| RandomSelect
    
    subgraph RandomSelect["随机渠道选择"]
        direction TB
        GroupType{Token group<br/>= auto?}
        
        GroupType -->|否| DirectGroup["使用指定分组"]
        DirectGroup --> FindChannels
        
        GroupType -->|是| AutoGroup["遍历 user.auto_groups"]
        AutoGroup --> NextGroup["取下一个可用分组"]
        NextGroup --> FindChannels
        
        FindChannels["从内存缓存查找<br/>group → model → []channel_id"]
        FindChannels --> FoundAny{找到候选渠道?}
        
        FoundAny -->|否| TryNextGroup{还有下一个分组?}
        TryNextGroup -->|是| NextGroup
        TryNextGroup -->|否| ReturnNone["返回无可用渠道"]
        
        FoundAny -->|是| AdvCustomFilter["Advanced Custom 渠道<br/>按 RequestPath 过滤"]
        AdvCustomFilter --> CollectPriority["收集唯一 Priority 值<br/>降序排列"]
        CollectPriority --> SelectPriority["根据 retry 参数<br/>选择目标 Priority 层<br/>(retry=0 → 最高层)"]
        SelectPriority --> WeightedRandom["在目标 Priority 内<br/>加权随机选择"]
        
        WeightedRandom --> WeightCheck{所有渠道<br/>weight = 0?}
        WeightCheck -->|是| Uniform["等概率选择<br/>(各渠道 weight=100)"]
        WeightCheck -->|否| AvgWeightCheck{平均 weight<br/>< 10?}
        
        AvgWeightCheck -->|是| Smoothing["平滑因子 ×100<br/>避免低权重被忽略"]
        Smoothing --> PickChannel
        AvgWeightCheck -->|否| PickChannel
        
        Uniform --> PickChannel["按权重概率选中渠道"]
        PickChannel --> CheckChannel{渠道状态<br/>为启用?}
        CheckChannel -->|是| ReturnChannel("返回渠道")
        CheckChannel -->|否| WeightedRandom
    end
    
    ReturnChannel --> SetupContext
    
    SetupContext --> PreConsume["预扣费"]
    PreConsume --> RelayLoop["进入重试循环"]
    
    subgraph RelayLoop["重试循环"]
        direction TB
        RL_Start["retry = 0"]
        RL_Request["执行代理请求<br/>(Adaptor → upstream)"]
        RL_Request --> RL_Success{成功?}
        
        RL_Success -->|是| RecordAffinity["记录亲和性缓存<br/>结算计费 → 记录日志 → 返回响应"]
        RL_Success -->|否| ProcessError["processChannelError()<br/>可能自动禁用渠道"]
        ProcessError --> ShouldRetry{应该重试?}
        
        ShouldRetry -->|是| RetryChannel["retry++<br/>重新选渠道<br/>(下一 Priority / 下一 Group)"]
        RetryChannel --> RL_Remaining{retry ≤<br/>RetryTimes?}
        RL_Remaining -->|是| RL_Request
        RL_Remaining -->|否| ReturnError["返回最后一次错误"]
        ShouldRetry -->|否| ReturnError
    end

    ReturnNone --> Abort503["返回 503<br/>无可用渠道"]
    Abort403 --> End
    Abort403Model --> End
    Abort503 --> End
    ReturnError --> End
    RecordAffinity --> End

    %% 样式
    classDef decision fill:#e6f3ff,stroke:#4a90d9,stroke-width:1px
    classDef action fill:#d4edda,stroke:#28a745,stroke-width:1px
    classDef terminal fill:#f8d7da,stroke:#dc3545,stroke-width:1px
    classDef subgraph fill:#f8f9fa,stroke:#6c757d,stroke-width:1px
    
    class CheckSpecific,ChannelEnabled,CheckModelLimit,ModelAllowed,AffinityHit,AffinityUsable,CheckKeepOnDisabled,GroupType,FoundAny,TryNextGroup,WeightCheck,AvgWeightCheck,CheckChannel,RL_Success,ShouldRetry,RL_Remaining decision
    class UseSpecific,SetupContext,ExtractModel,ClearAffinity,AutoGroup,NextGroup,DirectGroup,FindChannels,AdvCustomFilter,CollectPriority,SelectPriority,WeightedRandom,Uniform,Smoothing,PickChannel,PreConsume,ProcessError,RetryChannel,RecordAffinity action
    class Abort403,Abort403Model,Abort503,ReturnNone,ReturnError terminal
```

## 关键决策点

| 步骤 | 决策 | 结果 |
|------|------|------|
| 1 | Token 绑定特定渠道？ | 是 → 直接使用该渠道，跳过所有选择逻辑 |
| 2 | Channel Affinity 命中且渠道可用？ | 是 → 复用上次的渠道 |
| 3 | Group = "auto"？ | 是 → 遍历用户的自动分组列表 |
| 4 | retry=0 的 Priority 层有空渠道？ | 否 → retry++ 选更低 Priority |
| 5 | 当前 Group 所有 Priority 用尽？ | 是 → 切换下一个 Group（仅 auto group） |
| 6 | 代理请求失败，错误可重试？ | 是 → retry++ 重新选渠道（下一层） |
| 7 | 错误匹配禁用规则？ | 是 → 异步禁用渠道，从缓存移除 |

## 重试决策矩阵

| 条件 | 是否重试 | 原因 |
|------|----------|------|
| 渠道级错误（IsChannelError） | ✅ 总是 | 换一个渠道可能成功 |
| 状态码 2xx | ❌ 不 | 请求已成功 |
| 状态码 4xx（除 408/429） | ❌ 不 | 一般是客户端问题 |
| 状态码 429（限流） | ✅ 重试 | 可能其他渠道不限流 |
| 状态码 5xx（除 504/524） | ✅ 重试 | 上游临时故障 |
| 状态码 504/524（超时） | ❌ 不 | 超时重试大概率还是超时 |
| ErrorCodeBadResponseBody | ❌ 不 | 响应解析失败，重试也一样 |
| Token 绑定了特定渠道 | ❌ 不 | 只有一条路，重试也是它 |
| ChannelAffinity 配置了 SkipRetry | ❌ 不 | 规则指定的 |
