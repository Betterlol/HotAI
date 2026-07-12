// 令牌管理页面逻辑
let tokenPage = 1;
const tokenPageSize = 10;
let tokenTotal = 0;
let currentKey = '';
let tokenSortField = 'name';
let tokenSortOrder = 'asc';
let availableModels = [];
let selectedModels = new Set();
let allGroups = [];
let currentUserGroup = '';

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
    if (q === undefined || q === null || q === 0) return '无限制';
    if (q < 0) return '无限制';
    return '$' + (q / 500000).toFixed(4);
}

function formatTime(ts) {
    if (!ts || ts <= 0) return '永不过期';
    return new Date(ts * 1000).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
    return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

// 渲染额度使用进度条
function renderQuotaProgress(remainQuota, usedQuota) {
    if (remainQuota === 0 || remainQuota === undefined || remainQuota === null) {
        return `<div style="text-align:center;font-size:13px;color:var(--c-text-secondary);">无限制</div>`;
    }
    
    const total = Math.abs(remainQuota) + Math.abs(usedQuota || 0);
    const used = Math.abs(usedQuota || 0);
    const remain = Math.abs(remainQuota);
    
    // 计算使用百分比（剩余越少，进度条越满）
    const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    
    const displayUsed = quotaToDisplay(used);
    const displayRemain = quotaToDisplay(remain);
    
    let barColor = '#10b981'; // 绿色
    if (percentage >= 90) barColor = '#ef4444'; // 红色
    else if (percentage >= 70) barColor = '#f59e0b'; // 橙色
    
    return `
        <div style="min-width:140px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">
                <span style="color:var(--c-text-secondary);">已用:${displayUsed}</span>
                <span style="color:var(--c-text-secondary);">剩余:${displayRemain}</span>
            </div>
            <div style="width:100%;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
                <div style="width:${percentage}%;height:100%;background:${barColor};transition:width 0.3s;"></div>
            </div>
            <div style="font-size:10px;color:var(--c-text-secondary);text-align:center;margin-top:2px;">${percentage.toFixed(1)}% 已用</div>
        </div>
    `;
}

// 加载分组列表
async function loadGroups() {
    const res = await API.getGroups();
    if (res.success && res.data) {
        allGroups = res.data || [];
        const filterSelect = document.getElementById('tokenGroupFilter');
        const modalSelect = document.getElementById('tokenGroup');
        
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">所有分组</option>';
            allGroups.forEach(group => {
                if (group && group !== '') {
                    const option = document.createElement('option');
                    option.value = group;
                    option.textContent = group;
                    filterSelect.appendChild(option);
                }
            });
        }
        
        if (modalSelect) {
            modalSelect.innerHTML = '<option value="">留空使用用户分组</option>';
            allGroups.forEach(group => {
                if (group && group !== '') {
                    const option = document.createElement('option');
                    option.value = group;
                    option.textContent = group;
                    modalSelect.appendChild(option);
                }
            });
        }
    }
}

// 加载模型列表
async function loadModels() {
    const res = await API.getPricing();
    if (res.success && res.data) {
        availableModels = res.data.map(item => ({
            name: item.model_name,
            vendor: item.vendor_id
        }));
    }
}

// 切换排序方向
function toggleTokenSortOrder() {
    tokenSortOrder = tokenSortOrder === 'asc' ? 'desc' : 'asc';
    const icon = document.getElementById('tokenSortIcon');
    if (tokenSortOrder === 'asc') {
        // 升序图标：向上箭头
        icon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
    } else {
        // 降序图标：向下箭头
        icon.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>';
    }
    loadTokens();
}

// 重置筛选
function resetTokenFilters() {
    document.getElementById('tokenSearch').value = '';
    document.getElementById('tokenGroupFilter').value = '';
    document.getElementById('tokenSortField').value = 'name';
    tokenSortField = 'name';
    tokenSortOrder = 'asc';
    document.getElementById('tokenSortIcon').innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
    tokenPage = 1;
    loadTokens();
}

