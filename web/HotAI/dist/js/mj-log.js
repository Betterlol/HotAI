// 绘图日志页面逻辑
let mjPage = 1;
const mjPageSize = 20;
let mjTotal = 0;
let mjIsAdmin = false;

// ========== 列设置 ==========
const mjDefaultColumns = {
    time:        true,
    user:        true,
    task_id:     true,
    channel:     true,
    action:      true,
    status:      true,
    code:        true,
    progress:    true,
    prompt:      true,
    prompt_en:   true,
    image:       true,
    duration:    true,
    fail_reason: true,
};

const mjColumnNames = {
    time:        '时间',
    user:        '用户',
    task_id:     '任务ID',
    channel:     '渠道',
    action:      '操作类型',
    status:      '状态',
    code:        '提交结果',
    progress:    '进度',
    prompt:      '提示词',
    prompt_en:   'PromptEn',
    image:       '结果图片',
    duration:    '花费时间',
    fail_reason: '失败原因',
};

let mjColumnSettings = { ...mjDefaultColumns };

function loadMjColumnSettings() {
    const saved = localStorage.getItem('mjColumnSettings');
    if (saved) {
        try {
            mjColumnSettings = { ...mjDefaultColumns, ...JSON.parse(saved) };
        } catch (e) {
            mjColumnSettings = { ...mjDefaultColumns };
        }
    }
}

function saveMjColumnSettings() {
    localStorage.setItem('mjColumnSettings', JSON.stringify(mjColumnSettings));
}

function applyMjColumnSettings() {
    const table = document.querySelector('.mj-table');
    if (!table) return;
    Object.keys(mjColumnSettings).forEach(col => {
        const isVisible = mjColumnSettings[col];
        table.querySelectorAll(`[data-col="${col}"]`).forEach(el => {
            el.style.display = isVisible ? '' : 'none';
        });
    });
}

function renderMjColumnSettingsMenu() {
    const menu = document.getElementById('mjColumnSettingsMenu');
    if (!menu) return;
    menu.innerHTML = Object.keys(mjColumnNames).map(col => `
        <label class="column-settings-item">
            <input type="checkbox"
                   ${mjColumnSettings[col] ? 'checked' : ''}
                   onchange="toggleMjColumn('${col}', this.checked)">
            <span>${mjColumnNames[col]}</span>
        </label>
    `).join('');
}

window.toggleMjColumnSettings = function(event) {
    event.stopPropagation();
    const menu = document.getElementById('mjColumnSettingsMenu');
    if (!menu) return;
    menu.classList.toggle('show');
    if (menu.classList.contains('show')) renderMjColumnSettingsMenu();
};

window.toggleMjColumn = function(col, checked) {
    mjColumnSettings[col] = checked;
    saveMjColumnSettings();
    applyMjColumnSettings();
};

document.addEventListener('click', (e) => {
    const menu = document.getElementById('mjColumnSettingsMenu');
    const dropdown = document.querySelector('.mj-column-settings-dropdown');
    if (menu && dropdown && !dropdown.contains(e.target)) {
        menu.classList.remove('show');
    }
});

// ========== 工具函数 ==========
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
    return String(s)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"');
}

