// 订阅管理页面逻辑
let planSortField = 'id';
let planSortOrder = 'desc';
let userSortField = 'id';
let userSortOrder = 'desc';
let allPlans = [];
let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('subscription');

    // 监听模态框中的有效期单位变化
    const durationUnit = document.getElementById('planDurationUnit');
    if (durationUnit) {
        durationUnit.addEventListener('change', function() {
            const customGroup = document.getElementById('planCustomSecondsGroup');
            if (this.value === 'custom') {
                customGroup.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
            }
        });
    }

    // 监听额度重置周期变化
    const resetPeriod = document.getElementById('planResetPeriod');
    if (resetPeriod) {
        resetPeriod.addEventListener('change', function() {
            const customGroup = document.getElementById('planResetCustomGroup');
            if (this.value === 'custom') {
                customGroup.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
            }
        });
    }

    // 搜索监听
    let planSearchTimer;
    const planSearch = document.getElementById('planSearch');
    if (planSearch) {
        planSearch.addEventListener('input', () => {
            clearTimeout(planSearchTimer);
            planSearchTimer = setTimeout(() => renderPlans(), 300);
        });
    }

    let userSearchTimer;
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', () => {
            clearTimeout(userSearchTimer);
            userSearchTimer = setTimeout(() => renderUsers(), 300);
        });
    }

    // 排序监听
    const planSortFieldEl = document.getElementById('planSortField');
    if (planSortFieldEl) {
        planSortFieldEl.addEventListener('change', (e) => {
            planSortField = e.target.value;
            renderPlans();
        });
    }

    const userSortFieldEl = document.getElementById('userSortField');
    if (userSortFieldEl) {
        userSortFieldEl.addEventListener('change', (e) => {
            userSortField = e.target.value;
            renderUsers();
        });
    }

    // 初始加载
    await Promise.all([loadPlans(), loadSubscriptionUsers()]);
});

