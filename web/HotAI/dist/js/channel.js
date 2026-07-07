// 渠道管理页面逻辑（管理员）
let chPage = 1;
const chPageSize = 20;
let chTotal = 0;

const channelTypeNames = {
    1:'OpenAI',2:'API2D',3:'Azure OpenAI',4:'Slack Claude',5:'CloseAI',6:'OpenAI SB',7:'OpenAI Max',8:'自定义',
    9:'Ails',10:'AI Proxy',11:'PaLM2',12:'API2GPT',13:'AIGC2D',14:'Claude',15:'百度文心',16:'讯飞星火',
    17:'AWS Bedrock',18:'ChatGLM',19:'通义千问',20:'360 GPT',21:'天工',22:'月之暗面',23:'腾讯混元',24:'Gemini',
    25:'Moonshot',26:'百川AI',27:'MiniMax',28:'Mistral',29:'Groq',30:'OllamaAPI',31:'Deepseek',
    32:'Cohere',33:'Azure Claude',34:'Coze'
};

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
    return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

async function loadChannels() {
    const search = document.getElementById('channelSearch').value.trim();
    const tbody = document.getElementById('channelTableBody');
    tbody.innerHTML = '<tr><td colspan="9"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

    let res;
    if (search) {
        res = await API.searchChannels(search);
    } else {
        res = await API.getChannels(chPage, chPageSize);
    }

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="table-empty"><span>${res.message||'加载失败'}</span></div></td></tr>`;
        return;
    }

    const items = res.data?.items || [];
    chTotal = res.data?.total || items.length;
    document.getElementById('channelPageInfo').textContent = `共 ${chTotal} 条`;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="table-empty"><svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg><span>暂无渠道数据</span></div></td></tr>';
        renderPagination();
        return;
    }

    tbody.innerHTML = items.map(ch => {
        const statusBadge = ch.status === 1
            ? '<span class="badge badge-green">正常</span>'
            : '<span class="badge badge-red">禁用</span>';
        const typeName = channelTypeNames[ch.type] || `类型${ch.type}`;
        const balance = ch.balance !== undefined ? `$${ch.balance.toFixed(2)}` : '-';
        const respTime = ch.response_time ? `${ch.response_time}ms` : '-';
        return `
        <tr>
            <td><input type="checkbox" class="ch-checkbox" data-id="${ch.id}" onchange="toggleSelectChannel(${ch.id})" ${selectedChannels.has(ch.id)?'checked':''}></td>
            <td class="td-mono">${ch.id}</td>
            <td><strong>${escHtml(ch.name||'-')}</strong></td>
            <td><span class="badge badge-blue">${escHtml(typeName)}</span></td>
            <td>${statusBadge}</td>
            <td>${escHtml(ch.group||'default')}</td>
            <td style="font-family:monospace;">${balance}</td>
            <td>${ch.priority||0}</td>
            <td class="td-mono">${respTime}</td>
            <td>
                <div class="td-actions">
                    <button class="btn btn-secondary btn-sm" onclick="testChannel(${ch.id})">测速</button>
                    <button class="btn btn-secondary btn-sm" onclick="updateBalance(${ch.id})">余额</button>
                    <button class="btn btn-secondary btn-sm" onclick="cloneChannel(${ch.id})">克隆</button>
                    <button class="btn btn-secondary btn-sm" onclick="openEditChannelModal(${ch.id})">编辑</button>
                    <button class="btn ${ch.status===1?'btn-warning':'btn-success'} btn-sm" onclick="toggleChannelStatus(${ch.id},${ch.status})">${ch.status===1?'禁用':'启用'}</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteChannel(${ch.id},'${escHtml(ch.name||'')}')">删除</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    renderPagination();
}

