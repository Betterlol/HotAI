// 钱包充值页面逻辑
let tPage = 1;
const tPageSize = 20;
let tTotal = 0;
let topupRatio = 15;
let minTopup = 1;

function showToast(msg, type='info') {
    const c=document.getElementById('toastContainer');if(!c)return;
    const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);
}

function escHtml(s){return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');}
function quotaToDisplay(q){return '$'+(Math.abs(q||0)/500000).toFixed(4);}
function formatTime(ts){if(!ts||ts<=0)return '-';return new Date(ts*1000).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}

async function loadUserBalance() {
    const res = await API.getUserInfo();
    if (res.success && res.data) {
        document.getElementById('currentBalance').textContent = quotaToDisplay(res.data.quota);
    }
}

async function loadSettings() {
    const res = await API.getOptions();
    if (res.success && res.data) {
        topupRatio = parseFloat(res.data.TopupRatio) || 15;
        minTopup = parseFloat(res.data.MinTopUp) || 1;
        document.getElementById('ratioDisplay').textContent = topupRatio;
        document.getElementById('minTopupDisplay').textContent = minTopup;
    }
}

async function loadTopupHistory() {
    const tbody = document.getElementById('topupTableBody');
    tbody.innerHTML = '<tr><td colspan="5"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

    const res = await API.getTopupHistory(tPage, tPageSize);
    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><span>${res.message||'加载失败'}</span></div></td></tr>`;
        return;
    }

    const items = res.data?.items || [];
    tTotal = res.data?.total || items.length;
    document.getElementById('topupPageInfo').textContent = `共 ${tTotal} 条`;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="table-empty"><span>暂无充值记录</span></div></td></tr>';
        renderPagination();
        return;
    }

    tbody.innerHTML = items.map(item => {
        const statusBadge = item.status === 1
            ? '<span class="badge badge-green">成功</span>'
            : item.status === 2
            ? '<span class="badge badge-red">失败</span>'
            : '<span class="badge badge-gray">待支付</span>';
        const discount = item.discount_rate ? `${(item.discount_rate * 100).toFixed(1)}%` : '-';
        return `<tr>
            <td class="td-mono">${formatTime(item.created_time)}</td>
            <td style="font-weight:600;">¥${(item.amount||0).toFixed(2)}</td>
            <td>${escHtml(item.payment_method||'兑换码')}</td>
            <td>${statusBadge}</td>
            <td>${discount}</td>
        </tr>`;
    }).join('');

    renderPagination();
}

function renderPagination() {
    const pages = document.getElementById('topupPages');
    if (!pages) return;
    const total = Math.ceil(tTotal / tPageSize);
    let html = `<button class="page-btn" onclick="changeTPage(${tPage-1})" ${tPage<=1?'disabled':''}>‹</button>`;
    for (let i = Math.max(1, tPage-2); i <= Math.min(total, tPage+2); i++) {
        html += `<button class="page-btn ${i===tPage?'active':''}" onclick="changeTPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changeTPage(${tPage+1})" ${tPage>=total?'disabled':''}>›</button>`;
    pages.innerHTML = html;
}

function changeTPage(p) { if(p<1)return; tPage=p; loadTopupHistory(); }

async function redeemCode() {
    const code = document.getElementById('redemptionCode').value.trim();
    if (!code) { showToast('请输入兑换码','warning'); return; }

    const res = await API.redeemCode(code);
    if (res.success) {
        showToast('兑换成功！','success');
        document.getElementById('redemptionCode').value = '';
        loadUserBalance();
        loadTopupHistory();
    } else {
        showToast(res.message||'兑换失败','error');
    }
}

function selectAmount(amount) {
    document.getElementById('customAmount').value = amount;
    showToast(`已选择充值金额：¥${amount}，在线充值功能开发中...`,'info');
}

// 推广返利功能
let bPage = 1;
const bPageSize = 20;
let bTotal = 0;
let currentBillingFilter = 'all';

async function loadAffiliateInfo() {
    const res = await API.getUserInfo();
    if (res.success && res.data) {
        const user = res.data;
        document.getElementById('affBalance').textContent = quotaToDisplay(user.aff_quota || 0);
        document.getElementById('affCount').textContent = user.aff_count || 0;
        document.getElementById('affTotal').textContent = quotaToDisplay(user.aff_history_quota || 0);
        
        // 生成推广链接
        const affCode = user.aff_code || user.id;
        const baseUrl = window.location.origin;
        document.getElementById('affLink').value = `${baseUrl}/register.html?aff=${affCode}`;
        
        // 如果返利余额为0，禁用转账按钮
        const transferBtn = document.getElementById('transferBtn');
        if (transferBtn) {
            transferBtn.disabled = (user.aff_quota || 0) <= 0;
        }
    }
}

window.copyAffLink = function() {
    const link = document.getElementById('affLink');
    link.select();
    link.setSelectionRange(0, 99999);
    document.execCommand('copy');
    showToast('推广链接已复制到剪贴板', 'success');
};

window.openTransferDialog = function() {
    API.getUserInfo().then(res => {
        if (res.success && res.data) {
            const available = (res.data.aff_quota || 0) / 500000;
            document.getElementById('transferAvailable').textContent = '$' + available.toFixed(4);
            document.getElementById('transferAmount').value = '';
            document.getElementById('transferModal').classList.remove('hidden');
        }
    });
};

window.closeTransferDialog = function() {
    document.getElementById('transferModal').classList.add('hidden');
};

window.confirmTransfer = async function() {
    const amount = parseFloat(document.getElementById('transferAmount').value);
    if (isNaN(amount) || amount <= 0) {
        showToast('请输入有效的转账金额', 'warning');
        return;
    }
    
    const quota = Math.floor(amount * 500000);
    const res = await API.transferAffQuota(quota);
    
    if (res.success) {
        showToast('转账成功', 'success');
        closeTransferDialog();
        loadUserBalance();
        loadAffiliateInfo();
        loadBillingHistory();
    } else {
        showToast(res.message || '转账失败', 'error');
    }
};

// 账单历史
async function loadBillingHistory() {
    const tbody = document.getElementById('billingTableBody');
    tbody.innerHTML = '<tr><td colspan="5"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

    const params = { p: bPage - 1, page_size: bPageSize };
    if (currentBillingFilter !== 'all') {
        params.type = currentBillingFilter;
    }

    const res = await API.getBillingHistory(params);
    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><span>${res.message||'加载失败'}</span></div></td></tr>`;
        return;
    }

    const items = res.data || [];
    bTotal = res.total || items.length;
    document.getElementById('billingPageInfo').textContent = `共 ${bTotal} 条`;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="table-empty"><span>暂无账单记录</span></div></td></tr>';
        renderBillingPagination();
        return;
    }

    tbody.innerHTML = items.map(item => {
        const isPositive = (item.quota_change || 0) > 0;
        const changeText = (isPositive ? '+' : '') + quotaToDisplay(item.quota_change);
        const changeColor = isPositive ? 'color:#22c55e' : 'color:#ef4444';
        return `<tr>
            <td class="td-mono">${formatTime(item.created_time)}</td>
            <td>${escHtml(item.type_text || item.type || '-')}</td>
            <td style="font-weight:600;${changeColor}">${changeText}</td>
            <td>${quotaToDisplay(item.balance_after || 0)}</td>
            <td>${escHtml(item.description || '-')}</td>
        </tr>`;
    }).join('');

    renderBillingPagination();
}

