// 用户管理逻辑（管理员）
let uPage = 1;
const uPageSize = 20;
let uTotal = 0;

function showToast(msg, type='info') {
    const c=document.getElementById('toastContainer');if(!c)return;
    const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);
}
function escHtml(s){return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');}
function quotaToDisplay(q){return '$'+(Math.abs(q||0)/500000).toFixed(4);}
function formatTime(ts){if(!ts||ts<=0)return '-';return new Date(ts*1000).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});}
const roleNames={1:'普通用户',10:'管理员',100:'超管'};

async function loadUsers() {
    const search = document.getElementById('userSearch').value.trim();
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML='<tr><td colspan="9"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

    let res;
    if (search) {
        res = await API.searchUsers(search);
    } else {
        res = await API.getUsers(uPage, uPageSize);
    }

    if (!res.success) {
        tbody.innerHTML=`<tr><td colspan="9"><div class="table-empty"><span>${res.message||'加载失败'}</span></div></td></tr>`;
        return;
    }

    const items = res.data?.items || [];
    uTotal = res.data?.total || items.length;
    document.getElementById('userPageInfo').textContent = `共 ${uTotal} 条`;

    if (items.length === 0) {
        tbody.innerHTML='<tr><td colspan="9"><div class="table-empty"><span>暂无用户数据</span></div></td></tr>';
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
        return `<tr>
            <td><input type="checkbox" class="u-checkbox" data-id="${u.id}" onchange="toggleSelectUser(${u.id})" ${selectedUsers.has(u.id)?'checked':''}></td>
            <td class="td-mono">${u.id}</td>
            <td><strong>${escHtml(u.username||'-')}</strong></td>
            <td>${escHtml(u.display_name||'-')}</td>
            <td>${roleBadge}</td>
            <td style="font-weight:600;">${quotaToDisplay(u.quota)}</td>
            <td style="color:var(--c-text-secondary);">${quotaToDisplay(u.used_quota)}</td>
            <td>${statusBadge}</td>
            <td class="td-mono">${formatTime(u.created_time)}</td>
            <td>
                <div class="td-actions">
                    <button class="btn btn-secondary btn-sm" onclick="showUserDetail(${u.id})">详情</button>
                    <button class="btn btn-secondary btn-sm" onclick="openEditUserModal(${u.id})">编辑</button>
                    <button class="btn btn-secondary btn-sm" onclick="openTopupModal(${u.id},'${escHtml(u.username||'')}')">充值</button>
                    <button class="btn ${u.status===1?'btn-warning':'btn-success'} btn-sm" onclick="toggleUserStatus(${u.id},${u.status})">${u.status===1?'封禁':'解封'}</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${escHtml(u.username||'')}')">删除</button>
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
    document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() { document.getElementById('userModal').classList.add('hidden'); }

async function saveUser() {
    const id = parseInt(document.getElementById('userId').value);
    const payload = {
        display_name: document.getElementById('editDisplayName').value.trim(),
        role: parseInt(document.getElementById('editRole').value),
        group: document.getElementById('editGroup').value.trim()||'default',
        quota: parseInt(document.getElementById('editQuota').value)||0,
    };
    
    const email = document.getElementById('editEmail').value.trim();
    if (email) payload.email = email;
    
    const pwd = document.getElementById('editPassword').value.trim();
    if (pwd) payload.password = pwd;

    let res;
    if (id) {
        // 编辑模式
        payload.id = id;
        res = await API.updateUser(payload);
    } else {
        // 创建模式
        const username = document.getElementById('editUsername').value.trim();
        if (!username) { showToast('请输入用户名','warning'); return; }
        if (!pwd) { showToast('请输入密码','warning'); return; }
        payload.username = username;
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

async function toggleUserStatus(id, currentStatus) {
    // 防止封禁自己
    const currentUser = await API.getUserInfo();
    if (currentUser.success && currentUser.data && currentUser.data.id === id && currentStatus === 1) {
        showToast('不能封禁自己','warning');
        return;
    }
    
    const newStatus = currentStatus === 1 ? 2 : 1;
    const res = await API.updateUser({ id, status: newStatus });
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

// ========== 创建用户 ==========
function openCreateUserModal() {
    document.getElementById('userId').value = '';
    document.getElementById('editUsername').value = '';
    document.getElementById('editEmail').value = '';
    document.getElementById('editDisplayName').value = '';
    document.getElementById('editRole').value = '1';
    document.getElementById('editGroup').value = 'default';
    document.getElementById('editQuota').value = '500000';
    document.getElementById('editPassword').value = '';
    document.getElementById('userModalTitle').textContent = '创建用户';
    const usernameField = document.getElementById('editUsername');
    if (usernameField) usernameField.removeAttribute('readonly');
    document.getElementById('userModal').classList.remove('hidden');
}

// ========== 用户详情 ==========
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
                ['最后活跃', u.last_login_time ? formatTime(u.last_login_time) : '-'],
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

// ========== 批量操作 ==========
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
    
    // 防止封禁自己
    const currentUser = await API.getUserInfo();
    if (currentUser.success && currentUser.data) {
        const currentUserId = currentUser.data.id;
        if (selectedUsers.has(currentUserId)) {
            showToast('不能封禁自己，已从选择中排除','warning');
            selectedUsers.delete(currentUserId);
            if (selectedUsers.size === 0) {
                updateUserBatchBar();
                return;
            }
        }
    }
    
    await Promise.all([...selectedUsers].map(id => API.updateUser({ id, status: 2 })));
    showToast(`已封禁 ${selectedUsers.size} 个用户`, 'success');
    selectedUsers.clear(); updateUserBatchBar(); loadUsers();
}

async function batchUnbanUsers() {
    if (!selectedUsers.size) return;
    await Promise.all([...selectedUsers].map(id => API.updateUser({ id, status: 1 })));
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
    renderSidebar('user');
    loadUsers();

    const si = document.getElementById('userSearch');
    if(si) si.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{uPage=1;loadUsers();},400);});
});
