// 控制台数据看板逻辑
document.addEventListener('DOMContentLoaded', async () => {

    // ========== 工具函数 ==========
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

    function getDefaultTimeRange() {
        const end = new Date();
        const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
        return {
            start: Math.floor(start.getTime() / 1000),
            end: Math.floor(end.getTime() / 1000),
            label: '最近7天'
        };
    }

    function toLocalDatetimeInput(ts) {
        const d = new Date(ts * 1000);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // ========== 状态 ==========
    let currentTab = 'consumption-distribution';
    let chartData = [];
    let userChartData = [];
    let isAdmin = false;
    let filterParams = getDefaultTimeRange();
    let filterUsername = '';

    // ========== 初始化侧边栏 ==========
    renderSidebar('dashboard');

    // ========== 初始化时间筛选器默认值 ==========
    const startInput = document.getElementById('filterStartTime');
    const endInput = document.getElementById('filterEndTime');
    if (startInput) startInput.value = toLocalDatetimeInput(filterParams.start);
    if (endInput) endInput.value = toLocalDatetimeInput(filterParams.end);

    // ========== 欢迎语 ==========
    function updateWelcome(username) {
        const el = document.getElementById('welcomeHeader');
        if (!el) return;
        const h = new Date().getHours();
        let greeting = '早上好';
        if (h >= 12 && h < 14) greeting = '中午好';
        else if (h >= 14 && h < 18) greeting = '下午好';
        else if (h >= 18) greeting = '晚上好';
        el.textContent = `👋 ${greeting}，${username || 'User'}`;
    }

    // ========== 加载用户信息与统计卡片 ==========
    async function loadUserStats() {
        const res = await API.getUserInfo();
        if (!res.success || !res.data) return;
        const user = res.data;

        isAdmin = (user.role || 0) >= 10;
        updateWelcome(user.display_name || user.username);

        document.getElementById('statBalance').textContent = quotaToDisplay(user.quota);
        document.getElementById('statUsedQuota').textContent = quotaToDisplay(user.used_quota);
        document.getElementById('statRequestCount').textContent = formatNumber(user.request_count);

        // 显示管理员选项卡
        if (isAdmin) {
            document.querySelectorAll('.admin-tab').forEach(el => {
                el.classList.remove('hidden');
                el.classList.add('show');
            });
        }

        return user;
    }

    // ========== 加载日志统计数据（tokens / RPM / TPM）==========
    async function loadLogStats() {
        const params = {
            start_timestamp: filterParams.start,
            end_timestamp: filterParams.end,
        };
        const endpoint = isAdmin ? API.getAllLogsStat : API.getUserLogsStat;
        const res = await endpoint(params);
        if (res.success && res.data) {
            const { count, quota, prompt_tokens, completion_tokens } = res.data;
            const totalTokens = (prompt_tokens || 0) + (completion_tokens || 0);
            const timeDiffMin = (filterParams.end - filterParams.start) / 60;

            document.getElementById('statStatCount').textContent = formatNumber(count);
            document.getElementById('statStatQuota').textContent = quotaToDisplay(quota);
            document.getElementById('statStatTokens').textContent = formatNumber(totalTokens);

            const rpm = timeDiffMin > 0 ? (count / timeDiffMin).toFixed(3) : '0.000';
            const tpm = timeDiffMin > 0 ? Math.round(totalTokens / timeDiffMin) : 0;
            document.getElementById('statAvgRPM').textContent = rpm;
            document.getElementById('statAvgTPM').textContent = formatNumber(tpm);
        } else {
            ['statStatCount', 'statStatQuota', 'statStatTokens', 'statAvgRPM', 'statAvgTPM'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '0';
            });
        }
    }

    // ========== 加载图表数据 ==========
    async function loadChartData() {
        const params = {
            start_timestamp: filterParams.start,
            end_timestamp: filterParams.end,
            default_time: 'day',
        };
        if (isAdmin && filterUsername) params.username = filterUsername;

        const endpoint = isAdmin ? API.getAllQuotaDates : API.getUserQuotaDates;
        const res = await endpoint(params);
        if (res.success && res.data) {
            chartData = res.data;
            // 管理员额外加载用户数据
            if (isAdmin) {
                const userRes = await API.getQuotaDatesByUser({
                    start_timestamp: filterParams.start,
                    end_timestamp: filterParams.end,
                });
                if (userRes.success && userRes.data) userChartData = userRes.data;
            }
        } else {
            chartData = [];
        }
        renderChart(currentTab);
    }

    // ========== 渲染图表 ==========
    function renderChart(tab) {
        const loading = document.getElementById('chartLoading');
        const canvas = document.getElementById('mainChart');
        const empty = document.getElementById('chartEmpty');
        const total = document.getElementById('chartTotal');
        const range = document.getElementById('chartTimeRange');

        if (range) range.textContent = filterParams.label || '自定义';

        if (!chartData || chartData.length === 0) {
            if (loading) loading.style.display = 'none';
            if (canvas) canvas.style.display = 'none';
            if (empty) empty.style.display = 'flex';
            if (total) total.textContent = '$0.0000';
            return;
        }

        if (loading) loading.style.display = 'none';
        if (empty) empty.style.display = 'none';
        if (canvas) canvas.style.display = 'block';

        // 计算总计
        const totalQuota = chartData.reduce((sum, d) => sum + (d.quota || 0), 0);
        if (total) total.textContent = quotaToDisplay(totalQuota);

        // 按模型分组
        const modelMap = {};
        chartData.forEach(d => {
            const m = d.model_name || '未知';
            if (!modelMap[m]) modelMap[m] = { quota: 0, count: 0, times: [] };
            modelMap[m].quota += d.quota || 0;
            modelMap[m].count += d.count || 0;
            modelMap[m].times.push({ t: d.created_at, quota: d.quota || 0, count: d.count || 0 });
        });

        const models = Object.keys(modelMap);
        const colors = ['#2D6FF5','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899','#84CC16','#F97316','#14B8A6'];

        // 销毁旧图表
        if (window._mainChartInstance) {
            window._mainChartInstance.destroy();
            window._mainChartInstance = null;
        }

        const ctx = canvas.getContext('2d');

        if (tab === 'consumption-distribution' || tab === 'user-trend') {
            // 按时间聚合 - 折线图
            const dateMap = {};
            chartData.forEach(d => {
                const date = new Date(d.created_at * 1000).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' });
                if (!dateMap[date]) dateMap[date] = {};
                const m = d.model_name || '未知';
                dateMap[date][m] = (dateMap[date][m] || 0) + (d.quota || 0);
            });
            const labels = Object.keys(dateMap).sort();
            const datasets = models.map((m, i) => ({
                label: m,
                data: labels.map(l => ((dateMap[l] || {})[m] || 0) / 500000),
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '20',
                fill: false, tension: 0.3, pointRadius: 3,
            }));
            window._mainChartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { ticks: { callback: v => '$' + v.toFixed(4) } } } }
            });

        } else if (tab === 'consumption-trend') {
            // 按日期聚合总额度 - 面积图
            const dateMap = {};
            chartData.forEach(d => {
                const date = new Date(d.created_at * 1000).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' });
                dateMap[date] = (dateMap[date] || 0) + (d.quota || 0);
            });
            const labels = Object.keys(dateMap).sort();
            window._mainChartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets: [{ label: '消耗额度', data: labels.map(l => dateMap[l] / 500000), borderColor: '#2D6FF5', backgroundColor: '#2D6FF520', fill: true, tension: 0.3, pointRadius: 3 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => '$' + v.toFixed(4) } } } }
            });

        } else if (tab === 'call-distribution') {
            // 饼图 - 按模型调用次数
            const counts = models.map(m => modelMap[m].count);
            window._mainChartInstance = new Chart(ctx, {
                type: 'pie',
                data: { labels: models, datasets: [{ data: counts, backgroundColor: colors.slice(0, models.length), borderWidth: 2, borderColor: '#fff' }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
            });

        } else if (tab === 'call-ranking') {
            // 柱状图 - 按模型调用次数排行
            const sorted = models.sort((a, b) => modelMap[b].count - modelMap[a].count).slice(0, 10);
            window._mainChartInstance = new Chart(ctx, {
                type: 'bar',
                data: { labels: sorted, datasets: [{ label: '调用次数', data: sorted.map(m => modelMap[m].count), backgroundColor: colors.slice(0, sorted.length) }] },
                options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
            });

        } else if (tab === 'user-ranking' && isAdmin && userChartData.length > 0) {
            // 管理员：用户消耗排行
            const userMap = {};
            userChartData.forEach(d => {
                const u = d.username || '未知';
                userMap[u] = (userMap[u] || 0) + (d.quota || 0);
            });
            const sorted = Object.entries(userMap).sort((a,b) => b[1]-a[1]).slice(0, 10);
            window._mainChartInstance = new Chart(ctx, {
                type: 'bar',
                data: { labels: sorted.map(x=>x[0]), datasets: [{ label: '消耗额度', data: sorted.map(x => x[1]/500000), backgroundColor: colors.slice(0, sorted.length) }] },
                options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => '$' + v.toFixed(4) } } } }
            });
        } else {
            if (loading) loading.style.display = 'none';
            if (canvas) canvas.style.display = 'none';
            if (empty) empty.style.display = 'flex';
        }
    }

    // ========== 加载 API 信息 ==========
    async function loadApiInfo() {
        const res = await API.getStatus();
        if (!res.success || !res.data) return;
        const status = res.data;
        const apiInfoArea = document.getElementById('apiInfoArea');
        const apiInfoContent = document.getElementById('apiInfoContent');

        if (status.api_info && status.api_info.length > 0) {
            apiInfoArea.style.alignItems = 'flex-start';
            apiInfoArea.style.justifyContent = 'flex-start';
            apiInfoContent.innerHTML = `
                <div style="font-size:14px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--c-primary)"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>
                    API 信息
                </div>
                <div style="overflow-y:auto; max-height:calc(100% - 40px); width:100%;">
                    ${status.api_info.map(api => `
                        <div class="api-info-list-item">
                            <div class="api-info-list-item-header">
                                <span class="api-info-list-item-route">${api.route || ''}</span>
                            </div>
                            <div class="api-info-list-item-url" onclick="navigator.clipboard.writeText('${api.url||''}').then(()=>showToast && console.log('copied'))">${api.url || ''}</div>
                            ${api.description ? `<div class="api-info-list-item-desc">${api.description}</div>` : ''}
                            <div class="api-info-tags">
                                <button class="api-tag" onclick="navigator.clipboard.writeText('${api.url||''}')">复制</button>
                                <button class="api-tag" onclick="window.open('${api.url||''}','_blank')">跳转</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (status.api_url) {
            // 兼容旧格式
            apiInfoArea.style.alignItems = 'flex-start';
            apiInfoContent.innerHTML = `
                <div class="api-info-list-item">
                    <div class="api-info-list-item-header"><span class="api-info-list-item-route">API 端点</span></div>
                    <div class="api-info-list-item-url">${status.api_url}</div>
                    <div class="api-info-tags">
                        <button class="api-tag" onclick="navigator.clipboard.writeText('${status.api_url}')">复制</button>
                        <button class="api-tag" onclick="window.open('${status.api_url}','_blank')">跳转</button>
                    </div>
                </div>
            `;
        }

        // 加载公告/FAQ/Uptime
        const announcements = status.announcements || [];
        const faq = status.faq || [];
        const uptimeEnabled = status.uptime_kuma_enabled;

        let showInfoPanels = false;

        if (announcements.length > 0 && status.announcements_enabled !== false) {
            showInfoPanels = true;
            const panel = document.getElementById('announcementsPanel');
            const content = document.getElementById('announcementsContent');
            if (panel && content) {
                panel.style.display = 'block';
                content.innerHTML = announcements.slice(0, 20).map(a => `
                    <div style="padding:8px 0; border-bottom:1px solid var(--c-border);">
                        <div style="font-size:12px; color:var(--c-text-secondary); margin-bottom:4px;">${a.publishDate || ''}</div>
                        <div style="color:var(--c-text-main);">${a.content || ''}</div>
                    </div>
                `).join('');
            }
        }

        if (faq.length > 0 && status.faq_enabled !== false) {
            showInfoPanels = true;
            const panel = document.getElementById('faqPanel');
            const content = document.getElementById('faqContent');
            if (panel && content) {
                panel.style.display = 'block';
                content.innerHTML = faq.map((f, i) => `
                    <div class="faq-item" id="faq-${i}">
                        <div class="faq-question" onclick="toggleFaq(${i})">
                            <span>${f.question || ''}</span>
                            <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                        </div>
                        <div class="faq-answer">${f.answer || ''}</div>
                    </div>
                `).join('');
            }
        }

        if (uptimeEnabled !== false) {
            // 加载 Uptime 数据
            loadUptimeData();
        }

        if (showInfoPanels) {
            const panels = document.getElementById('infoPanels');
            if (panels) panels.style.display = 'block';
        }
    }

    // ========== FAQ 折叠 ==========
    window.toggleFaq = function(idx) {
        const item = document.getElementById(`faq-${idx}`);
        if (item) item.classList.toggle('open');
    };

    // ========== 加载 Uptime 数据 ==========
    async function loadUptimeData() {
        const res = await API.getUptimeStatus();
        if (!res.success || !res.data || res.data.length === 0) return;

        const panel = document.getElementById('uptimePanel');
        const content = document.getElementById('uptimeContent');
        const infoPanels = document.getElementById('infoPanels');

        if (panel && content) {
            panel.style.display = 'block';
            if (infoPanels) infoPanels.style.display = 'block';

            let html = '';
            res.data.forEach(category => {
                if (category.categoryName) {
                    html += `<div style="font-size:12px; font-weight:600; color:var(--c-text-secondary); padding:8px 0 4px 0; text-transform:uppercase; letter-spacing:0.5px;">${category.categoryName}</div>`;
                }
                (category.monitorList || []).forEach(m => {
                    const status = m.activeBeat?.status;
                    let dotClass = 'uptime-dot-pending';
                    let statusText = '检测中';
                    if (status === 1) { dotClass = 'uptime-dot-up'; statusText = '正常'; }
                    else if (status === 0) { dotClass = 'uptime-dot-down'; statusText = '故障'; }
                    html += `
                        <div class="uptime-service">
                            <span class="uptime-service-name">${m.name || ''}</span>
                            <span style="font-size:12px; color:${status===1?'#22C55E':status===0?'#EF4444':'#F59E0B'};">${statusText}</span>
                            <span class="uptime-dot ${dotClass}"></span>
                        </div>
                    `;
                });
            });
            content.innerHTML = html || '<div style="padding:12px 0;color:var(--c-text-secondary);">暂无监控数据</div>';
        }
    }

    // ========== 搜索模态框 ==========
    const searchModal = document.getElementById('searchModal');
    const searchBtn = document.getElementById('searchBtn');
    const searchModalClose = document.getElementById('searchModalClose');
    const searchModalCancel = document.getElementById('searchModalCancel');
    const searchModalConfirm = document.getElementById('searchModalConfirm');

    if (searchBtn) searchBtn.addEventListener('click', () => {
        // 显示管理员筛选
        const adminFilter = document.getElementById('adminFilterGroup');
        if (adminFilter && isAdmin) adminFilter.classList.remove('hidden');
        searchModal.classList.remove('hidden');
    });

    const closeSearchModal = () => searchModal.classList.add('hidden');
    if (searchModalClose) searchModalClose.addEventListener('click', closeSearchModal);
    if (searchModalCancel) searchModalCancel.addEventListener('click', closeSearchModal);

    // 时间快选按钮
    document.querySelectorAll('.time-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const hours = parseInt(btn.dataset.hours);
            const end = new Date();
            const start = new Date(end.getTime() - hours * 3600 * 1000);
            if (startInput) startInput.value = toLocalDatetimeInput(Math.floor(start.getTime()/1000));
            if (endInput) endInput.value = toLocalDatetimeInput(Math.floor(end.getTime()/1000));
            const labels = { 1: '过去1小时', 24: '过去24小时', 168: '过去7天', 720: '过去30天' };
            filterParams.label = labels[hours] || '自定义';
        });
    });

    if (searchModalConfirm) {
        searchModalConfirm.addEventListener('click', async () => {
            const start = startInput ? new Date(startInput.value).getTime() / 1000 : filterParams.start;
            const end = endInput ? new Date(endInput.value).getTime() / 1000 : filterParams.end;
            filterUsername = document.getElementById('filterUsername')?.value || '';
            filterParams = { start: Math.floor(start), end: Math.floor(end), label: filterParams.label || '自定义' };

            closeSearchModal();
            await refreshAll();
        });
    }

    // ========== 刷新按钮 ==========
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<div class="loading"></div> 刷新中';
            await refreshAll();
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.12"/></svg> 刷新';
        });
    }

    // ========== 图表选项卡 ==========
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;

            // 显示加载
            const loading = document.getElementById('chartLoading');
            const canvas = document.getElementById('mainChart');
            const empty = document.getElementById('chartEmpty');
            if (loading) loading.style.display = 'flex';
            if (canvas) canvas.style.display = 'none';
            if (empty) empty.style.display = 'none';

            setTimeout(() => renderChart(currentTab), 100);
        });
    });

    // ========== 全量刷新 ==========
    async function refreshAll() {
        // 显示加载状态
        const loading = document.getElementById('chartLoading');
        const canvas = document.getElementById('mainChart');
        if (loading) loading.style.display = 'flex';
        if (canvas) canvas.style.display = 'none';

        await Promise.all([
            loadUserStats(),
            loadLogStats(),
            loadChartData(),
        ]);
    }

    // ========== 初始化加载 ==========
    await loadUserStats();

    // 并发加载其余数据
    await Promise.all([
        loadLogStats(),
        loadChartData(),
        loadApiInfo(),
    ]);

    // 定时刷新（每60秒）
    setInterval(async () => {
        await loadUserStats();
        await loadLogStats();
    }, 60000);
});
