// 个人设置页面逻辑 (HotAI)
let currentUser = null;
let currentSettings = {};
let sidebarModulesConfig = {};

// ============================================================================
// 工具函数
// ============================================================================

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

// ============================================================================
// Tab 切换
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar('profile');
    
    // Tab 切换逻辑
    const tabBtns = document.querySelectorAll('.profile-tab-btn');
    const tabPanels = document.querySelectorAll('.profile-tab-panel');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 更新面板状态
            tabPanels.forEach(panel => panel.classList.remove('active'));
            const targetPanel = document.getElementById(`tab-${targetTab}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
    
    // 加载数据
    loadUserData();
    loadCheckinStatus();
    load2FAStatus();
    loadPasskeyStatus();
});

// ============================================================================
// 用户数据加载
// ============================================================================

async function loadUserData() {
    const res = await API.getUserInfo();
    if (!res.success || !res.data) {
        showToast('加载用户信息失败', 'error');
        return;
    }

    currentUser = res.data;
    updateUI();
    loadBindings();
    loadUserSettings();
    loadSidebarModules();
}

function updateUI() {
    if (!currentUser) return;

    const initial = (currentUser.username || currentUser.display_name || 'U').charAt(0).toUpperCase();
    
    // 更新头像
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) profileAvatar.textContent = initial;

    // 更新横幅信息
    document.getElementById('profileDisplayName').textContent = currentUser.display_name || currentUser.username || '未设置';
    document.getElementById('profileEmail').textContent = currentUser.email || '未绑定邮箱';
    document.getElementById('profileBalance').textContent = quotaToDisplay(currentUser.quota);
    document.getElementById('profileUsed').textContent = quotaToDisplay(currentUser.used_quota);
    
    if (currentUser.created_time) {
        const date = new Date(currentUser.created_time * 1000);
        document.getElementById('profileRegisterDate').textContent = 
            `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    // 更新表单
    document.getElementById('displayNameInput').value = currentUser.display_name || '';
    document.getElementById('usernameInput').value = currentUser.username || '';
    document.getElementById('emailInput').value = currentUser.email || '';
    
    // 检查是否为管理员
    if (currentUser.role >= 10) {
        const adminItem = document.getElementById('upstreamNotifyItem');
        if (adminItem) adminItem.style.display = 'flex';
    }
}

// ============================================================================
// 个人资料更新
// ============================================================================

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

// ============================================================================
// 修改密码
// ============================================================================

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

// ============================================================================
// 系统访问令牌
// ============================================================================

async function generateToken() {
    try {
        const res = await fetch('/api/user/token', {
            credentials: 'include',
            headers: {
                'New-Api-User': String(currentUser?.id || '')
            }
        });
        const data = await res.json();
        
        if (data.success && data.data) {
            document.getElementById('accessTokenInput').value = data.data;
            // 复制到剪贴板
            try {
                await navigator.clipboard.writeText(data.data);
                showToast('令牌已生成并复制到剪贴板', 'success');
            } catch (e) {
                showToast('令牌已生成', 'success');
            }
        } else {
            showToast(data.message || '生成失败', 'error');
        }
    } catch (error) {
        showToast('生成失败', 'error');
    }
}

// ============================================================================
// Passkey 管理
// ============================================================================

async function loadPasskeyStatus() {
    try {
        const res = await fetch('/api/user/passkey', {
            credentials: 'include',
            headers: {
                'New-Api-User': String(currentUser?.id || '')
            }
        });
        const data = await res.json();
        
        if (data.success && data.data) {
            const enabled = data.data.enabled || false;
            document.getElementById('passkeyStatusText').textContent = enabled ? '已启用' : '未启用';
            const badge = document.getElementById('passkeyStatusBadge');
            badge.textContent = enabled ? '启用' : '禁用';
            badge.className = enabled ? 'status-badge enabled' : 'status-badge disabled';
            
            const btn = document.getElementById('passkeyActionBtn');
            if (enabled) {
                btn.textContent = '移除 Passkey';
                btn.className = 'btn btn-danger';
            } else {
                btn.textContent = '添加 Passkey';
                btn.className = 'btn btn-primary';
            }
        }
    } catch (error) {
        console.error('Load passkey status failed:', error);
    }
}

