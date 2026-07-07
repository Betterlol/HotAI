// 系统设置页面逻辑（管理员）
function showToast(msg, type='info') {
    const c=document.getElementById('toastContainer');if(!c)return;
    const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);
}

let settingsData = {};

async function loadSettings() {
    const res = await API.getOptions();
    if (!res.success) { showToast('加载设置失败','error'); return; }
    settingsData = res.data || {};
    
    // 填充表单
    document.getElementById('systemName').value = settingsData.SystemName || '';
    document.getElementById('logoUrl').value = settingsData.Logo || '';
    document.getElementById('homeContent').value = settingsData.HomePageContent || '';
    document.getElementById('footerHtml').value = settingsData.FooterHTML || '';
    
    document.getElementById('registerEnabled').checked = settingsData.RegisterEnabled === 'true';
    document.getElementById('emailVerificationEnabled').checked = settingsData.EmailVerificationEnabled === 'true';
    document.getElementById('newUserQuota').value = parseInt(settingsData.QuotaForNewUser) || 500000;
    document.getElementById('newUserGroup').value = settingsData.GroupForNewUser || 'default';
    
    document.getElementById('topupEnabled').checked = settingsData.TopUpEnabled === 'true';
    document.getElementById('minTopup').value = parseFloat(settingsData.MinTopUp) || 1;
    document.getElementById('topupRatio').value = parseFloat(settingsData.TopupRatio) || 15;
    
    document.getElementById('logEnabled').checked = settingsData.LogConsumeEnabled === 'true';
    document.getElementById('logRetentionDays').value = parseInt(settingsData.LogRetentionDays) || 30;
    
    document.getElementById('monitorEnabled').checked = settingsData.MonitorEnabled === 'true';
    document.getElementById('uptimeKumaUrl').value = settingsData.UptimeKumaUrl || '';
    
    document.getElementById('smtpServer').value = settingsData.SMTPServer || '';
    document.getElementById('smtpPort').value = parseInt(settingsData.SMTPPort) || 587;
    document.getElementById('smtpFrom').value = settingsData.SMTPFrom || '';
    document.getElementById('smtpUsername').value = settingsData.SMTPUsername || '';
    document.getElementById('smtpPassword').value = settingsData.SMTPPassword || '';

    // 安全设置
    document.getElementById('passwordLoginEnabled').checked = settingsData.PasswordLoginEnabled !== 'false';
    document.getElementById('githubOAuthEnabled').checked = settingsData.GitHubOAuthEnabled === 'true';
    document.getElementById('githubClientId').value = settingsData.GitHubClientId || '';
    document.getElementById('githubClientSecret').value = settingsData.GitHubClientSecret || '';
    document.getElementById('googleOAuthEnabled').checked = settingsData.GoogleOAuthEnabled === 'true';
    document.getElementById('googleClientId').value = settingsData.GoogleClientId || '';
    document.getElementById('googleClientSecret').value = settingsData.GoogleClientSecret || '';
    document.getElementById('wechatOAuthEnabled').checked = settingsData.WeChatAuthEnabled === 'true';
    document.getElementById('wechatAppId').value = settingsData.WeChatServerAddress || '';
    document.getElementById('wechatAppSecret').value = settingsData.WeChatAccessToken || '';
    document.getElementById('turnstileSiteKey').value = settingsData.TurnstileSiteKey || '';
    document.getElementById('turnstileSecretKey').value = settingsData.TurnstileSecretKey || '';

    // 计费与定价
    document.getElementById('quotaPerUnit').value = parseInt(settingsData.QuotaPerUnit) || 500000;
    document.getElementById('displayRatio').value = parseFloat(settingsData.DisplayTokenStatRatio) || 1;
    document.getElementById('checkinEnabled').checked = settingsData.CheckInEnabled === 'true';
    document.getElementById('checkinQuota').value = parseInt(settingsData.QuotaForInvite) || 100;
    document.getElementById('affiliateEnabled').checked = settingsData.AffiliateEnabled === 'true';
    document.getElementById('affiliateRate').value = parseFloat(settingsData.AffiliateRate) || 5;

    // 运营设置
    document.getElementById('systemNoticeContent').value = settingsData.Notice || '';
    document.getElementById('announcementsEnabled').checked = settingsData.AnouncementsEnabled !== 'false';
    document.getElementById('faqEnabled').checked = settingsData.FAQEnabled !== 'false';
    document.getElementById('apiInfoContent').value = settingsData.ApiInfo || '';

    // 请求限制
    document.getElementById('globalRateLimit').value = parseInt(settingsData.GlobalApiRateLimitNum) || 1000;
    document.getElementById('userRateLimit').value = parseInt(settingsData.UserApiRateLimitNum) || 100;
    document.getElementById('tokenRateLimit').value = parseInt(settingsData.TokenApiRateLimitNum) || 60;
    document.getElementById('concurrentLimit').value = parseInt(settingsData.MaxReqsConcurrency) || 10;
    document.getElementById('ipRateLimitEnabled').checked = settingsData.IpRateLimitEnabled === 'true';

    // 维护模式
    document.getElementById('maintenanceMode').checked = settingsData.MaintenanceMode === 'true';
    document.getElementById('maintenanceMessage').value = settingsData.MaintenanceMessage || '';
}

