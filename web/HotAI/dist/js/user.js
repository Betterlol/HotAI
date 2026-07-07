// 用户管理逻辑（管理员）
let uPage = 1;
const uPageSize = 20;
let uTotal = 0;
let currentUserRole = 0;
let currentUserId = 0;
let sortField = 'id';
let sortOrder = 'desc'; // 'asc' 或 'desc'

function showToast(msg, type='info') {
    const c=document.getElementById('toastContainer');if(!c)return;
    const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);
}
function escHtml(s){return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');}
function quotaToDisplay(q){return '$'+(Math.abs(q||0)/500000).toFixed(4);}
function formatTime(ts){if(!ts||ts<=0)return '-';const d=new Date(ts*1000);return d.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
const roleNames={1:'普通用户',10:'管理员',100:'超管'};

// 切换排序顺序
function toggleSortOrder() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    const icon = document.getElementById('sortIcon');
    if (sortOrder === 'asc') {
        // 升序图标：向上箭头
        icon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
    } else {
        // 降序图标：向下箭头
        icon.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>';
    }
    loadUsers();
}

// 排序函数
function sortUsers(items) {
    return items.sort((a, b) => {
        let aVal, bVal;
        if (sortField === 'id') {
            aVal = a.id || 0;
            bVal = b.id || 0;
        } else if (sortField === 'username') {
            aVal = (a.username || '').toLowerCase();
            bVal = (b.username || '').toLowerCase();
        } else if (sortField === 'created_time') {
            aVal = a.created_time || 0;
            bVal = b.created_time || 0;
        }
        
        if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
}

// 额度进度条
function renderQuotaProgress(quota, usedQuota) {
    const total = Math.abs(quota || 0);
    const used = Math.abs(usedQuota || 0);
    const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    const displayUsed = quotaToDisplay(used);
    const displayTotal = quotaToDisplay(total);
    
    let barColor = '#10b981'; // 绿色
    if (percentage >= 90) barColor = '#ef4444'; // 红色
    else if (percentage >= 70) barColor = '#f59e0b'; // 橙色
    
    return `
        <div style="min-width:120px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">
                <span style="color:var(--c-text-secondary);">${displayUsed}</span>
                <span style="color:var(--c-text-secondary);">${displayTotal}</span>
            </div>
            <div style="width:100%;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
                <div style="width:${percentage}%;height:100%;background:${barColor};transition:width 0.3s;"></div>
            </div>
            <div style="font-size:10px;color:var(--c-text-secondary);text-align:center;margin-top:2px;">${percentage.toFixed(1)}%</div>
        </div>
    `;
}

async function loadGroups() {
    const res = await API.getGroups();
    if (res.success && res.data) {
        const select = document.getElementById('groupFilter');
        if (!select) return;
        const groups = res.data || [];
        groups.forEach(group => {
            if (group && group !== '') {
                const option = document.createElement('option');
                option.value = group;
                option.textContent = group;
                select.appendChild(option);
            }
        });
    }
}

function resetFilters() {
    document.getElementById('userSearch').value = '';
    document.getElementById('groupFilter').value = '';
    document.getElementById('sortField').value = 'id';
    sortField = 'id';
    sortOrder = 'desc';
    document.getElementById('sortIcon').innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>';
    uPage = 1;
    loadUsers();
}

async function loadUsers() {
    const search = document.getElementById('userSearch').value.trim();
    const groupFilter = document.getElementById('groupFilter').value;
    sortField = document.getElementById('sortField').value;
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML='<tr><td colspan="10"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

    let res;
    let items = [];
    
    if (search) {
        res = await API.searchUsers(search);
        if (res.success) {
            items = res.data || [];
            if (groupFilter) items = items.filter(u => u.group === groupFilter);
        }
    } else {
        res = await API.getUsers(uPage, uPageSize);
        if (res.success) {
            items = res.data?.items || [];
            if (groupFilter) items = items.filter(u => u.group === groupFilter);
        }
    }

    if (!res.success) {
        tbody.innerHTML=`<tr><td colspan="10"><div class="table-empty"><span>${res.message||'加载失败'}</span></div></td></tr>`;
        return;
    }

    items = sortUsers(items);
    uTotal = res.data?.total || items.length;
    document.getElementById('userPageInfo').textContent = `共 ${uTotal} 条`;

    if (items.length === 0) {
        tbody.innerHTML='<tr><td colspan="10"><div class="table-empty"><span>暂无用户数据</span></div></td></tr>';
        renderPagination(); return;
    }

    tbody.innerHTML = items.map(u => {
        const statusBadge = u.status === 1
            ? '<span class="badge badge-green">正常</span>'
            : '<span class="badge badge-red">封禁</span>';
        const roleName = roleNames[u.role] || `角色${u.role}`;
        const roleBadge = u.role >= 10
            ? `<span class="badge badge-purple">${roleName}</span>`
            : `<span class="badge badge-gray">${roleName}</span>`;
        
        const canManage = currentUserRole > u.role;
        const isSelf = u.id === currentUserId;
        const isDisabled = !canManage || isSelf;
        const disabledClass = isDisabled ? ' disabled' : '';
        const disabledStyle = isDisabled ? ' opacity:0.5;cursor:not-allowed;pointer-events:none;' : '';
        
        return `<tr>
            <td><input type="checkbox" class="u-checkbox" data-id="${u.id}" onchange="toggleSelectUser(${u.id})" ${selectedUsers.has(u.id)?'checked':''}></td>
            <td class="td-mono">${u.id}</td>
            <td><strong>${escHtml(u.username||'-')}</strong></td>
            <td><span class="badge badge-blue">${escHtml(u.group||'default')}</span></td>
            <td>${roleBadge}</td>
            <td>${renderQuotaProgress(u.quota, u.used_quota)}</td>
            <td class="td-mono" style="font-size:12px;">${formatTime(u.created_time)}</td>
            <td class="td-mono" style="font-size:12px;color:var(--c-text-secondary);">${formatTime(u.last_login_time||0)}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="td-actions" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
                    <button class="btn btn-secondary btn-sm" onclick="showUserDetail(${u.id})">详情</button>
                    <button class="btn btn-secondary btn-sm${disabledClass}" style="${disabledStyle}" onclick="openEditUserModal(${u.id})">编辑</button>
                    <button class="btn btn-success btn-sm${disabledClass}" style="${disabledStyle}" onclick="promoteUser(${u.id},${u.role},'${escHtml(u.username||'')}')">⬆️提升</button>
                    <button class="btn btn-warning btn-sm${disabledClass}" style="${disabledStyle}" onclick="demoteUser(${u.id},${u.role},'${escHtml(u.username||'')}')">⬇️降低</button>
                    <button class="btn btn-secondary btn-sm${disabledClass}" style="${disabledStyle}" onclick="openTopupModal(${u.id},'${escHtml(u.username||'')}')">充值</button>
                    <button class="btn ${u.status===1?'btn-warning':'btn-success'} btn-sm${disabledClass}" style="${disabledStyle}" onclick="toggleUserStatus(${u.id},${u.status})">${u.status===1?'封禁':'解封'}</button>
                    <button class="btn btn-secondary btn-sm${disabledClass}" style="${disabledStyle}" onclick="manageSubscription(${u.id},'${escHtml(u.username||'')}')">订阅</button>
                    <button class="btn btn-secondary btn-sm${disabledClass}" style="${disabledStyle}" onclick="resetPasskey(${u.id},'${escHtml(u.username||'')}')">重置PK</button>
                    <button class="btn btn-secondary btn-sm${disabledClass}" style="${disabledStyle}" onclick="reset2FA(${u.id},'${escHtml(u.username||'')}')">重置2FA</button>
                    <button class="btn btn-danger btn-sm${disabledClass}" style="${disabledStyle}" onclick="deleteUser(${u.id},'${escHtml(u.username||'')}')">删除</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    renderPagination();
}

function renderPagination() {
    const pages = document.getElementById('userPages');
    if (!pages) return;
    const total = Math.ceil(uTotal / uPageSize);
    let html = `<button class="page-btn" onclick="changeUPage(${uPage-1})" ${uPage<=1?'disabled':''}>‹</button>`;
    for (let i = Math.max(1, uPage-2); i <= Math.min(total, uPage+2); i++) {
        html += `<button class="page-btn ${i===uPage?'active':''}" onclick="changeUPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changeUPage(${uPage+1})" ${uPage>=total?'disabled':''}>›</button>`;
    pages.innerHTML = html;
}

function changeUPage(p) { if(p<1)return; uPage=p; loadUsers(); }

async function openEditUserModal(id) {
    const res = await API.getUser(id);
    if (!res.success||!res.data) { showToast('获取用户失败','error'); return; }
    const u = res.data;
    
    document.getElementById('userId').value = u.id;
    document.getElementById('editUsername').value = u.username||'';
    document.getElementById('editEmail').value = u.email||'';
    document.getElementById('editDisplayName').value = u.display_name||'';
    document.getElementById('editRole').value = String(u.role||1);
    document.getElementById('editGroup').value = u.group||'default';
    document.getElementById('editQuota').value = u.quota||0;
    document.getElementById('editPassword').value = '';
    document.getElementById('editRemark').value = '';
    document.getElementById('editStatus').value = String(u.status||1);
    document.getElementById('userModalTitle').textContent = '编辑用户';
    
    const roleSelect = document.getElementById('editRole');
    Array.from(roleSelect.options).forEach(opt => {
        const roleValue = parseInt(opt.value);
        opt.disabled = roleValue > currentUserRole;
    });
    
    document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() { document.getElementById('userModal').classList.add('hidden'); }

async function saveUser() {
    const id = parseInt(document.getElementById('userId').value);
    
    let res;
    if (id) {
        const payload = {
            id: id,
            display_name: document.getElementById('editDisplayName').value.trim(),
            role: parseInt(document.getElementById('editRole').value),
            group: document.getElementById('editGroup').value.trim()||'default',
            quota: parseInt(document.getElementById('editQuota').value)||0,
            status: parseInt(document.getElementById('editStatus').value)||1,
        };
        
        const email = document.getElementById('editEmail').value.trim();
        if (email) payload.email = email;
        
        const pwd = document.getElementById('editPassword').value.trim();
        if (pwd) payload.password = pwd;

        const remark = document.getElementById('editRemark').value.trim();
        if (remark) payload.remark = remark;
        
        res = await API.updateUser(payload);
    } else {
        const username = document.getElementById('editUsername').value.trim();
        if (!username) { showToast('请输入用户名','warning'); return; }
        
        const pwd = document.getElementById('editPassword').value.trim();
        if (!pwd) { showToast('请输入密码','warning'); return; }
        
        const payload = {
            username: username,
            password: pwd,
            display_name: document.getElementById('editDisplayName').value.trim(),
            role: parseInt(document.getElementById('editRole').value),
            group: document.getElementById('editGroup').value.trim()||'default',
            quota: parseInt(document.getElementById('editQuota').value)||0,
            status: parseInt(document.getElementById('editStatus').value)||1,
        };
        
        const email = document.getElementById('editEmail').value.trim();
        if (email) payload.email = email;
        
        const remark = document.getElementById('editRemark').value.trim();
        if (remark) payload.remark = remark;
        
        res = await API.createUser(payload);
    }

    if (res.success) {
        showToast(id ? '用户已更新' : '用户已创建','success');
        closeUserModal();
        loadUsers();
    } else {
        showToast(res.message||'操作失败','error');
    }
}

function openTopupModal(id, username) {
    document.getElementById('topupUserId').value = id;
    document.getElementById('topupUsername').value = username;
    document.getElementById('topupAmount').value = '500000';
    document.getElementById('topupModal').classList.remove('hidden');
}

function closeTopupModal() { document.getElementById('topupModal').classList.add('hidden'); }

async function doTopup() {
    const id = parseInt(document.getElementById('topupUserId').value);
    const amount = parseInt(document.getElementById('topupAmount').value)||0;
    if (!amount) { showToast('请输入充值额度','warning'); return; }

    const res = await API.topupUser(id, amount);
    if (res.success) {
        showToast('充值成功','success');
        closeTopupModal();
        loadUsers();
    } else {
        showToast(res.message||'充值失败','error');
    }
}

async function promoteUser(userId, currentRole, username) {
    if (currentRole >= 100) { showToast('已是最高权限','info'); return; }
    const newRole = currentRole === 1 ? 10 : 100;
    const nextRoleName = roleNames[newRole];
    if (!confirm(`确定要将用户「${username}」提升为${nextRoleName}吗？`)) return;
    
    const res = await API.updateUserAdmin({ id: userId, role: newRole });
    if (res.success) {
        showToast(`已将「${username}」提升为${nextRoleName}`, 'success');
        loadUsers();
    } else {
        showToast(res.message || '提升权限失败', 'error');
    }
}

async function demoteUser(userId, currentRole, username) {
    if (currentRole <= 1) { showToast('已是最低权限','info'); return; }
    const newRole = currentRole === 100 ? 10 : 1;
    const prevRoleName = roleNames[newRole];
    if (!confirm(`确定要将用户「${username}」降低为${prevRoleName}吗？`)) return;
    
    const res = await API.updateUserAdmin({ id: userId, role: newRole });
    if (res.success) {
        showToast(`已将「${username}」降低为${prevRoleName}`, 'success');
        loadUsers();
    } else {
        showToast(res.message || '降低权限失败', 'error');
    }
}

async function toggleUserStatus(id, currentStatus) {
    if (id === currentUserId && currentStatus === 1) {
        showToast('不能封禁自己','warning');
        return;
    }
    
    const newStatus = currentStatus === 1 ? 2 : 1;
    const res = await API.updateUserAdmin({ id, status: newStatus });
    if (res.success) {
        showToast(newStatus===1?'已解封':'已封禁','success');
        loadUsers();
    } else {
        showToast(res.message||'操作失败','error');
    }
}

async function deleteUser(id, username) {
    if (!confirm(`确定删除用户「${username}」？此操作不可撤销。`)) return;
    const res = await API.deleteUser(id);
    if (res.success) { showToast('用户已删除','success'); loadUsers(); }
    else showToast(res.message||'删除失败','error');
}

async function manageSubscription(userId, username) {
    // 打开订阅管理对话框
    document.getElementById('subUserId').value = userId;
    document.getElementById('subUsername').textContent = username;
    
    // 加载用户订阅列表
    const res = await API.getUserSubscriptions(userId);
    const tbody = document.getElementById('subTableBody');
    
    if (!res.success || !res.data || res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--c-text-secondary);padding:20px;">该用户暂无订阅</td></tr>';
    } else {
        tbody.innerHTML = res.data.map(sub => {
            const statusBadge = sub.status === 'active' 
                ? '<span class="badge badge-green">有效</span>'
                : '<span class="badge badge-gray">失效</span>';
            return `<tr>
                <td>${sub.id}</td>
                <td>${escHtml(sub.plan_name||'-')}</td>
                <td>${formatTime(sub.start_time)}</td>
                <td>${formatTime(sub.end_time)}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="invalidateSubscription(${sub.id})">使失效</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSubscription(${sub.id})">删除</button>
                </td>
            </tr>`;
        }).join('');
    }
    
    document.getElementById('subscriptionModal').classList.remove('hidden');
}

function closeSubscriptionModal() {
    document.getElementById('subscriptionModal').classList.add('hidden');
}

async function invalidateSubscription(subId) {
    if (!confirm('确定要使该订阅失效吗？')) return;
    const res = await API.invalidateUserSubscription(subId);
    if (res.success) {
        showToast('订阅已失效', 'success');
        const userId = document.getElementById('subUserId').value;
        const username = document.getElementById('subUsername').textContent;
        manageSubscription(userId, username); // 刷新列表
    } else {
        showToast(res.message || '操作失败', 'error');
    }
}

async function deleteSubscription(subId) {
    if (!confirm('确定要删除该订阅吗？此操作不可撤销。')) return;
    const res = await API.deleteUserSubscription(subId);
    if (res.success) {
        showToast('订阅已删除', 'success');
        const userId = document.getElementById('subUserId').value;
        const username = document.getElementById('subUsername').textContent;
        manageSubscription(userId, username); // 刷新列表
    } else {
        showToast(res.message || '删除失败', 'error');
    }
}

async function resetPasskey(userId, username) {
    if (!confirm(`确定要重置用户「${username}」的Passkey吗？用户将需要重新注册Passkey。`)) return;
    const res = await API.resetUserPasskey(userId);
    if (res.success) {
        showToast(`已重置「${username}」的Passkey`, 'success');
    } else {
        showToast(res.message || '重置失败', 'error');
    }
}

async function reset2FA(userId, username) {
    if (!confirm(`确定要重置用户「${username}」的2FA吗？用户将需要重新设置2FA。`)) return;
    const res = await API.resetUser2FA(userId);
    if (res.success) {
        showToast(`已重置「${username}」的2FA`, 'success');
    } else {
        showToast(res.message || '重置失败', 'error');
    }
}

function openCreateUserModal() {
    document.getElementById('userId').value = '';
    document.getElementById('editUsername').value = '';
    document.getElementById('editEmail').value = '';
    document.getElementById('editDisplayName').value = '';
    document.getElementById('editRole').value = '1';
    document.getElementById('editGroup').value = 'default';
    document.getElementById('editQuota').value = '500000';
    document.getElementById('editPassword').value = '';
    document.getElementById('editRemark').value = '';
    document.getElementById('editStatus').value = '1';
    document.getElementById('userModalTitle').textContent = '创建用户';
    const usernameField = document.getElementById('editUsername');
    if (usernameField) usernameField.removeAttribute('readonly');
    
    const roleSelect = document.getElementById('editRole');
    Array.from(roleSelect.options).forEach(opt => {
        const roleValue = parseInt(opt.value);
        opt.disabled = roleValue > currentUserRole;
    });
    
    document.getElementById('userModal').classList.remove('hidden');
}

window.showUserDetail = async function(id) {
    const res = await API.getUser(id);
    if (!res.success || !res.data) { showToast('获取用户失败', 'error'); return; }
    const u = res.data;
    const modal = document.getElementById('userDetailModal');
    const content = document.getElementById('userDetailContent');
    if (!modal || !content) return;

    content.innerHTML = `
        <div style="display:grid;grid-template-columns:120px 1fr;gap:8px 16px;font-size:14px;">
            ${[
                ['用户ID', u.id],
                ['用户名', u.username || '-'],
                ['显示名称', u.display_name || '-'],
                ['邮箱', u.email || '-'],
                ['角色', roleNames[u.role] || `角色${u.role}`],
                ['分组', u.group || 'default'],
                ['状态', u.status === 1 ? '正常' : '封禁'],
                ['账户余额', quotaToDisplay(u.quota)],
                ['已用额度', quotaToDisplay(u.used_quota)],
                ['请求次数', (u.request_count || 0).toLocaleString()],
                ['注册时间', formatTime(u.created_time)],
                ['最后登录', formatTime(u.last_login_time||0)],
            ].map(([k, v]) => `
                <div style="color:var(--c-text-secondary);padding:8px 0;border-bottom:1px solid var(--c-border);">${k}</div>
                <div style="padding:8px 0;border-bottom:1px solid var(--c-border);font-weight:500;">${escHtml(String(v))}</div>
            `).join('')}
        </div>
    `;
    modal.classList.remove('hidden');
};

window.closeUserDetail = function() {
    document.getElementById('userDetailModal')?.classList.add('hidden');
};

let selectedUsers = new Set();

function toggleSelectUser(id) {
    if (selectedUsers.has(id)) selectedUsers.delete(id);
    else selectedUsers.add(id);
    updateUserBatchBar();
}

function toggleSelectAllUsers(checked) {
    document.querySelectorAll('.u-checkbox').forEach(cb => {
        const id = parseInt(cb.dataset.id);
        if (checked) { selectedUsers.add(id); cb.checked = true; }
        else { selectedUsers.delete(id); cb.checked = false; }
    });
    updateUserBatchBar();
}

function updateUserBatchBar() {
    const bar = document.getElementById('userBatchBar');
    const count = document.getElementById('userSelectedCount');
    if (bar) bar.style.display = selectedUsers.size > 0 ? 'flex' : 'none';
    if (count) count.textContent = selectedUsers.size;
}

async function batchBanUsers() {
    if (!selectedUsers.size) return;
    if (selectedUsers.has(currentUserId)) {
        showToast('不能封禁自己，已从选择中排除','warning');
        selectedUsers.delete(currentUserId);
        if (selectedUsers.size === 0) {
            updateUserBatchBar();
            return;
        }
    }
    await Promise.all([...selectedUsers].map(id => API.updateUserAdmin({ id, status: 2 })));
    showToast(`已封禁 ${selectedUsers.size} 个用户`, 'success');
    selectedUsers.clear(); updateUserBatchBar(); loadUsers();
}

async function batchUnbanUsers() {
    if (!selectedUsers.size) return;
    await Promise.all([...selectedUsers].map(id => API.updateUserAdmin({ id, status: 1 })));
    showToast(`已解封 ${selectedUsers.size} 个用户`, 'success');
    selectedUsers.clear(); updateUserBatchBar(); loadUsers();
}

async function batchDeleteUsers() {
    if (!selectedUsers.size) return;
    if (!confirm(`确定删除选中的 ${selectedUsers.size} 个用户？`)) return;
    await Promise.all([...selectedUsers].map(id => API.deleteUser(id)));
    showToast(`已删除 ${selectedUsers.size} 个用户`, 'success');
    selectedUsers.clear(); updateUserBatchBar(); loadUsers();
}

let searchTimer;
document.addEventListener('DOMContentLoaded', async () => {
    const res = await API.getUserInfo();
    if (!res.success||!res.data||(res.data.role||0)<10) {
        showToast('无权限访问','error');
        setTimeout(()=>window.location.href='console.html',1500);
        return;
    }
    
    currentUserRole = res.data.role || 0;
    currentUserId = res.data.id || 0;
    
    renderSidebar('user');
    loadGroups();
    loadUsers();

    const si = document.getElementById('userSearch');
    if(si) si.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{uPage=1;loadUsers();},400);});
    
    const gf = document.getElementById('groupFilter');
    if(gf) gf.addEventListener('change',()=>{uPage=1;loadUsers();});
    
    const sf = document.getElementById('sortField');
    if(sf) sf.addEventListener('change',()=>{uPage=1;loadUsers();});
});
