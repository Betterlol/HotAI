// 认证管理
const Auth = {
    // 检查是否已登录
    async checkAuth() {
        try {
            const result = await API.getUserInfo();
            return result.success && result.data;
        } catch (error) {
            return false;
        }
    },
    
    // 登录
    async login(username, password) {
        try {
            const result = await API.login(username, password);
            if (result.success) {
                // 保存用户信息（可选）
                if (result.data) {
                    localStorage.setItem('user', JSON.stringify(result.data));
                }
                return { success: true, data: result.data };
            } else {
                return { success: false, message: result.message || '登录失败' };
            }
        } catch (error) {
            return { success: false, message: error.message || '网络错误' };
        }
    },
    
    // 注册
    async register(username, password, email) {
        try {
            const result = await API.register(username, password, email);
            return result;
        } catch (error) {
            return { success: false, message: error.message || '注册失败' };
        }
    },
    
    // 登出
    async logout() {
        try {
            await API.logout();
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout error:', error);
            // 即使失败也清除本地数据
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        }
    },
    
    // 获取当前用户
    getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },
    
    // 路由守卫 - 在需要登录的页面调用
    async requireAuth() {
        const isAuth = await this.checkAuth();
        if (!isAuth) {
            const currentPath = window.location.pathname;
            window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
            return false;
        }
        return true;
    }
};

// 页面加载时自动检查认证状态（排除登录/注册页）
document.addEventListener('DOMContentLoaded', async () => {
    const currentPage = window.location.pathname;
    const publicPages = ['/login.html', '/register.html', '/reset.html'];
    
    // 如果是公开页面，不需要验证
    const isPublicPage = publicPages.some(page => currentPage.endsWith(page));
    
    if (!isPublicPage) {
        const isAuth = await Auth.checkAuth();
        if (!isAuth) {
            window.location.href = `/login.html?redirect=${encodeURIComponent(currentPage)}`;
        } else {
            // 加载用户信息到页面
            try {
                const result = await API.getUserInfo();
                if (result.success && result.data) {
                    localStorage.setItem('user', JSON.stringify(result.data));
                    // 更新页面上的用户显示
                    const userNameEl = document.querySelector('.sidebar-bottom span');
                    if (userNameEl && result.data.username) {
                        userNameEl.textContent = result.data.username;
                    }
                    const userAvatarEl = document.querySelector('.user-avatar');
                    if (userAvatarEl && result.data.username) {
                        userAvatarEl.textContent = result.data.username.charAt(0).toUpperCase();
                    }
                }
            } catch (error) {
                console.error('Failed to load user info:', error);
            }
        }
    }
});