async function togglePasskey() {
    const statusText = document.getElementById('passkeyStatusText').textContent;
    const enabled = statusText === '已启用';
    
    if (enabled) {
        if (!confirm('确定要移除 Passkey 吗？')) return;
        try {
            const res = await fetch('/api/user/passkey', {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'New-Api-User': String(currentUser?.id || '')
                }
            });
            const data = await res.json();
            if (data.success) {
                showToast('Passkey 已移除', 'success');
                await loadPasskeyStatus();
            } else {
                showToast(data.message || '移除失败', 'error');
            }
        } catch (error) {
            showToast('移除失败', 'error');
        }
    } else {
        if (!window.PublicKeyCredential) {
            showToast('您的浏览器不支持 Passkey', 'error');
            return;
        }
        
        try {
            const res = await fetch('/api/user/passkey/register', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'New-Api-User': String(currentUser?.id || '')
                }
            });
            const data = await res.json();
            
            if (!data.success || !data.data) {
                showToast(data.message || '创建失败', 'error');
                return;
            }
            
            const credential = await navigator.credentials.create({
                publicKey: data.data.options
            });
            
            const verifyRes = await fetch('/api/user/passkey/verify', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'New-Api-User': String(currentUser?.id || '')
                },
                body: JSON.stringify({
                    id: credential.id,
                    rawId: Array.from(new Uint8Array(credential.rawId)),
                    response: {
                        clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON)),
                        attestationObject: Array.from(new Uint8Array(credential.response.attestationObject))
                    }
                })
            });
            
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
                showToast('Passkey 添加成功', 'success');
                await loadPasskeyStatus();
            } else {
                showToast(verifyData.message || '验证失败', 'error');
            }
        } catch (error) {
            showToast('添加失败：' + error.message, 'error');
        }
    }
}

// ============================================================================
// 2FA 管理
// ============================================================================

async function load2FAStatus() {
    try {
        const res = await fetch('/api/user/2fa', {
            credentials: 'include',
            headers: {
                'New-Api-User': String(currentUser?.id || '')
            }
        });
        const data = await res.json();
        
        if (data.success && data.data) {
            const enabled = data.data.enabled || false;
            document.getElementById('twoFAStatusText').textContent = enabled ? '已启用' : '未启用';
            const badge = document.getElementById('twoFAStatusBadge');
            badge.textContent = enabled ? '启用' : '禁用';
            badge.className = enabled ? 'status-badge enabled' : 'status-badge disabled';
            
            if (enabled) {
                document.getElementById('twoFABackupCodes').textContent = 
                    `备份码：${data.data.backup_codes_remaining || 0} 个剩余`;
                document.getElementById('twoFAActions').innerHTML = `
                    <button class="btn btn-secondary" onclick="regenerateBackupCodes()">重新生成备份码</button>
                    <button class="btn btn-danger" onclick="disable2FA()">禁用 2FA</button>
                `;
            } else {
                document.getElementById('twoFABackupCodes').textContent = '备份码：--';
                document.getElementById('twoFAActions').innerHTML = `
                    <button class="btn btn-primary" onclick="enable2FA()">启用 2FA</button>
                `;
            }
        }
    } catch (error) {
        console.error('Load 2FA status failed:', error);
    }
}

