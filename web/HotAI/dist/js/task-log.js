// 任务日志页面逻辑
let taskPage = 1;
const taskPageSize = 20;
let taskTotal = 0;
let taskIsAdmin = false;
let taskAdminMode = false;

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
    return new Date(ts * 1000).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

const taskStatusBadge = {
    'SUCCESS': 'badge-green', 'FAILURE': 'badge-red',
    'IN_PROGRESS': 'badge-blue', 'NOT_START': 'badge-gray',
};

async function loadTaskLogs() {
    const tbody = document.getElementById('taskTableBody');
    const colCount = taskAdminMode ? 7 : 6;
    tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>`;

    const params = { p: taskPage, page_size: taskPageSize };
    const platform = document.getElementById('filterPlatform').value;
    const status = document.getElementById('filterStatus').value;
    if (platform) params.platform = platform;
    if (status) params.status = status;
    if (taskAdminMode && document.getElementById('filterUser').value.trim()) {
        params.username = document.getElementById('filterUser').value.trim();
    }

    const endpoint = taskAdminMode ? API.getAllTask : API.getUserTask;
    const res = await endpoint(params);

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="table-empty"><span>${res.message || '加载失败'}</span></div></td></tr>`;
        return;
    }

    const items = res.data?.items || [];
    taskTotal = res.data?.total || items.length;
    document.getElementById('taskTotal').textContent = taskTotal;
    document.getElementById('taskPageInfo').textContent = `第 ${taskPage} 页`;

    const thUser = document.getElementById('thUser');
    if (thUser) thUser.style.display = taskAdminMode ? '' : 'none';

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="table-empty"><svg viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg><span>暂无任务记录</span></div></td></tr>`;
        renderPagination();
        return;
    }

    // 存储数据供详情弹窗使用
    window._taskData = items;

    tbody.innerHTML = items.map((item, idx) => {
        const st = item.status || '';
        const badgeClass = taskStatusBadge[st] || 'badge-gray';
        const userCell = taskAdminMode ? `<td>${escHtml(item.username||'-')}</td>` : '';
        const resultText = item.fail_reason || (item.result_url ? '已完成' : '-');
        const retryBtn = (st === 'FAILURE' || st === 'NOT_START')
            ? `<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();retryTask('${escHtml(item.task_id||'')}')">重试</button>`
            : '';
        return `
        <tr style="cursor:pointer;" onclick="showTaskDetail(${idx})">
            <td class="td-mono" style="white-space:nowrap;">${formatTime(item.submit_time || item.created_at)}</td>
            ${userCell}
            <td class="td-mono" style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(item.task_id||'')}">
                ${escHtml((item.task_id||'').slice(0,16)||'-')}
            </td>
            <td><span class="badge badge-blue">${escHtml(item.platform || '-')}</span></td>
            <td>${escHtml(item.action || '-')}</td>
            <td><span class="badge ${badgeClass}">${escHtml(st||'-')}</span></td>
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--c-text-secondary);">
                ${item.result_url ? `<a href="${escHtml(item.result_url)}" target="_blank" style="color:var(--c-primary);" onclick="event.stopPropagation()">查看结果</a>` : escHtml(resultText)}
                ${retryBtn}
            </td>
        </tr>`;
    }).join('');

    renderPagination();
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

function changeTaskPage(p) { if (p < 1) return; taskPage = p; loadTaskLogs(); }
function searchTaskLogs() { taskPage = 1; loadTaskLogs(); }
function resetTaskFilters() {
    document.getElementById('filterPlatform').value = '';
    document.getElementById('filterStatus').value = '';
    if (document.getElementById('filterUser')) document.getElementById('filterUser').value = '';
    taskPage = 1;
    loadTaskLogs();
}

// ========== 任务详情 ==========
window.showTaskDetail = function(idx) {
    const item = (window._taskData || [])[idx];
    if (!item) return;

    const modal = document.getElementById('taskDetailModal');
    const content = document.getElementById('taskDetailContent');
    if (!modal || !content) return;

    const statusColor = { SUCCESS: '#22c55e', FAILURE: '#ef4444', IN_PROGRESS: '#3b82f6', NOT_START: '#9ca3af' };
    const st = item.status || '';

    content.innerHTML = `
        <div style="display:grid;grid-template-columns:110px 1fr;gap:8px 16px;font-size:14px;">
            ${[
                ['任务ID', item.task_id || '-'],
                ['平台', item.platform || '-'],
                ['操作类型', item.action || '-'],
                ['用户名', item.username || '-'],
                ['状态', `<span style="color:${statusColor[st]||'#6b7280'};font-weight:600;">${st}</span>`],
                ['提交时间', formatTime(item.submit_time || item.created_at)],
                ['完成时间', item.finish_time ? formatTime(item.finish_time) : '-'],
                ['失败原因', item.fail_reason || '-'],
            ].map(([k, v]) => `
                <div style="color:var(--c-text-secondary);padding:8px 0;border-bottom:1px solid var(--c-border);">${k}</div>
                <div style="padding:8px 0;border-bottom:1px solid var(--c-border);word-break:break-all;">${typeof v === 'string' && !v.includes('<') ? escHtml(v) : v}</div>
            `).join('')}
        </div>
        ${item.result_url ? `
            <div style="margin-top:16px;padding:12px;background:var(--c-input-bg);border-radius:8px;">
                <div style="font-size:13px;color:var(--c-text-secondary);margin-bottom:8px;">结果链接</div>
                <a href="${escHtml(item.result_url)}" target="_blank" style="color:var(--c-primary);word-break:break-all;">${escHtml(item.result_url)}</a>
            </div>
        ` : ''}
    `;

    modal.classList.remove('hidden');
};

window.closeTaskDetail = function() {
    document.getElementById('taskDetailModal')?.classList.add('hidden');
};

// ========== 任务重试 ==========
window.retryTask = async function(taskId) {
    if (!taskId || taskId === '-') return;
    showToast('正在重试...', 'info');
    const res = await API.retryTask(taskId);
    if (res.success) {
        showToast('已重新提交任务', 'success');
        loadTaskLogs();
    } else {
        showToast(res.message || '重试失败', 'error');
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('task-log');
    const res = await API.getUserInfo();
    if (res.success && res.data && (res.data.role || 0) >= 10) {
        taskIsAdmin = true;
        const adminActions = document.getElementById('adminActions');
        if (adminActions) adminActions.style.display = 'flex';
        const toggle = document.getElementById('adminModeToggle');
        if (toggle) {
            toggle.addEventListener('change', () => {
                taskAdminMode = toggle.checked;
                const uf = document.getElementById('usernameFilterItem');
                if (uf) uf.style.display = taskAdminMode ? '' : 'none';
                taskPage = 1;
                loadTaskLogs();
            });
        }
    }
    loadTaskLogs();
});