// 排序函数
function sortTokens(items) {
    return items.sort((a, b) => {
        let aVal, bVal;
        if (tokenSortField === 'name') {
            aVal = (a.name || '').toLowerCase();
            bVal = (b.name || '').toLowerCase();
        } else if (tokenSortField === 'created_time') {
            aVal = a.created_time || 0;
            bVal = b.created_time || 0;
        }

        if (tokenSortOrder === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
}

async function loadTokens() {
    const search = document.getElementById('tokenSearch').value.trim();
    const groupFilter = document.getElementById('tokenGroupFilter').value;
    tokenSortField = document.getElementById('tokenSortField').value;
    
    const tbody = document.getElementById('tokenTableBody');
    tbody.innerHTML = '<tr><td colspan="10"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

    let res;
    let items = [];

    if (search) {
        res = await API.searchTokens(search);
        if (res.success) {
            items = res.data || [];
            if (groupFilter) items = items.filter(t => t.group === groupFilter);
        }
    } else {
        res = await API.getTokens(tokenPage, tokenPageSize);
        if (res.success) {
            items = res.data?.items || [];
            if (groupFilter) items = items.filter(t => t.group === groupFilter);
        }
    }

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="10"><div class="table-empty"><span>${res.message || '加载失败'}</span></div></td></tr>`;
        return;
    }

    items = sortTokens(items);
    tokenTotal = res.data?.total || items.length;
    document.getElementById('tokenPageInfo').textContent = `共 ${tokenTotal} 条`;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10"><div class="table-empty"><svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg><span>暂无令牌，点击右上角创建</span></div></td></tr>';
        renderPagination();
        return;
    }

    tbody.innerHTML = items.map(tk => {
        const statusBadge = tk.status === 1
            ? '<span class="badge badge-green">正常</span>'
            : '<span class="badge badge-red">禁用</span>';
        
        const groupDisplay = tk.group ? `<span class="badge badge-blue">${escHtml(tk.group)}</span>` : '<span style="color:var(--c-text-secondary);">默认</span>';
        
        // 处理可用模型显示
        let modelsDisplay = '全模型';
        if (tk.models && tk.models.length > 0) {
            const modelList = tk.models.split(',').filter(Boolean);
            if (modelList.length > 0) {
                modelsDisplay = modelList.length > 2 
                    ? `${modelList.slice(0, 2).map(m => escHtml(m)).join(', ')}... (${modelList.length}个)`
                    : modelList.map(m => escHtml(m)).join(', ');
            }
        }
        
        // 处理IP限制显示
        let ipsDisplay = '-';
        if (tk.subnet && tk.subnet.length > 0) {
            ipsDisplay = tk.subnet.length > 2
                ? `${tk.subnet.slice(0, 2).join(', ')}... (${tk.subnet.length}个)`
                : tk.subnet.join(', ');
        }
        
        const actionBtn = tk.status === 1
            ? `<button class="btn btn-warning btn-sm" onclick="toggleTokenStatus(${tk.id}, ${tk.status})">禁用</button>`
            : `<button class="btn btn-success btn-sm" onclick="toggleTokenStatus(${tk.id}, ${tk.status})">启用</button>`;

        return `
        <tr>
            <td style="text-align:center;"><input type="checkbox" class="tk-checkbox" data-id="${tk.id}" onchange="toggleSelectToken(${tk.id})" ${selectedTokens.has(tk.id)?'checked':''}></td>
            <td style="text-align:center;"><strong>${escHtml(tk.name || '-')}</strong></td>
            <td style="text-align:center;">${groupDisplay}</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center;">${renderQuotaProgress(tk.remain_quota, tk.used_quota)}</td>
            <td style="text-align:center;font-size:12px;">${modelsDisplay}</td>
            <td style="text-align:center;font-size:12px;">${escHtml(ipsDisplay)}</td>
            <td style="text-align:center;" class="td-mono">${formatTime(tk.created_time)}</td>
            <td style="text-align:center;" class="td-mono">${formatTime(tk.expired_time)}</td>
            <td style="text-align:center;">
                <div class="td-actions" style="justify-content:center;">
                    <button class="btn btn-secondary btn-sm" onclick="viewKey(${tk.id})">查看密钥</button>
                    <button class="btn btn-secondary btn-sm" onclick="openEditTokenModal(${tk.id})">编辑</button>
                    ${actionBtn}
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

function openCreateTokenModal() {
    document.getElementById('tokenModalTitle').textContent = '创建令牌';
    document.getElementById('tokenId').value = '';
    document.getElementById('tokenName').value = '';
    document.getElementById('tokenQuota').value = '0';
    document.getElementById('tokenExpire').value = '';
    document.getElementById('tokenGroup').value = '';
    document.getElementById('tokenIps').value = '';
    selectedModels.clear();
    renderSelectedModels();
    document.getElementById('tokenModal').classList.remove('hidden');
}

async function openEditTokenModal(id) {
    const res = await API.getToken(id);
    if (!res.success || !res.data) { showToast('获取令牌失败', 'error'); return; }
    const tk = res.data;
    document.getElementById('tokenModalTitle').textContent = '编辑令牌';
    document.getElementById('tokenId').value = tk.id;
    document.getElementById('tokenName').value = tk.name || '';
    document.getElementById('tokenQuota').value = tk.remain_quota ?? 0;
    document.getElementById('tokenGroup').value = tk.group || '';
    document.getElementById('tokenIps').value = (tk.subnet || []).join(',');
    
    // 处理模型限制
    selectedModels.clear();
    if (tk.models) {
        const modelList = tk.models.split(',').filter(Boolean);
        modelList.forEach(m => selectedModels.add(m));
    }
    renderSelectedModels();
    
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

// 渲染已选模型
function renderSelectedModels() {
    const container = document.getElementById('tokenModelsSelected');
    if (!container) return;
    
    if (selectedModels.size === 0) {
        container.innerHTML = '<span style="color:var(--c-text-secondary);font-size:13px;padding:4px;">未选择（允许所有模型）</span>';
        return;
    }
    
    container.innerHTML = Array.from(selectedModels).map(model => `
        <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:var(--c-primary-light);color:var(--c-primary);border-radius:6px;font-size:12px;">
            ${escHtml(model)}
            <svg onclick="removeModel('${escHtml(model)}')" style="width:14px;height:14px;cursor:pointer;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        </span>
    `).join('');
}

// 移除模型
function removeModel(modelName) {
    selectedModels.delete(modelName);
    renderSelectedModels();
}

// 模型搜索和选择
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('tokenModelsSearch');
    const dropdown = document.getElementById('tokenModelsDropdown');
    
    if (searchInput && dropdown) {
        searchInput.addEventListener('focus', () => {
            if (availableModels.length > 0) {
                renderModelDropdown('');
                dropdown.style.display = 'block';
            }
        });
        
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            renderModelDropdown(keyword);
            dropdown.style.display = 'block';
        });
        
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }
});

function renderModelDropdown(keyword) {
    const dropdown = document.getElementById('tokenModelsDropdown');
    if (!dropdown) return;
    
    const filtered = availableModels.filter(m => 
        !keyword || m.name.toLowerCase().includes(keyword)
    );
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding:8px 12px;color:var(--c-text-secondary);font-size:13px;">无匹配模型</div>';
        return;
    }
    
    dropdown.innerHTML = filtered.slice(0, 50).map(model => {
        const isSelected = selectedModels.has(model.name);
        return `
            <div onclick="toggleModel('${escHtml(model.name)}')" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;gap:8px;${isSelected?'background:var(--c-primary-light);':''}" onmouseover="this.style.background='var(--c-gray-hover)'" onmouseout="this.style.background='${isSelected?'var(--c-primary-light)':''}">
                <input type="checkbox" ${isSelected?'checked':''} onclick="event.stopPropagation();" style="pointer-events:none;">
                <span>${escHtml(model.name)}</span>
            </div>
        `;
    }).join('');
}