async function enable2FA() {
    try {
        const res = await fetch('/api/user/2fa/setup', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'New-Api-User': String(currentUser?.id || '')
            }
        });
        const data = await res.json();
        
        if (data.success && data.data) {
            document.getElementById('totpSecret').value = data.data.secret || '';
            document.getElementById('qrCode').innerHTML = `<img src="${data.data.qr_code_data}" alt="QR Code" style="max-width:200px;">`;
            document.getElementById('twoFAModal').classList.remove('hidden');
        } else {
            showToast(data.message || '生成失败', 'error');
        }
    } catch (error) {
        showToast('生成失败', 'error');
    }
}

function close2FAModal() {
    document.getElementById('twoFAModal').classList.add('hidden');
    document.getElementById('totpCode').value = '';
}

async function confirm2FA() {
    const code = document.getElementById('totpCode').value.trim();
    if (!code || code.length !== 6) {
        showToast('请输入6位验证码', 'warning');
        return;
    }
    
    try {
        const res = await fetch('/api/user/2fa/verify', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'New-Api-User': String(currentUser?.id || '')
            },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('2FA 已启用', 'success');
            close2FAModal();
            await load2FAStatus();
        } else {
            showToast(data.message || '验证失败', 'error');
        }
    } catch (error) {
        showToast('验证失败', 'error');
    }
}

async function disable2FA() {
    if (!confirm('确定要禁用双因素认证吗？这会降低账户安全性。')) return;
    
    try {
        const res = await fetch('/api/user/2fa', {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'New-Api-User': String(currentUser?.id || '')
            }
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('2FA 已禁用', 'success');
            await load2FAStatus();
        } else {
            showToast(data.message || '禁用失败', 'error');
        }
    } catch (error) {
        showToast('禁用失败', 'error');
    }
}

async function regenerateBackupCodes() {
    if (!confirm('重新生成备份码会使旧的备份码失效，确定继续吗？')) return;
    
    try {
        const res = await fetch('/api/user/2fa/backup', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'New-Api-User': String(currentUser?.id || '')
            }
        });
        const data = await res.json();
        
        if (data.success && data.data && data.data.backup_codes) {
            const codes = data.data.backup_codes.join('\n');
            alert('备份码已重新生成（请妥善保存）：\n\n' + codes);
            await load2FAStatus();
        } else {
            showToast(data.message || '生成失败', 'error');
        }
    } catch (error) {
        showToast('生成失败', 'error');
    }
}

// ============================================================================
// 删除账户
// ============================================================================

async function deleteAccount() {
    const confirm1 = confirm('警告：此操作不可撤销！确定要永久删除您的账户吗？');
    if (!confirm1) return;
    
    const confirm2 = confirm('最后确认：删除账户将永久删除所有数据，包括余额、令牌、使用记录等。真的要继续吗？');
    if (!confirm2) return;
    
    const res = await API.deleteAccount();
    if (res.success) {
        showToast('账户已删除', 'success');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
    } else {
        showToast(res.message || '删除失败', 'error');
    }
}

// ============================================================================
// 账户绑定
// ============================================================================

