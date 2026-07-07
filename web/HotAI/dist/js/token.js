// 令牌管理页面逻辑
let tokenPage = 1;
const tokenPageSize = 10;
let tokenTotal = 0;
let currentKey = '';

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
    if (q === -1 || q === undefined || q === null) return '不限制';
    return '$' + (q / 500000).toFixed(4);
}

function formatTime(ts) {
    if (!ts || ts <= 0) return '永不过期';
    return new Date(ts * 1000).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function loadTokens() {
    const search = document.getElementById('tokenSearch').value.trim();
    const tbody = document.getElementById('tokenTableBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

    let res;
    if (search) {
        res = await API.searchTokens(search);
    } else {
        res = await API.getTokens(tokenPage, tokenPageSize);
    }

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><span>${res.message || '加载失败'}</span></div></td></tr>`;
        return;
    }

    const tokens = res.data?.items || [];
    tokenTotal = res.data?.total || tokens.length;
    document.getElementById('tokenPageInfo').textContent = `共 ${tokenTotal} 条`;

    if (tokens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="table-empty"><svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg><span>暂无令牌，点击右上角创建</span></div></td></tr>';
        renderPagination();
        return;
    }

    tbody.innerHTML = tokens.map(tk => {
        const statusBadge = tk.status === 1
            ? '<span class="badge badge-green">正常</span>'
            : '<span class="badge badge-red">禁用</span>';
        const usedPct = (tk.remain_quota > 0 && tk.used_quota > 0)
            ? Math.min(100, Math.round(tk.used_quota / (tk.used_quota + tk.remain_quota) * 100))
            : 0;
        return `
        <tr>
            <td><input type="checkbox" class="tk-checkbox" data-id="${tk.id}" onchange="toggleSelectToken(${tk.id})" ${selectedTokens.has(tk.id)?'checked':''}></td>
            <td><strong>${escHtml(tk.name || '-')}</strong></td>
            <td>${statusBadge}</td>
            <td>
                <div style="font-size:13px;">${quotaToDisplay(tk.remain_quota)}</div>
                ${tk.remain_quota !== -1 ? `<div style="margin-top:4px;height:4px;background:var(--c-border);border-radius:2px;overflow:hidden;"><div style="width:${usedPct}%;height:100%;background:var(--c-primary);"></div></div>` : ''}
            </td>
            <td>${quotaToDisplay(tk.used_quota)}</td>
            <td class="td-mono">${formatTime(tk.created_time)}</td>
            <td class="td-mono">${formatTime(tk.expired_time)}</td>
            <td>
                <div class="td-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewKey(${tk.id})">查看密钥</button>
                    <button class="btn btn-secondary btn-sm" onclick="openEditTokenModal(${tk.id})">编辑</button>
                    <button class="btn ${tk.status===1?'btn-warning':'btn-success'} btn-sm" onclick="toggleTokenStatus(${tk.id}, ${tk.status})">${tk.status === 1 ? '禁用' : '启用'}</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteToken(${tk.id}, '${escHtml(tk.name)}')">删除</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    renderPagination();
}

function renderPagination() {
    const pages = document.getElementById('tokenPages');
    if (!pages) return;
    const total = Math.ceil(tokenTotal / tokenPageSize);
    let html = `<button class="page-btn" onclick="changePage(${tokenPage-1})" ${tokenPage<=1?'disabled':''}>‹</button>`;
    for (let i = Math.max(1, tokenPage-2); i <= Math.min(total, tokenPage+2); i++) {
        html += `<button class="page-btn ${i===tokenPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changePage(${tokenPage+1})" ${tokenPage>=total?'disabled':''}>›</button>`;
    pages.innerHTML = html;
}

function changePage(p) {
    if (p < 1) return;
    tokenPage = p;
    loadTokens();
}

function escHtml(s) {
    return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

function openCreateTokenModal() {
    document.getElementById('tokenModalTitle').textContent = '创建令牌';
    document.getElementById('tokenId').value = '';
    document.getElementById('tokenName').value = '';
    document.getElementById('tokenQuota').value = '-1';
    document.getElementById('tokenExpire').value = '';
    document.getElementById('tokenModels').value = '';
    document.getElementById('tokenIps').value = '';
    document.getElementById('tokenGroup').value = '';
    document.getElementById('tokenModal').classList.remove('hidden');
}

async function openEditTokenModal(id) {
    const res = await API.getToken(id);
    if (!res.success || !res.data) { showToast('获取令牌失败', 'error'); return; }
    const tk = res.data;
    document.getElementById('tokenModalTitle').textContent = '编辑令牌';
    document.getElementById('tokenId').value = tk.id;
    document.getElementById('tokenName').value = tk.name || '';
    document.getElementById('tokenQuota').value = tk.remain_quota ?? -1;
    document.getElementById('tokenModels').value = (tk.models || '').split(',').filter(Boolean).join(',');
    document.getElementById('tokenIps').value = (tk.subnet || []).join(',');
    document.getElementById('tokenGroup').value = tk.group || '';
    if (tk.expired_time > 0) {
        const d = new Date(tk.expired_time * 1000);
        const pad = n => String(n).padStart(2,'0');
        document.getElementById('tokenExpire').value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
        document.getElementById('tokenExpire').value = '';
    }
    document.getElementById('tokenModal').classList.remove('hidden');
}

function closeTokenModal() {
    document.getElementById('tokenModal').classList.add('hidden');
}

async function saveToken() {
    const id = document.getElementById('tokenId').value;
    const name = document.getElementById('tokenName').value.trim();
    if (!name) { showToast('请输入令牌名称', 'warning'); return; }

    const quotaValue = document.getElementById('tokenQuota').value.trim();
    // 处理额度：空字符串或-1表示无限制，0表示禁止使用
    let quota;
    if (quotaValue === '' || quotaValue === '-1') {
        quota = -1;
    } else {
        quota = parseInt(quotaValue);
        if (isNaN(quota)) quota = -1;
    }
    
    const expireStr = document.getElementById('tokenExpire').value;
    const expiredTime = expireStr ? Math.floor(new Date(expireStr).getTime()/1000) : -1;
    const models = document.getElementById('tokenModels').value.trim().split(',').filter(Boolean);
    const subnet = document.getElementById('tokenIps').value.trim().split(',').filter(Boolean);
    const group = document.getElementById('tokenGroup').value.trim();

    const payload = { name, remain_quota: quota, expired_time: expiredTime, models, subnet };
    if (group) payload.group = group;

    let res;
    if (id) {
        payload.id = parseInt(id);
        res = await API.updateToken(payload);
    } else {
        res = await API.createToken(payload);
    }

    if (res.success) {
        showToast(id ? '令牌已更新' : '令牌已创建', 'success');
        closeTokenModal();
        loadTokens();
    } else {
        showToast(res.message || '操作失败', 'error');
    }
}

async function viewKey(id) {
    const res = await API.getTokenKey(id);
    if (res.success && res.data) {
        currentKey = res.data.key || res.data;
        document.getElementById('keyDisplay').textContent = currentKey;
        document.getElementById('keyModal').classList.remove('hidden');
    } else {
        showToast(res.message || '获取密钥失败', 'error');
    }
}

function closeKeyModal() {
    document.getElementById('keyModal').classList.add('hidden');
    currentKey = '';
}

function copyKey() {
    if (!currentKey) return;
    navigator.clipboard.writeText(currentKey).then(() => showToast('密钥已复制', 'success'));
}

async function toggleTokenStatus(id, currentStatus) {
    const newStatus = currentStatus === 1 ? 2 : 1;
    const res = await API.updateToken({ id, status: newStatus });
    if (res.success) {
        showToast(newStatus === 1 ? '已启用' : '已禁用', 'success');
        loadTokens();
    } else {
        showToast(res.message || '操作失败', 'error');
    }
}

async function deleteToken(id, name) {
    if (!confirm(`确定删除令牌「${name}」？此操作不可恢复。`)) return;
    const res = await API.deleteToken(id);
    if (res.success) {
        showToast('令牌已删除', 'success');
        loadTokens();
    } else {
        showToast(res.message || '删除失败', 'error');
    }
}

// ========== 批量操作 ==========
let selectedTokens = new Set();

function toggleSelectToken(id) {
    if (selectedTokens.has(id)) selectedTokens.delete(id);
    else selectedTokens.add(id);
    updateTokenBatchActions();
}

function toggleSelectAllTokens(checked) {
    document.querySelectorAll('.tk-checkbox').forEach(cb => {
        const id = parseInt(cb.dataset.id);
        if (checked) { selectedTokens.add(id); cb.checked = true; }
        else { selectedTokens.delete(id); cb.checked = false; }
    });
    updateTokenBatchActions();
}

function updateTokenBatchActions() {
    const bar = document.getElementById('tokenBatchBar');
    const count = document.getElementById('tokenSelectedCount');
    if (bar) bar.style.display = selectedTokens.size > 0 ? 'flex' : 'none';
    if (count) count.textContent = selectedTokens.size;
}

async function batchEnableTokens() {
    if (!selectedTokens.size) return;
    await Promise.all([...selectedTokens].map(id => API.updateToken({ id, status: 1 })));
    showToast(`已启用 ${selectedTokens.size} 个令牌`, 'success');
    selectedTokens.clear(); updateTokenBatchActions(); loadTokens();
}

async function batchDisableTokens() {
    if (!selectedTokens.size) return;
    await Promise.all([...selectedTokens].map(id => API.updateToken({ id, status: 2 })));
    showToast(`已禁用 ${selectedTokens.size} 个令牌`, 'success');
    selectedTokens.clear(); updateTokenBatchActions(); loadTokens();
}

async function batchDeleteTokens() {
    if (!selectedTokens.size) return;
    if (!confirm(`确定删除选中的 ${selectedTokens.size} 个令牌？`)) return;
    await Promise.all([...selectedTokens].map(id => API.deleteToken(id)));
    showToast(`已删除 ${selectedTokens.size} 个令牌`, 'success');
    selectedTokens.clear(); updateTokenBatchActions(); loadTokens();
}

// 搜索防抖
let searchTimer;
document.addEventListener('DOMContentLoaded', () => {
    renderSidebar('token');
    loadTokens();

    const searchInput = document.getElementById('tokenSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { tokenPage = 1; loadTokens(); }, 400);
        });
    }
});
