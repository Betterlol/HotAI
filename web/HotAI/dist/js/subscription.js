// 订阅管理页面逻辑
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化侧边栏
    renderSidebar('subscription');

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

    // 模态框管理
    window.openCreateSubscriptionModal = function () {
        document.getElementById('subscriptionModalTitle').textContent = '创建订阅套餐';
        document.getElementById('subscriptionId').value = '';
        document.getElementById('subscriptionName').value = '';
        document.getElementById('subscriptionPrice').value = '';
        document.getElementById('subscriptionPeriod').value = 'month';
        document.getElementById('subscriptionQuota').value = '';
        document.getElementById('subscriptionDescription').value = '';
        document.getElementById('subscriptionEnabled').checked = true;
        document.getElementById('subscriptionModal').classList.remove('hidden');
    };

    window.closeSubscriptionModal = function () {
        document.getElementById('subscriptionModal').classList.add('hidden');
    };

    window.saveSubscription = async function () {
        const id = document.getElementById('subscriptionId').value;
        const name = document.getElementById('subscriptionName').value.trim();
        const price = parseFloat(document.getElementById('subscriptionPrice').value);
        const period = document.getElementById('subscriptionPeriod').value;
        const quota = parseInt(document.getElementById('subscriptionQuota').value);
        const description = document.getElementById('subscriptionDescription').value.trim();
        const enabled = document.getElementById('subscriptionEnabled').checked;

        if (!name || isNaN(price) || isNaN(quota)) {
            showToast('请填写必填项', 'error');
            return;
        }

        try {
            const data = {name, price, period, quota, description, enabled: enabled ? 1 : 0};

            let res;
            if (id) {
                res = await API.updateSubscription(id, data);
            } else {
                res = await API.createSubscription(data);
            }

            if (res.success) {
                showToast(id ? '更新成功' : '创建成功', 'success');
                closeSubscriptionModal();
                await loadSubscriptionPlans();
            } else {
                showToast(res.message || '操作失败', 'error');
            }
        } catch (error) {
            console.error('保存订阅套餐失败:', error);
            showToast('保存失败', 'error');
        }
    };

    // 加载订阅套餐列表
    async function loadSubscriptionPlans() {
        const container = document.getElementById('subscriptionPlansContainer');
        container.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div></div>';

        try {
            const res = await API.getSubscriptions();

            if (res.success && res.data && res.data.length > 0) {
                container.innerHTML = res.data.map(plan => `
                    <div class="setting-card">
                        <div class="setting-card-header">
                            <div>
                                <h3>${plan.name}</h3>
                                <p>${plan.description || '暂无描述'}</p>
                            </div>
                            <span class="badge ${plan.enabled ? 'badge-success' : 'badge-secondary'}">
                                ${plan.enabled ? '启用' : '禁用'}
                            </span>
                        </div>
                        <div class="setting-card-body">
                            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;">
                                <div>
                                    <div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">价格</div>
                                    <div style="font-size:20px;font-weight:700;color:var(--c-primary);">¥${plan.price}</div>
                                </div>
                                <div>
                                    <div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">周期</div>
                                    <div style="font-size:16px;font-weight:500;">${plan.period === 'month' ? '月付' : plan.period === 'quarter' ? '季付' : '年付'}</div>
                                </div>
                                <div>
                                    <div style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px;">赠送额度</div>
                                    <div style="font-size:16px;font-weight:500;">$${(plan.quota / 500000).toFixed(2)}</div>
                                </div>
                            </div>
                            <div style="display:flex;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid var(--c-border);">
                                <button class="btn btn-sm btn-secondary" onclick="editSubscription(${plan.id})">编辑</button>
                                <button class="btn btn-sm btn-secondary" onclick="toggleSubscription(${plan.id}, ${plan.enabled ? 0 : 1})">${plan.enabled ? '禁用' : '启用'}</button>
                                <button class="btn btn-sm btn-secondary" onclick="deleteSubscription(${plan.id})" style="color:#DC2626;">删除</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div class="setting-card"><div class="setting-card-body" style="text-align:center;padding:40px;color:var(--c-text-secondary);">暂无订阅套餐，点击右上角创建</div></div>';
            }
        } catch (error) {
            console.error('加载订阅套餐失败:', error);
            container.innerHTML = '<div class="setting-card"><div class="setting-card-body" style="text-align:center;padding:40px;color:var(--c-text-secondary);">加载失败</div></div>';
        }
    }

    // 编辑订阅套餐
    window.editSubscription = async function (id) {
        try {
            const res = await API.getSubscription(id);
            if (res.success && res.data) {
                const plan = res.data;
                document.getElementById('subscriptionModalTitle').textContent = '编辑订阅套餐';
                document.getElementById('subscriptionId').value = plan.id;
                document.getElementById('subscriptionName').value = plan.name;
                document.getElementById('subscriptionPrice').value = plan.price;
                document.getElementById('subscriptionPeriod').value = plan.period;
                document.getElementById('subscriptionQuota').value = plan.quota;
                document.getElementById('subscriptionDescription').value = plan.description || '';
                document.getElementById('subscriptionEnabled').checked = plan.enabled;
                document.getElementById('subscriptionModal').classList.remove('hidden');
            }
        } catch (error) {
            console.error('加载订阅套餐详情失败:', error);
            showToast('加载失败', 'error');
        }
    };

    // 切换订阅套餐状态
    window.toggleSubscription = async function (id, enabled) {
        try {
            const res = await API.updateSubscription(id, {enabled});
            if (res.success) {
                showToast(enabled ? '已启用' : '已禁用', 'success');
                await loadSubscriptionPlans();
            } else {
                showToast(res.message || '操作失败', 'error');
            }
        } catch (error) {
            console.error('切换订阅套餐状态失败:', error);
            showToast('操作失败', 'error');
        }
    };

    // 删除订阅套餐
    window.deleteSubscription = async function (id) {
        if (!confirm('确定要删除此订阅套餐吗？')) return;

        try {
            const res = await API.deleteSubscription(id);
            if (res.success) {
                showToast('删除成功', 'success');
                await loadSubscriptionPlans();
            } else {
                showToast(res.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除订阅套餐失败:', error);
            showToast('删除失败', 'error');
        }
    };

    // 加载订阅用户列表
    window.loadSubscriptionUsers = async function () {
        const tbody = document.getElementById('subscriptionUsersTableBody');
        tbody.innerHTML = '<tr><td colspan="6"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

        try {
            const res = await API.getSubscriptionUsers();

            if (res.success && res.data && res.data.length > 0) {
                tbody.innerHTML = res.data.map(user => `
                    <tr>
                        <td>${user.username}</td>
                        <td>${user.subscription_name || '--'}</td>
                        <td><span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-secondary'}">${user.status === 'active' ? '有效' : '已过期'}</span></td>
                        <td>${user.start_time ? new Date(user.start_time * 1000).toLocaleDateString() : '--'}</td>
                        <td>${user.end_time ? new Date(user.end_time * 1000).toLocaleDateString() : '--'}</td>
                        <td>
                            <button class="btn btn-sm btn-secondary" onclick="cancelUserSubscription(${user.user_id})">取消订阅</button>
                        </td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--c-text-secondary);">暂无订阅用户</td></tr>';
            }
        } catch (error) {
            console.error('加载订阅用户失败:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--c-text-secondary);">加载失败</td></tr>';
        }
    };

    // 取消用户订阅
    window.cancelUserSubscription = async function (userId) {
        if (!confirm('确定要取消此用户的订阅吗？')) return;

        try {
            const res = await API.cancelUserSubscription(userId);
            if (res.success) {
                showToast('取消订阅成功', 'success');
                await loadSubscriptionUsers();
            } else {
                showToast(res.message || '操作失败', 'error');
            }
        } catch (error) {
            console.error('取消订阅失败:', error);
            showToast('操作失败', 'error');
        }
    };

    // 初始加载
    await Promise.all([
        loadSubscriptionPlans(),
        loadSubscriptionUsers()
    ]);
});