function formatTime(ts) {
    if (!ts) return '-';
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function calcDuration(submitTime, finishTime) {
    if (!submitTime || !finishTime) return '-';
    // submitTime and finishTime may be in ms or s
    const st = submitTime > 1e12 ? submitTime : submitTime * 1000;
    const ft = finishTime > 1e12 ? finishTime : finishTime * 1000;
    const sec = (ft - st) / 1000;
    if (sec < 0) return '-';
    return sec.toFixed(1) + 's';
}

// ========== 状态/操作类型 Badge ==========
const mjStatusBadge = {
    'SUCCESS':     'badge-green',
    'FAILURE':     'badge-red',
    'IN_PROGRESS': 'badge-blue',
    'NOT_START':   'badge-gray',
    'SUBMITTED':   'badge-yellow',
    'MODAL':       'badge-yellow',
};

const mjStatusLabel = {
    'SUCCESS':     '成功',
    'FAILURE':     '失败',
    'IN_PROGRESS': '执行中',
    'NOT_START':   '未启动',
    'SUBMITTED':   '队列中',
    'MODAL':       '窗口等待',
};

const mjActionLabel = {
    'IMAGINE':       '绘图',
    'UPSCALE':       '放大',
    'VARIATION':     '变换',
    'HIGH_VARIATION':'强变换',
    'LOW_VARIATION': '弱变换',
    'PAN':           '平移',
    'DESCRIBE':      '图生文',
    'BLEND':         '图混合',
    'SHORTEN':       '缩词',
    'REROLL':        '重绘',
    'INPAINT':       '局部重绘',
    'ZOOM':          '变焦',
    'CUSTOM_ZOOM':   '自定义变焦',
    'MODAL':         '窗口处理',
    'SWAP_FACE':     '换脸',
    'UPLOAD':        '上传文件',
    'VIDEO':         '视频',
    'EDITS':         '编辑',
};

const mjCodeLabel = {
    1:  '已提交',
    21: '等待中',
    22: '重复提交',
    0:  '未提交',
};

const mjCodeBadge = {
    1:  'badge-green',
    21: 'badge-blue',
    22: 'badge-yellow',
    0:  'badge-gray',
};

// ========== 筛选参数 ==========
function getMjFilters() {
    const start = document.getElementById('filterStart')?.value;
    const end   = document.getElementById('filterEnd')?.value;
    const params = {
        p:         mjPage,
        page_size: mjPageSize,
    };
    const action    = document.getElementById('filterAction')?.value;
    const status    = document.getElementById('filterStatus')?.value;
    const username  = document.getElementById('filterUser')?.value.trim();
    const taskId    = document.getElementById('filterTaskId')?.value.trim();
    const channelId = document.getElementById('filterChannelId')?.value.trim();
    if (action)    params.action     = action;
    if (status)    params.status     = status;
    if (username)  params.username   = username;
    if (taskId)    params.mj_id      = taskId;
    if (channelId) params.channel_id = channelId;
    if (start)     params.start_timestamp = Math.floor(new Date(start).getTime() / 1000);
    if (end)       params.end_timestamp   = Math.floor(new Date(end).getTime() / 1000);
    return params;
}

// ========== 加载数据 ==========
async function loadMjLogs() {
    const tbody = document.getElementById('mjTableBody');
    tbody.innerHTML = `<tr><td colspan="13"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>`;

    const params = getMjFilters();
    const endpoint = mjIsAdmin ? API.getAllMidjourney : API.getUserMidjourney;
    const res = await endpoint(params);

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="13"><div class="table-empty"><span>${escHtml(res.message || '加载失败')}</span></div></td></tr>`;
        return;
    }

    const items = res.data?.items || [];
    mjTotal = res.data?.total || items.length;
    document.getElementById('mjTotal').textContent = mjTotal;
    document.getElementById('mjPageInfo').textContent = `第 ${mjPage} 页`;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13"><div class="table-empty"><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z"/></svg><span>暂无绘图记录</span></div></td></tr>`;
        renderMjPagination();
        return;
    }

    window._mjData = items;

    tbody.innerHTML = items.map((item) => {
        const status      = item.status || '';
        const badgeClass  = mjStatusBadge[status] || 'badge-gray';
        const statusLabel = mjStatusLabel[status] || status || '-';
        const actionLabel = mjActionLabel[item.action] || item.action || '-';
        const codeClass   = mjCodeBadge[item.code] ?? 'badge-gray';
        const codeLabel   = mjCodeLabel[item.code] ?? (item.code != null ? item.code : '-');
        const itemKey = escHtml(item.mj_id || String(item.id || ''));

        // 进度条
        const pct = item.progress ? parseInt(item.progress.replace('%', '')) || 0 : 0;
        const progressCell = `
            <div class="mj-progress-wrap">
                <div class="mj-progress-bar"><div class="mj-progress-fill ${status === 'FAILURE' ? 'mj-progress-fail' : ''}" style="width:${pct}%"></div></div>
                <span class="mj-progress-label">${item.progress || '0%'}</span>
            </div>`;

        // 缩略图
        const imgCell = item.image_url
            ? `<img src="${escHtml(item.image_url)}" class="mj-thumb" onclick="event.stopPropagation();showMjImageModal('${escHtml(item.image_url)}')" onerror="this.style.display='none'" title="点击放大">`
            : `<span style="color:var(--c-text-secondary);font-size:12px;">无</span>`;

        // 花费时间
        const duration = calcDuration(item.submit_time, item.finish_time);

        return `
        <tr style="cursor:pointer;" onclick="showMjDetail('${itemKey}')">
            <td data-col="time" class="td-mono">${formatTime(item.submit_time)}</td>
            <td data-col="user">${escHtml(item.username || '-')}</td>
            <td data-col="task_id" class="td-mono" title="${escHtml(item.mj_id || '')}">${escHtml(item.mj_id || '-')}</td>
            <td data-col="channel">${item.channel_id ? `<span class="badge badge-blue">#${escHtml(String(item.channel_id))}</span>` : '-'}</td>
            <td data-col="action"><span class="badge badge-purple">${escHtml(actionLabel)}</span></td>
            <td data-col="status"><span class="badge ${badgeClass}">${escHtml(statusLabel)}</span></td>
            <td data-col="code"><span class="badge ${codeClass}">${escHtml(String(codeLabel))}</span></td>
            <td data-col="progress">${progressCell}</td>
            <td data-col="prompt" class="mj-text-cell" title="${escHtml(item.prompt || '')}">${escHtml(item.prompt || '-')}</td>
            <td data-col="prompt_en" class="mj-text-cell" title="${escHtml(item.prompt_en || '')}">${escHtml(item.prompt_en || '-')}</td>
            <td data-col="image">${imgCell}</td>
            <td data-col="duration">${escHtml(duration)}</td>
            <td data-col="fail_reason" class="mj-text-cell" title="${escHtml(item.fail_reason || '')}">${escHtml(item.fail_reason || '-')}</td>
        </tr>`;
    }).join('');

    renderMjPagination();
    applyMjColumnSettings();
}

// ========== 分页 ==========
function renderMjPagination() {
    const pages = document.getElementById('mjPages');
    if (!pages) return;
    const total = Math.ceil(mjTotal / mjPageSize);
    let html = `<button class="page-btn" onclick="changeMjPage(${mjPage - 1})" ${mjPage <= 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = Math.max(1, mjPage - 2); i <= Math.min(total, mjPage + 2); i++) {
        html += `<button class="page-btn ${i === mjPage ? 'active' : ''}" onclick="changeMjPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changeMjPage(${mjPage + 1})" ${mjPage >= total ? 'disabled' : ''}>›</button>`;
    pages.innerHTML = html;
}

function changeMjPage(p) {
    if (p < 1) return;
    mjPage = p;
    loadMjLogs();
}

function searchMjLogs() { mjPage = 1; loadMjLogs(); }

function resetMjFilters() {
    ['filterAction', 'filterStatus', 'filterUser', 'filterTaskId', 'filterChannelId', 'filterStart', 'filterEnd'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    mjPage = 1;
    loadMjLogs();
}

// ========== 详情弹窗 ==========
window.showMjDetail = function(itemKey) {
    const item = (window._mjData || []).find(i => i.mj_id === itemKey || String(i.id) === itemKey);
    if (!item) return;

    const modal   = document.getElementById('mjDetailModal');
    const content = document.getElementById('mjDetailContent');
    if (!modal || !content) return;

    const status      = item.status || '';
    const actionLabel = mjActionLabel[item.action] || item.action || '-';
    const statusLabel = mjStatusLabel[status] || status || '-';
    const codeLabel   = mjCodeLabel[item.code] ?? (item.code != null ? item.code : '-');
    const duration    = calcDuration(item.submit_time, item.finish_time);

    const rows = [
        ['时间',     formatTime(item.submit_time)],
        ['用户',     item.username || '-'],
        ['任务ID',   item.mj_id || '-'],
        ['渠道',     item.channel_id ? `#${item.channel_id}` : '-'],
        ['操作类型', actionLabel],
        ['状态',     statusLabel],
        ['提交结果', String(codeLabel)],
        ['进度',     item.progress || '-'],
        ['花费时间', duration],
        ['完成时间', formatTime(item.finish_time)],
        ['失败原因', item.fail_reason || '-'],
    ];

    content.innerHTML = `
        ${item.image_url ? `
            <div style="text-align:center;margin-bottom:20px;">
                <img src="${escHtml(item.image_url)}" style="max-width:100%;max-height:360px;border-radius:8px;border:1px solid var(--c-border);" alt="生成图片">
                <div style="margin-top:8px;display:flex;gap:8px;justify-content:center;">
                    <a href="${escHtml(item.image_url)}" target="_blank" class="btn btn-sm btn-secondary">在新窗口打开</a>
                    <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${escHtml(item.image_url)}').then(()=>showToast('链接已复制','success'))">复制链接</button>
                </div>
            </div>
        ` : ''}
        <div style="display:grid;grid-template-columns:110px 1fr;gap:0 16px;font-size:14px;">
            ${rows.map(([k, v]) => `
                <div style="color:var(--c-text-secondary);padding:8px 0;border-bottom:1px solid var(--c-border);">${escHtml(k)}</div>
                <div style="padding:8px 0;border-bottom:1px solid var(--c-border);font-weight:500;word-break:break-all;">${escHtml(String(v))}</div>
            `).join('')}
        </div>
        ${item.prompt ? `
            <div style="margin-top:16px;">
                <div style="font-size:13px;font-weight:600;color:var(--c-text-secondary);margin-bottom:8px;">提示词</div>
                <div style="background:var(--c-input-bg);border-radius:8px;padding:12px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all;">${escHtml(item.prompt)}</div>
            </div>
        ` : ''}
        ${item.prompt_en ? `
            <div style="margin-top:12px;">
                <div style="font-size:13px;font-weight:600;color:var(--c-text-secondary);margin-bottom:8px;">PromptEn</div>
                <div style="background:var(--c-input-bg);border-radius:8px;padding:12px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all;">${escHtml(item.prompt_en)}</div>
            </div>
        ` : ''}
    `;

    modal.classList.remove('hidden');
};

window.closeMjDetail = function() {
    document.getElementById('mjDetailModal')?.classList.add('hidden');
};

// ========== 图片放大弹窗 ==========
window.showMjImageModal = function(url) {
    const modal = document.getElementById('mjImageModal');
    const img   = document.getElementById('mjImageModalImg');
    if (!modal || !img) return;
    img.src = url;
    modal.classList.remove('hidden');
};

window.closeMjImageModal = function() {
    document.getElementById('mjImageModal')?.classList.add('hidden');
};

// ========== CSV 导出 ==========
window.exportMjCSV = async function() {
    showToast('正在导出，请稍候...', 'info');

    const params = getMjFilters();
    params.page_size = 10000;

    const endpoint = mjIsAdmin ? API.getAllMidjourney : API.getUserMidjourney;
    const res = await endpoint(params);
    if (!res.success || !res.data) {
        showToast('导出失败', 'error');
        return;
    }

    const items = res.data?.items || [];
    const header = ['时间', '用户', '任务ID', '渠道', '操作类型', '状态', '提交结果', '进度', '提示词', 'PromptEn', '结果图片', '花费时间', '失败原因'];
    const rows = items.map(item => {
        return [
            formatTime(item.submit_time),
            item.username || '',
            item.mj_id || '',
            item.channel_id || '',
            mjActionLabel[item.action] || item.action || '',
            mjStatusLabel[item.status] || item.status || '',
            mjCodeLabel[item.code] ?? (item.code != null ? item.code : ''),
            item.progress || '',
            item.prompt || '',
            item.prompt_en || '',
            item.image_url || '',
            calcDuration(item.submit_time, item.finish_time),
            item.fail_reason || '',
        ].map(v => String(v).replace(/,/g, '，').replace(/\n/g, ' '));
    });

    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mj_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${items.length} 条记录`, 'success');
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('mj-log');

    const res = await API.getUserInfo();
    if (res.success && res.data && (res.data.role || 0) >= 10) {
        mjIsAdmin = true;
    }

    loadMjColumnSettings();
    loadMjLogs();
});