function renderBillingPagination() {
    const pages = document.getElementById('billingPages');
    if (!pages) return;
    const total = Math.ceil(bTotal / bPageSize);
    let html = `<button class="page-btn" onclick="changeBPage(${bPage-1})" ${bPage<=1?'disabled':''}>‹</button>`;
    for (let i = Math.max(1, bPage-2); i <= Math.min(total, bPage+2); i++) {
        html += `<button class="page-btn ${i===bPage?'active':''}" onclick="changeBPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changeBPage(${bPage+1})" ${bPage>=total?'disabled':''}>›</button>`;
    pages.innerHTML = html;
}

window.changeBPage = function(p) { if(p<1)return; bPage=p; loadBillingHistory(); };

window.filterBilling = function(type) {
    currentBillingFilter = type;
    bPage = 1;
    loadBillingHistory();
};

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar('topup');
    loadUserBalance();
    loadSettings();
    loadTopupHistory();
    loadAffiliateInfo();
    loadBillingHistory();

    // 绑定金额按钮点击事件
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = parseInt(btn.dataset.amount);
            selectAmount(amount);
        });
    });

    // 自定义金额输入
    const customInput = document.getElementById('customAmount');
    if (customInput) {
        customInput.addEventListener('change', () => {
            const amount = parseFloat(customInput.value);
            if (amount && amount >= minTopup) {
                showToast(`已输入充值金额：¥${amount}，在线充值功能开发中...`,'info');
            } else if (amount < minTopup) {
                showToast(`充值金额不能少于 ¥${minTopup}`,'warning');
            }
        });
    }
});