function renderPagination() {
    const pages = document.getElementById('channelPages');
    if (!pages) return;
    const total = Math.ceil(chTotal / chPageSize);
    let html = `<button class="page-btn" onclick="changeChPage(${chPage-1})" ${chPage<=1?'disabled':''}>‹</button>`;
    for (let i = Math.max(1, chPage-2); i <= Math.min(total, chPage+2); i++) {
        html += `<button class="page-btn ${i===chPage?'active':''}" onclick="changeChPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changeChPage(${chPage+1})" ${chPage>=total?'disabled':''}>›</button>`;
    pages.innerHTML = html;
}

function changeChPage(p) { if (p < 1) return; chPage = p; loadChannels(); }

function openCreateChannelModal() {
    document.getElementById('channelModalTitle').textContent = '创建渠道';
    document.getElementById('channelId').value = '';
    document.getElementById('channelName').value = '';
    document.getElementById('channelType').value = '1';
    document.getElementById('channelBaseUrl').value = '';
    document.getElementById('channelKey').value = '';
    document.getElementById('channelModels').value = '';
    document.getElementById('channelGroup').value = 'default';
    document.getElementById('channelPriority').value = '0';
    document.getElementById('channelWeight').value = '0';
    document.getElementById('channelTestModel').value = '';
    document.getElementById('channelTag').value = '';
    document.getElementById('channelAutoBan').value = '0';
    document.getElementById('channelRemark').value = '';
    document.getElementById('channelModelMapping').value = '';
    document.getElementById('channelModal').classList.remove('hidden');
}

async function openEditChannelModal(id) {
    const res = await API.getChannel(id);
    if (!res.success || !res.data) { showToast('获取渠道失败', 'error'); return; }
    const ch = res.data;
    document.getElementById('channelModalTitle').textContent = '编辑渠道';
    document.getElementById('channelId').value = ch.id;
    document.getElementById('channelName').value = ch.name || '';
    document.getElementById('channelType').value = String(ch.type || 1);
    document.getElementById('channelBaseUrl').value = ch.base_url || '';
    document.getElementById('channelKey').value = (ch.key || '').replace(/,/g, '\n');
    document.getElementById('channelModels').value = (ch.models || '').split(',').filter(Boolean).join('\n');
    document.getElementById('channelGroup').value = ch.group || 'default';
    document.getElementById('channelPriority').value = ch.priority || 0;
    document.getElementById('channelWeight').value = ch.weight || 0;
    document.getElementById('channelTestModel').value = ch.test_model || '';
    document.getElementById('channelTag').value = ch.tag || '';
    document.getElementById('channelAutoBan').value = String(ch.auto_ban || 0);
    document.getElementById('channelRemark').value = ch.remark || '';
    // 模型映射：如果是对象，转换为JSON字符串
    if (ch.model_mapping && typeof ch.model_mapping === 'object') {
        document.getElementById('channelModelMapping').value = JSON.stringify(ch.model_mapping, null, 2);
    } else {
        document.getElementById('channelModelMapping').value = ch.model_mapping || '';
    }
    document.getElementById('channelModal').classList.remove('hidden');
}

function closeChannelModal() { document.getElementById('channelModal').classList.add('hidden'); }

async function saveChannel() {
    const id = document.getElementById('channelId').value;
    const name = document.getElementById('channelName').value.trim();
    const key = document.getElementById('channelKey').value.trim().replace(/\n/g, ',');
    if (!name) { showToast('请输入渠道名称', 'warning'); return; }
    if (!key && !id) { showToast('请输入密钥', 'warning'); return; }

    const modelsStr = document.getElementById('channelModels').value.trim().split('\n').filter(Boolean).join(',');
    const channelData = {
        name,
        type: parseInt(document.getElementById('channelType').value),
        base_url: document.getElementById('channelBaseUrl').value.trim(),
        key,
        models: modelsStr,
        group: document.getElementById('channelGroup').value.trim() || 'default',
        priority: parseInt(document.getElementById('channelPriority').value) || 0,
        weight: parseInt(document.getElementById('channelWeight').value) || 0,
        test_model: document.getElementById('channelTestModel').value.trim(),
        tag: document.getElementById('channelTag').value.trim(),
        auto_ban: parseInt(document.getElementById('channelAutoBan').value) || 0,
        remark: document.getElementById('channelRemark').value.trim(),
    };

    // 处理模型映射：尝试解析JSON
    const modelMappingStr = document.getElementById('channelModelMapping').value.trim();
    if (modelMappingStr) {
        try {
            channelData.model_mapping = JSON.parse(modelMappingStr);
        } catch (e) {
            showToast('模型映射格式错误，请输入有效的JSON', 'warning');
            return;
        }
    }

    let res;
    if (id) {
        channelData.id = parseInt(id);
        res = await API.updateChannel(channelData);
    } else {
        const payload = {
            mode: 'single',
            channel: channelData
        };
        res = await API.createChannel(payload);
    }

    if (res.success) {
        showToast(id ? '渠道已更新' : '渠道已创建', 'success');
        closeChannelModal();
        loadChannels();
    } else {
        showToast(res.message || '操作失败', 'error');
    }
}

async function testChannel(id) {
    showToast('测速中...', 'info');
    const res = await API.testChannel(id);
    if (res.success) {
        showToast(`测速成功：${res.data || ''}`, 'success');
        loadChannels();
    } else {
        showToast(`测速失败：${res.message || ''}`, 'error');
    }
}

async function testAllChannels() {
    showToast('正在测试所有渠道，请稍候...', 'info');
    const res = await API.testAllChannels();
    if (res.success) {
        showToast('测试完成', 'success');
        loadChannels();
    } else {
        showToast(res.message || '测试失败', 'error');
    }
}

async function updateBalance(id) {
    const res = await API.updateChannelBalance(id);
    if (res.success) {
        showToast('余额已更新', 'success');
        loadChannels();
    } else {
        showToast(res.message || '更新失败', 'error');
    }
}

async function updateAllBalance() {
    showToast('正在更新所有渠道余额...', 'info');
    const res = await API.updateAllChannelBalance();
    if (res.success) {
        showToast('余额更新完成', 'success');
        loadChannels();
    } else {
        showToast(res.message || '更新失败', 'error');
    }
}

async function toggleChannelStatus(id, currentStatus) {
    // 先获取完整的渠道信息
    const getRes = await API.getChannel(id);
    if (!getRes.success || !getRes.data) {
        showToast('获取渠道信息失败', 'error');
        return;
    }
    
    const channel = getRes.data;
    const newStatus = currentStatus === 1 ? 2 : 1;
    channel.status = newStatus;
    
    const res = await API.updateChannel(channel);
    if (res.success) {
        showToast(newStatus === 1 ? '已启用' : '已禁用', 'success');
        loadChannels();
    } else {
        showToast(res.message || '操作失败', 'error');
    }
}

async function deleteChannel(id, name) {
    if (!confirm(`确定删除渠道「${name}」？`)) return;
    const res = await API.deleteChannel(id);
    if (res.success) {
        showToast('渠道已删除', 'success');
        loadChannels();
    } else {
        showToast(res.message || '删除失败', 'error');
    }
}

// 克隆渠道
async function cloneChannel(id) {
    const res = await API.getChannel(id);
    if (!res.success || !res.data) { showToast('获取渠道失败', 'error'); return; }
    const ch = res.data;
    const cloneData = {
        name: ch.name + '_copy',
        type: ch.type,
        base_url: ch.base_url || '',
        key: ch.key || '',
        models: ch.models || '',
        group: ch.group || 'default',
        priority: ch.priority || 0,
    };
    const payload = { mode: 'single', channel: cloneData };
    const createRes = await API.createChannel(payload);
    if (createRes.success) {
        showToast('渠道已克隆', 'success');
        loadChannels();
    } else {
        showToast(createRes.message || '克隆失败', 'error');
    }
}

// 批量操作
let selectedChannels = new Set();

function toggleSelectChannel(id) {
    if (selectedChannels.has(id)) {
        selectedChannels.delete(id);
    } else {
        selectedChannels.add(id);
    }
    updateBatchActions();
}

function toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.ch-checkbox');
    checkboxes.forEach(cb => {
        const id = parseInt(cb.dataset.id);
        if (checked) {
            selectedChannels.add(id);
            cb.checked = true;
        } else {
            selectedChannels.delete(id);
            cb.checked = false;
        }
    });
    updateBatchActions();
}

