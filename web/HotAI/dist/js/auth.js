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
            
            // 获取用户信息并更新显示（包括余额）
            API.getUserInfo().then(result => {
                if (result.success && result.data) {
                    const user = result.data;
                    
                    // 更新用户名和头像
                    if (user.username) {
                        if (navUsername) navUsername.textContent = user.username;
                        if (navUserAvatar) navUserAvatar.textContent = user.username.charAt(0).toUpperCase();
                    }
                    
                    // 更新余额显示
                    const navUserBalance = document.getElementById('navUserBalance');
                    if (navUserBalance && typeof user.quota === 'number') {
                        // quota单位转换为美元
                        const balanceUSD = (user.quota / 500000).toFixed(4);
                        navUserBalance.textContent = `余额 $${balanceUSD}`;
                    }
                    
                    // 保存用户信息到本地存储
                    localStorage.setItem('user', JSON.stringify(user));
                } else {
                    // API返回失败，使用缓存的用户信息
                    const user = Auth.getCurrentUser();
                    if (user && user.username) {
                        if (navUsername) navUsername.textContent = user.username;
                        if (navUserAvatar) navUserAvatar.textContent = user.username.charAt(0).toUpperCase();
                        
                        // 显示缓存的余额
                        const navUserBalance = document.getElementById('navUserBalance');
                        if (navUserBalance && typeof user.quota === 'number') {
                            const balanceUSD = (user.quota / 500000).toFixed(4);
                            navUserBalance.textContent = `余额 $${balanceUSD}`;
                        }
                    }
                }
            }).catch(error => {
                console.error('获取用户信息失败:', error);
                // 出错时使用缓存信息
                const user = Auth.getCurrentUser();
                if (user && user.username) {
                    if (navUsername) navUsername.textContent = user.username;
                    if (navUserAvatar) navUserAvatar.textContent = user.username.charAt(0).toUpperCase();
                    
                    const navUserBalance = document.getElementById('navUserBalance');
                    if (navUserBalance) {
                        if (typeof user.quota === 'number') {
                            const balanceUSD = (user.quota / 500000).toFixed(4);
                            navUserBalance.textContent = `余额 $${balanceUSD}`;
                        } else {
                            navUserBalance.textContent = '余额加载失败';
                        }
                    }
                }
            });
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

// ========== 公告功能（所有页面共享） ==========
function initNoticeFeature() {
    const noticeBtn = document.getElementById('noticeBtn');
    const noticeModal = document.getElementById('noticeModal');
    const noticeOverlay = document.getElementById('noticeOverlay');
    const noticeClose = document.getElementById('noticeClose');
    const noticeContent = document.getElementById('noticeContent');
    
    if (!noticeBtn || !noticeModal) return;
    
    // 打开公告弹窗
    noticeBtn.addEventListener('click', async () => {
        noticeModal.style.display = 'flex';
        noticeContent.innerHTML = `<div class="notice-loading">${I18n.t('notice.loading')}</div>`;
        
        try {
            const result = await API.getNotice();
            if (result.success && result.data) {
                // 渲染公告内容
                noticeContent.innerHTML = result.data || `<div class="notice-empty">${I18n.t('notice.no_notice')}</div>`;
            } else {
                noticeContent.innerHTML = `<div class="notice-empty">${I18n.t('notice.no_notice')}</div>`;
            }
        } catch (error) {
            console.error('获取公告失败:', error);
            noticeContent.innerHTML = `<div class="notice-empty">${I18n.t('notice.load_failed')}</div>`;
        }
    });
    
    // 关闭公告弹窗
    const closeNotice = () => {
        noticeModal.style.display = 'none';
    };
    
    if (noticeClose) noticeClose.addEventListener('click', closeNotice);
    if (noticeOverlay) noticeOverlay.addEventListener('click', closeNotice);
}

// ========== 语言切换功能（所有页面共享） ==========
function initLanguageSelector() {
    const languageBtn = document.getElementById('languageBtn');
    const languageDropdown = document.getElementById('languageDropdown');
    
    if (!languageBtn || !languageDropdown) return;
    
    // 点击语言按钮切换下拉菜单
    languageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        languageDropdown.classList.toggle('show');
        
        // 高亮当前语言
        const currentLang = I18n.getCurrentLang();
        document.querySelectorAll('.language-option').forEach(option => {
            if (option.getAttribute('data-lang') === currentLang) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    });
    
    // 点击语言选项切换语言
    document.querySelectorAll('.language-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const lang = option.getAttribute('data-lang');
            I18n.switchLanguage(lang);
            languageDropdown.classList.remove('show');
        });
    });
    
    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', () => {
        languageDropdown.classList.remove('show');
    });
}

// 页面加载时自动检查认证状态（排除登录/注册页）
document.addEventListener('DOMContentLoaded', async () => {
    const currentPage = window.location.pathname;
    const publicPages = ['/', '/index.html', '/model.html', '/login.html', '/register.html', '/reset.html', '/docs.html'];
    const protectedPages = ['/console.html', '/profile.html'];
    
    // 初始化导航栏用户菜单
    initNavbarUserMenu();
    
    // 初始化公告功能（所有页面共享）
    initNoticeFeature();
    
    // 初始化语言切换功能（所有页面共享）
    initLanguageSelector();
    
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