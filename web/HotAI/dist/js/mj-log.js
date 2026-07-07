// 绘图日志 (Midjourney) 页面逻辑
let mjPage = 1;
const mjPageSize = 20;
let mjTotal = 0;
let mjIsAdmin = false;
let mjAdminMode = false;

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

const mjStatusBadge = {
    'SUCCESS': 'badge-green',
    'FAILURE': 'badge-red',
    'IN_PROGRESS': 'badge-blue',
    'NOT_START': 'badge-gray',
};

async function loadMjLogs() {
    const tbody = document.getElementById('mjTableBody');
    const colCount = mjAdminMode ? 7 : 6;
    tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>`;

    const params = {
        p: mjPage,
        page_size: mjPageSize,
    };
    const action = document.getElementById('filterAction').value;
    const status = document.getElementById('filterStatus').value;
    if (action) params.action = action;
    if (status) params.status = status;
    if (mjAdminMode && document.getElementById('filterUser').value.trim()) {
        params.username = document.getElementById('filterUser').value.trim();
    }

    const endpoint = mjAdminMode ? API.getAllMidjourney : API.getUserMidjourney;
    const res = await endpoint(params);

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="table-empty"><span>${res.message || '加载失败'}</span></div></td></tr>`;
        return;
    }

    const items = res.data?.items || [];
    mjTotal = res.data?.total || items.length;
    document.getElementById('mjTotal').textContent = mjTotal;
    document.getElementById('mjPageInfo').textContent = `第 ${mjPage} 页`;

    const thUser = document.getElementById('thUser');
    if (thUser) thUser.style.display = mjAdminMode ? '' : 'none';

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="table-empty"><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z"/></svg><span>暂无绘图记录</span></div></td></tr>`;
        renderPagination();
        return;
    }

    tbody.innerHTML = items.map(item => {
        const status = item.status || '';
        const badgeClass = mjStatusBadge[status] || 'badge-gray';
        const userCell = mjAdminMode ? `<td>${escHtml(item.username || '-')}</td>` : '';
        const imgCell = item.image_url
            ? `<td><a href="${escHtml(item.image_url)}" target="_blank"><img src="${escHtml(item.image_url)}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;" onerror="this.style.display='none'"></a></td>`
            : `<td><span style="color:var(--c-text-secondary);font-size:12px;">无</span></td>`;
        return `
        <tr>
            <td class="td-mono" style="white-space:nowrap;">${formatTime(item.submit_time || item.created_at)}</td>
            ${userCell}
            <td class="td-mono" style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(item.mj_id||'')}">
                ${escHtml((item.mj_id||'').slice(0,16)+'...'||'-')}
            </td>
            <td><span class="badge badge-blue">${escHtml(item.action || '-')}</span></td>
            <td><span class="badge ${badgeClass}">${escHtml(status || '-')}</span></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--c-text-secondary);" title="${escHtml(item.prompt||'')}">
                ${escHtml(item.prompt || '-')}
            </td>
            ${imgCell}
        </tr>`;
    }).join('');

    renderPagination();
}

function renderPagination() {
    const pages = document.getElementById('mjPages');
    if (!pages) return;
    const total = Math.ceil(mjTotal / mjPageSize);
    let html = `<button class="page-btn" onclick="changeMjPage(${mjPage-1})" ${mjPage<=1?'disabled':''}>‹</button>`;
    for (let i = Math.max(1, mjPage-2); i <= Math.min(total, mjPage+2); i++) {
        html += `<button class="page-btn ${i===mjPage?'active':''}" onclick="changeMjPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changeMjPage(${mjPage+1})" ${mjPage>=total?'disabled':''}>›</button>`;
    pages.innerHTML = html;
}

function changeMjPage(p) {
    if (p < 1) return;
    mjPage = p;
    loadMjLogs();
}

function searchMjLogs() { mjPage = 1; loadMjLogs(); }

function resetMjFilters() {
    document.getElementById('filterAction').value = '';
    document.getElementById('filterStatus').value = '';
    if (document.getElementById('filterUser')) document.getElementById('filterUser').value = '';
    mjPage = 1;
    loadMjLogs();
}

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('mj-log');

    const res = await API.getUserInfo();
    if (res.success && res.data && (res.data.role || 0) >= 10) {
        mjIsAdmin = true;
        const adminActions = document.getElementById('adminActions');
        if (adminActions) adminActions.style.display = 'flex';
        const toggle = document.getElementById('adminModeToggle');
        if (toggle) {
            toggle.addEventListener('change', () => {
                mjAdminMode = toggle.checked;
                const userFilter = document.getElementById('usernameFilterItem');
                if (userFilter) userFilter.style.display = mjAdminMode ? '' : 'none';
                mjPage = 1;
                loadMjLogs();
            });
        }
    }

    loadMjLogs();
});
