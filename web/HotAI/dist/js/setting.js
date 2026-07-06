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
    };

    const res = await API.updateOptions(payload);
    if (res.success) {
        showToast('设置已保存','success');
        loadSettings();
    } else {
        showToast(res.message||'保存失败','error');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const res = await API.getUserInfo();
    if (!res.success||!res.data||(res.data.role||0)<10) {
        showToast('无权限访问','error');
        setTimeout(()=>window.location.href='console.html',1500);
        return;
    }
    renderSidebar('setting');
    loadSettings();
});