async function saveAllSettings() {
    const payload = {
        SystemName: document.getElementById('systemName').value,
        Logo: document.getElementById('logoUrl').value,
        HomePageContent: document.getElementById('homeContent').value,
        FooterHTML: document.getElementById('footerHtml').value,
        
        RegisterEnabled: document.getElementById('registerEnabled').checked ? 'true' : 'false',
        EmailVerificationEnabled: document.getElementById('emailVerificationEnabled').checked ? 'true' : 'false',
        QuotaForNewUser: document.getElementById('newUserQuota').value,
        GroupForNewUser: document.getElementById('newUserGroup').value,
        
        TopUpEnabled: document.getElementById('topupEnabled').checked ? 'true' : 'false',
        MinTopUp: document.getElementById('minTopup').value,
        TopupRatio: document.getElementById('topupRatio').value,
        
        LogConsumeEnabled: document.getElementById('logEnabled').checked ? 'true' : 'false',
        LogRetentionDays: document.getElementById('logRetentionDays').value,
        
        MonitorEnabled: document.getElementById('monitorEnabled').checked ? 'true' : 'false',
        UptimeKumaUrl: document.getElementById('uptimeKumaUrl').value,
        
        SMTPServer: document.getElementById('smtpServer').value,
        SMTPPort: document.getElementById('smtpPort').value,
        SMTPFrom: document.getElementById('smtpFrom').value,
        SMTPUsername: document.getElementById('smtpUsername').value,
        SMTPPassword: document.getElementById('smtpPassword').value,

        // 安全设置
        PasswordLoginEnabled: document.getElementById('passwordLoginEnabled').checked ? 'true' : 'false',
        GitHubOAuthEnabled: document.getElementById('githubOAuthEnabled').checked ? 'true' : 'false',
        GitHubClientId: document.getElementById('githubClientId').value,
        GitHubClientSecret: document.getElementById('githubClientSecret').value,
        GoogleOAuthEnabled: document.getElementById('googleOAuthEnabled').checked ? 'true' : 'false',
        GoogleClientId: document.getElementById('googleClientId').value,
        GoogleClientSecret: document.getElementById('googleClientSecret').value,
        WeChatAuthEnabled: document.getElementById('wechatOAuthEnabled').checked ? 'true' : 'false',
        WeChatServerAddress: document.getElementById('wechatAppId').value,
        WeChatAccessToken: document.getElementById('wechatAppSecret').value,
        TurnstileSiteKey: document.getElementById('turnstileSiteKey').value,
        TurnstileSecretKey: document.getElementById('turnstileSecretKey').value,

        // 计费与定价
        QuotaPerUnit: document.getElementById('quotaPerUnit').value,
        DisplayTokenStatRatio: document.getElementById('displayRatio').value,
        CheckInEnabled: document.getElementById('checkinEnabled').checked ? 'true' : 'false',
        QuotaForInvite: document.getElementById('checkinQuota').value,
        AffiliateEnabled: document.getElementById('affiliateEnabled').checked ? 'true' : 'false',
        AffiliateRate: document.getElementById('affiliateRate').value,

        // 运营设置
        Notice: document.getElementById('systemNoticeContent').value,
        AnnouncementsEnabled: document.getElementById('announcementsEnabled').checked ? 'true' : 'false',
        FAQEnabled: document.getElementById('faqEnabled').checked ? 'true' : 'false',
        ApiInfo: document.getElementById('apiInfoContent').value,

        // 请求限制
        GlobalApiRateLimitNum: document.getElementById('globalRateLimit').value,
        UserApiRateLimitNum: document.getElementById('userRateLimit').value,
        TokenApiRateLimitNum: document.getElementById('tokenRateLimit').value,
        MaxReqsConcurrency: document.getElementById('concurrentLimit').value,
        IpRateLimitEnabled: document.getElementById('ipRateLimitEnabled').checked ? 'true' : 'false',

        // 维护模式
        MaintenanceMode: document.getElementById('maintenanceMode').checked ? 'true' : 'false',
        MaintenanceMessage: document.getElementById('maintenanceMessage').value,
    };

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
                <div><div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">CPU 使用率</div><div style="font-weight:600;">${d.cpu_usage !== undefined ? d.cpu_usage + '%' : '--'}</div>
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

document.addEventListener('DOMContentLoaded', async () => {
    const res = await API.getUserInfo();
    if (!res.success||!res.data||(res.data.role||0)<100) {
        showToast('需要超级管理员权限才能访问系统设置','error');
        setTimeout(()=>window.location.href='console.html',1500);
        return;
    }
    renderSidebar('setting');
    loadSettings();
    loadSystemInfo();
});
