// 系统设置页面逻辑（管理员）
function showToast(msg, type='info') {
    const c=document.getElementById('toastContainer');if(!c)return;
    const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);
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
    settingsData = res.data || {};
    
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
    
    // 渠道亲和性
    safeSetChecked('ChannelAffinityEnabled', getBool('channel_affinity_setting.enabled'));
    safeSetChecked('ChannelAffinitySwitchOnSuccess', getBool('channel_affinity_setting.switch_on_success'));
    safeSetChecked('ChannelAffinityKeepOnDisabled', getBool('channel_affinity_setting.keep_on_channel_disabled'));
    safeSetValue('ChannelAffinityMaxEntries', getNum('channel_affinity_setting.max_entries', 10000));
    safeSetValue('ChannelAffinityDefaultTTL', getNum('channel_affinity_setting.default_ttl_seconds', 3600));
    safeSetValue('ChannelAffinityRules', getValue('channel_affinity_setting.rules', '{}'));
    
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

async function saveAllSettings() {
    const payload = {};

    // ========== Tab 1: 运营设置 ==========
    // 系统行为
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
    
    // 渠道亲和性
    payload['channel_affinity_setting.enabled'] = safeGetChecked('ChannelAffinityEnabled') ? 'true' : 'false';
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

    // 批量更新
    const res = await API.updateOptions(payload);
    if (res.success) {
        showToast('设置已保存','success');
        loadSettings();
    } else {
        showToast(res.message||'保存失败','error');
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

function loadModelPricingTable() {
    try {
        const modelPrice = JSON.parse(settingsData.ModelPrice || '{}');
        const modelRatio = JSON.parse(settingsData.ModelRatio || '{}');
        const completionRatio = JSON.parse(settingsData.CompletionRatio || '{}');
        const billingMode = JSON.parse(settingsData['billing_setting.billing_mode'] || '{}');
        
        const allModels = new Set([
            ...Object.keys(modelPrice),
            ...Object.keys(modelRatio)
        ]);
        
        modelPricingData = Array.from(allModels).map(name => ({
            name,
            price: modelPrice[name] || '',
            ratio: modelRatio[name] || '',
            completionRatio: completionRatio[name] || '',
            billingMode: billingMode[name] || 'per-token'
        })).sort((a, b) => a.name.localeCompare(b.name));
        
        renderModelPricingTable();
    } catch (e) {
        console.error('加载模型定价失败:', e);
    }
}

function renderModelPricingTable() {
    const tbody = document.getElementById('modelPricingTableBody');
    if (!tbody) return;
    
    if (modelPricingData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 40px; text-align: center; color: #9CA3AF;">暂无模型定价配置</td></tr>';
        return;
    }
    
    tbody.innerHTML = modelPricingData.map(model => {
        const mode = model.price ? '按次计费' : '按量计费';
        const inputPrice = model.ratio ? `$${(parseFloat(model.ratio) * 2).toFixed(6)}/1M` : '-';
        const outputPrice = model.completionRatio ? `$${(parseFloat(model.completionRatio) * parseFloat(model.ratio || 1) * 2).toFixed(6)}/1M` : '-';
        
        return `
            <tr style="border-bottom: 1px solid #E5E7EB;">
                <td style="padding: 12px; font-weight: 500;">${model.name}</td>
                <td style="padding: 12px; color: #6B7280;">${mode}</td>
                <td style="padding: 12px; color: #6B7280; font-family: monospace; font-size: 12px;">${inputPrice}</td>
                <td style="padding: 12px; color: #6B7280; font-family: monospace; font-size: 12px;">${outputPrice}</td>
                <td style="padding: 12px; text-align: right;">
                    <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 13px;" onclick="deleteModelPricing('${model.name}')">删除</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.addModelPricing = function() {
    showToast('模型定价添加功能需要更复杂的表单，建议在 web/default 中配置', 'info');
};

window.deleteModelPricing = async function(modelName) {
    if (!confirm(`确定要删除模型 ${modelName} 的定价配置吗？`)) return;
    
    try {
        const modelPrice = JSON.parse(settingsData.ModelPrice || '{}');
        const modelRatio = JSON.parse(settingsData.ModelRatio || '{}');
        const completionRatio = JSON.parse(settingsData.CompletionRatio || '{}');
        const cacheRatio = JSON.parse(settingsData.CacheRatio || '{}');
        const billingMode = JSON.parse(settingsData['billing_setting.billing_mode'] || '{}');
        
        delete modelPrice[modelName];
        delete modelRatio[modelName];
        delete completionRatio[modelName];
        delete cacheRatio[modelName];
        delete billingMode[modelName];
        
        const payload = {
            ModelPrice: JSON.stringify(modelPrice),
            ModelRatio: JSON.stringify(modelRatio),
            CompletionRatio: JSON.stringify(completionRatio),
            CacheRatio: JSON.stringify(cacheRatio),
            'billing_setting.billing_mode': JSON.stringify(billingMode)
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
});