// 系统设置页面逻辑（管理员）
function showToast(msg, type='info') {
    const c=document.getElementById('toastContainer');if(!c)return;
    const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);
}

// 通用校验函数 - 收集所有违规项并统一提示
const validationViolations = [];

function validateAndCorrect(fieldName, value, constraint, fallback) {
    if (!constraint(value)) {
        validationViolations.push(`${fieldName} 已自动修正为 ${fallback}`);
        return fallback;
    }
    return value;
}

function flushValidationWarnings() {
    if (validationViolations.length > 0) {
        showToast(validationViolations.join('；'), 'warning');
        validationViolations.length = 0; // 清空
    }
}

let settingsData = {};

// Tab 切换功能
function initTabs() {
    const tabItems = document.querySelectorAll('.tab-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // 更新 tab 激活状态
            tabItems.forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            
            // 更新内容区激活状态
            tabContents.forEach(content => content.classList.remove('active'));
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
    
    // Pricing子Tab切换
    const pricingSubtabs = document.querySelectorAll('.pricing-subtab');
    const pricingSubtabContents = document.querySelectorAll('.pricing-subtab-content');
    
    pricingSubtabs.forEach(item => {
        item.addEventListener('click', () => {
            const targetSubtab = item.getAttribute('data-subtab');
            
            pricingSubtabs.forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            
            pricingSubtabContents.forEach(content => content.classList.remove('active'));
            const targetContent = document.getElementById(`pricing-subtab-${targetSubtab}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

async function loadSettings() {
    const res = await API.getOptions();
    if (!res.success) { showToast('加载设置失败','error'); return; }
    
    // 后端返回 [{key, value}, ...] 数组，需转换为 {key: value} 对象
    const array = res.data || [];
    settingsData = {};
    array.forEach(item => { 
        if (item && item.key) settingsData[item.key] = item.value; 
    });
    
    // 辅助函数：安全获取值
    const getValue = (key, defaultValue = '') => {
        return settingsData[key] !== undefined ? settingsData[key] : defaultValue;
    };
    const getBool = (key, defaultValue = false) => {
        const val = settingsData[key];
        if (val === 'true' || val === true) return true;
        if (val === 'false' || val === false) return false;
        return defaultValue;
    };
    const getNum = (key, defaultValue = 0) => {
        const val = settingsData[key];
        return val !== undefined ? Number(val) : defaultValue;
    };

    // ========== Tab 1: 运营设置 ==========
    // 系统行为
    safeSetChecked('DefaultCollapseSidebar', getBool('DefaultCollapseSidebar'));
    safeSetChecked('DemoSiteEnabled', getBool('DemoSiteEnabled'));
    safeSetChecked('SelfUseModeEnabled', getBool('SelfUseModeEnabled'));
    safeSetChecked('LoginRequiredEnabled', getBool('LoginRequiredEnabled'));
    
    // 顶栏管理
    safeSetChecked('NavHomeEnabled', getBool('nav.home_enabled', true));
    safeSetChecked('NavConsoleEnabled', getBool('nav.console_enabled', true));
    safeSetChecked('NavModelEnabled', getBool('nav.model_enabled', true));
    safeSetChecked('NavDocsEnabled', getBool('nav.docs_enabled', true));
    safeSetChecked('NavAboutEnabled', getBool('nav.about_enabled', true));
    
    // 监控与告警
    safeSetValue('QuotaRemindThreshold', getNum('QuotaRemindThreshold', 0));
    safeSetChecked('PerfMetricsEnabled', getBool('perf_metrics_setting.enabled', true));
    safeSetValue('PerfMetricsFlushInterval', getNum('perf_metrics_setting.flush_interval', 5));
    safeSetValue('PerfMetricsBucketTime', getValue('perf_metrics_setting.bucket_time', 'hour'));
    safeSetValue('PerfMetricsRetentionDays', getNum('perf_metrics_setting.retention_days', 0));
    
    // 日志维护
    safeSetChecked('LogConsumeEnabled', getBool('LogConsumeEnabled'));
    
    // Worker 代理
    safeSetValue('WorkerUrl', getValue('WorkerUrl'));
    safeSetValue('WorkerValidKey', getValue('WorkerValidKey'));
    safeSetChecked('WorkerAllowHttpImageRequestEnabled', getBool('WorkerAllowHttpImageRequestEnabled'));
    
    // 通用设置
    safeSetValue('TopUpLink', getValue('TopUpLink'));
    safeSetValue('ServerAddress', getValue('ServerAddress'));
    safeSetValue('RetryTimes', getNum('RetryTimes', 0));
    safeSetChecked('DisplayInCurrencyEnabled', getBool('DisplayInCurrencyEnabled'));
    safeSetChecked('DisplayTokenStatEnabled', getBool('DisplayTokenStatEnabled'));
    
    // 系统公告
    safeSetValue('Notice', getValue('Notice'));

    // ========== Tab 2: 仪表盘 ==========
    safeSetChecked('DataExportEnabled', getBool('DataExportEnabled'));
    safeSetValue('DataExportInterval', getNum('DataExportInterval', 5));
    safeSetValue('DataExportDefaultTime', getValue('DataExportDefaultTime', 'hour'));

    // ========== Tab 3: 聊天设置 ==========
    safeSetValue('Chats', getValue('Chats', '[]'));

    // ========== Tab 6: 分组与模型定价 ==========
    // 分组倍率
    safeSetValue('UserUsableGroups', getValue('UserUsableGroups', ''));
    safeSetValue('GroupRatio', getValue('GroupRatio', ''));
    safeSetValue('TopupGroupRatio', getValue('TopupGroupRatio', ''));
    safeSetValue('GroupGroupRatio', getValue('GroupGroupRatio', ''));
    safeSetValue('AutoGroups', getValue('AutoGroups', ''));
    safeSetChecked('DefaultUseAutoGroup', getBool('DefaultUseAutoGroup'));
    safeSetChecked('ExposeRatioEnabled', getBool('ExposeRatioEnabled'));
    safeSetValue('GroupSpecialUsableGroup', getValue('group_ratio_setting.group_special_usable_group', '{}'));
    // 工具定价
    safeSetValue('ToolPriceSetting', getValue('tool_price_setting.prices', '{}'));
    // 模型定价（动态加载到表格）
    loadModelPricingTable();

    // ========== Tab 4: 绘图设置 ==========
    safeSetChecked('MjNotifyEnabled', getBool('MjNotifyEnabled'));
    safeSetChecked('MjActionCheckSucceed', getBool('MjActionCheckSucceed'));
    safeSetChecked('MjAllowCallbackEnabled', getBool('MjAllowCallbackEnabled'));
    safeSetChecked('MjAccountFilterEnabled', getBool('MjAccountFilterEnabled'));
    safeSetChecked('MjServerAddressRewriteEnabled', getBool('MjServerAddressRewriteEnabled'));
    safeSetChecked('MjClearPromptParamsEnabled', getBool('MjClearPromptParamsEnabled'));

    // ========== Tab 5: 支付设置 ==========
    safeSetChecked('TopUpEnabled', getBool('TopUpEnabled'));
    safeSetValue('MinTopUp', getNum('MinTopUp', 1));
    safeSetValue('TopupRatio', getNum('TopupRatio', 15));

    // ========== Tab 8: 模型相关设置 ==========
    // 全局模型设置
    safeSetChecked('GlobalPassThroughEnabled', getBool('global.pass_through_request_enabled'));
    safeSetValue('GlobalThinkingBlacklist', getValue('global.thinking_model_blacklist', '[]'));
    safeSetValue('GlobalChatCompletionsToResponsesPolicy', getValue('global.chat_completions_to_responses_policy', '{}'));
    
    // 路由可靠性
    safeSetChecked('AutomaticEnableChannelEnabled', getBool('AutomaticEnableChannelEnabled'));
    safeSetChecked('AutomaticDisableChannelEnabled', getBool('AutomaticDisableChannelEnabled'));
    safeSetValue('ChannelDisableThreshold', getNum('ChannelDisableThreshold', 3));
    safeSetValue('AutomaticDisableKeywords', getValue('AutomaticDisableKeywords'));
    safeSetValue('AutomaticDisableStatusCodes', getValue('AutomaticDisableStatusCodes', '401'));
    safeSetValue('AutomaticRetryStatusCodes', getValue('AutomaticRetryStatusCodes', '100-199,300-399,401-407,409-499,500-503,505-523,525-599'));
    
    // 渠道自动测试
    safeSetChecked('AutoTestChannelEnabled', getBool('monitor_setting.auto_test_channel_enabled'));
    safeSetValue('AutoTestChannelMinutes', getNum('monitor_setting.auto_test_channel_minutes', 10));
    safeSetValue('ChannelTestMode', getValue('monitor_setting.channel_test_mode', 'scheduled_all'));
    
    // Gemini 设置
    safeSetValue('GeminiSafetySetting', getValue('gemini.safety_settings', ''));
    safeSetValue('GeminiVersionSettings', getValue('gemini.version_settings', ''));
    safeSetValue('GeminiSupportedImagineModels', getValue('gemini.supported_imagine_models', ''));
    safeSetChecked('GeminiThinkingAdapterEnabled', getBool('gemini.thinking_adapter_enabled'));
    safeSetValue('GeminiThinkingAdapterBudgetTokensPercentage', getNum('gemini.thinking_adapter_budget_tokens_percentage', 0.6));
    safeSetChecked('GeminiFunctionCallThoughtSignatureEnabled', getBool('gemini.function_call_thought_signature_enabled', true));
    safeSetChecked('GeminiRemoveFunctionResponseIdEnabled', getBool('gemini.remove_function_response_id_enabled', true));
    
    // Claude 设置
    safeSetValue('ClaudeModelHeaders', getValue('claude.model_headers_settings', ''));
    safeSetValue('ClaudeDefaultMaxTokens', getValue('claude.default_max_tokens', ''));
    safeSetChecked('ClaudeThinkingAdapterEnabled', getBool('claude.thinking_adapter_enabled', true));
    safeSetValue('ClaudeThinkingAdapterBudgetTokensPercentage', getNum('claude.thinking_adapter_budget_tokens_percentage', 0.8));
    
    // 连接存活检测
    safeSetChecked('PingIntervalEnabled', getBool('general_setting.ping_interval_enabled'));
    safeSetValue('PingIntervalSeconds', getNum('general_setting.ping_interval_seconds', 60));
    
    // 渠道亲和性（enabled 迁移到智能路由 Tab，此处仅保留高级选项）
    safeSetChecked('ChannelAffinitySwitchOnSuccess', getBool('channel_affinity_setting.switch_on_success'));
    safeSetChecked('ChannelAffinityKeepOnDisabled', getBool('channel_affinity_setting.keep_on_channel_disabled'));
    safeSetValue('ChannelAffinityMaxEntries', getNum('channel_affinity_setting.max_entries', 10000));
    safeSetValue('ChannelAffinityDefaultTTL', getNum('channel_affinity_setting.default_ttl_seconds', 3600));
    safeSetValue('ChannelAffinityRules', getValue('channel_affinity_setting.rules', '{}'));
    
    // ========== Tab 智能路由配置 ==========
    // 延迟感知路由
    safeSetChecked('LatencyRoutingEnabled', getBool('latency_routing_setting.enabled'));
    safeSetValue('LatencyRoutingWeightFactor', getNum('latency_routing_setting.weight_factor', 0.3));
    document.getElementById('LatencyRoutingWeightFactorVal').textContent = getNum('latency_routing_setting.weight_factor', 0.3);
    
    // 滑动窗口熔断
    safeSetChecked('CircuitBreakerEnabled', getBool('circuit_breaker_setting.enabled'));
    safeSetValue('CircuitBreakerWindowSeconds', getNum('circuit_breaker_setting.window_seconds', 60));
    safeSetValue('CircuitBreakerBucketSeconds', getNum('circuit_breaker_setting.bucket_seconds', 10));
    safeSetValue('CircuitBreakerErrorThreshold', getNum('circuit_breaker_setting.error_threshold', 0.5));
    document.getElementById('CircuitBreakerErrorThresholdVal').textContent = getNum('circuit_breaker_setting.error_threshold', 0.5);
    safeSetValue('CircuitBreakerMinRequestCount', getNum('circuit_breaker_setting.min_request_count', 10));
    safeSetValue('CircuitBreakerOpenTimeoutSeconds', getNum('circuit_breaker_setting.open_timeout_seconds', 30));
    safeSetValue('CircuitBreakerHalfOpenMaxRequests', getNum('circuit_breaker_setting.half_open_max_requests', 3));
    safeSetValue('CircuitBreakerHalfOpenSuccessThreshold', getNum('circuit_breaker_setting.half_open_success_threshold', 2));
    
    // 渠道并发限流
    safeSetChecked('ChannelLimiterEnabled', getBool('channel_limiter_setting.enabled'));
    safeSetValue('ChannelLimiterMaxConcurrent', getNum('channel_limiter_setting.max_concurrent_requests', 0));
    
    // 渠道亲和性 enabled（从旧位置迁移到智能路由 Tab）
    safeSetChecked('ChannelAffinityEnabled', getBool('channel_affinity_setting.enabled'));
    
    // 成本感知路由
    safeSetChecked('CostRoutingEnabled', getBool('cost_routing_setting.enabled'));
    safeSetValue('CostRoutingWeight', getNum('cost_routing_setting.cost_weight', 0.2));
    document.getElementById('CostRoutingWeightVal').textContent = getNum('cost_routing_setting.cost_weight', 0.2);
    
    // 成功率动态权重
    safeSetChecked('SuccessRateRoutingEnabled', getBool('success_rate_routing_setting.enabled'));
    safeSetValue('SuccessRateWeightFactor', getNum('success_rate_routing_setting.weight_factor', 0.3));
    document.getElementById('SuccessRateWeightFactorVal').textContent = getNum('success_rate_routing_setting.weight_factor', 0.3);
    safeSetValue('SuccessRateWindowMinutes', getNum('success_rate_routing_setting.window_minutes', 5));
    safeSetValue('SuccessRateMinSamples', getNum('success_rate_routing_setting.min_samples', 10));
    
    // Grok 设置
    safeSetChecked('GrokViolationDeductionEnabled', getBool('grok.violation_deduction_enabled'));
    safeSetValue('GrokViolationDeductionAmount', getNum('grok.violation_deduction_amount', 0));
    
    // io.net 部署
    safeSetChecked('IoNetEnabled', getBool('model_deployment.ionet.enabled'));
    safeSetValue('IoNetApiKey', getValue('model_deployment.ionet.api_key'));

    // ========== Tab 7: 速率限制 ==========
    // 模型请求速率限制
    safeSetChecked('ModelRequestRateLimitEnabled', getBool('ModelRequestRateLimitEnabled'));
    safeSetValue('ModelRequestRateLimitDuration', getNum('ModelRequestRateLimitDurationMinutes', 60));
    safeSetValue('ModelRequestRateLimitCount', getNum('ModelRequestRateLimitCount', 100));
    safeSetValue('ModelRequestRateLimitSuccessCount', getNum('ModelRequestRateLimitSuccessCount', 100));
    safeSetValue('ModelRequestRateLimitGroup', getValue('ModelRequestRateLimitGroup'));
    
    // 敏感词过滤
    safeSetChecked('CheckSensitiveEnabled', getBool('CheckSensitiveEnabled'));
    safeSetChecked('CheckSensitiveOnPromptEnabled', getBool('CheckSensitiveOnPromptEnabled'));
    safeSetValue('SensitiveWords', getValue('SensitiveWords'));
    
    // SSRF 防护
    safeSetChecked('SSRFProtectionEnabled', getBool('fetch_setting.enable_ssrf_protection'));
    safeSetChecked('SSRFAllowPrivateIP', getBool('fetch_setting.allow_private_ip'));
    safeSetValue('SSRFDomainFilterMode', getValue('fetch_setting.domain_filter_mode', 'false'));
    safeSetValue('SSRFDomainList', getValue('fetch_setting.domain_list'));
    safeSetValue('SSRFAllowedPorts', getValue('fetch_setting.allowed_ports'));
    
    // 令牌限制
    safeSetValue('UserMaxTokenNum', getNum('UserMaxTokenNum', 10));
    
    // API 速率限制
    safeSetValue('GlobalApiRateLimitNum', getNum('GlobalApiRateLimitNum', 1000));
    safeSetValue('UserApiRateLimitNum', getNum('UserApiRateLimitNum', 100));
    safeSetValue('TokenApiRateLimitNum', getNum('TokenApiRateLimitNum', 60));

    // ========== Tab 10: 性能设置 ==========
    // 磁盘缓存
    safeSetChecked('DiskCacheEnabled', getBool('performance_setting.disk_cache_enabled'));
    safeSetValue('DiskCacheThresholdMB', getNum('performance_setting.disk_cache_threshold_mb', 10));
    safeSetValue('DiskCacheMaxSizeMB', getNum('performance_setting.disk_cache_max_size_mb', 1024));
    safeSetValue('DiskCachePath', getValue('performance_setting.disk_cache_path'));
    
    // 系统性能监控
    safeSetChecked('PerfMonitorEnabled', getBool('performance_setting.monitor_enabled'));
    safeSetValue('PerfMonitorCPUThreshold', getNum('performance_setting.monitor_cpu_threshold', 90));
    safeSetValue('PerfMonitorMemoryThreshold', getNum('performance_setting.monitor_memory_threshold', 90));
    safeSetValue('PerfMonitorDiskThreshold', getNum('performance_setting.monitor_disk_threshold', 95));

    // ========== Tab 11: 系统设置 ==========
    // 基础设置
    safeSetValue('SystemName', getValue('SystemName'));
    safeSetValue('Logo', getValue('Logo'));
    safeSetValue('HomePageContent', getValue('HomePageContent'));
    safeSetValue('FooterHTML', getValue('FooterHTML'));
    safeSetValue('AboutContent', getValue('About'));
    
    // 额度设置
    safeSetValue('PreConsumedQuota', getNum('PreConsumedQuota', 0));
    safeSetValue('QuotaForInviter', getNum('QuotaForInviter', 0));
    safeSetValue('QuotaForInvitee', getNum('QuotaForInvitee', 0));
    
    // 注册设置
    safeSetChecked('RegisterEnabled', getBool('RegisterEnabled'));
    safeSetChecked('EmailVerificationEnabled', getBool('EmailVerificationEnabled'));
    safeSetValue('QuotaForNewUser', getNum('QuotaForNewUser', 500000));
    safeSetValue('GroupForNewUser', getValue('GroupForNewUser', 'default'));
    
    // 日志设置
    safeSetChecked('LogConsumeEnabled', getBool('LogConsumeEnabled'));
    safeSetValue('LogRetentionDays', getNum('LogRetentionDays', 30));
    
    // SMTP设置
    safeSetValue('SMTPServer', getValue('SMTPServer'));
    safeSetValue('SMTPPort', getNum('SMTPPort', 587));
    safeSetValue('SMTPFrom', getValue('SMTPFrom'));
    safeSetValue('SMTPUsername', getValue('SMTPUsername'));
    safeSetValue('SMTPPassword', getValue('SMTPPassword'));

    // OAuth设置
    safeSetChecked('PasswordLoginEnabled', getBool('PasswordLoginEnabled', true));
    safeSetChecked('PasswordRegisterEnabled', getBool('PasswordRegisterEnabled', true));
    safeSetChecked('GitHubOAuthEnabled', getBool('GitHubOAuthEnabled'));
    safeSetValue('GitHubClientId', getValue('GitHubClientId'));
    safeSetValue('GitHubClientSecret', getValue('GitHubClientSecret'));
    
    // Turnstile验证
    safeSetChecked('TurnstileCheckEnabled', getBool('TurnstileCheckEnabled'));
    safeSetValue('TurnstileSiteKey', getValue('TurnstileSiteKey'));
    safeSetValue('TurnstileSecretKey', getValue('TurnstileSecretKey'));

    // 计费与定价
    safeSetValue('QuotaPerUnit', getNum('QuotaPerUnit', 500000));
    safeSetValue('DisplayTokenStatRatio', getNum('DisplayTokenStatRatio', 1));
    safeSetChecked('CheckInEnabled', getBool('CheckInEnabled'));
    safeSetValue('QuotaForInvite', getNum('QuotaForInvite', 100));

    // 维护模式
    safeSetChecked('MaintenanceMode', getBool('MaintenanceMode'));
    safeSetValue('MaintenanceMessage', getValue('MaintenanceMessage'));
}

// 安全设置值的辅助函数
function safeSetValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function safeSetChecked(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
}

function safeGetValue(id, defaultValue = '') {
    const el = document.getElementById(id);
    return el ? el.value : defaultValue;
}

function safeGetChecked(id, defaultValue = false) {
    const el = document.getElementById(id);
    return el ? el.checked : defaultValue;
}

// 按 Tab 收集表单数据的辅助函数
function collectTabPayload() {
    const payload = {};

    // ========== Tab 1: 运营设置 ==========
    payload.DefaultCollapseSidebar = safeGetChecked('DefaultCollapseSidebar') ? 'true' : 'false';
    payload.DemoSiteEnabled = safeGetChecked('DemoSiteEnabled') ? 'true' : 'false';
    payload.SelfUseModeEnabled = safeGetChecked('SelfUseModeEnabled') ? 'true' : 'false';
    payload.LoginRequiredEnabled = safeGetChecked('LoginRequiredEnabled') ? 'true' : 'false';
    
    // 顶栏管理
    payload['nav.home_enabled'] = safeGetChecked('NavHomeEnabled') ? 'true' : 'false';
    payload['nav.console_enabled'] = safeGetChecked('NavConsoleEnabled') ? 'true' : 'false';
    payload['nav.model_enabled'] = safeGetChecked('NavModelEnabled') ? 'true' : 'false';
    payload['nav.docs_enabled'] = safeGetChecked('NavDocsEnabled') ? 'true' : 'false';
    payload['nav.about_enabled'] = safeGetChecked('NavAboutEnabled') ? 'true' : 'false';
    
    // 监控与告警
    payload.QuotaRemindThreshold = safeGetValue('QuotaRemindThreshold');
    payload['perf_metrics_setting.enabled'] = safeGetChecked('PerfMetricsEnabled') ? 'true' : 'false';
    payload['perf_metrics_setting.flush_interval'] = safeGetValue('PerfMetricsFlushInterval');
    payload['perf_metrics_setting.bucket_time'] = safeGetValue('PerfMetricsBucketTime');
    payload['perf_metrics_setting.retention_days'] = safeGetValue('PerfMetricsRetentionDays');
    
    // Worker 代理
    payload.WorkerUrl = safeGetValue('WorkerUrl');
    payload.WorkerValidKey = safeGetValue('WorkerValidKey');
    payload.WorkerAllowHttpImageRequestEnabled = safeGetChecked('WorkerAllowHttpImageRequestEnabled') ? 'true' : 'false';
    
    // 通用设置
    payload.TopUpLink = safeGetValue('TopUpLink');
    payload.ServerAddress = safeGetValue('ServerAddress');
    payload.RetryTimes = safeGetValue('RetryTimes');
    payload.DisplayInCurrencyEnabled = safeGetChecked('DisplayInCurrencyEnabled') ? 'true' : 'false';
    payload.DisplayTokenStatEnabled = safeGetChecked('DisplayTokenStatEnabled') ? 'true' : 'false';
    
    // 系统公告
    payload.Notice = safeGetValue('Notice');

    // ========== Tab 2: 仪表盘 ==========
    payload.DataExportEnabled = safeGetChecked('DataExportEnabled') ? 'true' : 'false';
    payload.DataExportInterval = safeGetValue('DataExportInterval');
    payload.DataExportDefaultTime = safeGetValue('DataExportDefaultTime');

    // ========== Tab 3: 聊天设置 ==========
    payload.Chats = safeGetValue('Chats');

    // ========== Tab 6: 分组与模型定价 ==========
    payload.UserUsableGroups = safeGetValue('UserUsableGroups');
    payload.GroupRatio = safeGetValue('GroupRatio');
    payload.TopupGroupRatio = safeGetValue('TopupGroupRatio');
    payload.GroupGroupRatio = safeGetValue('GroupGroupRatio');
    payload.AutoGroups = safeGetValue('AutoGroups');
    payload.DefaultUseAutoGroup = safeGetChecked('DefaultUseAutoGroup') ? 'true' : 'false';
    payload.ExposeRatioEnabled = safeGetChecked('ExposeRatioEnabled') ? 'true' : 'false';
    payload['group_ratio_setting.group_special_usable_group'] = safeGetValue('GroupSpecialUsableGroup');
    payload['tool_price_setting.prices'] = safeGetValue('ToolPriceSetting');
    // 模型定价通过表格单独保存

    // ========== Tab 4: 绘图设置 ==========
    payload.MjNotifyEnabled = safeGetChecked('MjNotifyEnabled') ? 'true' : 'false';
    payload.MjActionCheckSucceed = safeGetChecked('MjActionCheckSucceed') ? 'true' : 'false';
    payload.MjAllowCallbackEnabled = safeGetChecked('MjAllowCallbackEnabled') ? 'true' : 'false';
    payload.MjAccountFilterEnabled = safeGetChecked('MjAccountFilterEnabled') ? 'true' : 'false';
    payload.MjServerAddressRewriteEnabled = safeGetChecked('MjServerAddressRewriteEnabled') ? 'true' : 'false';
    payload.MjClearPromptParamsEnabled = safeGetChecked('MjClearPromptParamsEnabled') ? 'true' : 'false';

    // ========== Tab 5: 支付设置 ==========
    payload.TopUpEnabled = safeGetChecked('TopUpEnabled') ? 'true' : 'false';
    payload.MinTopUp = safeGetValue('MinTopUp');
    payload.TopupRatio = safeGetValue('TopupRatio');

    // ========== Tab 8: 模型相关设置 ==========
    // 全局模型设置
    payload['global.pass_through_request_enabled'] = safeGetChecked('GlobalPassThroughEnabled') ? 'true' : 'false';
    payload['global.thinking_model_blacklist'] = safeGetValue('GlobalThinkingBlacklist');
    payload['global.chat_completions_to_responses_policy'] = safeGetValue('GlobalChatCompletionsToResponsesPolicy');
    
    // 路由可靠性
    payload.AutomaticEnableChannelEnabled = safeGetChecked('AutomaticEnableChannelEnabled') ? 'true' : 'false';
    payload.AutomaticDisableChannelEnabled = safeGetChecked('AutomaticDisableChannelEnabled') ? 'true' : 'false';
    payload.ChannelDisableThreshold = safeGetValue('ChannelDisableThreshold');
    payload.AutomaticDisableKeywords = safeGetValue('AutomaticDisableKeywords');
    payload.AutomaticDisableStatusCodes = safeGetValue('AutomaticDisableStatusCodes');
    payload.AutomaticRetryStatusCodes = safeGetValue('AutomaticRetryStatusCodes');
    
    // 渠道自动测试
    payload['monitor_setting.auto_test_channel_enabled'] = safeGetChecked('AutoTestChannelEnabled') ? 'true' : 'false';
    payload['monitor_setting.auto_test_channel_minutes'] = safeGetValue('AutoTestChannelMinutes');
    payload['monitor_setting.channel_test_mode'] = safeGetValue('ChannelTestMode');
    
    // Gemini 设置
    payload['gemini.safety_settings'] = safeGetValue('GeminiSafetySetting');
    payload['gemini.version_settings'] = safeGetValue('GeminiVersionSettings');
    payload['gemini.supported_imagine_models'] = safeGetValue('GeminiSupportedImagineModels');
    payload['gemini.thinking_adapter_enabled'] = safeGetChecked('GeminiThinkingAdapterEnabled') ? 'true' : 'false';
    payload['gemini.thinking_adapter_budget_tokens_percentage'] = safeGetValue('GeminiThinkingAdapterBudgetTokensPercentage');
    payload['gemini.function_call_thought_signature_enabled'] = safeGetChecked('GeminiFunctionCallThoughtSignatureEnabled') ? 'true' : 'false';
    payload['gemini.remove_function_response_id_enabled'] = safeGetChecked('GeminiRemoveFunctionResponseIdEnabled') ? 'true' : 'false';
    
    // Claude 设置
    payload['claude.model_headers_settings'] = safeGetValue('ClaudeModelHeaders');
    payload['claude.default_max_tokens'] = safeGetValue('ClaudeDefaultMaxTokens');
    payload['claude.thinking_adapter_enabled'] = safeGetChecked('ClaudeThinkingAdapterEnabled') ? 'true' : 'false';
    payload['claude.thinking_adapter_budget_tokens_percentage'] = safeGetValue('ClaudeThinkingAdapterBudgetTokensPercentage');
    
    // 连接存活检测
    payload['general_setting.ping_interval_enabled'] = safeGetChecked('PingIntervalEnabled') ? 'true' : 'false';
    payload['general_setting.ping_interval_seconds'] = safeGetValue('PingIntervalSeconds');
    
    // 渠道亲和性（enabled 使用原生 boolean 与智能路由 Tab 一致）
    payload['channel_affinity_setting.enabled'] = safeGetChecked('ChannelAffinityEnabled');
    payload['channel_affinity_setting.switch_on_success'] = safeGetChecked('ChannelAffinitySwitchOnSuccess') ? 'true' : 'false';
    payload['channel_affinity_setting.keep_on_channel_disabled'] = safeGetChecked('ChannelAffinityKeepOnDisabled') ? 'true' : 'false';
    payload['channel_affinity_setting.max_entries'] = safeGetValue('ChannelAffinityMaxEntries');
    payload['channel_affinity_setting.default_ttl_seconds'] = safeGetValue('ChannelAffinityDefaultTTL');
    payload['channel_affinity_setting.rules'] = safeGetValue('ChannelAffinityRules');
    
    // Grok 设置
    payload['grok.violation_deduction_enabled'] = safeGetChecked('GrokViolationDeductionEnabled') ? 'true' : 'false';
    payload['grok.violation_deduction_amount'] = safeGetValue('GrokViolationDeductionAmount');
    
    // io.net 部署
    payload['model_deployment.ionet.enabled'] = safeGetChecked('IoNetEnabled') ? 'true' : 'false';
    payload['model_deployment.ionet.api_key'] = safeGetValue('IoNetApiKey');

    // ========== Tab 7: 速率限制 ==========
    // 模型请求速率限制
    payload.ModelRequestRateLimitEnabled = safeGetChecked('ModelRequestRateLimitEnabled') ? 'true' : 'false';
    payload.ModelRequestRateLimitDurationMinutes = safeGetValue('ModelRequestRateLimitDuration');
    payload.ModelRequestRateLimitCount = safeGetValue('ModelRequestRateLimitCount');
    payload.ModelRequestRateLimitSuccessCount = safeGetValue('ModelRequestRateLimitSuccessCount');
    payload.ModelRequestRateLimitGroup = safeGetValue('ModelRequestRateLimitGroup');
    
    // 敏感词过滤
    payload.CheckSensitiveEnabled = safeGetChecked('CheckSensitiveEnabled') ? 'true' : 'false';
    payload.CheckSensitiveOnPromptEnabled = safeGetChecked('CheckSensitiveOnPromptEnabled') ? 'true' : 'false';
    payload.SensitiveWords = safeGetValue('SensitiveWords');
    
    // SSRF 防护
    payload['fetch_setting.enable_ssrf_protection'] = safeGetChecked('SSRFProtectionEnabled') ? 'true' : 'false';
    payload['fetch_setting.allow_private_ip'] = safeGetChecked('SSRFAllowPrivateIP') ? 'true' : 'false';
    payload['fetch_setting.domain_filter_mode'] = safeGetValue('SSRFDomainFilterMode');
    payload['fetch_setting.domain_list'] = safeGetValue('SSRFDomainList');
    payload['fetch_setting.allowed_ports'] = safeGetValue('SSRFAllowedPorts');
    
    // 令牌限制
    payload.UserMaxTokenNum = safeGetValue('UserMaxTokenNum');
    
    // API 速率限制
    payload.GlobalApiRateLimitNum = safeGetValue('GlobalApiRateLimitNum');
    payload.UserApiRateLimitNum = safeGetValue('UserApiRateLimitNum');
    payload.TokenApiRateLimitNum = safeGetValue('TokenApiRateLimitNum');

    // ========== Tab 10: 性能设置 ==========
    // 磁盘缓存
    payload['performance_setting.disk_cache_enabled'] = safeGetChecked('DiskCacheEnabled') ? 'true' : 'false';
    payload['performance_setting.disk_cache_threshold_mb'] = safeGetValue('DiskCacheThresholdMB');
    payload['performance_setting.disk_cache_max_size_mb'] = safeGetValue('DiskCacheMaxSizeMB');
    payload['performance_setting.disk_cache_path'] = safeGetValue('DiskCachePath');
    
    // 系统性能监控
    payload['performance_setting.monitor_enabled'] = safeGetChecked('PerfMonitorEnabled') ? 'true' : 'false';
    payload['performance_setting.monitor_cpu_threshold'] = safeGetValue('PerfMonitorCPUThreshold');
    payload['performance_setting.monitor_memory_threshold'] = safeGetValue('PerfMonitorMemoryThreshold');
    payload['performance_setting.monitor_disk_threshold'] = safeGetValue('PerfMonitorDiskThreshold');

    // ========== Tab 11: 系统设置 ==========
    // 基础设置
    payload.SystemName = safeGetValue('SystemName');
    payload.Logo = safeGetValue('Logo');
    payload.HomePageContent = safeGetValue('HomePageContent');
    payload.FooterHTML = safeGetValue('FooterHTML');
    payload.About = safeGetValue('AboutContent');
    
    // 额度设置
    payload.PreConsumedQuota = safeGetValue('PreConsumedQuota');
    payload.QuotaForInviter = safeGetValue('QuotaForInviter');
    payload.QuotaForInvitee = safeGetValue('QuotaForInvitee');
    
    // 注册设置
    payload.RegisterEnabled = safeGetChecked('RegisterEnabled') ? 'true' : 'false';
    payload.EmailVerificationEnabled = safeGetChecked('EmailVerificationEnabled') ? 'true' : 'false';
    payload.QuotaForNewUser = safeGetValue('QuotaForNewUser');
    payload.GroupForNewUser = safeGetValue('GroupForNewUser');
    
    // 日志设置
    payload.LogConsumeEnabled = safeGetChecked('LogConsumeEnabled') ? 'true' : 'false';
    payload.LogRetentionDays = safeGetValue('LogRetentionDays');
    
    // SMTP设置
    payload.SMTPServer = safeGetValue('SMTPServer');
    payload.SMTPPort = safeGetValue('SMTPPort');
    payload.SMTPFrom = safeGetValue('SMTPFrom');
    payload.SMTPUsername = safeGetValue('SMTPUsername');
    payload.SMTPPassword = safeGetValue('SMTPPassword');

    // OAuth设置
    payload.PasswordLoginEnabled = safeGetChecked('PasswordLoginEnabled') ? 'true' : 'false';
    payload.PasswordRegisterEnabled = safeGetChecked('PasswordRegisterEnabled') ? 'true' : 'false';
    payload.GitHubOAuthEnabled = safeGetChecked('GitHubOAuthEnabled') ? 'true' : 'false';
    payload.GitHubClientId = safeGetValue('GitHubClientId');
    payload.GitHubClientSecret = safeGetValue('GitHubClientSecret');
    
    // Turnstile验证
    payload.TurnstileCheckEnabled = safeGetChecked('TurnstileCheckEnabled') ? 'true' : 'false';
    payload.TurnstileSiteKey = safeGetValue('TurnstileSiteKey');
    payload.TurnstileSecretKey = safeGetValue('TurnstileSecretKey');

    // 计费与定价
    payload.QuotaPerUnit = safeGetValue('QuotaPerUnit');
    payload.DisplayTokenStatRatio = safeGetValue('DisplayTokenStatRatio');
    payload.CheckInEnabled = safeGetChecked('CheckInEnabled') ? 'true' : 'false';
    payload.QuotaForInvite = safeGetValue('QuotaForInvite');

    // 维护模式
    payload.MaintenanceMode = safeGetChecked('MaintenanceMode') ? 'true' : 'false';
    payload.MaintenanceMessage = safeGetValue('MaintenanceMessage');

    // ========== Tab 智能路由配置 ==========
    // 延迟感知路由（使用原生 JS 类型）
    payload['latency_routing_setting.enabled'] = safeGetChecked('LatencyRoutingEnabled');
    payload['latency_routing_setting.weight_factor'] = Number(safeGetValue('LatencyRoutingWeightFactor'));
    
    // 滑动窗口熔断（带通用校验）
    payload['circuit_breaker_setting.enabled'] = safeGetChecked('CircuitBreakerEnabled');
    const windowSeconds = Number(safeGetValue('CircuitBreakerWindowSeconds'));
    const bucketSeconds = Number(safeGetValue('CircuitBreakerBucketSeconds'));
    const halfOpenMax = Number(safeGetValue('CircuitBreakerHalfOpenMaxRequests'));
    const halfOpenSuccess = Number(safeGetValue('CircuitBreakerHalfOpenSuccessThreshold'));
    
    payload['circuit_breaker_setting.window_seconds'] = validateAndCorrect('统计窗口', windowSeconds, v => v > 0, 60);
    payload['circuit_breaker_setting.bucket_seconds'] = validateAndCorrect('时间桶粒度', bucketSeconds, v => v > 0 && v <= windowSeconds, Math.min(10, windowSeconds));
    payload['circuit_breaker_setting.error_threshold'] = Number(safeGetValue('CircuitBreakerErrorThreshold'));
    payload['circuit_breaker_setting.min_request_count'] = validateAndCorrect('最小请求数', Number(safeGetValue('CircuitBreakerMinRequestCount')), v => v > 0, 10);
    payload['circuit_breaker_setting.open_timeout_seconds'] = validateAndCorrect('熔断持续时间', Number(safeGetValue('CircuitBreakerOpenTimeoutSeconds')), v => v > 0, 30);
    payload['circuit_breaker_setting.half_open_max_requests'] = validateAndCorrect('半开最大请求数', halfOpenMax, v => v > 0, 3);
    payload['circuit_breaker_setting.half_open_success_threshold'] = validateAndCorrect('半开成功阈值', halfOpenSuccess, v => v > 0 && v <= halfOpenMax, Math.min(2, halfOpenMax));
    
    // 渠道并发限流
    payload['channel_limiter_setting.enabled'] = safeGetChecked('ChannelLimiterEnabled');
    payload['channel_limiter_setting.max_concurrent_requests'] = Number(safeGetValue('ChannelLimiterMaxConcurrent'));
    
    // 成本感知路由
    payload['cost_routing_setting.enabled'] = safeGetChecked('CostRoutingEnabled');
    payload['cost_routing_setting.cost_weight'] = Number(safeGetValue('CostRoutingWeight'));
    
    // 成功率动态权重
    payload['success_rate_routing_setting.enabled'] = safeGetChecked('SuccessRateRoutingEnabled');
    payload['success_rate_routing_setting.weight_factor'] = Number(safeGetValue('SuccessRateWeightFactor'));
    payload['success_rate_routing_setting.window_minutes'] = validateAndCorrect('成功率统计窗口', Number(safeGetValue('SuccessRateWindowMinutes')), v => v >= 1, 5);
    payload['success_rate_routing_setting.min_samples'] = validateAndCorrect('成功率最小样本数', Number(safeGetValue('SuccessRateMinSamples')), v => v >= 1, 10);
    
    return payload;
}

// 保存全部设置（对应 HTML 中的"保存全部设置"按钮）
async function saveAllSettings() {
    const payload = collectTabPayload();
    flushValidationWarnings();
    const res = await API.updateOptions(payload);
    if (res.success) {
        showToast(res.message || '所有设置已保存', 'success');
        await loadSettings();
    } else {
        showToast(res.message || '保存失败', 'error');
    }
}

async function loadSystemInfo() {
    const res = await API.getStatus();
    const container = document.getElementById('systemInfoContent');
    if (res.success && res.data) {
        const d = res.data;
        container.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
                <div><div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">系统版本</div><div style="font-weight:600;">${d.version || '--'}</div></div>
                <div><div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">Go 版本</div><div style="font-weight:600;">${d.go_version || '--'}</div></div>
                <div><div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">启动时间</div><div style="font-weight:600;">${d.start_time ? new Date(d.start_time * 1000).toLocaleString('zh-CN') : '--'}</div></div>
                <div><div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">数据库</div><div style="font-weight:600;">${d.db_type || '--'}</div></div>
                <div><div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">Redis 状态</div><div style="font-weight:600;">${d.redis_enabled ? '已连接' : '未启用'}</div></div>
                <div><div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">内存使用</div><div style="font-weight:600;">${d.memory_mb ? d.memory_mb + ' MB' : '--'}</div></div>
                <div><div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">CPU 使用率</div><div style="font-weight:600;">${d.cpu_usage !== undefined ? d.cpu_usage + '%' : '--'}</div></div>
                <div><div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">今日请求数</div><div style="font-weight:600;">${d.today_requests !== undefined ? d.today_requests.toLocaleString() : '--'}</div></div>
            </div>
        `;
    } else {
        container.innerHTML = '<div style="color:var(--c-text-secondary);">加载失败</div>';
    }
}

window.clearSystemLogs = async function() {
    if (!confirm('确定要清理系统日志吗？此操作不可撤销。')) return;
    const res = await API.clearLogs();
    showToast(res.success ? '清理成功' : (res.message || '清理失败'), res.success ? 'success' : 'error');
};

window.clearModelCache = async function() {
    const res = await API.clearModelCache();
    showToast(res.success ? '缓存已清理' : (res.message || '清理失败'), res.success ? 'success' : 'error');
};

window.syncChannelBalance = async function() {
    const res = await API.updateAllChannelsBalance();
    showToast(res.success ? '同步完成' : (res.message || '同步失败'), res.success ? 'success' : 'error');
};

window.purgeOldLogs = async function() {
    const dateInput = document.getElementById('LogPurgeDate');
    if (!dateInput || !dateInput.value) {
        showToast('请选择日期', 'error');
        return;
    }
    if (!confirm(`确定要清除 ${dateInput.value} 之前的所有日志吗？此操作不可撤销。`)) return;
    
    // 调用后端API清除日志（需要后端支持）
    showToast('日志清除功能需要后端API支持', 'info');
};

window.testIoNetConnection = async function() {
    const apiKey = safeGetValue('IoNetApiKey');
    if (!apiKey) {
        showToast('请先填写 io.net API Key', 'error');
        return;
    }
    showToast('正在测试连接...', 'info');
    setTimeout(() => {
        showToast('测试连接功能需要后端API支持', 'info');
    }, 1000);
};

// ========== Tab 6: 模型定价管理 ==========
let modelPricingData = [];
let currentEditingModel = null;

function loadModelPricingTable() {
    try {
        const modelPrice = JSON.parse(settingsData.ModelPrice || '{}');
        const modelRatio = JSON.parse(settingsData.ModelRatio || '{}');
        const completionRatio = JSON.parse(settingsData.CompletionRatio || '{}');
        const billingMode = JSON.parse(settingsData['billing_setting.billing_mode'] || '{}');
        const billingExpr = JSON.parse(settingsData['billing_setting.billing_expr'] || '{}');
        
        const allModels = new Set([
            ...Object.keys(modelPrice),
            ...Object.keys(modelRatio),
            ...Object.keys(billingExpr)
        ]);
        
        modelPricingData = Array.from(allModels).map(name => ({
            name,
            price: modelPrice[name] || '',
            ratio: modelRatio[name] || '',
            completionRatio: completionRatio[name] || '',
            billingMode: billingMode[name] || 'per-token',
            billingExpr: billingExpr[name] || ''
        })).sort((a, b) => a.name.localeCompare(b.name));
        
        renderModelPricingTable();
    } catch (e) {
        console.error('加载模型定价失败:', e);
        showToast('加载模型定价失败: ' + e.message, 'error');
    }
}

function renderModelPricingTable() {
    const tbody = document.getElementById('modelPricingTableBody');
    if (!tbody) return;
    
    const searchTerm = (document.getElementById('modelSearchInput')?.value || '').toLowerCase();
    const filtered = searchTerm 
        ? modelPricingData.filter(m => m.name.toLowerCase().includes(searchTerm))
        : modelPricingData;
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 40px; text-align: center; color: #9CA3AF;">${searchTerm ? '未找到匹配的模型' : '暂无模型定价配置'}</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filtered.map(model => {
        let billingType = '按量计费';
        let priceSummary = '-';
        
        if (model.price) {
            billingType = '按次计费';
            priceSummary = `$${parseFloat(model.price).toFixed(4)}/次`;
        } else if (model.billingExpr) {
            billingType = '表达式/阶梯计费';
            priceSummary = '阶梯计费';
        } else if (model.ratio) {
            billingType = '按量计费';
            const inputPrice = (parseFloat(model.ratio) * 2).toFixed(6);
            priceSummary = `输入 $${inputPrice}/1M`;
            if (model.completionRatio) {
                const outputPrice = (parseFloat(model.completionRatio) * parseFloat(model.ratio) * 2).toFixed(6);
                priceSummary += `, 输出 $${outputPrice}/1M`;
            }
        }
        
        return `
            <tr style="border-bottom: 1px solid #E5E7EB;">
                <td style="padding: 12px; text-align: center; font-weight: 500;">${escHtml(model.name)}</td>
                <td style="padding: 12px; text-align: center; color: #6B7280;">${billingType}</td>
                <td style="padding: 12px; text-align: center; color: #6B7280; font-family: monospace; font-size: 12px;">${priceSummary}</td>
                <td style="padding: 12px; text-align: center;">
                    <button class="btn btn-danger btn-sm" onclick="deleteModelPricing('${escHtml(model.name)}')">删除</button>
                </td>
            </tr>
        `;
    }).join('');
}

function escHtml(s){return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"').replace(/'/g,'&#39;');}

window.filterPricingTable = function() {
    renderModelPricingTable();
};

window.openPricingModal = function(modelName) {
    currentEditingModel = modelName || null;
    const modal = document.getElementById('pricingModal');
    document.getElementById('pricingModalTitle').textContent = modelName ? '编辑模型定价' : '添加模型定价';
    
    if (modelName) {
        const model = modelPricingData.find(m => m.name === modelName);
        if (model) {
            document.getElementById('pricingName').value = model.name;
            document.getElementById('pricingName').disabled = true;
            
            if (model.billingExpr) {
                document.getElementById('pricingBillingMode').value = 'tiered_expr';
                document.getElementById('pricingExpr').value = model.billingExpr;
            } else if (model.price) {
                document.getElementById('pricingBillingMode').value = 'per-request';
                document.getElementById('pricingPerRequest').value = model.price;
            } else {
                document.getElementById('pricingBillingMode').value = 'per-token';
                document.getElementById('pricingInputPrice').value = model.ratio ? (parseFloat(model.ratio) * 2).toFixed(6) : '';
                document.getElementById('pricingOutputPrice').value = model.completionRatio ? (parseFloat(model.completionRatio) * parseFloat(model.ratio || 1) * 2).toFixed(6) : '';
            }
        }
    } else {
        document.getElementById('pricingName').value = '';
        document.getElementById('pricingName').disabled = false;
        document.getElementById('pricingBillingMode').value = 'per-token';
        document.getElementById('pricingInputPrice').value = '';
        document.getElementById('pricingOutputPrice').value = '';
        document.getElementById('pricingCachePrice').value = '';
        document.getElementById('pricingCreateCachePrice').value = '';
        document.getElementById('pricingImagePrice').value = '';
        document.getElementById('pricingAudioPrice').value = '';
        document.getElementById('pricingAudioCompletionPrice').value = '';
        document.getElementById('pricingPerRequest').value = '';
        document.getElementById('pricingExpr').value = '';
    }
    
    togglePricingFields();
    modal.classList.remove('hidden');
};

window.closePricingModal = function() {
    document.getElementById('pricingModal').classList.add('hidden');
    currentEditingModel = null;
};

window.togglePricingFields = function() {
    const mode = document.getElementById('pricingBillingMode').value;
    document.getElementById('perTokenFields').style.display = mode === 'per-token' ? 'block' : 'none';
    document.getElementById('perRequestFields').style.display = mode === 'per-request' ? 'block' : 'none';
    document.getElementById('exprFields').style.display = mode === 'tiered_expr' ? 'block' : 'none';
};

window.savePricing = async function() {
    const name = document.getElementById('pricingName').value.trim();
    if (!name) { showToast('请输入模型名称', 'warning'); return; }
    
    const mode = document.getElementById('pricingBillingMode').value;
    
    try {
        const modelPrice = JSON.parse(settingsData.ModelPrice || '{}');
        const modelRatio = JSON.parse(settingsData.ModelRatio || '{}');
        const completionRatio = JSON.parse(settingsData.CompletionRatio || '{}');
        const cacheRatio = JSON.parse(settingsData.CacheRatio || '{}');
        const createCacheRatio = JSON.parse(settingsData.CreateCacheRatio || '{}');
        const imageRatio = JSON.parse(settingsData.ImageRatio || '{}');
        const audioRatio = JSON.parse(settingsData.AudioRatio || '{}');
        const audioCompletionRatio = JSON.parse(settingsData.AudioCompletionRatio || '{}');
        const billingMode = JSON.parse(settingsData['billing_setting.billing_mode'] || '{}');
        const billingExpr = JSON.parse(settingsData['billing_setting.billing_expr'] || '{}');
        
        // 清除旧值
        delete modelPrice[name];
        delete modelRatio[name];
        delete completionRatio[name];
        delete cacheRatio[name];
        delete createCacheRatio[name];
        delete imageRatio[name];
        delete audioRatio[name];
        delete audioCompletionRatio[name];
        delete billingExpr[name];
        
        if (mode === 'per-request') {
            const price = parseFloat(document.getElementById('pricingPerRequest').value) || 0;
            modelPrice[name] = price;
            billingMode[name] = 'per-request';
        } else if (mode === 'tiered_expr') {
            const expr = document.getElementById('pricingExpr').value.trim();
            if (!expr) { showToast('请输入计费表达式', 'warning'); return; }
            billingExpr[name] = expr;
            billingMode[name] = 'tiered_expr';
        } else {
            const inputPrice = parseFloat(document.getElementById('pricingInputPrice').value) || 0;
            const outputPrice = parseFloat(document.getElementById('pricingOutputPrice').value) || 0;
            const cachePrice = parseFloat(document.getElementById('pricingCachePrice').value) || 0;
            const createCache = parseFloat(document.getElementById('pricingCreateCachePrice').value) || 0;
            const imagePrice = parseFloat(document.getElementById('pricingImagePrice').value) || 0;
            const audioPrice = parseFloat(document.getElementById('pricingAudioPrice').value) || 0;
            const audioComp = parseFloat(document.getElementById('pricingAudioCompletionPrice').value) || 0;
            
            if (inputPrice > 0) modelRatio[name] = inputPrice / 2;
            if (outputPrice > 0 && inputPrice > 0) completionRatio[name] = outputPrice / inputPrice;
            if (cachePrice > 0) cacheRatio[name] = cachePrice / 2;
            if (createCache > 0) createCacheRatio[name] = createCache / 2;
            if (imagePrice > 0) imageRatio[name] = imagePrice / 2;
            if (audioPrice > 0) audioRatio[name] = audioPrice / 2;
            if (audioComp > 0) audioCompletionRatio[name] = audioComp / 2;
            billingMode[name] = 'per-token';
        }
        
        const payload = {
            ModelPrice: JSON.stringify(modelPrice),
            ModelRatio: JSON.stringify(modelRatio),
            CompletionRatio: JSON.stringify(completionRatio),
            CacheRatio: JSON.stringify(cacheRatio),
            CreateCacheRatio: JSON.stringify(createCacheRatio),
            ImageRatio: JSON.stringify(imageRatio),
            AudioRatio: JSON.stringify(audioRatio),
            AudioCompletionRatio: JSON.stringify(audioCompletionRatio),
            'billing_setting.billing_mode': JSON.stringify(billingMode),
            'billing_setting.billing_expr': JSON.stringify(billingExpr)
        };
        
        const res = await API.updateOptions(payload);
        if (res.success) {
            showToast('保存成功', 'success');
            closePricingModal();
            loadSettings();
        } else {
            showToast(res.message || '保存失败', 'error');
        }
    } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
    }
};

window.deleteModelPricing = async function(modelName) {
    if (!confirm(`确定要删除模型 ${modelName} 的定价配置吗？`)) return;
    
    try {
        const modelPrice = JSON.parse(settingsData.ModelPrice || '{}');
        const modelRatio = JSON.parse(settingsData.ModelRatio || '{}');
        const completionRatio = JSON.parse(settingsData.CompletionRatio || '{}');
        const cacheRatio = JSON.parse(settingsData.CacheRatio || '{}');
        const createCacheRatio = JSON.parse(settingsData.CreateCacheRatio || '{}');
        const imageRatio = JSON.parse(settingsData.ImageRatio || '{}');
        const audioRatio = JSON.parse(settingsData.AudioRatio || '{}');
        const audioCompletionRatio = JSON.parse(settingsData.AudioCompletionRatio || '{}');
        const billingMode = JSON.parse(settingsData['billing_setting.billing_mode'] || '{}');
        const billingExpr = JSON.parse(settingsData['billing_setting.billing_expr'] || '{}');
        
        delete modelPrice[modelName];
        delete modelRatio[modelName];
        delete completionRatio[modelName];
        delete cacheRatio[modelName];
        delete createCacheRatio[modelName];
        delete imageRatio[modelName];
        delete audioRatio[modelName];
        delete audioCompletionRatio[modelName];
        delete billingMode[modelName];
        delete billingExpr[modelName];
        
        const payload = {
            ModelPrice: JSON.stringify(modelPrice),
            ModelRatio: JSON.stringify(modelRatio),
            CompletionRatio: JSON.stringify(completionRatio),
            CacheRatio: JSON.stringify(cacheRatio),
            CreateCacheRatio: JSON.stringify(createCacheRatio),
            ImageRatio: JSON.stringify(imageRatio),
            AudioRatio: JSON.stringify(audioRatio),
            AudioCompletionRatio: JSON.stringify(audioCompletionRatio),
            'billing_setting.billing_mode': JSON.stringify(billingMode),
            'billing_setting.billing_expr': JSON.stringify(billingExpr)
        };
        
        const res = await API.updateOptions(payload);
        if (res.success) {
            showToast('删除成功', 'success');
            loadSettings();
        } else {
            showToast(res.message || '删除失败', 'error');
        }
    } catch (e) {
        showToast('删除失败: ' + e.message, 'error');
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    const res = await API.getUserInfo();
    if (!res.success||!res.data||(res.data.role||0)<100) {
        showToast('需要超级管理员权限才能访问系统设置','error');
        setTimeout(()=>window.location.href='console.html',1500);
        return;
    }
    renderSidebar('setting');
    initTabs();
    loadSettings();
    loadSystemInfo();
    
    // ========== 智能路由配置 - 实时校验 ==========
    // bucket_seconds 校验：必须 > 0 且 <= window_seconds
    const bucketInput = document.getElementById('CircuitBreakerBucketSeconds');
    const windowInput = document.getElementById('CircuitBreakerWindowSeconds');
    const bucketHint = document.getElementById('CircuitBreakerBucketSecondsHint');
    
    if (bucketInput && windowInput) {
        bucketInput.addEventListener('blur', function() {
            const bucket = Number(this.value);
            const windowSec = Number(windowInput.value);
            if (bucket <= 0 || bucket > windowSec) {
                this.classList.add('input-error');
                if (bucketHint) bucketHint.style.display = 'block';
            } else {
                this.classList.remove('input-error');
                if (bucketHint) bucketHint.style.display = 'none';
            }
        });
        
        // window_seconds 变化时也触发 bucket 校验
        windowInput.addEventListener('input', function() {
            bucketInput.dispatchEvent(new Event('blur'));
        });
    }
    
    // half_open_success_threshold 校验：必须 > 0 且 <= half_open_max_requests
    const successInput = document.getElementById('CircuitBreakerHalfOpenSuccessThreshold');
    const maxInput = document.getElementById('CircuitBreakerHalfOpenMaxRequests');
    const successHint = document.getElementById('CircuitBreakerHalfOpenSuccessHint');
    
    if (successInput && maxInput) {
        successInput.addEventListener('blur', function() {
            const success = Number(this.value);
            const max = Number(maxInput.value);
            if (success <= 0 || success > max) {
                this.classList.add('input-error');
                if (successHint) successHint.style.display = 'block';
            } else {
                this.classList.remove('input-error');
                if (successHint) successHint.style.display = 'none';
            }
        });
        
        // max_requests 变化时也触发 success 校验
        maxInput.addEventListener('input', function() {
            successInput.dispatchEvent(new Event('blur'));
        });
    }
});
