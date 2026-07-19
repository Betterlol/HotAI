// 任务日志页面逻辑 - 完整11列版本
let taskPage = 1;
const taskPageSize = 20;
let taskTotal = 0;
let taskIsAdmin = false;

// 列定义（按最终顺序）
const COLUMNS = {
    SUBMIT_TIME: 'submit_time',
    FINISH_TIME: 'finish_time',
    DURATION: 'duration',
    CHANNEL: 'channel',
    USER: 'user',
    PLATFORM: 'platform',
    TYPE: 'type',
    TASK_ID: 'task_id',
    STATUS: 'status',
    PROGRESS: 'progress',
    DETAIL: 'detail'
};

// 列可见性（localStorage持久化）
let visibleColumns = {};

function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function escHtml(s) {
    return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(submitTime, finishTime) {
    if (!submitTime || !finishTime) return '-';
    const sec = finishTime - submitTime;
    if (sec < 0) return '-';
    if (sec < 60) return `${sec}秒`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}分${s}秒`;
}

const statusBadgeClass = {
    'SUCCESS': 'badge-green',
    'FAILURE': 'badge-red',
    'IN_PROGRESS': 'badge-blue',
    'SUBMITTED': 'badge-yellow',
    'QUEUED': 'badge-yellow',
    'NOT_START': 'badge-gray',
    'UNKNOWN': 'badge-gray'
};

const statusText = {
    'SUCCESS': '成功',
    'FAILURE': '失败',
    'IN_PROGRESS': '执行中',
    'SUBMITTED': '已提交',
    'QUEUED': '排队中',
    'NOT_START': '未开始',
    'UNKNOWN': '未知'
};

// 初始化列可见性
function initColumnVisibility() {
    const saved = localStorage.getItem('taskLogColumns');
    if (saved) {
        try {
            visibleColumns = JSON.parse(saved);
        } catch (e) {
            visibleColumns = {};
        }
    }
    // 默认全部显示
    Object.keys(COLUMNS).forEach(k => {
        if (visibleColumns[COLUMNS[k]] === undefined) {
            visibleColumns[COLUMNS[k]] = true;
        }
    });
}

function saveColumnVisibility() {
    localStorage.setItem('taskLogColumns', JSON.stringify(visibleColumns));
}

// 渲染列设置下拉菜单
function renderColumnSettings() {
    const btn = document.getElementById('colSettingsBtn');
    if (!btn) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';
    dropdown.id = 'colSettingsDropdown';
    dropdown.style.cssText = 'position:absolute;right:0;top:100%;margin-top:4px;background:var(--c-white);border:1px solid var(--c-border);border-radius:8px;padding:8px;min-width:140px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:1000;display:none;';

    const colNames = {
        [COLUMNS.SUBMIT_TIME]: '提交时间',
        [COLUMNS.FINISH_TIME]: '结束时间',
        [COLUMNS.DURATION]: '花费时间',
        [COLUMNS.CHANNEL]: '渠道',
        [COLUMNS.USER]: '用户',
        [COLUMNS.PLATFORM]: '平台',
        [COLUMNS.TYPE]: '类型',
        [COLUMNS.TASK_ID]: '任务ID',
        [COLUMNS.STATUS]: '任务状态',
        [COLUMNS.PROGRESS]: '进度',
        [COLUMNS.DETAIL]: '详情'
    };

    Object.keys(COLUMNS).forEach(k => {
        const col = COLUMNS[k];
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;font-size:13px;border-radius:4px;';
        label.onmouseover = () => label.style.background = 'var(--c-hover)';
        label.onmouseout = () => label.style.background = 'transparent';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = visibleColumns[col];
        checkbox.onchange = () => {
            visibleColumns[col] = checkbox.checked;
            saveColumnVisibility();
            loadTaskLogs();
        };
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(colNames[col]));
        dropdown.appendChild(label);
    });

    // 移除旧下拉菜单
    const oldDropdown = document.getElementById('colSettingsDropdown');
    if (oldDropdown) oldDropdown.remove();

    // 插入新下拉菜单
    const parent = btn.parentElement;
    parent.style.position = 'relative';
    parent.appendChild(dropdown);

    // 按钮点击切换显示
    btn.onclick = (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    };

    // 点击外部关闭
    document.addEventListener('click', () => {
        dropdown.style.display = 'none';
    });
}

async function loadTaskLogs() {
    const tbody = document.getElementById('taskTableBody');
    const visibleColCount = Object.values(visibleColumns).filter(Boolean).length;
    tbody.innerHTML = `<tr><td colspan="${visibleColCount}" style="text-align:center;"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>`;

    const params = { p: taskPage, page_size: taskPageSize };
    
    // 筛选参数
    const platform = document.getElementById('filterPlatform')?.value;
    const status = document.getElementById('filterStatus')?.value;
    const username = document.getElementById('filterUser')?.value.trim();
    const taskId = document.getElementById('filterTaskId')?.value.trim();
    const channelId = document.getElementById('filterChannelId')?.value.trim();
    const startTime = document.getElementById('filterStartTime')?.value;
    const endTime = document.getElementById('filterEndTime')?.value;

    if (platform) params.platform = platform;
    if (status) params.status = status;
    if (username) params.username = username;
    if (taskId) params.task_id = taskId;
    if (channelId) params.channel_id = channelId;
    if (startTime) params.start_timestamp = Math.floor(new Date(startTime).getTime() / 1000);
    if (endTime) params.end_timestamp = Math.floor(new Date(endTime).getTime() / 1000);

    // 管理员调用getAllTask，普通用户调用getUserTask
    const endpoint = taskIsAdmin ? API.getAllTask : API.getUserTask;
    const res = await endpoint(params);

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="${visibleColCount}" style="text-align:center;"><div class="table-empty"><span>${res.message || '加载失败'}</span></div></td></tr>`;
        return;
    }

    const items = res.data?.items || [];
    taskTotal = res.data?.total || items.length;
    document.getElementById('taskTotal').textContent = taskTotal;
    document.getElementById('taskPageInfo').textContent = `第 ${taskPage} 页`;

    // 更新表头可见性
    updateTableHeaders();

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${visibleColCount}" style="text-align:center;"><div class="table-empty"><svg viewBox="0 0 24 24" style="width:48px;height:48px;margin:0 auto 8px;fill:var(--c-text-secondary);"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg><span>暂无任务记录</span></div></td></tr>`;
        renderPagination();
        return;
    }

    // 存储数据供详情弹窗使用
    window._taskData = items;

    tbody.innerHTML = items.map((item) => {
        const cells = [];
        const itemKey = item.task_id || String(item.id || '');
        
        // 提交时间
        if (visibleColumns[COLUMNS.SUBMIT_TIME]) {
            cells.push(`<td style="text-align:center;white-space:nowrap;font-size:12px;">${formatTime(item.submit_time)}</td>`);
        }
        
        // 结束时间
        if (visibleColumns[COLUMNS.FINISH_TIME]) {
            cells.push(`<td style="text-align:center;white-space:nowrap;font-size:12px;">${formatTime(item.finish_time)}</td>`);
        }
        
        // 花费时间
        if (visibleColumns[COLUMNS.DURATION]) {
            const duration = formatDuration(item.submit_time, item.finish_time);
            const durationSec = item.finish_time && item.submit_time ? item.finish_time - item.submit_time : 0;
            const color = durationSec > 300 ? 'var(--c-danger)' : 'var(--c-success)';
            cells.push(`<td style="text-align:center;white-space:nowrap;"><span style="color:${color};font-weight:500;font-size:12px;">${duration}</span></td>`);
        }
        
        // 渠道
        if (visibleColumns[COLUMNS.CHANNEL]) {
            cells.push(`<td style="text-align:center;">${taskIsAdmin && item.channel_id ? `<span class="badge badge-blue" style="font-size:11px;">#${escHtml(String(item.channel_id))}</span>` : '-'}</td>`);
        }
        
        // 用户
        if (visibleColumns[COLUMNS.USER]) {
            cells.push(`<td style="text-align:center;font-size:12px;">${taskIsAdmin ? escHtml(item.username || '-') : '-'}</td>`);
        }
        
        // 平台
        if (visibleColumns[COLUMNS.PLATFORM]) {
            cells.push(`<td style="text-align:center;"><span class="badge badge-blue" style="font-size:11px;">${escHtml(item.platform || '-')}</span></td>`);
        }
        
        // 类型
        if (visibleColumns[COLUMNS.TYPE]) {
            cells.push(`<td style="text-align:center;font-size:12px;">${escHtml(item.action || '-')}</td>`);
        }
        
        // 任务ID
        if (visibleColumns[COLUMNS.TASK_ID]) {
            const taskIdShort = (item.task_id || '').slice(0, 16) || '-';
            cells.push(`<td style="text-align:center;"><span class="td-mono" style="font-size:11px;cursor:pointer;color:var(--c-primary);" title="${escHtml(item.task_id||'')}" onclick="showTaskDetail('${escHtml(itemKey)}')">${escHtml(taskIdShort)}</span></td>`);
        }
        
        // 任务状态
        if (visibleColumns[COLUMNS.STATUS]) {
            const st = item.status || '';
            const badgeClass = statusBadgeClass[st] || 'badge-gray';
            const stText = statusText[st] || st || '-';
            cells.push(`<td style="text-align:center;"><span class="badge ${badgeClass}" style="font-size:11px;">${escHtml(stText)}</span></td>`);
        }
        
        // 进度
        if (visibleColumns[COLUMNS.PROGRESS]) {
            let progressHtml = '-';
            if (item.progress) {
                const progressNum = parseInt(String(item.progress).replace('%', ''));
                if (!isNaN(progressNum)) {
                    const color = item.status === 'FAILURE' ? 'var(--c-danger)' : 'var(--c-primary)';
                    progressHtml = `<div style="display:inline-flex;align-items:center;gap:4px;min-width:100px;"><div style="flex:1;height:6px;background:var(--c-border);border-radius:3px;overflow:hidden;"><div style="height:100%;background:${color};width:${progressNum}%;transition:width 0.3s;"></div></div><span style="font-size:11px;color:var(--c-text-secondary);">${progressNum}%</span></div>`;
                } else {
                    progressHtml = escHtml(item.progress);
                }
            }
            cells.push(`<td style="text-align:center;">${progressHtml}</td>`);
        }
        
        // 详情
        if (visibleColumns[COLUMNS.DETAIL]) {
            cells.push(`<td style="text-align:center;"><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();showTaskDetail('${escHtml(itemKey)}')" style="font-size:11px;padding:4px 12px;">详情</button></td>`);
        }

        return `<tr style="cursor:pointer;" onclick="showTaskDetail('${escHtml(itemKey)}')">${cells.join('')}</tr>`;
    }).join('');

    renderPagination();
}