async function loadBindings() {
    if (!currentUser) return;
    
    const bindingsList = document.getElementById('bindingsList');
    if (!bindingsList) return;
    
    // 获取系统状态
    const statusRes = await API.getStatus();
    const status = statusRes.success ? statusRes.data : {};
    
    const bindings = [
        {
            id: 'email',
            name: '邮箱',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>',
            value: currentUser.email,
            bound: !!currentUser.email,
            enabled: true
        },
        {
            id: 'wechat',
            name: '微信',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 3c-4.97 0-9 3.13-9 7 0 2.19 1.14 4.16 2.96 5.5L5 20l4.39-2.18c.87.22 1.78.34 2.61.34 4.97 0 9-3.13 9-7s-4.03-7-9-7z"/></svg>',
            value: currentUser.wechat_id,
            bound: !!currentUser.wechat_id,
            enabled: status.wechat_login || false
        },
        {
            id: 'github',
            name: 'GitHub',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>',
            value: currentUser.github_id,
            bound: !!currentUser.github_id,
            enabled: status.github_oauth || false
        },
        {
            id: 'discord',
            name: 'Discord',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
            value: currentUser.discord_id,
            bound: !!currentUser.discord_id,
            enabled: status.discord_oauth || false
        },
        {
            id: 'telegram',
            name: 'Telegram',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>',
            value: currentUser.telegram_id,
            bound: !!currentUser.telegram_id,
            enabled: status.telegram_oauth || false
        },
        {
            id: 'linuxdo',
            name: 'LinuxDO',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
            value: currentUser.linux_do_id,
            bound: !!currentUser.linux_do_id,
            enabled: status.linuxdo_oauth || false
        },
        {
            id: 'oidc',
            name: 'OIDC',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
            value: currentUser.oidc_id,
            bound: !!currentUser.oidc_id,
            enabled: status.oidc_enabled || false
        }
    ];
    
    const html = bindings.filter(b => b.enabled).map(binding => `
        <div class="binding-item">
            <div class="binding-left">
                <div class="binding-icon">${binding.icon}</div>
                <div class="binding-info">
                    <h4>
                        ${binding.name}
                        ${binding.bound ? '<span class="binding-status">已绑定</span>' : '<span class="binding-status unbound">未绑定</span>'}
                    </h4>
                    <p>${binding.value || '未绑定'}</p>
                </div>
            </div>
            <button class="btn-bind" onclick="handleBind('${binding.id}')" ${binding.bound && binding.id !== 'email' ? 'disabled' : ''}>
                ${binding.bound ? (binding.id === 'email' ? '修改' : '已绑定') : '绑定'}
            </button>
        </div>
    `).join('');
    
    bindingsList.innerHTML = html;
}

function handleBind(type) {
    if (type === 'email') {
        document.getElementById('emailBindModal').classList.remove('hidden');
    } else {
        // OAuth 绑定通过重定向
        const redirectUrl = `${window.location.origin}/oauth/${type}?bind=true`;
        window.location.href = `/api/oauth/${type}?redirect=${encodeURIComponent(redirectUrl)}`;
    }
}

function closeEmailBindModal() {
    document.getElementById('emailBindModal').classList.add('hidden');
}

let emailCodeSending = false;
async function sendEmailCode() {
    if (emailCodeSending) return;
    
    const email = document.getElementById('bindEmailInput').value.trim();
    if (!email) {
        showToast('请输入邮箱地址', 'warning');
        return;
    }
    
    emailCodeSending = true;
    const btn = document.getElementById('sendEmailCodeBtn');
    btn.disabled = true;
    btn.textContent = '发送中...';
    
    try {
        const res = await fetch(`/api/verification?email=${encodeURIComponent(email)}`, {
            credentials: 'include'
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('验证码已发送', 'success');
            // 倒计时
            let countdown = 60;
            const timer = setInterval(() => {
                countdown--;
                btn.textContent = `${countdown}秒后重试`;
                if (countdown <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.textContent = '发送验证码';
                    emailCodeSending = false;
                }
            }, 1000);
        } else {
            showToast(data.message || '发送失败', 'error');
            btn.disabled = false;
            btn.textContent = '发送验证码';
            emailCodeSending = false;
        }
    } catch (error) {
        showToast('发送失败', 'error');
        btn.disabled = false;
        btn.textContent = '发送验证码';
        emailCodeSending = false;
    }
}

async function confirmEmailBind() {
    const email = document.getElementById('bindEmailInput').value.trim();
    const code = document.getElementById('bindEmailCode').value.trim();
    
    if (!email || !code) {
        showToast('请填写所有字段', 'warning');
        return;
    }
    
    try {
        const res = await fetch('/api/oauth/email/bind', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'New-Api-User': String(currentUser?.id || '')
            },
            body: JSON.stringify({ email, code })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('邮箱绑定成功', 'success');
            closeEmailBindModal();
            await loadUserData();
        } else {
            showToast(data.message || '绑定失败', 'error');
        }
    } catch (error) {
        showToast('绑定失败', 'error');
    }
}