function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function escHtml(s) {
    return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

function formatQuota(q) {
    return '$' + (Math.abs(q || 0) / 500000).toFixed(4);
}

function formatTime(ts) {
    if (!ts || ts <= 0) return '-';
    const d = new Date(ts * 1000);
    return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ========== 套餐管理 ==========

async function loadPlans() {
    try {
        const res = await API.getAdminPlans();
        if (res.success && res.data) {
            allPlans = res.data.map(item => item.plan || item);
            renderPlans();
        } else {
            showToast(res.message || '加载失败', 'error');
            allPlans = [];
            renderPlans();
        }
    } catch (error) {
        console.error('加载套餐失败:', error);
        showToast('加载失败', 'error');
        allPlans = [];
        renderPlans();
    }
}

function renderPlans() {
    const tbody = document.getElementById('planTableBody');
    if (!tbody) return;

    const searchVal = (document.getElementById('planSearch')?.value || '').toLowerCase();
    let plans = allPlans.filter(p => {
        if (!searchVal) return true;
        const title = (p.title || '').toLowerCase();
        const subtitle = (p.subtitle || '').toLowerCase();
        return title.includes(searchVal) || subtitle.includes(searchVal);
    });

    // 排序
    plans = sortPlans(plans);

    if (plans.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="12" style="text-align:center;padding:60px 20px;">
                <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--c-text-secondary);">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span style="font-size:14px;">暂无订阅套餐</span>
                </div>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = plans.map(p => {
        const statusBadge = p.enabled
            ? '<span class="badge badge-green">启用</span>'
            : '<span class="badge badge-gray">禁用</span>';

        const paymentChannels = [];
        if (p.stripe_price_id) paymentChannels.push('<span class="badge badge-blue">Stripe</span>');
        if (p.creem_product_id) paymentChannels.push('<span class="badge badge-blue">Creem</span>');
        if (p.waffo_pancake_product_id) paymentChannels.push('<span class="badge badge-blue">Waffo</span>');
        const paymentHtml = paymentChannels.length > 0 ? paymentChannels.join(' ') : '<span style="color:var(--c-text-secondary);">-</span>';

        const durationText = formatDuration(p);
        const resetText = formatResetPeriod(p);
        const totalAmountText = p.total_amount > 0 ? formatQuota(p.total_amount) : '<span style="color:var(--c-text-secondary);">不限</span>';
        const maxPurchaseText = p.max_purchase_per_user > 0 ? p.max_purchase_per_user : '<span style="color:var(--c-text-secondary);">不限</span>';
        const upgradeGroupText = p.upgrade_group ? `<span class="badge badge-purple">${escHtml(p.upgrade_group)}</span>` : '<span style="color:var(--c-text-secondary);">无升级</span>';

        const titleHtml = p.subtitle
            ? `<div style="max-width:200px;"><div style="font-weight:500;">${escHtml(p.title)}</div><div style="font-size:12px;color:var(--c-text-secondary);">${escHtml(p.subtitle)}</div></div>`
            : `<div style="font-weight:500;">${escHtml(p.title)}</div>`;

        return `<tr>
            <td style="text-align:center;" class="td-mono">${p.id}</td>
            <td style="text-align:center;">${titleHtml}</td>
            <td style="text-align:center;"><span style="font-weight:600;color:#10b981;">$${Number(p.price_amount || 0).toFixed(2)}</span></td>
            <td style="text-align:center;">${maxPurchaseText}</td>
            <td style="text-align:center;" class="td-mono">${p.sort_order || 0}</td>
            <td style="text-align:center;color:var(--c-text-secondary);">${durationText}</td>
            <td style="text-align:center;color:var(--c-text-secondary);">${resetText}</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center;">${paymentHtml}</td>
            <td style="text-align:center;">${totalAmountText}</td>
            <td style="text-align:center;">${upgradeGroupText}</td>
            <td style="text-align:center;">
                <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="editPlan(${p.id})">编辑</button>
                    <button class="btn btn-secondary btn-sm" onclick="togglePlanStatus(${p.id}, ${p.enabled ? 'false' : 'true'})">${p.enabled ? '禁用' : '启用'}</button>
                    <button class="btn btn-danger btn-sm" onclick="deletePlan(${p.id})">删除</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function sortPlans(plans) {
    return plans.sort((a, b) => {
        let aVal, bVal;
        if (planSortField === 'id') {
            aVal = a.id || 0;
            bVal = b.id || 0;
        } else if (planSortField === 'price') {
            aVal = a.price_amount || 0;
            bVal = b.price_amount || 0;
        } else if (planSortField === 'sort_order') {
            aVal = a.sort_order || 0;
            bVal = b.sort_order || 0;
        }

        if (planSortOrder === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
}

window.togglePlanSortOrder = function() {
    planSortOrder = planSortOrder === 'asc' ? 'desc' : 'asc';
    const icon = document.getElementById('planSortIcon');
    if (planSortOrder === 'asc') {
        icon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
    } else {
        icon.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>';
    }
    renderPlans();
};

function formatDuration(plan) {
    const unit = plan.duration_unit || 'month';
    const value = plan.duration_value || 1;
    const unitMap = { year: '年', month: '月', day: '天', hour: '小时', custom: '自定义' };
    if (unit === 'custom') {
        const secs = plan.custom_seconds || 0;
        if (secs >= 86400) return Math.floor(secs / 86400) + '天';
        if (secs >= 3600) return Math.floor(secs / 3600) + '小时';
        return secs + '秒';
    }
    return value + unitMap[unit];
}

function formatResetPeriod(plan) {
    const period = plan.quota_reset_period || 'never';
    if (period === 'daily') return '每天';
    if (period === 'weekly') return '每周';
    if (period === 'monthly') return '每月';
    if (period === 'custom') {
        const secs = Number(plan.quota_reset_custom_seconds || 0);
        if (secs >= 86400) return Math.floor(secs / 86400) + '天';
        if (secs >= 3600) return Math.floor(secs / 3600) + '小时';
        if (secs >= 60) return Math.floor(secs / 60) + '分钟';
        return secs + '秒';
    }
    return '从不';
}

window.openCreatePlanModal = function() {
    document.getElementById('planModalTitle').textContent = '创建订阅套餐';
    document.getElementById('planId').value = '';
    document.getElementById('planTitle').value = '';
    document.getElementById('planSubtitle').value = '';
    document.getElementById('planPrice').value = '';
    document.getElementById('planSortOrder').value = '0';
    document.getElementById('planDurationUnit').value = 'month';
    document.getElementById('planDurationValue').value = '1';
    document.getElementById('planCustomSeconds').value = '';
    document.getElementById('planResetPeriod').value = 'never';
    document.getElementById('planResetCustomSeconds').value = '';
    document.getElementById('planTotalAmount').value = '0';
    document.getElementById('planMaxPurchase').value = '0';
    document.getElementById('planUpgradeGroup').value = '';
    document.getElementById('planDowngradeGroup').value = '';
    document.getElementById('planStripeId').value = '';
    document.getElementById('planCreemId').value = '';
    document.getElementById('planWaffoId').value = '';
    document.getElementById('planEnabled').checked = true;
    document.getElementById('planCustomSecondsGroup').style.display = 'none';
    document.getElementById('planResetCustomGroup').style.display = 'none';
    document.getElementById('planModal').classList.remove('hidden');
};

window.closePlanModal = function() {
    document.getElementById('planModal').classList.add('hidden');
};

window.editPlan = async function(id) {
    const plan = allPlans.find(p => p.id === id);
    if (!plan) {
        showToast('套餐未找到', 'error');
        return;
    }

    document.getElementById('planModalTitle').textContent = '编辑订阅套餐';
    document.getElementById('planId').value = plan.id;
    document.getElementById('planTitle').value = plan.title || '';
    document.getElementById('planSubtitle').value = plan.subtitle || '';
    document.getElementById('planPrice').value = plan.price_amount || '';
    document.getElementById('planSortOrder').value = plan.sort_order || 0;
    document.getElementById('planDurationUnit').value = plan.duration_unit || 'month';
    document.getElementById('planDurationValue').value = plan.duration_value || 1;
    document.getElementById('planCustomSeconds').value = plan.custom_seconds || '';
    document.getElementById('planResetPeriod').value = plan.quota_reset_period || 'never';
    document.getElementById('planResetCustomSeconds').value = plan.quota_reset_custom_seconds || '';
    document.getElementById('planTotalAmount').value = plan.total_amount || 0;
    document.getElementById('planMaxPurchase').value = plan.max_purchase_per_user || 0;
    document.getElementById('planUpgradeGroup').value = plan.upgrade_group || '';
    document.getElementById('planDowngradeGroup').value = plan.downgrade_group || '';
    document.getElementById('planStripeId').value = plan.stripe_price_id || '';
    document.getElementById('planCreemId').value = plan.creem_product_id || '';
    document.getElementById('planWaffoId').value = plan.waffo_pancake_product_id || '';
    document.getElementById('planEnabled').checked = plan.enabled;

    const durationUnit = document.getElementById('planDurationUnit').value;
    document.getElementById('planCustomSecondsGroup').style.display = durationUnit === 'custom' ? 'block' : 'none';

    const resetPeriod = document.getElementById('planResetPeriod').value;
    document.getElementById('planResetCustomGroup').style.display = resetPeriod === 'custom' ? 'block' : 'none';

    document.getElementById('planModal').classList.remove('hidden');
};

window.savePlan = async function() {
    const id = document.getElementById('planId').value;
    const title = document.getElementById('planTitle').value.trim();
    const subtitle = document.getElementById('planSubtitle').value.trim();
    const price = parseFloat(document.getElementById('planPrice').value);
    const sortOrder = parseInt(document.getElementById('planSortOrder').value) || 0;
    const durationUnit = document.getElementById('planDurationUnit').value;
    const durationValue = parseInt(document.getElementById('planDurationValue').value) || 1;
    const customSeconds = parseInt(document.getElementById('planCustomSeconds').value) || 0;
    const resetPeriod = document.getElementById('planResetPeriod').value;
    const resetCustomSeconds = parseInt(document.getElementById('planResetCustomSeconds').value) || 0;
    const totalAmount = parseInt(document.getElementById('planTotalAmount').value) || 0;
    const maxPurchase = parseInt(document.getElementById('planMaxPurchase').value) || 0;
    const upgradeGroup = document.getElementById('planUpgradeGroup').value.trim();
    const downgradeGroup = document.getElementById('planDowngradeGroup').value.trim();
    const stripeId = document.getElementById('planStripeId').value.trim();
    const creemId = document.getElementById('planCreemId').value.trim();
    const waffoId = document.getElementById('planWaffoId').value.trim();
    const enabled = document.getElementById('planEnabled').checked;

    if (!title) {
        showToast('请输入套餐标题', 'warning');
        return;
    }
    if (isNaN(price) || price < 0) {
        showToast('请输入有效价格', 'warning');
        return;
    }

    const planData = {
        plan: {
            title,
            subtitle,
            price_amount: price,
            currency: 'USD',
            duration_unit: durationUnit,
            duration_value: durationValue,
            custom_seconds: customSeconds,
            quota_reset_period: resetPeriod,
            quota_reset_custom_seconds: resetCustomSeconds,
            enabled,
            sort_order: sortOrder,
            max_purchase_per_user: maxPurchase,
            total_amount: totalAmount,
            upgrade_group: upgradeGroup,
            downgrade_group: downgradeGroup,
            stripe_price_id: stripeId,
            creem_product_id: creemId,
            waffo_pancake_product_id: waffoId,
        }
    };

    try {
        let res;
        if (id) {
            res = await API.updateAdminPlan(id, planData);
        } else {
            res = await API.createAdminPlan(planData);
        }

        if (res.success) {
            showToast(id ? '更新成功' : '创建成功', 'success');
            closePlanModal();
            await loadPlans();
        } else {
            showToast(res.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('保存套餐失败:', error);
        showToast('保存失败', 'error');
    }
};

window.togglePlanStatus = async function(id, enabled) {
    const enabledBool = enabled === 'true' || enabled === true;
    try {
        const res = await API.patchPlanStatus(id, enabledBool);
        if (res.success) {
            showToast(enabledBool ? '已启用' : '已禁用', 'success');
            await loadPlans();
        } else {
            showToast(res.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('切换状态失败:', error);
        showToast('操作失败', 'error');
    }
};

window.deletePlan = async function(id) {
    if (!confirm('确定要删除此订阅套餐吗？')) return;

    try {
        const res = await API.deleteAdminPlan(id);
        if (res.success) {
            showToast('删除成功', 'success');
            await loadPlans();
        } else {
            showToast(res.message || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除套餐失败:', error);
        showToast('删除失败', 'error');
    }
};

// ========== 订阅用户列表 ==========

let userPage = 1;
const userPageSize = 20;
let userTotal = 0;

window.loadSubscriptionUsers = async function() {
    const tbody = document.getElementById('subscriptionUsersTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';
    }

    try {
        // 获取所有用户列表
        const res = await API.getUsers(userPage, userPageSize);
        if (!res.success || !res.data) {
            allUsers = [];
            userTotal = 0;
            renderUsers();
            return;
        }

        const users = res.data.items || [];
        userTotal = res.data.total || 0;

        // 对每个用户获取订阅信息
        const userSubscriptions = await Promise.all(
            users.map(async (user) => {
                try {
                    const subRes = await API.getUserSubscriptions(user.id);
                    if (subRes.success && subRes.data && subRes.data.length > 0) {
                        // 找到最新的有效订阅
                        const activeSubs = subRes.data
                            .filter(s => s.subscription && s.subscription.status === 'active')
                            .sort((a, b) => (b.subscription.end_time || 0) - (a.subscription.end_time || 0));
                        
                        if (activeSubs.length > 0) {
                            const sub = activeSubs[0].subscription;
                            return {
                                user_id: user.id,
                                username: user.username,
                                subscription_id: sub.id,
                                plan_id: sub.plan_id,
                                plan_name: `套餐 ${sub.plan_id}`, // 简化显示
                                status: sub.status,
                                start_time: sub.start_time,
                                end_time: sub.end_time
                            };
                        }
                    }
                    return null;
                } catch (err) {
                    console.error(`获取用户 ${user.id} 订阅失败:`, err);
                    return null;
                }
            })
        );

        // 过滤掉没有订阅的用户
        allUsers = userSubscriptions.filter(u => u !== null);
        renderUsers();
    } catch (error) {
        console.error('加载订阅用户失败:', error);
        allUsers = [];
        userTotal = 0;
        renderUsers();
    }
};

function renderUsers() {
    const tbody = document.getElementById('subscriptionUsersTableBody');
    if (!tbody) return;

    const searchVal = (document.getElementById('userSearch')?.value || '').toLowerCase();
    let users = allUsers.filter(u => {
        if (!searchVal) return true;
        const username = (u.username || '').toLowerCase();
        return username.includes(searchVal);
    });

    users = sortUsers(users);

    // 更新统计信息
    const filteredTotal = users.length;
    document.getElementById('subscriptionUsersPageInfo').textContent = `共 ${filteredTotal} 条`;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" style="text-align:center;padding:60px 20px;">
                <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--c-text-secondary);">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span style="font-size:14px;">暂无订阅用户</span>
                </div>
            </td></tr>
        `;
        renderUserPagination();
        return;
    }

    tbody.innerHTML = users.map(u => {
        const statusBadge = u.status === 'active'
            ? '<span class="badge badge-green">有效</span>'
            : '<span class="badge badge-gray">已过期</span>';

        return `<tr>
            <td style="text-align:center;" class="td-mono">${u.user_id || '-'}</td>
            <td style="text-align:center;"><strong>${escHtml(u.username || '-')}</strong></td>
            <td style="text-align:center;">${escHtml(u.plan_name || '-')}</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center;" class="td-mono">${formatTime(u.start_time)}</td>
            <td style="text-align:center;" class="td-mono">${formatTime(u.end_time)}</td>
            <td style="text-align:center;">
                <button class="btn btn-warning btn-sm" onclick="cancelUserSub(${u.subscription_id})">取消订阅</button>
            </td>
        </tr>`;
    }).join('');

    renderUserPagination();
}

function renderUserPagination() {
    const pages = document.getElementById('subscriptionUsersPages');
    if (!pages) return;

    const total = Math.ceil(userTotal / userPageSize);
    if (total <= 1) {
        pages.innerHTML = '';
        return;
    }

    let html = `<button class="page-btn" onclick="changeUserPage(${userPage - 1})" ${userPage <= 1 ? 'disabled' : ''}>‹</button>`;
    
    for (let i = Math.max(1, userPage - 2); i <= Math.min(total, userPage + 2); i++) {
        html += `<button class="page-btn ${i === userPage ? 'active' : ''}" onclick="changeUserPage(${i})">${i}</button>`;
    }
    
    html += `<button class="page-btn" onclick="changeUserPage(${userPage + 1})" ${userPage >= total ? 'disabled' : ''}>›</button>`;
    pages.innerHTML = html;
}

window.changeUserPage = function(p) {
    if (p < 1) return;
    const total = Math.ceil(userTotal / userPageSize);
    if (p > total) return;
    userPage = p;
    loadSubscriptionUsers();
};

function sortUsers(users) {
    return users.sort((a, b) => {
        let aVal, bVal;
        if (userSortField === 'id') {
            aVal = a.user_id || 0;
            bVal = b.user_id || 0;
        } else if (userSortField === 'username') {
            aVal = (a.username || '').toLowerCase();
            bVal = (b.username || '').toLowerCase();
        }

        if (userSortOrder === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
}

window.toggleUserSortOrder = function() {
    userSortOrder = userSortOrder === 'asc' ? 'desc' : 'asc';
    const icon = document.getElementById('userSortIcon');
    if (userSortOrder === 'asc') {
        icon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
    } else {
        icon.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>';
    }
    renderUsers();
};

window.cancelUserSub = async function(subId) {
    if (!confirm('确定要取消此用户的订阅吗？这将使订阅立即失效。')) return;

    try {
        const res = await API.invalidateUserSubscription(subId);
        if (res.success) {
            showToast('订阅已取消', 'success');
            await loadSubscriptionUsers();
        } else {
            showToast(res.message || '取消订阅失败', 'error');
        }
    } catch (error) {
        console.error('取消订阅失败:', error);
        showToast('取消订阅失败', 'error');
    }
};
