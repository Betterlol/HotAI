// 控制台页面逻辑
document.addEventListener('DOMContentLoaded', async () => {
    // ========== 初始化状态 ==========
    let sidebarCollapsed = false;
    let currentChartTab = 'consumption-distribution';

    // ========== DOM 元素引用 ==========
    const welcomeHeader = document.querySelector('.welcome-header');
    const sidebarToggle = document.querySelector('.sidebar-bottom .menu-item');
    const sidebar = document.querySelector('.sidebar');
    const chartTabs = document.querySelectorAll('.chart-tab');
    const userTrigger = document.querySelector('.user-trigger');
    const userDropdown = document.querySelector('.user-dropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    // 统计卡片值元素
    const statElements = {
        balance: document.getElementById('statBalance'),
        usedQuota: document.getElementById('statUsedQuota'),
        requestCount: document.getElementById('statRequestCount'),
        statCount: document.getElementById('statStatCount'),
        statQuota: document.getElementById('statStatQuota'),
        statTokens: document.getElementById('statStatTokens'),
        avgRPM: document.getElementById('statAvgRPM'),
        avgTPM: document.getElementById('statAvgTPM')
    };

    // ========== 加载用户信息 ==========
    async function loadUserInfo() {
        try {
            const result = await API.getUserInfo();
            if (result.success && result.data) {
                const user = result.data;
                
                // 更新欢迎语
                if (welcomeHeader) {
                    const hour = new Date().getHours();
                    let greeting = '早上好';
                    if (hour >= 12 && hour < 18) greeting = '下午好';
                    else if (hour >= 18) greeting = '晚上好';
                    
                    welcomeHeader.innerHTML = `👋 ${greeting}，${user.username || 'admin'}`;
                }
                
                // 更新侧边栏用户信息
                const sidebarUserName = document.querySelector('.sidebar-bottom .menu-item span:not(.user-avatar)');
                if (sidebarUserName) {
                    sidebarUserName.textContent = user.username || 'User';
                }
                
                const sidebarAvatar = document.querySelector('.user-avatar');
                if (sidebarAvatar && user.username) {
                    sidebarAvatar.textContent = user.username.charAt(0).toUpperCase();
                }

                // 更新顶部用户头像
                const topAvatar = document.querySelector('.user-avatar-top');
                if (topAvatar && user.username) {
                    topAvatar.textContent = user.username.charAt(0).toUpperCase();
                }

                const topUsername = document.getElementById('topUsername');
                if (topUsername) {
                    topUsername.textContent = user.username || 'User';
                }
                
                return user;
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
        return null;
    }

    // ========== 加载统计数据 ==========
    async function loadDashboardStats() {
        try {
            const user = await API.getUserInfo();
            if (user.success && user.data) {
                const userData = user.data;
                
                // 更新账户数据
                if (statElements.balance) {
                    const balance = (userData.quota || 0) / 500000;
                    statElements.balance.textContent = `$${balance.toFixed(2)}`;
                }
                
                if (statElements.usedQuota) {
                    const used = (userData.used_quota || 0) / 500000;
                    statElements.usedQuota.textContent = `$${used.toFixed(2)}`;
                }
                
                // 更新使用统计
                if (statElements.requestCount) {
                    statElements.requestCount.textContent = userData.request_count || 0;
                }
                
                if (statElements.statCount) {
                    statElements.statCount.textContent = userData.request_count || 0;
                }
                
                // 更新资源消耗
                if (statElements.statQuota) {
                    const quota = (userData.used_quota || 0) / 500000;
                    statElements.statQuota.textContent = `$${quota.toFixed(2)}`;
                }
                
                // Token 统计需要从日志获取，这里先显示为0
                if (statElements.statTokens) {
                    statElements.statTokens.textContent = '0';
                }
                
                // 性能指标（需要额外API，暂时显示计算值）
                if (statElements.avgRPM) {
                    statElements.avgRPM.textContent = '0.000';
                }
                
                if (statElements.avgTPM) {
                    statElements.avgTPM.textContent = '0';
                }
            }
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    // ========== 加载 API 信息 ==========
    async function loadApiInfo() {
        try {
            const result = await API.getStatus();
            if (result.success && result.data) {
                const apiInfoArea = document.querySelector('.api-info-area');
                if (!apiInfoArea) return;

                // 如果有 API 信息，显示列表
                if (result.data.api_url) {
                    apiInfoArea.innerHTML = `
                        <div class="api-info-list">
                            <div class="api-info-item">
                                <div class="api-info-item-label">API 端点</div>
                                <div class="api-info-item-value">${result.data.api_url}</div>
                            </div>
                            ${result.data.home_page_content ? `
                            <div class="api-info-item">
                                <div class="api-info-item-label">主页内容</div>
                                <div class="api-info-item-value">${result.data.home_page_content}</div>
                            </div>
                            ` : ''}
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Failed to load API info:', error);
        }
    }

    // ========== 侧边栏折叠切换 ==========
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarCollapsed = !sidebarCollapsed;
            
            if (sidebarCollapsed) {
                sidebar.classList.add('collapsed');
                sidebarToggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9.41 7.41L14 12l-4.59 4.59L8 15.17 11.17 12 8 8.83z"/></svg> 展开侧边栏';
            } else {
                sidebar.classList.remove('collapsed');
                sidebarToggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg> 收起侧边栏';
            }
        });
    }

    // ========== 图表选项卡切换 ==========
    chartTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有 active 状态
            chartTabs.forEach(t => t.classList.remove('active'));
            // 添加当前 active 状态
            tab.classList.add('active');
            
            // 更新当前选项卡
            currentChartTab = tab.dataset.chart || 'consumption-distribution';
            
            // 更新图表显示（实际项目中这里会调用图表更新函数）
            updateChartDisplay(currentChartTab);
        });
    });

    // ========== 更新图表显示 ==========
    function updateChartDisplay(chartType) {
        const chartPlaceholderText = document.querySelector('.chart-placeholder-text');
        const chartPlaceholderSub = document.querySelector('.chart-placeholder-sub');
        
        if (!chartPlaceholderText || !chartPlaceholderSub) return;
        
        switch (chartType) {
            case 'consumption-distribution':
                chartPlaceholderText.textContent = '模型消耗分布';
                chartPlaceholderSub.textContent = '总计：$0.00';
                break;
            case 'consumption-trend':
                chartPlaceholderText.textContent = '消耗趋势';
                chartPlaceholderSub.textContent = '时间范围：最近7天';
                break;
            case 'call-distribution':
                chartPlaceholderText.textContent = '调用次数分布';
                chartPlaceholderSub.textContent = '总计：0 次调用';
                break;
            case 'call-ranking':
                chartPlaceholderText.textContent = '调用次数排行';
                chartPlaceholderSub.textContent = 'Top 10 模型';
                break;
        }
    }

    // ========== 用户下拉菜单 ==========
    if (userTrigger && userDropdown) {
        userTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });

        // 点击其他地方关闭下拉菜单
        document.addEventListener('click', () => {
            if (!userDropdown.classList.contains('hidden')) {
                userDropdown.classList.add('hidden');
            }
        });

        userDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // ========== 退出登录 ==========
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('确定要退出登录吗？')) {
                await Auth.logout();
            }
        });
    }

    // ========== 页面加载时初始化 ==========
    await loadUserInfo();
    await loadDashboardStats();
    await loadApiInfo();

    // 定期刷新统计数据（每30秒）
    setInterval(() => {
        loadDashboardStats();
    }, 30000);
});