// ============================================================================
// 通知设置
// ============================================================================

async function loadUserSettings() {
    if (!currentUser || !currentUser.setting) return;
    
    try {
        const settings = typeof currentUser.setting === 'string' 
            ? JSON.parse(currentUser.setting) 
            : currentUser.setting;
        
        currentSettings = settings;
        
        // 设置通知方式
        const notifyType = settings.notify_type || 'email';
        document.querySelectorAll('.notification-method').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-method') === notifyType);
        });
        
        // 设置额度阈值
        document.getElementById('quotaThreshold').value = settings.quota_warning_threshold || 10;
        
        // 设置偏好
        document.getElementById('acceptUnsetModel').checked = settings.accept_unset_model_ratio_model || false;
        document.getElementById('recordIP').checked = settings.record_ip_log || false;
        document.getElementById('upstreamNotify').checked = settings.upstream_model_update_notify_enabled || false;
        
        // 加载通知配置
        updateNotificationConfig(notifyType);
        
        // 通知方式切换
        document.querySelectorAll('.notification-method').forEach(btn => {
            btn.addEventListener('click', () => {
                const method = btn.getAttribute('data-method');
                document.querySelectorAll('.notification-method').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updateNotificationConfig(method);
            });
        });
    } catch (error) {
        console.error('Parse settings failed:', error);
    }
}

function updateNotificationConfig(method) {
    const configDiv = document.getElementById('notificationConfig');
    if (!configDiv) return;
    
    let html = '';
    
    if (method === 'email') {
        html = `
            <div class="form-group">
                <label class="form-label">通知邮箱</label>
                <input type="email" class="form-input" id="notificationEmail" 
                    placeholder="留空则使用账户邮箱" value="${currentSettings.notification_email || ''}">
            </div>
        `;
    } else if (method === 'webhook') {
        html = `
            <div class="form-group">
                <label class="form-label">Webhook URL</label>
                <input type="url" class="form-input" id="webhookUrl" 
                    placeholder="https://example.com/webhook" value="${currentSettings.webhook_url || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Webhook Secret</label>
                <input type="password" class="form-input" id="webhookSecret" 
                    placeholder="可选的密钥" value="${currentSettings.webhook_secret || ''}">
            </div>
        `;
    } else if (method === 'bark') {
        html = `
            <div class="form-group">
                <label class="form-label">Bark Push URL</label>
                <input type="url" class="form-input" id="barkUrl" 
                    placeholder="https://api.day.app/yourkey/{{title}}/{{content}}" value="${currentSettings.bark_url || ''}">
                <p class="form-hint">模板变量：{{title}}, {{content}}</p>
            </div>
        `;
    } else if (method === 'gotify') {
        html = `
            <div class="form-group">
                <label class="form-label">Gotify 服务器 URL</label>
                <input type="url" class="form-input" id="gotifyUrl" 
                    placeholder="https://gotify.example.com" value="${currentSettings.gotify_url || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Gotify 应用令牌</label>
                <input type="password" class="form-input" id="gotifyToken" 
                    placeholder="输入应用令牌" value="${currentSettings.gotify_token || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">消息优先级 (0-10)</label>
                <input type="number" class="form-input" id="gotifyPriority" 
                    min="0" max="10" value="${currentSettings.gotify_priority || 5}">
            </div>
        `;
    }
    
    configDiv.innerHTML = html;
}

