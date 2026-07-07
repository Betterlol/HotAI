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

// 签到功能
async function loadCheckinStatus() {
    const res = await API.getCheckinStatus();
    if (res.success && res.data) {
        document.getElementById('checkinStreak').textContent = res.data.streak || 0;
        document.getElementById('checkinMonth').textContent = res.data.month_count || 0;
        
        if (res.data.checked_today) {
            document.getElementById('checkinBadge').style.display = 'inline-block';
            document.getElementById('checkinBtn').disabled = true;
            document.getElementById('checkinBtn').textContent = '今日已签到';
        }
        
        renderCheckinCalendar(res.data.calendar || []);
    }
}

function renderCheckinCalendar(checkinDays) {
    const calendar = document.getElementById('checkinCalendar');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isChecked = checkinDays.includes(dateStr);
        const bgColor = isChecked ? '#22c55e' : '#e5e7eb';
        html += `<div style="aspect-ratio:1;background:${bgColor};border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;color:${isChecked ? '#fff' : '#6b7280'};">${day}</div>`;
    }
    html += '</div>';
    calendar.innerHTML = html;
}

window.doCheckin = async function() {
    const res = await API.checkin();
    if (res.success) {
        showToast('签到成功！' + (res.message || ''), 'success');
        await loadCheckinStatus();
        await loadUserData();
    } else {
        showToast(res.message || '签到失败', 'error');
    }
};

// Passkey 功能
async function loadPasskeys() {
    const res = await API.getPasskeys();
    const list = document.getElementById('passkeyList');
    if (res.success && res.data && res.data.length > 0) {
        list.innerHTML = res.data.map(pk => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--c-border);border-radius:8px;margin-top:8px;">
                <div>
                    <div style="font-weight:500;">${pk.name || 'Passkey'}</div>
                    <div style="font-size:12px;color:var(--c-text-secondary);">创建于 ${new Date(pk.created_at * 1000).toLocaleDateString()}</div>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="deletePasskey(${pk.id})" style="color:#DC2626;">删除</button>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<div style="font-size:14px;color:var(--c-text-secondary);margin-top:12px;">暂无 Passkey</div>';
    }
}

window.addPasskey = async function() {
    if (!window.PublicKeyCredential) {
        showToast('您的浏览器不支持 Passkey', 'error');
        return;
    }
    
    try {
        const res = await API.createPasskeyChallenge();
        if (!res.success) {
            showToast(res.message || '创建失败', 'error');
            return;
        }
        
        const credential = await navigator.credentials.create({
            publicKey: res.data.options
        });
        
        const verifyRes = await API.verifyPasskey({
            id: credential.id,
            rawId: Array.from(new Uint8Array(credential.rawId)),
            response: {
                clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON)),
                attestationObject: Array.from(new Uint8Array(credential.response.attestationObject))
            }
        });
        
        if (verifyRes.success) {
            showToast('Passkey 添加成功', 'success');
            await loadPasskeys();
        }
    } catch (error) {
        showToast('添加失败：' + error.message, 'error');
    }
};

window.deletePasskey = async function(id) {
    if (!confirm('确定要删除此 Passkey 吗？')) return;
    const res = await API.deletePasskey(id);
    if (res.success) {
        showToast('删除成功', 'success');
        await loadPasskeys();
    } else {
        showToast(res.message || '删除失败', 'error');
    }
};

// 2FA 功能
async function load2FAStatus() {
    const res = await API.get2FAStatus();
    const statusDiv = document.getElementById('twoFAStatus');
    if (res.success && res.data && res.data.enabled) {
        statusDiv.innerHTML = `
            <div style="padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;margin-bottom:12px;">
                <div style="color:#166534;font-weight:500;">✓ 双因素认证已启用</div>
            </div>
            <button class="btn btn-secondary" onclick="disable2FA()">禁用 2FA</button>
        `;
    } else {
        statusDiv.innerHTML = '<button class="btn btn-primary" onclick="enable2FA()">启用 2FA</button>';
    }
}

window.enable2FA = async function() {
    const res = await API.generate2FASecret();
    if (res.success && res.data) {
        document.getElementById('totpSecret').value = res.data.secret;
        document.getElementById('qrCode').innerHTML = `<img src="${res.data.qr_code}" alt="QR Code" style="max-width:200px;">`;
        document.getElementById('twoFAModal').classList.remove('hidden');
    } else {
        showToast(res.message || '生成失败', 'error');
    }
};

window.close2FAModal = function() {
    document.getElementById('twoFAModal').classList.add('hidden');
    document.getElementById('totpCode').value = '';
};

window.confirm2FA = async function() {
    const code = document.getElementById('totpCode').value.trim();
    if (!code || code.length !== 6) {
        showToast('请输入6位验证码', 'warning');
        return;
    }
    
    const res = await API.verify2FA(code);
    if (res.success) {
        showToast('2FA 已启用', 'success');
        close2FAModal();
        await load2FAStatus();
    } else {
        showToast(res.message || '验证失败', 'error');
    }
};

window.disable2FA = async function() {
    if (!confirm('确定要禁用双因素认证吗？这会降低账户安全性。')) return;
    const res = await API.disable2FA();
    if (res.success) {
        showToast('2FA 已禁用', 'success');
        await load2FAStatus();
    } else {
        showToast(res.message || '禁用失败', 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar('profile');
    loadUserData();
    loadCheckinStatus();
    loadPasskeys();
    load2FAStatus();
});
