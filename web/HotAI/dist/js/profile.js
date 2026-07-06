// 个人设置页面逻辑
let currentUser = null;

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
    return '$' + (Math.abs(q || 0) / 500000).toFixed(4);
}

async function loadUserData() {
    const res = await API.getUserInfo();
    if (!res.success || !res.data) {
        showToast('加载用户信息失败', 'error');
        return;
    }

    currentUser = res.data;
    updateUI();
}

function updateUI() {
    if (!currentUser) return;

    const initial = (currentUser.username || currentUser.display_name || 'U').charAt(0).toUpperCase();
    
    // 更新头像
    const avatarLarge = document.getElementById('avatarLarge');
    if (avatarLarge) avatarLarge.textContent = initial;

    // 更新概览信息
    document.getElementById('usernameDisplay').textContent = currentUser.display_name || currentUser.username || '未设置';
    document.getElementById('emailDisplay').textContent = currentUser.email || '未绑定邮箱';
    document.getElementById('balanceDisplay').textContent = quotaToDisplay(currentUser.quota);
    document.getElementById('usedDisplay').textContent = quotaToDisplay(currentUser.used_quota);
    
    if (currentUser.created_time) {
        const date = new Date(currentUser.created_time * 1000);
        document.getElementById('registerDateDisplay').textContent = 
            `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    // 更新表单
    document.getElementById('displayNameInput').value = currentUser.display_name || '';
    document.getElementById('usernameInput').value = currentUser.username || '';
    document.getElementById('emailInput').value = currentUser.email || '';
}

async function updateProfile() {
    const displayName = document.getElementById('displayNameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();

    if (!displayName) {
        showToast('显示名称不能为空', 'warning');
        return;
    }

    const res = await API.updateUser({ display_name: displayName, email });
    if (res.success) {
        showToast('资料已更新', 'success');
        await loadUserData();
    } else {
        showToast(res.message || '更新失败', 'error');
    }
}

async function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (!current || !newPwd || !confirm) {
        showToast('请填写所有密码字段', 'warning');
        return;
    }

    if (newPwd.length < 8) {
        showToast('新密码至少需要 8 个字符', 'warning');
        return;
    }

    if (newPwd !== confirm) {
        showToast('两次输入的新密码不一致', 'warning');
        return;
    }

    const res = await API.updateUser({
        old_password: current,
        password: newPwd
    });

    if (res.success) {
        showToast('密码已修改', 'success');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    } else {
        showToast(res.message || '修改失败', 'error');
    }
}

async function redeemCode() {
    const code = document.getElementById('redeemCodeInput').value.trim();
    if (!code) {
        showToast('请输入兑换码', 'warning');
        return;
    }

    const res = await API.redeemCode(code);
    if (res.success) {
        showToast('兑换成功！', 'success');
        document.getElementById('redeemCodeInput').value = '';
        await loadUserData();
    } else {
        showToast(res.message || '兑换失败', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 使用标准侧边栏，高亮 profile 菜单项
    renderSidebar('profile');
    loadUserData();
});