async function saveNotificationSettings() {
    const method = document.querySelector('.notification-method.active')?.getAttribute('data-method') || 'email';
    const threshold = document.getElementById('quotaThreshold').value;
    
    const settings = {
        notify_type: method,
        quota_warning_threshold: Number(threshold),
        accept_unset_model_ratio_model: document.getElementById('acceptUnsetModel').checked,
        record_ip_log: document.getElementById('recordIP').checked,
        upstream_model_update_notify_enabled: document.getElementById('upstreamNotify').checked
    };
    
    // 根据通知方式添加配置
    if (method === 'email') {
        settings.notification_email = document.getElementById('notificationEmail')?.value || '';
    } else if (method === 'webhook') {
        settings.webhook_url = document.getElementById('webhookUrl')?.value || '';
        settings.webhook_secret = document.getElementById('webhookSecret')?.value || '';
    } else if (method === 'bark') {
        settings.bark_url = document.getElementById('barkUrl')?.value || '';
    } else if (method === 'gotify') {
        settings.gotify_url = document.getElementById('gotifyUrl')?.value || '';
        settings.gotify_token = document.getElementById('gotifyToken')?.value || '';
        settings.gotify_priority = Number(document.getElementById('gotifyPriority')?.value || 5);
    }
    
    try {
        const res = await fetch('/api/user/setting', {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'New-Api-User': String(currentUser?.id || '')
            },
            body: JSON.stringify(settings)
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('设置已保存', 'success');
            await loadUserData();
        } else {
            showToast(data.message || '保存失败', 'error');
        }
    } catch (error) {
        showToast('保存失败', 'error');
    }
}

// ============================================================================
// 侧边栏模块配置
// ============================================================================

async function loadSidebarModules() {
    if (!currentUser) return;
    
    try {
        const raw = currentUser.sidebar_modules;
        const config = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
        
        sidebarModulesConfig = config;
        renderSidebarModules();
    } catch (error) {
        console.error('Parse sidebar modules failed:', error);
        sidebarModulesConfig = {};
        renderSidebarModules();
    }
}

