// 使用日志页面逻辑（统一老UI风格）
let logPage = 1;
const logPageSize = 20;
let logTotal = 0;
let isAdmin = false;

// 列设置默认全部显示
const defaultColumns = {
    time: true,
    channel: true,
    user: true,
    token: true,
    group: true,
    type: true,
    model: true,
    usetime: true,
    input: true,
    output: true,
    cost: true,
    ip: true,
    retry: true,
    detail: true
};

const columnNames = {
    time: '时间',
    channel: '渠道',
    user: '用户',
    token: '令牌',
    group: '分组',
    type: '类型',
    model: '模型',
    usetime: '用时/首字',
    input: '输入',
    output: '输出',
    cost: '花费',
    ip: 'IP',
    retry: '重试',
    detail: '详情'
};

let columnSettings = { ...defaultColumns };

function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function quotaToDisplay(q) {
    if (!q) return '$0.0000';
    return '$' + (q / 500000).toFixed(4);
}

function formatTime(ts) {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString('zh-CN', { 
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

function formatUseTime(seconds) {
    if (!seconds || seconds <= 0) return '-';
    return seconds.toFixed(2) + 's';
}

const logTypes = { 1: '文本', 2: '图像', 3: '音频', 4: '视频', 5: '嵌入', 6: '缓存' };
const logTypeBadge = { 1: 'badge-blue', 2: 'badge-purple', 3: 'badge-yellow', 4: 'badge-green', 5: 'badge-gray', 6: 'badge-green' };

function getFilters() {
    const start = document.getElementById('filterStart').value;
    const end = document.getElementById('filterEnd').value;
    const params = {
        model_name: document.getElementById('filterModel').value.trim(),
        token_name: document.getElementById('filterToken').value.trim(),
        username: document.getElementById('filterUser').value.trim(),
        start_timestamp: start ? Math.floor(new Date(start).getTime() / 1000) : '',
        end_timestamp: end ? Math.floor(new Date(end).getTime() / 1000) : '',
        group: document.getElementById('filterGroup').value.trim(),
        request_id: document.getElementById('filterRequestId').value.trim(),
        p: logPage,
        page_size: logPageSize,
    };
    
    // 渠道ID筛选
    const channelId = document.getElementById('filterChannelId').value.trim();
    if (channelId) {
        params.channel = channelId;
    }
    
    return params;
}

async function loadLogs() {
    const tbody = document.getElementById('logTableBody');
    tbody.innerHTML = `<tr><td colspan="14"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>`;

    // 加载统计
    loadLogStat();

    const params = getFilters();
    // Remove empty values
    Object.keys(params).forEach(k => { if (params[k] === '') delete params[k]; });

    let res;
    if (isAdmin) {
        res = await API.getAllLogs(params);
    } else {
        res = await API.getUserLogs(params);
    }

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="14"><div class="table-empty"><span>${res.message || '加载失败'}</span></div></td></tr>`;
        return;
    }

    const logs = res.data?.items || [];
    logTotal = res.data?.total || logs.length;
    document.getElementById('logTotal').textContent = logTotal;
    document.getElementById('logPageInfo').textContent = `第 ${logPage} 页`;

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14"><div class="table-empty"><svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/></svg><span>暂无日志数据</span></div></td></tr>`;
        renderPagination();
        return;
    }

    // 存储日志数据供详情弹窗使用
    window._logData = logs;

    tbody.innerHTML = logs.map((log, idx) => {
        const typeLabel = logTypes[log.type] || '其他';
        const typeBadge = logTypeBadge[log.type] || 'badge-gray';
        
        const channelDisplay = log.channel_name || (log.channel ? `#${log.channel}` : '-');
        const useTimeDisplay = formatUseTime(log.use_time);
        
        return `
        <tr style="cursor:pointer;" onclick="showLogDetail(${idx})">
            <td data-col="time" class="td-mono" title="${formatTime(log.created_at)}">${formatTime(log.created_at)}</td>
            <td data-col="channel" title="${escHtml(channelDisplay)}">${escHtml(channelDisplay)}</td>
            <td data-col="user" title="${escHtml(log.username || '-')}">${escHtml(log.username || '-')}</td>
            <td data-col="token" title="${escHtml(log.token_name || '-')}">${escHtml(log.token_name || '-')}</td>
            <td data-col="group" title="${escHtml(log.group || '-')}">${escHtml(log.group || '-')}</td>
            <td data-col="type"><span class="badge ${typeBadge}">${typeLabel}</span></td>
            <td data-col="model" title="${escHtml(log.model_name || '-')}"><span style="font-size:12px;font-weight:600;">${escHtml(log.model_name || '-')}</span></td>
            <td data-col="usetime" class="td-mono">${useTimeDisplay}</td>
            <td data-col="input">${(log.prompt_tokens || 0).toLocaleString()}</td>
            <td data-col="output">${(log.completion_tokens || 0).toLocaleString()}</td>
            <td data-col="cost" style="font-weight:600;color:var(--c-primary);">${quotaToDisplay(log.quota)}</td>
            <td data-col="ip" class="td-mono" title="${escHtml(log.ip || '-')}">${escHtml(log.ip || '-')}</td>
            <td data-col="retry">-</td>
            <td data-col="detail">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showLogDetail(${idx})">查看</button>
            </td>
        </tr>`;
    }).join('');

    renderPagination();
    applyColumnSettings();
}

async function loadLogStat() {
    const start = document.getElementById('filterStart').value;
    const end = document.getElementById('filterEnd').value;
    const params = {};
    if (start) params.start_timestamp = Math.floor(new Date(start).getTime() / 1000);
    if (end) params.end_timestamp = Math.floor(new Date(end).getTime() / 1000);
    
    const username = document.getElementById('filterUser').value.trim();
    if (username) params.username = username;
    
    const group = document.getElementById('filterGroup').value.trim();
    if (group) params.group = group;

    const endpoint = isAdmin ? API.getAllLogsStat : API.getUserLogsStat;
    const res = await endpoint(params);
    const bar = document.getElementById('logStatBar');
    if (!bar) return;

    if (res.success && res.data) {
        const d = res.data;
        bar.innerHTML = `
            <span>消耗额度：<strong style="color:var(--c-primary);">${quotaToDisplay(d.quota)}</strong></span>
            <span>RPM：<strong>${(d.rpm || 0).toLocaleString()}</strong></span>
            <span>TPM：<strong>${(d.tpm || 0).toLocaleString()}</strong></span>
        `;
    } else {
        bar.innerHTML = '';
    }
}

function renderPagination() {
    const pages = document.getElementById('logPages');
    if (!pages) return;
    const total = Math.ceil(logTotal / logPageSize);
    let html = `<button class="page-btn" onclick="changeLogPage(${logPage - 1})" ${logPage <= 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = Math.max(1, logPage - 2); i <= Math.min(total, logPage + 2); i++) {
        html += `<button class="page-btn ${i === logPage ? 'active' : ''}" onclick="changeLogPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changeLogPage(${logPage + 1})" ${logPage >= total ? 'disabled' : ''}>›</button>`;
    pages.innerHTML = html;
}

function changeLogPage(p) {
    if (p < 1) return;
    logPage = p;
    loadLogs();
}

function searchLogs() {
    logPage = 1;
    loadLogs();
}

function resetFilters() {
    document.getElementById('filterModel').value = '';
    document.getElementById('filterToken').value = '';
    document.getElementById('filterUser').value = '';
    document.getElementById('filterStart').value = '';
    document.getElementById('filterEnd').value = '';
    document.getElementById('filterChannel').value = '';
    document.getElementById('filterGroup').value = '';
    document.getElementById('filterRequestId').value = '';
    document.getElementById('filterChannelId').value = '';
    logPage = 1;
    loadLogs();
}

// ========== 日志详情弹窗 ==========
window.showLogDetail = function(idx) {
    const log = (window._logData || [])[idx];
    if (!log) return;

    const modal = document.getElementById('logDetailModal');
    const content = document.getElementById('logDetailContent');
    if (!modal || !content) return;

    const channelDisplay = log.channel_name || (log.channel ? `#${log.channel}` : '-');
    
    const rows = [
        ['时间', formatTime(log.created_at)],
        ['渠道', channelDisplay],
        ['用户名', log.username || '-'],
        ['令牌', log.token_name || '-'],
        ['分组', log.group || '-'],
        ['类型', logTypes[log.type] || '其他'],
        ['模型', log.model_name || '-'],
        ['用时/首字', formatUseTime(log.use_time)],
        ['输入 Tokens', (log.prompt_tokens || 0).toLocaleString()],
        ['输出 Tokens', (log.completion_tokens || 0).toLocaleString()],
        ['花费', quotaToDisplay(log.quota)],
        ['IP 地址', log.ip || '-'],
        ['重试次数', '-'],
        ['渠道ID', log.channel || '-'],
        ['RequestID', log.request_id || '-'],
        ['上游RequestID', log.upstream_request_id || '-'],
    ];

    content.innerHTML = `
        <div style="display:grid;grid-template-columns:120px 1fr;gap:8px 16px;font-size:14px;">
            ${rows.map(([k, v]) => `
                <div style="color:var(--c-text-secondary);padding:8px 0;border-bottom:1px solid var(--c-border);">${k}</div>
                <div style="padding:8px 0;border-bottom:1px solid var(--c-border);font-weight:500;word-break:break-all;">${escHtml(String(v))}</div>
            `).join('')}
        </div>
        ${log.content ? `
            <div style="margin-top:16px;">
                <div style="font-size:13px;font-weight:600;color:var(--c-text-secondary);margin-bottom:8px;">请求内容</div>
                <div style="background:var(--c-input-bg);border-radius:8px;padding:12px;font-size:13px;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow-y:auto;">${escHtml(log.content)}</div>
            </div>
        ` : ''}
    `;

    modal.classList.remove('hidden');
};

window.closeLogDetail = function() {
    document.getElementById('logDetailModal')?.classList.add('hidden');
};

// ========== 导出日志 ==========
window.exportLogs = async function() {
    showToast('正在导出，请稍候...', 'info');

    const params = getFilters();
    params.page_size = 10000; // 尽量导出全部
    Object.keys(params).forEach(k => { if (params[k] === '') delete params[k]; });

    const res = isAdmin ? await API.getAllLogs(params) : await API.getUserLogs(params);
    if (!res.success || !res.data) {
        showToast('导出失败', 'error');
        return;
    }

    const logs = res.data?.items || [];
    const header = ['时间', '渠道', '用户', '令牌', '分组', '类型', '模型', '用时/首字', '输入', '输出', '花费', 'IP', '重试', 'RequestID'];
    const rows = logs.map(log => {
        const channelDisplay = log.channel_name || (log.channel ? `#${log.channel}` : '');
        return [
            formatTime(log.created_at),
            channelDisplay,
            log.username || '',
            log.token_name || '',
            log.group || '',
            logTypes[log.type] || '',
            log.model_name || '',
            formatUseTime(log.use_time),
            log.prompt_tokens || 0,
            log.completion_tokens || 0,
            (log.quota / 500000).toFixed(6),
            log.ip || '',
            '-',
            log.request_id || '',
        ].map(v => String(v).replace(/,/g, '，').replace(/\n/g, ' '));
    });

    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${logs.length} 条日志`, 'success');
};

// ========== 列设置功能 ==========
function loadColumnSettings() {
    const saved = localStorage.getItem('logColumnSettings');
    if (saved) {
        try {
            columnSettings = { ...defaultColumns, ...JSON.parse(saved) };
        } catch (e) {
            columnSettings = { ...defaultColumns };
        }
    }
}

function saveColumnSettings() {
    localStorage.setItem('logColumnSettings', JSON.stringify(columnSettings));
}

function applyColumnSettings() {
    const table = document.querySelector('.log-table');
    if (!table) return;
    
    // 显示/隐藏列
    Object.keys(columnSettings).forEach(col => {
        const isVisible = columnSettings[col];
        const elements = table.querySelectorAll(`[data-col="${col}"]`);
        elements.forEach(el => {
            el.style.display = isVisible ? '' : 'none';
        });
    });
}

function renderColumnSettingsMenu() {
    const menu = document.getElementById('columnSettingsMenu');
    if (!menu) return;
    
    menu.innerHTML = Object.keys(columnNames).map(col => `
        <label class="column-settings-item">
            <input type="checkbox" 
                   ${columnSettings[col] ? 'checked' : ''} 
                   onchange="toggleColumn('${col}', this.checked)">
            <span>${columnNames[col]}</span>
        </label>
    `).join('');
}

window.toggleColumnSettings = function(event) {
    event.stopPropagation();
    const menu = document.getElementById('columnSettingsMenu');
    if (!menu) return;
    
    menu.classList.toggle('show');
    if (menu.classList.contains('show')) {
        renderColumnSettingsMenu();
    }
};

window.toggleColumn = function(col, checked) {
    columnSettings[col] = checked;
    saveColumnSettings();
    applyColumnSettings();
};

// 点击外部关闭列设置菜单
document.addEventListener('click', (e) => {
    const menu = document.getElementById('columnSettingsMenu');
    const dropdown = document.querySelector('.column-settings-dropdown');
    if (menu && dropdown && !dropdown.contains(e.target)) {
        menu.classList.remove('show');
    }
});

function escHtml(s) {
    return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('log');

    // 检查管理员身份
    const res = await API.getUserInfo();
    if (res.success && res.data && (res.data.role || 0) >= 10) {
        isAdmin = true;
    }

    // 加载列设置
    loadColumnSettings();

    // 设置默认时间范围（最近7天）
    const now = new Date();
    const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const pad = n => String(n).padStart(2, '0');
    const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    document.getElementById('filterStart').value = toLocal(week);
    document.getElementById('filterEnd').value = toLocal(now);

    loadLogs();
});
