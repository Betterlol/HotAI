// 个人中心页面交互逻辑
const ProfilePage = {
    currentUser: null,
    currentPanel: 'profile',
    avatarFile: null,

    // 初始化
    async init() {
        // 加载用户数据
        await this.loadUserData();
        
        // 绑定菜单切换事件
        this.bindMenuEvents();
        
        // 绑定表单提交事件
        this.bindFormEvents();
        
        // 显示默认面板
        this.switchPanel('profile');
    },

    // 加载用户数据
    async loadUserData() {
        try {
            const result = await API.getUserInfo();
            if (result.success && result.data) {
                this.currentUser = result.data;
                this.updateUI();
            } else {
                console.error('Failed to load user data');
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    },

    // 更新UI显示
    updateUI() {
        if (!this.currentUser) return;

        const user = this.currentUser;
        
        // 更新概览卡片
        const avatarLarge = document.getElementById('avatarLarge');
        const usernameDisplay = document.getElementById('usernameDisplay');
        const emailDisplay = document.getElementById('emailDisplay');
        const balanceDisplay = document.getElementById('balanceDisplay');
        const quotaDisplay = document.getElementById('quotaDisplay');
        const registerDateDisplay = document.getElementById('registerDateDisplay');

        if (avatarLarge) {
            const initial = (user.username || user.display_name || 'U').charAt(0).toUpperCase();
            avatarLarge.textContent = initial;
        }
        if (usernameDisplay) usernameDisplay.textContent = user.username || user.display_name || '未设置';
        if (emailDisplay) emailDisplay.textContent = user.email || '未绑定';
        if (balanceDisplay) balanceDisplay.textContent = `$${(user.quota || 0).toFixed(2)}`;
        if (quotaDisplay) quotaDisplay.textContent = user.request_count || 0;
        
        if (registerDateDisplay && user.created_time) {
            const date = new Date(user.created_time * 1000);
            registerDateDisplay.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月`;
        }

        // 更新编辑表单
        const avatarMedium = document.getElementById('avatarMedium');
        const usernameInput = document.getElementById('usernameInput');
        const emailBindDisplay = document.getElementById('emailBindDisplay');

        if (avatarMedium) {
            const initial = (user.username || user.display_name || 'U').charAt(0).toUpperCase();
            avatarMedium.textContent = initial;
        }
        if (usernameInput) usernameInput.value = user.display_name || user.username || '';
        if (emailBindDisplay) emailBindDisplay.textContent = user.email || '未绑定';
    },

    // 绑定菜单切换事件
    bindMenuEvents() {
        const menuItems = document.querySelectorAll('.profile-menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.dataset.target;
                if (target) {
                    this.switchPanel(target);
                }
            });
        });
    },

    // 切换面板
    switchPanel(panelName) {
        this.currentPanel = panelName;
        
        // 更新菜单激活状态
        document.querySelectorAll('.profile-menu-item').forEach(item => {
            if (item.dataset.target === panelName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // 更新面板显示
        document.querySelectorAll('.content-panel').forEach(panel => {
            if (panel.id === `panel-${panelName}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    },

    // 绑定表单事件
    bindFormEvents() {
        // 头像上传
        const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
        const avatarFileInput = document.getElementById('avatarFileInput');
        if (uploadAvatarBtn && avatarFileInput) {
            uploadAvatarBtn.addEventListener('click', () => {
                avatarFileInput.click();
            });
            
            avatarFileInput.addEventListener('change', (e) => {
                this.handleAvatarSelect(e.target.files[0]);
            });
        }

        // 保存头像
        const saveAvatarBtn = document.getElementById('saveAvatarBtn');
        if (saveAvatarBtn) {
            saveAvatarBtn.addEventListener('click', () => {
                this.saveAvatar();
            });
        }

        // 删除头像
        const deleteAvatarBtn = document.getElementById('deleteAvatarBtn');
        if (deleteAvatarBtn) {
            deleteAvatarBtn.addEventListener('click', () => {
                this.deleteAvatar();
            });
        }

        // 更新用户资料
        const updateProfileBtn = document.getElementById('updateProfileBtn');
        if (updateProfileBtn) {
            updateProfileBtn.addEventListener('click', () => {
                this.updateProfile();
            });
        }

        // 修改密码
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                this.changePassword();
            });
        }

        // 管理邮箱（占位）
        const manageEmailBtn = document.getElementById('manageEmailBtn');
        if (manageEmailBtn) {
            manageEmailBtn.addEventListener('click', () => {
                this.showMessage('邮箱管理功能开发中...', 'error');
            });
        }
    },

    // 处理头像选择
    handleAvatarSelect(file) {
        if (!file) return;
        
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            this.showMessage('请选择图片文件', 'error');
            return;
        }
        
        // 验证文件大小 (20KB)
        if (file.size > 20 * 1024) {
            this.showMessage('图片大小不能超过 20KB，请压缩后上传', 'error');
            return;
        }
        
        this.avatarFile = file;
        
        // 预览
        const reader = new FileReader();
        reader.onload = (e) => {
            const avatarMedium = document.getElementById('avatarMedium');
            if (avatarMedium) {
                avatarMedium.innerHTML = `<img src="${e.target.result}" alt="头像预览">`;
            }
        };
        reader.readAsDataURL(file);
        
        this.showMessage('头像已选择，点击"保存"按钮上传', 'success');
    },

    // 保存头像
    async saveAvatar() {
        if (!this.avatarFile) {
            this.showMessage('请先选择头像图片', 'error');
            return;
        }
        
        // TODO: 实现头像上传API
        this.showMessage('头像上传功能开发中...', 'error');
    },

    // 删除头像
    async deleteAvatar() {
        if (!confirm('确定要删除头像吗？')) return;
        
        // TODO: 实现头像删除API
        this.showMessage('头像删除功能开发中...', 'error');
    },

    // 更新用户资料
    async updateProfile() {
        const usernameInput = document.getElementById('usernameInput');
        if (!usernameInput) return;
        
        const displayName = usernameInput.value.trim();
        if (!displayName) {
            this.showMessage('用户名不能为空', 'error');
            return;
        }
        
        try {
            const result = await API.updateUser({ display_name: displayName });
            if (result.success) {
                this.showMessage('资料更新成功', 'success');
                await this.loadUserData();
            } else {
                this.showMessage(result.message || '更新失败', 'error');
            }
        } catch (error) {
            this.showMessage(error.message || '网络错误', 'error');
        }
    },

    // 修改密码
    async changePassword() {
        const currentPassword = document.getElementById('currentPassword')?.value;
        const newPassword = document.getElementById('newPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showMessage('请填写所有密码字段', 'error');
            return;
        }
        
        if (newPassword.length < 8) {
            this.showMessage('新密码至少需要 8 个字符', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showMessage('两次输入的新密码不一致', 'error');
            return;
        }
        
        // TODO: 实现密码修改API
        this.showMessage('密码修改功能开发中...', 'error');
    },

    // 显示消息
    showMessage(text, type = 'success') {
        // 移除旧消息
        const oldMessage = document.querySelector('.message');
        if (oldMessage) {
            oldMessage.remove();
        }
        
        // 创建新消息
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        
        // 插入到当前面板顶部
        const activePanel = document.querySelector('.content-panel.active');
        if (activePanel) {
            activePanel.insertBefore(message, activePanel.firstChild);
            
            // 3秒后自动消失
            setTimeout(() => {
                message.remove();
            }, 3000);
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    ProfilePage.init();
});
