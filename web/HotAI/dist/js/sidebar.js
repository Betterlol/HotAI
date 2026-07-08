/**
 * 控制台侧边栏共享组件
 * @param {string} activePage - 当前激活的页面标识
 * @param {Array} customMenuItems - 自定义菜单项（用于 profile 等特殊页面）
 */
function renderSidebar(activePage, customMenuItems = null) {
    const sidebarEl = document.querySelector('.sidebar');
    if (!sidebarEl) return;

    // 如果提供了自定义菜单项，只渲染自定义菜单
    if (customMenuItems && customMenuItems.length > 0) {
        let html = '<div class="menu-group"><div class="menu-group-title">个人设置</div>';
        customMenuItems.forEach(item => {
            html += `<a href="javascript:void(0)" class="menu-item" id="${item.id}" data-panel="${item.id.replace('profile-', '')}">
                ${item.icon}<span>${item.label}</span>
            </a>`;
        });
        html += '</div>';
        sidebarEl.innerHTML = html;

        // 绑定点击事件
        customMenuItems.forEach(item => {
            const el = document.getElementById(item.id);
            if (el && item.onClick) {
                el.addEventListener('click', item.onClick);
            }
        });

        // 默认激活第一项
        if (customMenuItems[0]) {
            document.getElementById(customMenuItems[0].id)?.classList.add('active');
        }
        return;
    }

    // 标准侧边栏
    sidebarEl.innerHTML = `
        <div class="menu-group">
            <div class="menu-group-title">聊天</div>
            <a href="index.html" class="menu-item ${activePage === 'chat' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                <span>聊天</span>
            </a>
        </div>

        <div class="menu-group">
            <div class="menu-group-title">控制台</div>
            <a href="console.html" class="menu-item ${activePage === 'dashboard' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
                <span>数据看板</span>
            </a>
            <a href="rankings.html" class="menu-item ${activePage === 'rankings' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M16 11V3H8v6H2v12h20V11h-6zm-6-6h4v14h-4V5zm-6 6h4v8H4v-8zm16 8h-4v-6h4v6z"/></svg>
                <span>排行榜</span>
            </a>
            <a href="token.html" class="menu-item ${activePage === 'token' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                <span>令牌管理</span>
            </a>
            <a href="log.html" class="menu-item ${activePage === 'log' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                <span>使用日志</span>
            </a>
            <a href="mj-log.html" class="menu-item ${activePage === 'mj-log' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                <span>绘图日志</span>
            </a>
            <a href="task-log.html" class="menu-item ${activePage === 'task-log' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                <span>任务日志</span>
            </a>
        </div>

        <div class="menu-group admin-group" id="adminMenuGroup">
            <div class="menu-group-title">管理员</div>
            <a href="channel.html" class="menu-item admin-only ${activePage === 'channel' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>
                <span>渠道管理</span>
            </a>
            <a href="redemption.html" class="menu-item admin-only ${activePage === 'redemption' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>
                <span>兑换码管理</span>
            </a>
            <a href="user.html" class="menu-item admin-only ${activePage === 'user' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                <span>用户管理</span>
            </a>
            <a href="subscription.html" class="menu-item admin-only ${activePage === 'subscription' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                <span>订阅管理</span>
            </a>
            <a href="setting.html" class="menu-item admin-only ${activePage === 'setting' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L6.16 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
                <span>系统设置</span>
            </a>
        </div>

        <div class="menu-group">
            <div class="menu-group-title">个人中心</div>
            <a href="topup.html" class="menu-item ${activePage === 'topup' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                <span>钱包</span>
            </a>
            <a href="profile.html" class="menu-item ${activePage === 'profile' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                <span>个人设置</span>
            </a>
        </div>

        <div class="sidebar-bottom">
            <div class="toggle-wrapper">
                <button class="sidebar-toggle-btn" id="sidebarToggleBtn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="11 17 6 12 11 7"></polyline>
                        <polyline points="18 17 13 12 18 7"></polyline>
                    </svg>
                    <span>收起侧边栏</span>
                </button>
            </div>
        </div>
    `;

    // 根据用户角色显示/隐藏管理员菜单
    checkAdminAccess();
    
    // 初始化侧边栏折叠功能
    initSidebarToggle();
}

// 初始化侧边栏折叠功能
function initSidebarToggle() {
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebar = document.querySelector('.sidebar');
    
    if (!sidebarToggleBtn || !sidebar) return;
    
    // 从 localStorage 读取侧边栏状态
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
        updateToggleButton(true);
    }
    
    // 绑定点击事件
    sidebarToggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        
        // 保存状态到 localStorage
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        
        // 更新按钮图标
        updateToggleButton(isCollapsed);
        
        // 触发图表重绘（如果存在）
        setTimeout(() => {
            if (window._mainChartInstance) {
                window._mainChartInstance.resize();
            }
            if (window._flowChartInstance) {
                window._flowChartInstance.resize();
            }
        }, 350);
    });
}

// 更新侧边栏折叠按钮的图标
function updateToggleButton(isCollapsed) {
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    if (!sidebarToggleBtn) return;
    
    const svg = sidebarToggleBtn.querySelector('svg');
    if (svg) {
        if (isCollapsed) {
            // 展开图标（向右双箭头）
            svg.innerHTML = '<polyline points="6 17 11 12 6 7"></polyline><polyline points="13 17 18 12 13 7"></polyline>';
        } else {
            // 收起图标（向左双箭头）
            svg.innerHTML = '<polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline>';
        }
    }
}

function checkAdminAccess() {
    const user = Auth ? null : null; // will be updated after API call
    API.getUserInfo().then(result => {
        if (result.success && result.data) {
            const role = result.data.role || 0;
            if (role >= 10) {
                // 管理员或超级管理员
                const adminGroup = document.getElementById('adminMenuGroup');
                if (adminGroup) {
                    adminGroup.classList.add('show');
                    adminGroup.querySelectorAll('.admin-only').forEach(el => {
                        // 系统设置只对超级管理员（role >= 100）显示
                        if (el.href && el.href.includes('setting.html')) {
                            if (role >= 100) {
                                el.classList.add('show');
                            } else {
                                el.style.display = 'none';
                            }
                        } else {
                            el.classList.add('show');
                        }
                    });
                }
            }
        }
    }).catch(() => {});
}