function toggleModel(modelName) {
    if (selectedModels.has(modelName)) {
        selectedModels.delete(modelName);
    } else {
        selectedModels.add(modelName);
    }
    renderSelectedModels();
    renderModelDropdown(document.getElementById('tokenModelsSearch').value.toLowerCase());
}

async function saveToken() {
    const id = document.getElementById('tokenId').value;
    const name = document.getElementById('tokenName').value.trim();
    if (!name) { showToast('请输入令牌名称', 'warning'); return; }

    let quotaValue = parseInt(document.getElementById('tokenQuota').value.trim());
    if (isNaN(quotaValue) || quotaValue < 0) quotaValue = 0;
    
    const expireStr = document.getElementById('tokenExpire').value;
    const expiredTime = expireStr ? Math.floor(new Date(expireStr).getTime()/1000) : -1;
    
    const models = Array.from(selectedModels);
    const subnet = document.getElementById('tokenIps').value.trim().split(',').filter(Boolean);
    const group = document.getElementById('tokenGroup').value.trim();

    // 留空时使用用户当前分组
    const effectiveGroup = group || currentUserGroup;

    const payload = { 
        name, 
        remain_quota: quotaValue, 
        expired_time: expiredTime, 
        models,
        subnet,
        unlimited_quota: quotaValue === 0,
        model_limits_enabled: models.length > 0,
        model_limits: models.join(','),
        group: effectiveGroup
    };

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
    const res = await API.updateTokenStatus(id, newStatus);
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
    await Promise.all([...selectedTokens].map(id => API.updateTokenStatus(id, 1)));
    showToast(`已启用 ${selectedTokens.size} 个令牌`, 'success');
    selectedTokens.clear(); updateTokenBatchActions(); loadTokens();
}

async function batchDisableTokens() {
    if (!selectedTokens.size) return;
    await Promise.all([...selectedTokens].map(id => API.updateTokenStatus(id, 2)));
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
document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('token');

    // 获取当前用户分组
    const userRes = await API.getUserInfo();
    if (userRes.success && userRes.data) {
        currentUserGroup = userRes.data.group || 'default';
    }

    loadGroups();
    loadModels();
    loadTokens();

    const searchInput = document.getElementById('tokenSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { tokenPage = 1; loadTokens(); }, 400);
        });
    }
    
    const groupFilter = document.getElementById('tokenGroupFilter');
    if (groupFilter) {
        groupFilter.addEventListener('change', () => {
            tokenPage = 1;
            loadTokens();
        });
    }
    
    const sortField = document.getElementById('tokenSortField');
    if (sortField) {
        sortField.addEventListener('change', () => {
            tokenPage = 1;
            loadTokens();
        });
    }
});