function updateBatchActions() {
    const bar = document.getElementById('batchActionBar');
    const count = document.getElementById('selectedCount');
    if (bar) bar.style.display = selectedChannels.size > 0 ? 'flex' : 'none';
    if (count) count.textContent = selectedChannels.size;
}

async function batchEnable() {
    if (selectedChannels.size === 0) return;
    const promises = [...selectedChannels].map(async id => {
        const getRes = await API.getChannel(id);
        if (getRes.success && getRes.data) {
            const channel = getRes.data;
            channel.status = 1;
            return API.updateChannel(channel);
        }
    });
    await Promise.all(promises);
    showToast(`已启用 ${selectedChannels.size} 个渠道`, 'success');
    selectedChannels.clear();
    updateBatchActions();
    loadChannels();
}

async function batchDisable() {
    if (selectedChannels.size === 0) return;
    const promises = [...selectedChannels].map(async id => {
        const getRes = await API.getChannel(id);
        if (getRes.success && getRes.data) {
            const channel = getRes.data;
            channel.status = 2;
            return API.updateChannel(channel);
        }
    });
    await Promise.all(promises);
    showToast(`已禁用 ${selectedChannels.size} 个渠道`, 'success');
    selectedChannels.clear();
    updateBatchActions();
    loadChannels();
}

async function batchDelete() {
    if (selectedChannels.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedChannels.size} 个渠道？此操作不可撤销。`)) return;
    const promises = [...selectedChannels].map(id => API.deleteChannel(id));
    await Promise.all(promises);
    showToast(`已删除 ${selectedChannels.size} 个渠道`, 'success');
    selectedChannels.clear();
    updateBatchActions();
    loadChannels();
}

let searchTimer;
document.addEventListener('DOMContentLoaded', async () => {
    // 验证管理员权限
    const res = await API.getUserInfo();
    if (!res.success || !res.data || (res.data.role || 0) < 10) {
        showToast('您没有权限访问此页面', 'error');
        setTimeout(() => window.location.href = 'console.html', 1500);
        return;
    }
    renderSidebar('channel');
    loadChannels();

    const searchInput = document.getElementById('channelSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { chPage = 1; loadChannels(); }, 400);
        });
    }
});