function updateTableHeaders() {
    const ths = document.querySelectorAll('thead th[data-col]');
    ths.forEach(th => {
        const col = th.getAttribute('data-col');
        th.style.display = visibleColumns[col] ? '' : 'none';
    });
}

function renderPagination() {
    const pages = document.getElementById('taskPages');
    if (!pages) return;
    const total = Math.ceil(taskTotal / taskPageSize);
    let html = `<button class="page-btn" onclick="changeTaskPage(${taskPage-1})" ${taskPage<=1?'disabled':''}>‹</button>`;
    for (let i = Math.max(1, taskPage-2); i <= Math.min(total, taskPage+2); i++) {
        html += `<button class="page-btn ${i===taskPage?'active':''}" onclick="changeTaskPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changeTaskPage(${taskPage+1})" ${taskPage>=total?'disabled':''}>›</button>`;
    pages.innerHTML = html;
}

function changeTaskPage(p) {
    if (p < 1) return;
    taskPage = p;
    loadTaskLogs();
}

function searchTaskLogs() {
    taskPage = 1;
    loadTaskLogs();
}

function resetTaskFilters() {
    ['filterPlatform', 'filterStatus', 'filterUser', 'filterTaskId', 'filterChannelId', 'filterStartTime', 'filterEndTime'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    taskPage = 1;
    loadTaskLogs();
}

// ========== 任务详情 ==========
window.showTaskDetail = function(itemKey) {
    const item = (window._taskData || []).find(t => t.task_id === itemKey || String(t.id) === itemKey);
    if (!item) return;

    const modal = document.getElementById('taskDetailModal');
    const content = document.getElementById('taskDetailContent');
    if (!modal || !content) return;

    const statusColors = {
        SUCCESS: '#22c55e',
        FAILURE: '#ef4444',
        IN_PROGRESS: '#3b82f6',
        SUBMITTED: '#f59e0b',
        QUEUED: '#f59e0b',
        NOT_START: '#9ca3af'
    };
    const st = item.status || '';
    const stColor = statusColors[st] || '#6b7280';

    const fields = [
        ['任务ID', item.task_id || '-'],
        ['平台', item.platform || '-'],
        ['类型', item.action || '-'],
        ['用户', item.username || '-'],
        ['用户ID', item.user_id || '-'],
        ['渠道ID', item.channel_id || '-'],
        ['任务状态', `<span style="color:${stColor};font-weight:600;">${statusText[st] || st || '-'}</span>`],
        ['进度', item.progress || '-'],
        ['提交时间', formatTime(item.submit_time)],
        ['开始时间', formatTime(item.start_time)],
        ['完成时间', formatTime(item.finish_time)],
        ['花费时间', formatDuration(item.submit_time, item.finish_time)],
        ['消耗额度', item.quota ? `${item.quota}` : '-'],
        ['失败原因', item.fail_reason || '-'],
        ['结果URL', item.result_url ? `<a href="${escHtml(item.result_url)}" target="_blank" style="color:var(--c-primary);word-break:break-all;">${escHtml(item.result_url)}</a>` : '-'],
    ];

    content.innerHTML = `
        <div style="display:grid;grid-template-columns:120px 1fr;gap:8px 16px;font-size:13px;">
            ${fields.map(([k, v]) => `
                <div style="color:var(--c-text-secondary);padding:8px 0;border-bottom:1px solid var(--c-border);">${k}</div>
                <div style="padding:8px 0;border-bottom:1px solid var(--c-border);word-break:break-all;">${typeof v === 'string' && !v.includes('<') ? escHtml(v) : v}</div>
            `).join('')}
        </div>
    `;

    modal.classList.remove('hidden');
};

window.closeTaskDetail = function() {
    document.getElementById('taskDetailModal')?.classList.add('hidden');
};

// ========== CSV 导出 ==========
window.exportTaskCSV = async function() {
    showToast('正在导出，请稍候...', 'info');

    const params = { p: 1, page_size: 10000 };
    
    // 应用当前筛选参数
    const platform = document.getElementById('filterPlatform')?.value;
    const status = document.getElementById('filterStatus')?.value;
    const username = document.getElementById('filterUser')?.value.trim();
    const taskId = document.getElementById('filterTaskId')?.value.trim();
    const channelId = document.getElementById('filterChannelId')?.value.trim();
    const startTime = document.getElementById('filterStartTime')?.value;
    const endTime = document.getElementById('filterEndTime')?.value;

    if (platform) params.platform = platform;
    if (status) params.status = status;
    if (username) params.username = username;
    if (taskId) params.task_id = taskId;
    if (channelId) params.channel_id = channelId;
    if (startTime) params.start_timestamp = Math.floor(new Date(startTime).getTime() / 1000);
    if (endTime) params.end_timestamp = Math.floor(new Date(endTime).getTime() / 1000);

    const endpoint = taskIsAdmin ? API.getAllTask : API.getUserTask;
    const res = await endpoint(params);

    if (!res.success || !res.data) {
        showToast('导出失败', 'error');
        return;
    }

    const items = res.data?.items || [];
    const header = ['提交时间', '结束时间', '花费时间', '渠道', '用户', '平台', '类型', '任务ID', '任务状态', '进度', '失败原因', '结果URL'];
    const rows = items.map(item => {
        const duration = formatDuration(item.submit_time, item.finish_time);
        return [
            formatTime(item.submit_time),
            formatTime(item.finish_time),
            duration,
            item.channel_id || '',
            item.username || '',
            item.platform || '',
            item.action || '',
            item.task_id || '',
            statusText[item.status] || item.status || '',
            item.progress || '',
            item.fail_reason || '',
            item.result_url || '',
        ].map(v => String(v).replace(/,/g, '，').replace(/\n/g, ' '));
    });

    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${items.length} 条记录`, 'success');
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('task-log');
    
    // 初始化列可见性
    initColumnVisibility();
    
    // 渲染列设置按钮
    renderColumnSettings();
    
    // 检查管理员权限
    const res = await API.getUserInfo();
    if (res.success && res.data && (res.data.role || 0) >= 10) {
        taskIsAdmin = true;
        // 管理员时显示用户名筛选
        const uf = document.getElementById('usernameFilterItem');
        if (uf) uf.style.display = '';
    } else {
        // 普通用户隐藏用户名筛选
        const uf = document.getElementById('usernameFilterItem');
        if (uf) uf.style.display = 'none';
    }
    
    loadTaskLogs();
});
