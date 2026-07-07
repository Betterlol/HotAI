// 排行榜页面逻辑
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化侧边栏
    renderSidebar('rankings');

    // 工具函数
    function showToast(msg, type = 'info') {
        const c = document.getElementById('toastContainer');
        if (!c) return;
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.textContent = msg;
        c.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    function quotaToDisplay(quota) {
        if (quota === undefined || quota === null) return '--';
        return '$' + (quota / 500000).toFixed(4);
    }

    function formatNumber(n) {
        if (n === undefined || n === null) return '--';
        return Number(n).toLocaleString();
    }

    // 加载排行榜数据
    async function loadRankings() {
        const timeRange = document.getElementById('timeRange').value;
        const rankingType = document.getElementById('rankingType').value;
        const topLimit = document.getElementById('topLimit').value;

        const tbody = document.getElementById('rankingTableBody');
        const totalEl = document.getElementById('rankingTotal');

        // 显示加载状态
        tbody.innerHTML = '<tr><td colspan="5"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

        try {
            const endTime = Math.floor(Date.now() / 1000);
            const startTime = endTime - (parseInt(timeRange) * 24 * 3600);

            let data = [];
            
            // 根据排行类型调用不同的 API
            if (rankingType === 'model') {
                // 模型调用排行
                const res = await API.getAllQuotaDates({
                    start_timestamp: startTime,
                    end_timestamp: endTime
                });
                
                if (res.success && res.data) {
                    const modelMap = {};
                    res.data.forEach(item => {
                        const model = item.model_name || '未知';
                        if (!modelMap[model]) {
                            modelMap[model] = { count: 0, quota: 0 };
                        }
                        modelMap[model].count += item.count || 0;
                        modelMap[model].quota += item.quota || 0;
                    });
                    
                    data = Object.entries(modelMap)
                        .map(([name, stats]) => ({ name, ...stats }))
                        .sort((a, b) => b.quota - a.quota)
                        .slice(0, parseInt(topLimit));
                }
            } else if (rankingType === 'user') {
                // 用户消耗排行
                const res = await API.getQuotaDatesByUser({
                    start_timestamp: startTime,
                    end_timestamp: endTime
                });
                
                if (res.success && res.data) {
                    const userMap = {};
                    res.data.forEach(item => {
                        const user = item.username || '未知';
                        if (!userMap[user]) {
                            userMap[user] = { count: 0, quota: 0 };
                        }
                        userMap[user].count += item.count || 0;
                        userMap[user].quota += item.quota || 0;
                    });
                    
                    data = Object.entries(userMap)
                        .map(([name, stats]) => ({ name, ...stats }))
                        .sort((a, b) => b.quota - a.quota)
                        .slice(0, parseInt(topLimit));
                }
            } else if (rankingType === 'token') {
                // 令牌使用排行
                const res = await API.getAllLogs({
                    start_timestamp: startTime,
                    end_timestamp: endTime,
                    p: 0,
                    page_size: 10000
                });
                
                if (res.success && res.data) {
                    const tokenMap = {};
                    res.data.forEach(item => {
                        const token = item.token_name || '未知';
                        if (!tokenMap[token]) {
                            tokenMap[token] = { count: 0, quota: 0 };
                        }
                        tokenMap[token].count += 1;
                        tokenMap[token].quota += item.quota || 0;
                    });
                    
                    data = Object.entries(tokenMap)
                        .map(([name, stats]) => ({ name, ...stats }))
                        .sort((a, b) => b.quota - a.quota)
                        .slice(0, parseInt(topLimit));
                }
            }

            // 计算总计
            const totalQuota = data.reduce((sum, item) => sum + item.quota, 0);
            totalEl.textContent = data.length;

            // 渲染表格
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--c-text-secondary);">暂无数据</td></tr>';
                return;
            }

            tbody.innerHTML = data.map((item, index) => {
                const percentage = totalQuota > 0 ? ((item.quota / totalQuota) * 100).toFixed(2) : '0.00';
                const rankClass = index < 3 ? `rank-${index + 1}` : '';
                
                return `
                    <tr>
                        <td><span class="rank-badge ${rankClass}">${index + 1}</span></td>
                        <td style="font-weight:500;">${item.name}</td>
                        <td>${formatNumber(item.count)}</td>
                        <td style="color:var(--c-primary);font-weight:600;">${quotaToDisplay(item.quota)}</td>
                        <td>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <div style="flex:1;height:8px;background:var(--c-border);border-radius:4px;overflow:hidden;">
                                    <div style="width:${percentage}%;height:100%;background:var(--c-primary);"></div>
                                </div>
                                <span style="min-width:50px;text-align:right;font-size:13px;">${percentage}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error('加载排行榜失败:', error);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--c-text-secondary);">加载失败，请重试</td></tr>';
            showToast('加载排行榜失败', 'error');
        }
    }

    // 绑定事件
    window.loadRankings = loadRankings;

    document.getElementById('refreshBtn')?.addEventListener('click', loadRankings);

    // 初始加载
    await loadRankings();
});