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

    // 存储数据供详情弹窗使用
    window._mjData = items;

    tbody.innerHTML = items.map((item, idx) => {
        const status = item.status || '';
        const badgeClass = mjStatusBadge[status] || 'badge-gray';
        const userCell = mjAdminMode ? `<td>${escHtml(item.username || '-')}</td>` : '';
        const imgCell = item.image_url
            ? `<td style="cursor:pointer;" onclick="showMjDetail(${idx})"><img src="${escHtml(item.image_url)}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:2px solid transparent;transition:border-color 0.2s;" onerror="this.style.display='none'" title="点击查看详情"></td>`
            : `<td><span style="color:var(--c-text-secondary);font-size:12px;">无图片</span></td>`;
        return `
        <tr style="cursor:pointer;" onclick="showMjDetail(${idx})">
            <td class="td-mono" style="white-space:nowrap;">${formatTime(item.submit_time || item.created_at)}</td>
            ${userCell}
            <td class="td-mono" style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(item.mj_id||'')}">
                ${escHtml((item.mj_id||'').slice(0,16) || '-')}
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

// ========== 绘图任务详情 ==========
window.showMjDetail = function(idx) {
    const item = (window._mjData || [])[idx];
    if (!item) return;

    const modal = document.getElementById('mjDetailModal');
    const content = document.getElementById('mjDetailContent');
    if (!modal || !content) return;

    const statusColor = { SUCCESS: '#22c55e', FAILURE: '#ef4444', IN_PROGRESS: '#3b82f6', NOT_START: '#9ca3af' };
    const status = item.status || '';

    content.innerHTML = `
        ${item.image_url ? `
            <div style="text-align:center;margin-bottom:20px;">
                <img src="${escHtml(item.image_url)}" style="max-width:100%;max-height:400px;border-radius:8px;border:1px solid var(--c-border);" alt="生成图片">
                <div style="margin-top:8px;">
                    <a href="${escHtml(item.image_url)}" target="_blank" class="btn btn-sm btn-secondary">在新窗口打开</a>
                    <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${escHtml(item.image_url)}').then(()=>showToast('链接已复制','success'))">复制链接</button>
                </div>
            </div>
        ` : ''}
        <div style="display:grid;grid-template-columns:110px 1fr;gap:8px 16px;font-size:14px;">
            ${[
                ['任务ID', item.mj_id || '-'],
                ['用户名', item.username || '-'],
                ['操作类型', item.action || '-'],
                ['状态', `<span style="color:${statusColor[status]||'#6b7280'};font-weight:600;">${status}</span>`],
                ['提交时间', formatTime(item.submit_time || item.created_at)],
                ['完成时间', item.finish_time ? formatTime(item.finish_time) : '-'],
                ['错误信息', item.fail_reason || item.fail_message || '-'],
            ].map(([k, v]) => `
                <div style="color:var(--c-text-secondary);padding:8px 0;border-bottom:1px solid var(--c-border);">${k}</div>
                <div style="padding:8px 0;border-bottom:1px solid var(--c-border);word-break:break-all;">${typeof v === 'string' && !v.includes('<') ? escHtml(v) : v}</div>
            `).join('')}
        </div>
        ${item.prompt ? `
            <div style="margin-top:16px;">
                <div style="font-size:13px;font-weight:600;color:var(--c-text-secondary);margin-bottom:8px;">Prompt</div>
                <div style="background:var(--c-input-bg);border-radius:8px;padding:12px;font-size:13px;line-height:1.6;">${escHtml(item.prompt)}</div>
            </div>
        ` : ''}
    `;

    modal.classList.remove('hidden');
};

window.closeMjDetail = function() {
    document.getElementById('mjDetailModal')?.classList.add('hidden');
};

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