function renderSidebarModules() {
    const container = document.getElementById('sidebarModules');
    if (!container) return;
    
    const sections = [
        {
            key: 'chat',
            title: '聊天区域',
            desc: 'Playground 和聊天功能',
            modules: [
                { key: 'playground', name: 'Playground', desc: 'AI 模型测试环境' },
                { key: 'chat', name: '聊天', desc: '聊天会话管理' }
            ]
        },
        {
            key: 'console',
            title: '控制台区域',
            desc: '数据管理和日志查看',
            modules: [
                { key: 'detail', name: '数据看板', desc: '系统数据统计' },
                { key: 'token', name: '令牌管理', desc: 'API 令牌管理' },
                { key: 'log', name: '使用日志', desc: 'API 使用记录' },
                { key: 'midjourney', name: '绘图日志', desc: '绘图任务记录' },
                { key: 'task', name: '任务日志', desc: '系统任务记录' }
            ]
        },
        {
            key: 'personal',
            title: '个人中心区域',
            desc: '用户个人功能',
            modules: [
                { key: 'topup', name: '钱包管理', desc: '余额和充值管理' },
                { key: 'personal', name: '个人设置', desc: '个人信息设置' }
            ]
        }
    ];
    
    // 初始化默认配置
    sections.forEach(sec => {
        if (!sidebarModulesConfig[sec.key]) {
            sidebarModulesConfig[sec.key] = { enabled: true };
        }
        sec.modules.forEach(mod => {
            if (sidebarModulesConfig[sec.key][mod.key] === undefined) {
                sidebarModulesConfig[sec.key][mod.key] = true;
            }
        });
    });
    
    const html = sections.map(section => `
        <div class="sidebar-section">
            <div class="sidebar-section-header">
                <div>
                    <div class="sidebar-section-title">${section.title}</div>
                    <div class="sidebar-section-desc">${section.desc}</div>
                </div>
                <label class="form-switch">
                    <input type="checkbox" class="switch-input" 
                        data-section="${section.key}" 
                        ${sidebarModulesConfig[section.key]?.enabled !== false ? 'checked' : ''}>
                    <span class="switch-track"></span>
                </label>
            </div>
            <div class="sidebar-modules-list">
                ${section.modules.map(mod => `
                    <div class="sidebar-module-item">
                        <div class="sidebar-module-info">
                            <div class="sidebar-module-name">${mod.name}</div>
                            <div class="sidebar-module-desc">${mod.desc}</div>
                        </div>
                        <label class="form-switch">
                            <input type="checkbox" class="switch-input" 
                                data-section="${section.key}" 
                                data-module="${mod.key}"
                                ${sidebarModulesConfig[section.key]?.[mod.key] !== false ? 'checked' : ''}
                                ${sidebarModulesConfig[section.key]?.enabled === false ? 'disabled' : ''}>
                            <span class="switch-track"></span>
                        </label>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
    
    // 绑定事件
    container.querySelectorAll('input[data-section]').forEach(input => {
        input.addEventListener('change', (e) => {
            const section = e.target.getAttribute('data-section');
            const module = e.target.getAttribute('data-module');
            
            if (module) {
                sidebarModulesConfig[section][module] = e.target.checked;
            } else {
                sidebarModulesConfig[section].enabled = e.target.checked;
                // 更新该分组下所有模块的禁用状态
                container.querySelectorAll(`input[data-section="${section}"][data-module]`).forEach(modInput => {
                    modInput.disabled = !e.target.checked;
                });
            }
        });
    });
}

function resetSidebarModules() {
    if (!confirm('确定要重置为默认配置吗？')) return;
    
    sidebarModulesConfig = {};
    renderSidebarModules();
    showToast('已重置为默认配置', 'info');
}

async function saveSidebarModules() {
    try {
        const res = await API.updateUser({
            sidebar_modules: JSON.stringify(sidebarModulesConfig)
        });
        
        if (res.success) {
            showToast('侧边栏设置已保存', 'success');
            // 刷新侧边栏
            renderSidebar('profile');
        } else {
            showToast(res.message || '保存失败', 'error');
        }
    } catch (error) {
        showToast('保存失败', 'error');
    }
}

// ============================================================================
// 签到功能
// ============================================================================

async function loadCheckinStatus() {
    try {
        const res = await fetch('/api/user/checkin?month=' + new Date().toISOString().slice(0, 7), {
            credentials: 'include',
            headers: {
                'New-Api-User': String(currentUser?.id || '')
            }
        });
        const data = await res.json();
        
        if (data.success && data.data && data.data.stats) {
            const stats = data.data.stats;
            document.getElementById('checkinStreak').textContent = stats.total_checkins || 0;
            document.getElementById('checkinMonth').textContent = stats.checkin_count || 0;
            
            if (stats.checked_in_today) {
                document.getElementById('checkinBadge').style.display = 'inline-block';
                const btn = document.getElementById('checkinBtn');
                btn.disabled = true;
                btn.textContent = '今日已签到';
            }
            
            renderCheckinCalendar(stats.records || []);
        }
    } catch (error) {
        console.error('Load checkin status failed:', error);
    }
}

function renderCheckinCalendar(records) {
    const calendar = document.getElementById('checkinCalendar');
    if (!calendar) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const checkedDates = new Set(records.map(r => r.checkin_date));
    
    let html = '<div class="checkin-calendar">';
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isChecked = checkedDates.has(dateStr);
        html += `<div class="checkin-day ${isChecked ? 'checked' : ''}">${day}</div>`;
    }
    html += '</div>';
    
    calendar.innerHTML = html;
}

async function doCheckin() {
    try {
        const res = await fetch('/api/user/checkin', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'New-Api-User': String(currentUser?.id || '')
            }
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('签到成功！' + (data.message || ''), 'success');
            await loadCheckinStatus();
            await loadUserData();
        } else {
            showToast(data.message || '签到失败', 'error');
        }
    } catch (error) {
        showToast('签到失败', 'error');
    }
}

// ============================================================================
// 兑换码
// ============================================================================

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
