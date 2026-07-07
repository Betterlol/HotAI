// 使用日志页面逻辑
let logPage = 1;
const logPageSize = 20;
let logTotal = 0;
let isAdmin = false;
let adminMode = false;

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
    return new Date(ts * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const logTypes = { 1: '文本', 2: '图像', 3: '音频', 4: '视频', 5: '嵌入', 6: '缓存' };
const logTypeBadge = { 1: 'badge-blue', 2: 'badge-purple', 3: 'badge-yellow', 4: 'badge-green', 5: 'badge-gray', 6: 'badge-green' };

function getFilters() {
    const start = document.getElementById('filterStart').value;
    const end = document.getElementById('filterEnd').value;
    return {
        model_name: document.getElementById('filterModel').value.trim(),
        token_name: document.getElementById('filterToken').value.trim(),
        username: adminMode ? (document.getElementById('filterUser').value.trim() || '') : '',
        start_timestamp: start ? Math.floor(new Date(start).getTime() / 1000) : '',
        end_timestamp: end ? Math.floor(new Date(end).getTime() / 1000) : '',
        p: logPage,
        page_size: logPageSize,
    };
}

async function loadLogs() {
    const tbody = document.getElementById('logTableBody');
    const colCount = adminMode ? 9 : 8;
    tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>`;

    // 加载统计
    loadLogStat();

    const params = getFilters();
    // Remove empty values
    Object.keys(params).forEach(k => { if (params[k] === '') delete params[k]; });

    let res;
    if (adminMode) {
        res = await API.getAllLogs(params);
    } else {
        res = await API.getUserLogs(params);
    }

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="table-empty"><span>${res.message || '加载失败'}</span></div></td></tr>`;
        return;
    }

    const logs = res.data?.items || [];
    logTotal = res.data?.total || logs.length;
    document.getElementById('logTotal').textContent = logTotal;
    document.getElementById('logPageInfo').textContent = `第 ${logPage} 页`;

    // 显示/隐藏用户列
    const thUser = document.getElementById('thUser');
    if (thUser) thUser.style.display = adminMode ? '' : 'none';

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="table-empty"><svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/></svg><span>暂无日志数据</span></div></td></tr>`;
        renderPagination();
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const typeLabel = logTypes[log.type] || '其他';
        const typeBadge = logTypeBadge[log.type] || 'badge-gray';
        const userCell = adminMode ? `<td>${escHtml(log.username || '-')}</td>` : '';
        return `
        <tr>
            <td class="td-mono" style="white-space:nowrap;">${formatTime(log.created_at)}</td>
            ${userCell}
            <td>${escHtml(log.token_name || '-')}</td>
            <td><span style="font-size:12px;font-weight:600;">${escHtml(log.model_name || '-')}</span></td>
            <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
            <td style="text-align:right;">${(log.prompt_tokens || 0).toLocaleString()}</td>
            <td style="text-align:right;">${(log.completion_tokens || 0).toLocaleString()}</td>
            <td style="text-align:right;font-weight:600;color:var(--c-primary);">${quotaToDisplay(log.quota)}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--c-text-secondary);font-size:12px;" title="${escHtml(log.content || '')}">${escHtml(log.content || '-')}</td>
        </tr>`;
    }).join('');

    renderPagination();
}

async function loadLogStat() {
    const start = document.getElementById('filterStart').value;
    const end = document.getElementById('filterEnd').value;
    const params = {};
    if (start) params.start_timestamp = Math.floor(new Date(start).getTime() / 1000);
    if (end) params.end_timestamp = Math.floor(new Date(end).getTime() / 1000);
    if (adminMode && document.getElementById('filterUser').value.trim()) {
        params.username = document.getElementById('filterUser').value.trim();
    }

    const endpoint = adminMode ? API.getAllLogsStat : API.getUserLogsStat;
    const res = await endpoint(params);
    const bar = document.getElementById('logStatBar');
    if (!bar) return;

    if (res.success && res.data) {
        const d = res.data;
        const total = (d.prompt_tokens || 0) + (d.completion_tokens || 0);
        bar.innerHTML = `
            <span>统计次数：<strong>${(d.count || 0).toLocaleString()}</strong></span>
            <span>提示Tokens：<strong>${(d.prompt_tokens || 0).toLocaleString()}</strong></span>
            <span>补全Tokens：<strong>${(d.completion_tokens || 0).toLocaleString()}</strong></span>
            <span>合计Tokens：<strong>${total.toLocaleString()}</strong></span>
            <span>消耗额度：<strong style="color:var(--c-primary);">${quotaToDisplay(d.quota)}</strong></span>
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
    document.getElementById('filterStart').value = '';
    document.getElementById('filterEnd').value = '';
    if (document.getElementById('filterUser')) document.getElementById('filterUser').value = '';
    logPage = 1;
    loadLogs();
}

function escHtml(s) {
    return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('log');

    // 检查管理员身份
    const res = await API.getUserInfo();
    if (res.success && res.data && (res.data.role || 0) >= 10) {
        isAdmin = true;
        const adminActions = document.getElementById('adminActions');
        if (adminActions) adminActions.style.display = 'flex';
        const toggle = document.getElementById('adminModeToggle');
        if (toggle) {
            toggle.addEventListener('change', () => {
                adminMode = toggle.checked;
                const userFilter = document.getElementById('usernameFilterItem');
                if (userFilter) userFilter.style.display = adminMode ? '' : 'none';
                logPage = 1;
                loadLogs();
            });
        }
    }

    // 设置默认时间范围（最近7天）
    const now = new Date();
    const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const pad = n => String(n).padStart(2, '0');
    const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    document.getElementById('filterStart').value = toLocal(week);
    document.getElementById('filterEnd').value = toLocal(now);

    loadLogs();
});
