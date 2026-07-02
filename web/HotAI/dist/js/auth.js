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
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            // 即使失败也清除本地数据
            localStorage.removeItem('user');
            window.location.href = 'index.html';
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
            window.location.href = `login.html?redirect=${encodeURIComponent(currentPath)}`;
            return false;
        }
        return true;
    }
};

// 初始化导航栏用户菜单
function initNavbarUserMenu() {
    const navLoginBtn = document.getElementById('navLoginBtn');
    const navSignupBtn = document.getElementById('navSignupBtn');
    const navUserMenu = document.getElementById('navUserMenu');
    const navUserAvatar = document.getElementById('navUserAvatar');
    const navUsername = document.getElementById('navUsername');
    const navUserDropdown = document.getElementById('navUserDropdown');
    const navLogoutBtn = document.getElementById('navLogoutBtn');
    
    // 如果页面没有这些元素，直接返回
    if (!navLoginBtn || !navUserMenu) return;
    
    // 检查登录状态并更新UI
    Auth.checkAuth().then(isAuth => {
        if (isAuth) {
            // 已登录：隐藏登录/注册按钮，显示用户菜单
            navLoginBtn.classList.add('hidden');
            navSignupBtn.classList.add('hidden');
            navUserMenu.classList.remove('hidden');
            
            // 获取用户信息并更新显示
            const user = Auth.getCurrentUser();
            if (user && user.username) {
                if (navUsername) navUsername.textContent = user.username;
                if (navUserAvatar) navUserAvatar.textContent = user.username.charAt(0).toUpperCase();
            }
        } else {
            // 未登录：显示登录/注册按钮，隐藏用户菜单
            navLoginBtn.classList.remove('hidden');
            navSignupBtn.classList.remove('hidden');
            navUserMenu.classList.add('hidden');
        }
    });
    
    // 用户菜单下拉交互（优化：增加延迟，便于点击）
    if (navUserMenu && navUserDropdown) {
        let hideTimeout;
        
        const userTrigger = navUserMenu.querySelector('.user-trigger');
        if (userTrigger) {
            // 鼠标移入显示下拉菜单
            navUserMenu.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
                navUserDropdown.classList.add('show');
            });
            
            // 鼠标移出隐藏下拉菜单（延迟300ms）
            navUserMenu.addEventListener('mouseleave', () => {
                hideTimeout = setTimeout(() => {
                    navUserDropdown.classList.remove('show');
                }, 300);
            });
            
            // 鼠标移入下拉菜单时取消隐藏
            navUserDropdown.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
            });
            
            // 鼠标移出下拉菜单时隐藏（延迟300ms）
            navUserDropdown.addEventListener('mouseleave', () => {
                hideTimeout = setTimeout(() => {
                    navUserDropdown.classList.remove('show');
                }, 300);
            });
        }
    }
    
    // 退出登录按钮
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
    }
}

// 页面加载时自动检查认证状态（排除登录/注册页）
document.addEventListener('DOMContentLoaded', async () => {
    const currentPage = window.location.pathname;
    const publicPages = ['/', '/index.html', '/model.html', '/login.html', '/register.html', '/reset.html', '/console.html', '/docs.html', '/profile.html'];
    const protectedPages = [];
    
    // 初始化导航栏用户菜单
    initNavbarUserMenu();
    
    // 如果是公开页面，不需要验证
    const isPublicPage = publicPages.some(page => currentPage.endsWith(page));
    const isProtectedPage = protectedPages.some(page => currentPage.endsWith(page));
    
    if (!isPublicPage || isProtectedPage) {
        const isAuth = await Auth.checkAuth();
        if (!isAuth) {
            window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
        } else {
            // 加载用户信息到页面
            try {
                const result = await API.getUserInfo();
                if (result.success && result.data) {
                    localStorage.setItem('user', JSON.stringify(result.data));
                    // 刷新导航栏用户信息
                    initNavbarUserMenu();
                }
            } catch (error) {
                console.error('Failed to load user info:', error);
            }
        }
    }
});
