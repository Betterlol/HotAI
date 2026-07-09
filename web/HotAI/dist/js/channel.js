// 渠道管理模块
// 全局状态
const ChannelState = {
    channels: [],
    currentPage: 1,
    pageSize: 10,
    totalCount: 0,
    selectedIds: new Set(),
    filters: {
        keyword: '',
        model: '',
        group: '',
        status: '',
        type: '',
        sort_by: 'id',
        sort_order: 'desc'
    },
    allModels: [],
    allGroups: [],
    prefillGroups: [],
    channelTypes: [
        {value:1,label:'OpenAI',icon:'🤖'},{value:3,label:'Azure',icon:'☁️'},{value:8,label:'自定义渠道',icon:'🔧'},
        {value:11,label:'Google PaLM',icon:'🅖'},{value:14,label:'Claude',icon:'🎭'},{value:15,label:'Baidu',icon:'🐾'},
        {value:16,label:'Zhipu',icon:'智'},{value:17,label:'Ali',icon:'🐱'},{value:18,label:'Xunfei',icon:'讯'},
        {value:19,label:'360 GPT',icon:'360'},{value:23,label:'Tencent',icon:'腾'},{value:24,label:'Gemini',icon:'✨'},
        {value:25,label:'Moonshot',icon:'🌙'},{value:26,label:'Baichuan',icon:'百'},{value:27,label:'Minimax',icon:'Ⓜ️'},
        {value:28,label:'Deepseek',icon:'🔍'},{value:29,label:'Groq',icon:'⚡'},{value:30,label:'Ollama',icon:'🦙'},
        {value:31,label:'零一万物',icon:'01'},{value:32,label:'StepFun',icon:'阶'},{value:33,label:'Coze',icon:'🎨'},
        {value:34,label:'Cohere',icon:'cohère'},{value:35,label:'Mistral',icon:'🌬️'},{value:36,label:'OpenRouter',icon:'🔀'},
        {value:37,label:'Together',icon:'🤝'},{value:38,label:'Cloudflare',icon:'☁️'},{value:39,label:'Vertex AI',icon:'🔷'},
        {value:41,label:'Vertex AI',icon:'🔶'},{value:42,label:'Hunyuan',icon:'混'},{value:43,label:'SiliconFlow',icon:'硅'},
        {value:44,label:'Doubao',icon:'豆'},{value:45,label:'VolcEngine',icon:'火'},{value:46,label:'Novita',icon:'🆕'},
        {value:47,label:'X.AI',icon:'✖️'},{value:48,label:'Perplexity',icon:'❓'},{value:49,label:'AWS Bedrock',icon:'🪨'},
        {value:50,label:'Stepfun',icon:'步'},{value:51,label:'Github',icon:'🐙'},{value:52,label:'VoyageAI',icon:'⛵'},
        {value:53,label:'JinaAI',icon:'🍱'},{value:54,label:'DeepL',icon:'🇩🇪'},{value:55,label:'FakeAI',icon:'🎪'},
        {value:56,label:'Luma',icon:'🎬'},{value:57,label:'Codex',icon:'📝'},{value:58,label:'高级自定义',icon:'⚙️'}
    ],
    isEditing: false,
    editingId: null,
    modelTagsState: [],
    groupTagsState: [],
    modelMappingRows: []
};

// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
    // 权限检查（需要管理员权限）
    const user = Auth.getCurrentUser();
    if (!user || user.role < 10) {
        showToast('需要管理员权限才能访问渠道管理', 'error');
        setTimeout(() => window.location.href = 'console.html', 1500);
        return;
    }

    // 初始化数据
    await Promise.all([
        loadAllModels(),
        loadGroups(),
        loadPrefillGroups()
    ]);

    // 初始化UI
    initTypeDropdown();
    initFilters();
    initSearchListeners();
    
    // 加载渠道列表
    await loadChannels();
    
    // 点击外部关闭下拉
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.type-combobox-wrap')) {
            document.getElementById('typeComboboxDropdown').classList.remove('show');
        }
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.action-menu.show').forEach(m => m.classList.remove('show'));
        }
    });
});

// ========== 数据加载 ==========
async function loadAllModels() {
    try {
        const res = await API.getAllChannelModels();
        if (res.success && res.data) {
            ChannelState.allModels = res.data.map(m => m.id || m).filter(Boolean);
        }
    } catch (err) {
        console.error('加载模型列表失败:', err);
    }
}

async function loadGroups() {
    try {
        const res = await API.getGroups();
        if (res.success && res.data) {
            ChannelState.allGroups = res.data;
            const select = document.getElementById('filterGroup');
            res.data.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g;
                opt.textContent = g;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('加载分组失败:', err);
    }
}

async function loadPrefillGroups() {
    try {
        const res = await API.getPrefillGroups('model');
        if (res.success && res.data) {
            ChannelState.prefillGroups = res.data;
        }
    } catch (err) {
        console.error('加载预填分组失败:', err);
    }
}

async function loadChannels() {
    const params = {
        p: ChannelState.currentPage,
        page_size: ChannelState.pageSize,
        ...Object.fromEntries(Object.entries(ChannelState.filters).filter(([k,v]) => v))
    };
    
    try {
        const res = params.keyword || params.model 
            ? await API.searchChannelsEx(params)
            : await API.getChannelsEx(params);
        
        if (res.success) {
            ChannelState.channels = res.data || [];
            ChannelState.totalCount = res.total || 0;
            renderChannelTable();
            renderPagination();
        } else {
            showToast(res.message || '加载失败', 'error');
        }
    } catch (err) {
        console.error('加载渠道失败:', err);
        showToast('加载渠道失败', 'error');
    }
}

// ========== 表格渲染 ==========
function renderChannelTable() {
    const tbody = document.getElementById('channelTableBody');
    if (!ChannelState.channels.length) {
        tbody.innerHTML = '<tr><td colspan="16" style="text-align:center;padding:40px;color:var(--c-text-secondary);">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = ChannelState.channels.map(ch => `
        <tr>
            <td><input type="checkbox" class="ch-checkbox" data-id="${ch.id}" ${ChannelState.selectedIds.has(ch.id)?'checked':''}></td>
            <td class="td-mono">${ch.id}</td>
            <td><strong>${escapeHtml(ch.name || '-')}</strong></td>
            <td>${getTypeLabel(ch.type)}</td>
            <td>${getStatusBadge(ch.status)}</td>
            <td>${escapeHtml(ch.group || '-')}</td>
            <td>${getModelsPreview(ch.models)}</td>
            <td>${ch.tag ? `<span class="badge badge-gray">${escapeHtml(ch.tag)}</span>` : '-'}</td>
            <td>${ch.priority||0}</td>
            <td>${ch.weight||0}</td>
            <td>$${formatMoney(ch.balance)}</td>
            <td>$${formatMoney(ch.used_quota)}</td>
            <td>$${formatMoney((ch.balance||0)-(ch.used_quota||0))}</td>
            <td>${ch.response_time ? ch.response_time+'ms' : '-'}</td>
            <td>${formatTime(ch.test_time)}</td>
            <td class="td-actions">
                <button class="btn btn-sm btn-secondary" onclick="testChannel(${ch.id})">测试</button>
                <button class="btn btn-sm btn-secondary" onclick="editChannel(${ch.id})">编辑</button>
                <button class="btn btn-sm btn-secondary" onclick="updateChannelBalance(${ch.id})">余额</button>
                <button class="btn btn-sm btn-secondary" onclick="copyChannel(${ch.id})">复制</button>
                <button class="btn btn-sm ${ch.status===1?'btn-warning':'btn-success'}" onclick="toggleChannelStatus(${ch.id},${ch.status})">${ch.status===1?'禁用':'启用'}</button>
                <div class="action-dropdown" style="display:inline-block;">
                    <button class="btn btn-sm btn-secondary" onclick="toggleActionMenu(event,${ch.id})">···</button>
                    <div class="action-menu" id="actionMenu${ch.id}">
                        <button class="action-menu-item" onclick="checkUpstreamUpdate(${ch.id})">仅检测上游模型</button>
                        <button class="action-menu-item" onclick="syncUpstreamUpdate(${ch.id})">处理上游模型更新</button>
                        <div class="action-menu-sep"></div>
                        <button class="action-menu-item danger" onclick="deleteChannel(${ch.id})">删除</button>
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
    
    // 绑定复选框事件
    tbody.querySelectorAll('.ch-checkbox').forEach(cb => {
        cb.addEventListener('change', handleCheckboxChange);
    });
}

function renderPagination() {
    document.getElementById('totalChannels').textContent = ChannelState.totalCount;
    const pages = Math.ceil(ChannelState.totalCount / ChannelState.pageSize);
    const container = document.getElementById('paginationPages');
    if (pages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = `<button class="page-btn" ${ChannelState.currentPage===1?'disabled':''} onclick="goToPage(${ChannelState.currentPage-1})">‹</button>`;
    for (let i = 1; i <= Math.min(pages, 10); i++) {
        html += `<button class="page-btn ${i===ChannelState.currentPage?'active':''}" onclick="goToPage(${i})">${i}</button>`;
    }
    if (pages > 10) html += '<span style="padding:0 8px;">...</span>';
    html += `<button class="page-btn" ${ChannelState.currentPage===pages?'disabled':''} onclick="goToPage(${ChannelState.currentPage+1})">›</button>`;
    container.innerHTML = html;
}

function goToPage(page) {
    ChannelState.currentPage = page;
    loadChannels();
}

// ========== 渠道操作 ==========
function openChannelModal(editId = null) {
    ChannelState.isEditing = !!editId;
    ChannelState.editingId = editId;
    document.getElementById('chModalTitleText').textContent = editId ? '编辑渠道' : '创建渠道';
    
    if (editId) {
        loadChannelToForm(editId);
        document.getElementById('chAddModeRow').style.display = 'none';
        document.getElementById('chRevealKeyBtn').style.display = 'inline-flex';
    } else {
        resetChannelForm();
        document.getElementById('chAddModeRow').style.display = 'block';
        document.getElementById('chRevealKeyBtn').style.display = 'none';
    }
    
    document.getElementById('channelModal').classList.remove('hidden');
    renderPrefillGroupButtons();
}

function closeChannelModal() {
    document.getElementById('channelModal').classList.add('hidden');
    resetChannelForm();
}

function resetChannelForm() {
    document.getElementById('chId').value = '';
    document.getElementById('chType').value = '0';
    document.getElementById('chName').value = '';
    document.getElementById('chKey').value = '';
    document.getElementById('chBaseUrl').value = '';
    document.getElementById('chStatusSwitch').checked = true;
    ChannelState.modelTagsState = [];
    ChannelState.groupTagsState = ['default'];
    ChannelState.modelMappingRows = [];
    renderModelTags();
    renderGroupTags();
    renderModelMappingEditor();
    switchChannelSection('sec-basic', document.querySelector('[data-section="sec-basic"]'));
}

async function loadChannelToForm(id) {
    try {
        const res = await API.getChannel(id);
        if (!res.success || !res.data) {
            showToast('加载渠道详情失败', 'error');
            return;
        }
        const ch = res.data;
        document.getElementById('chId').value = ch.id;
        document.getElementById('chType').value = ch.type;
        document.getElementById('chName').value = ch.name || '';
        document.getElementById('chBaseUrl').value = ch.base_url || '';
        document.getElementById('chPriority').value = ch.priority || 0;
        document.getElementById('chWeight').value = ch.weight || 0;
        document.getElementById('chTestModel').value = ch.test_model || '';
        document.getElementById('chAutoBan').checked = (ch.auto_ban ?? 1) === 1;
        document.getElementById('chTag').value = ch.tag || '';
        document.getElementById('chRemark').value = ch.remark || '';
        
        // 模型与分组
        ChannelState.modelTagsState = (ch.models || '').split(',').map(m => m.trim()).filter(Boolean);
        ChannelState.groupTagsState = (ch.group || 'default').split(',').map(g => g.trim()).filter(Boolean);
        renderModelTags();
        renderGroupTags();
        
        // 模型映射
        if (ch.model_mapping) {
            try {
                const mapping = JSON.parse(ch.model_mapping);
                ChannelState.modelMappingRows = Object.entries(mapping).map(([k,v]) => ({source:k, target:v}));
            } catch {}
        }
        renderModelMappingEditor();
        
        // 高级设置
        document.getElementById('chStatusCodeMapping').value = ch.status_code_mapping || '';
        document.getElementById('chParamOverride').value = ch.param_override || '';
        document.getElementById('chHeaderOverride').value = ch.header_override || '';
        document.getElementById('chProxy').value = ch.proxy || '';
        document.getElementById('chSystemPrompt').value = ch.system_prompt || '';
        document.getElementById('chSystemPromptOverride').checked = ch.system_prompt_override || false;
        document.getElementById('chForceFormat').checked = ch.force_format || false;
        document.getElementById('chThinkingToContent').checked = ch.thinking_to_content || false;
        document.getElementById('chPassThroughBody').checked = ch.pass_through_body_enabled || false;
        
        updateTypeComboboxDisplay(ch.type);
        onTypeChange(ch.type);
    } catch (err) {
        console.error('加载渠道失败:', err);
        showToast('加载渠道失败', 'error');
    }
}

async function saveChannel() {
    const isEdit = !!document.getElementById('chId').value;
    const formData = collectFormData();
    
    if (!formData.name || !formData.type || (!isEdit && !formData.key)) {
        showToast('请填写必填字段', 'error');
        return;
    }
    
    try {
        const res = isEdit 
            ? await API.updateChannel({id: parseInt(formData.id), ...formData})
            : await API.createChannel({
                mode: formData.multi_key_mode || 'single',
                channel: formData
            });
        
        if (res.success) {
            showToast(isEdit ? '保存成功' : '创建成功', 'success');
            closeChannelModal();
            loadChannels();
        } else {
            showToast(res.message || '保存失败', 'error');
        }
    } catch (err) {
        console.error('保存失败:', err);
        showToast('保存失败', 'error');
    }
}

function collectFormData() {
    return {
        id: document.getElementById('chId').value,
        type: parseInt(document.getElementById('chType').value),
        name: document.getElementById('chName').value.trim(),
        status: document.getElementById('chStatusSwitch').checked ? 1 : 2,
        key: document.getElementById('chKey').value.trim(),
        base_url: document.getElementById('chBaseUrl').value.trim(),
        models: ChannelState.modelTagsState.join(','),
        group: ChannelState.groupTagsState.join(','),
        model_mapping: ChannelState.modelMappingRows.length ? JSON.stringify(Object.fromEntries(ChannelState.modelMappingRows.map(r => [r.source, r.target]))) : '',
        priority: parseInt(document.getElementById('chPriority').value) || 0,
        weight: parseInt(document.getElementById('chWeight').value) || 0,
        test_model: document.getElementById('chTestModel').value.trim(),
        auto_ban: document.getElementById('chAutoBan').checked ? 1 : 0,
        tag: document.getElementById('chTag').value.trim(),
        remark: document.getElementById('chRemark').value.trim(),
        status_code_mapping: document.getElementById('chStatusCodeMapping').value.trim(),
        param_override: document.getElementById('chParamOverride').value.trim(),
        header_override: document.getElementById('chHeaderOverride').value.trim(),
        proxy: document.getElementById('chProxy').value.trim(),
        system_prompt: document.getElementById('chSystemPrompt').value.trim(),
        system_prompt_override: document.getElementById('chSystemPromptOverride').checked,
        force_format: document.getElementById('chForceFormat').checked,
        thinking_to_content: document.getElementById('chThinkingToContent').checked,
        pass_through_body_enabled: document.getElementById('chPassThroughBody').checked,
        multi_key_mode: document.getElementById('chMultiKeyMode').value,
        multi_key_type: document.getElementById('chMultiKeyType').value
    };
}

async function deleteChannel(id) {
    if (!confirm('确认删除该渠道？此操作不可恢复')) return;
    try {
        const res = await API.deleteChannel(id);
        if (res.success) {
            showToast('删除成功', 'success');
            loadChannels();
        } else {
            showToast(res.message || '删除失败', 'error');
        }
    } catch (err) {
        showToast('删除失败', 'error');
    }
}

async function toggleChannelStatus(id, currentStatus) {
    const newStatus = currentStatus === 1 ? 2 : 1;
    try {
        const res = await API.updateChannelStatus(id, newStatus);
        if (res.success) {
            showToast(newStatus === 1 ? '已启用' : '已禁用', 'success');
            loadChannels();
        } else {
            showToast(res.message || '操作失败', 'error');
        }
    } catch (err) {
        showToast('操作失败', 'error');
    }
}

// testChannel：打开测试弹窗（含模型列表、批量测试等高级功能）
function testChannel(id) {
    openTestModal(id);
}

// quickTestChannel：快速单次测试（供其他入口调用）
async function quickTestChannel(id) {
    showToast('测试中...', 'info');
    try {
        const res = await API.testChannel(id);
        if (res.success) {
            showToast(`测试成功 响应时间: ${res.data?.response_time || 0}ms`, 'success');
            loadChannels();
        } else {
            showToast(res.message || '测试失败', 'error');
        }
    } catch (err) {
        showToast('测试失败', 'error');
    }
}

async function updateChannelBalance(id) {
    showToast('更新中...', 'info');
    try {
        const res = await API.updateChannelBalance(id);
        if (res.success) {
            showToast('余额已更新', 'success');
            loadChannels();
        } else {
            showToast(res.message || '更新失败', 'error');
        }
    } catch (err) {
        showToast('更新失败', 'error');
    }
}

async function copyChannel(id) {
    try {
        const res = await API.copyChannel(id);
        if (res.success) {
            showToast('复制成功', 'success');
            loadChannels();
        } else {
            showToast(res.message || '复制失败', 'error');
        }
    } catch (err) {
        showToast('复制失败', 'error');
    }
}

async function checkUpstreamUpdate(id) {
    showToast('检测中...', 'info');
    try {
        const res = await API.checkUpstreamModelUpdate(id);
        if (res.success) {
            showToast('检测完成', 'success');
        } else {
            showToast(res.message || '检测失败', 'error');
        }
    } catch (err) {
        showToast('检测失败', 'error');
    }
}

async function syncUpstreamUpdate(id) {
    if (!confirm('确认同步上游模型更新？')) return;
    try {
        const res = await API.syncUpstreamModelUpdate(id);
        if (res.success) {
            showToast('同步成功', 'success');
            loadChannels();
        } else {
            showToast(res.message || '同步失败', 'error');
        }
    } catch (err) {
        showToast('同步失败', 'error');
    }
}

// ========== 批量操作 ==========
function handleCheckboxChange(e) {
    const id = parseInt(e.target.dataset.id);
    if (e.target.checked) {
        ChannelState.selectedIds.add(id);
    } else {
        ChannelState.selectedIds.delete(id);
    }
    updateBatchBar();
}

function toggleSelectAll(checked) {
    ChannelState.selectedIds.clear();
    if (checked) {
        ChannelState.channels.forEach(ch => ChannelState.selectedIds.add(ch.id));
    }
    document.querySelectorAll('.ch-checkbox').forEach(cb => cb.checked = checked);
    updateBatchBar();
}

function updateBatchBar() {
    const bar = document.getElementById('channelBatchBar');
    const count = ChannelState.selectedIds.size;
    document.getElementById('batchSelectedCount').textContent = count;
    bar.classList.toggle('show', count > 0);
}

function cancelBatchSelection() {
    ChannelState.selectedIds.clear();
    document.getElementById('selectAllChannels').checked = false;
    document.querySelectorAll('.ch-checkbox').forEach(cb => cb.checked = false);
    updateBatchBar();
}

async function batchEnableChannels() {
    if (ChannelState.selectedIds.size === 0) return;
    try {
        const res = await API.batchUpdateChannelStatus([...ChannelState.selectedIds], 1);
        if (res.success) {
            showToast('批量启用成功', 'success');
            cancelBatchSelection();
            loadChannels();
        } else {
            showToast(res.message || '操作失败', 'error');
        }
    } catch (err) {
        showToast('操作失败', 'error');
    }
}

async function batchDisableChannels() {
    if (ChannelState.selectedIds.size === 0) return;
    try {
        const res = await API.batchUpdateChannelStatus([...ChannelState.selectedIds], 2);
        if (res.success) {
            showToast('批量禁用成功', 'success');
            cancelBatchSelection();
            loadChannels();
        } else {
            showToast(res.message || '操作失败', 'error');
        }
    } catch (err) {
        showToast('操作失败', 'error');
    }
}

async function batchDeleteChannels() {
    if (ChannelState.selectedIds.size === 0) return;
    if (!confirm(`确认删除选中的 ${ChannelState.selectedIds.size} 个渠道？`)) return;
    try {
        const res = await API.batchDeleteChannels([...ChannelState.selectedIds]);
        if (res.success) {
            showToast('批量删除成功', 'success');
            cancelBatchSelection();
            loadChannels();
        } else {
            showToast(res.message || '操作失败', 'error');
        }
    } catch (err) {
        showToast('操作失败', 'error');
    }
}

function openBatchSetTagDialog() {
    if (ChannelState.selectedIds.size === 0) return;
    const tag = prompt('输入标签名称（留空则清除标签）:');
    if (tag === null) return;
    batchSetTag(tag.trim());
}

async function batchSetTag(tag) {
    try {
        const res = await API.batchSetChannelTag([...ChannelState.selectedIds], tag || null);
        if (res.success) {
            showToast('标签设置成功', 'success');
            cancelBatchSelection();
            loadChannels();
        } else {
            showToast(res.message || '操作失败', 'error');
        }
    } catch (err) {
        showToast('操作失败', 'error');
    }
}

// ========== 类型下拉 ==========
function initTypeDropdown() {
    const list = document.getElementById('typeComboboxList');
    list.innerHTML = ChannelState.channelTypes.map(t => `
        <div class="type-combobox-option" data-type="${t.value}" onclick="selectChannelType(${t.value})">
            <span style="font-size:18px;">${t.icon}</span>
            <span>${t.label}</span>
        </div>
    `).join('');
}

function toggleTypeDropdown() {
    const dropdown = document.getElementById('typeComboboxDropdown');
    dropdown.classList.toggle('show');
    if (dropdown.classList.contains('show')) {
        document.getElementById('typeSearchInput').focus();
    }
}

function filterTypeOptions(keyword) {
    const kw = keyword.toLowerCase();
    document.querySelectorAll('.type-combobox-option').forEach(opt => {
        const text = opt.textContent.toLowerCase();
        opt.style.display = text.includes(kw) ? 'flex' : 'none';
    });
}

function selectChannelType(type) {
    document.getElementById('chType').value = type;
    updateTypeComboboxDisplay(type);
    document.getElementById('typeComboboxDropdown').classList.remove('show');
    onTypeChange(type);
}

function updateTypeComboboxDisplay(type) {
    const typeInfo = ChannelState.channelTypes.find(t => t.value === type) || {icon:'📡', label:'未知类型'};
    document.getElementById('typeComboboxLabel').innerHTML = `<span style="font-size:18px;margin-right:6px;">${typeInfo.icon}</span>${typeInfo.label}`;
    document.getElementById('chModalTypeIcon').textContent = typeInfo.icon;
    document.getElementById('chModalTypeName').textContent = typeInfo.label;
}

function onTypeChange(type) {
    // 根据类型显示/隐藏特定字段
    document.getElementById('chOrgRow').style.display = type === 1 ? 'block' : 'none';
    document.getElementById('chAzureEndpointRow').style.display = type === 3 ? 'block' : 'none';
    const otherRow = document.getElementById('chOtherRow');
    otherRow.style.display = [3,18,21,39,41,49].includes(type) ? 'block' : 'none';
    document.getElementById('chAwsKeyTypeRow').style.display = type === 49 ? 'block' : 'none';
    document.getElementById('chVertexKeyTypeRow').style.display = type === 41 ? 'block' : 'none';
    document.getElementById('fetchModelsBtn').style.display = [1,3,14,24,25,28,29,30].includes(type) ? 'inline-flex' : 'none';
}

// ========== 筛选与搜索 ==========
function initFilters() {
    const typeSelect = document.getElementById('filterType');
    ChannelState.channelTypes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.value;
        opt.textContent = `${t.icon} ${t.label}`;
        typeSelect.appendChild(opt);
    });
}

function initSearchListeners() {
    let keywordTimeout, modelTimeout;
    document.getElementById('searchKeyword').addEventListener('input', (e) => {
        clearTimeout(keywordTimeout);
        keywordTimeout = setTimeout(() => {
            ChannelState.filters.keyword = e.target.value.trim();
            ChannelState.currentPage = 1;
            loadChannels();
        }, 400);
    });
    document.getElementById('searchModel').addEventListener('input', (e) => {
        clearTimeout(modelTimeout);
        modelTimeout = setTimeout(() => {
            ChannelState.filters.model = e.target.value.trim();
            ChannelState.currentPage = 1;
            loadChannels();
        }, 400);
    });
}

function resetFilters() {
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchModel').value = '';
    document.getElementById('filterGroup').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterType').value = '';
    ChannelState.filters = { keyword:'', model:'', group:'', status:'', type:'', sort_by:'id', sort_order:'desc' };
    ChannelState.currentPage = 1;
    loadChannels();
}

function toggleSort() {
    ChannelState.filters.sort_order = ChannelState.filters.sort_order === 'asc' ? 'desc' : 'asc';
    loadChannels();
}

// ========== 全局操作 ==========
async function testAllChannels() {
    showToast('正在测试所有渠道...', 'info');
    try {
        const res = await API.testAllChannels();
        if (res.success) {
            showToast('测试完成', 'success');
            loadChannels();
        } else {
            showToast(res.message || '测试失败', 'error');
        }
    } catch (err) {
        showToast('测试失败', 'error');
    }
}

async function updateAllChannelsBalance() {
    showToast('正在更新所有渠道余额...', 'info');
    try {
        const res = await API.updateAllChannelBalance();
        if (res.success) {
            showToast('余额更新完成', 'success');
            loadChannels();
        } else {
            showToast(res.message || '更新失败', 'error');
        }
    } catch (err) {
        showToast('更新失败', 'error');
    }
}

// ========== 模型标签组件 ==========
function onModelInputChange(value) {
    if (!value) {
        document.getElementById('modelDropdown').style.display = 'none';
        return;
    }
    const kw = value.toLowerCase();
    const results = ChannelState.allModels.filter(m => m.toLowerCase().includes(kw)).slice(0, 20);
    const dd = document.getElementById('modelDropdown');
    if (!results.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = results.map(m => `<div class="model-dropdown-item" onclick="addModel('${escapeHtml(m)}')">${escapeHtml(m)}</div>`).join('');
    dd.style.display = 'block';
}

function onModelKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const val = event.target.value.trim().replace(/,$/, '');
        if (val) addModel(val);
    } else if (event.key === 'Backspace' && !event.target.value) {
        ChannelState.modelTagsState.pop();
        renderModelTags();
    }
}

function addModel(model) {
    model = model.trim();
    if (model && !ChannelState.modelTagsState.includes(model)) {
        ChannelState.modelTagsState.push(model);
        renderModelTags();
    }
    document.getElementById('modelTagsInput').value = '';
    document.getElementById('modelDropdown').style.display = 'none';
}

function removeModel(idx) {
    ChannelState.modelTagsState.splice(idx, 1);
    renderModelTags();
}

function renderModelTags() {
    const wrap = document.getElementById('modelTagsWrap');
    const input = document.getElementById('modelTagsInput');
    wrap.querySelectorAll('.model-tag').forEach(t => t.remove());
    ChannelState.modelTagsState.forEach((m, i) => {
        const tag = document.createElement('span');
        tag.className = 'model-tag';
        tag.innerHTML = `${escapeHtml(m)} <span class="tag-del" onclick="removeModel(${i})">✕</span>`;
        wrap.insertBefore(tag, input);
    });
}

function fillAllModels() {
    ChannelState.modelTagsState = [...new Set([...ChannelState.modelTagsState, ...ChannelState.allModels])];
    renderModelTags();
}

function clearModels() {
    ChannelState.modelTagsState = [];
    renderModelTags();
}

async function copyModels() {
    const text = ChannelState.modelTagsState.join(',');
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板', 'success');
    } catch {
        showToast('复制失败', 'error');
    }
}

async function openFetchModelsDialog() {
    const id = document.getElementById('chId').value;
    if (!id) {
        showToast('请先保存渠道后再从上游获取模型', 'warning');
        return;
    }
    showToast('正在从上游获取模型...', 'info');
    try {
        const res = await API.fetchUpstreamModels(parseInt(id));
        if (res.success && res.data) {
            const newModels = res.data.filter(m => !ChannelState.modelTagsState.includes(m));
            ChannelState.modelTagsState = [...ChannelState.modelTagsState, ...newModels];
            renderModelTags();
            showToast(`成功获取 ${res.data.length} 个模型`, 'success');
        } else {
            showToast(res.message || '获取失败', 'error');
        }
    } catch (err) {
        showToast('获取失败', 'error');
    }
}

// ========== 分组标签组件 ==========
function onGroupInputChange(value) {
    if (!value) {
        document.getElementById('groupDropdown').style.display = 'none';
        return;
    }
    const kw = value.toLowerCase();
    const results = ChannelState.allGroups.filter(g => g.toLowerCase().includes(kw)).slice(0, 10);
    const dd = document.getElementById('groupDropdown');
    if (!results.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = results.map(g => `<div class="model-dropdown-item" onclick="addGroup('${escapeHtml(g)}')">${escapeHtml(g)}</div>`).join('');
    dd.style.display = 'block';
}

function onGroupKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const val = event.target.value.trim();
        if (val) addGroup(val);
    } else if (event.key === 'Backspace' && !event.target.value) {
        ChannelState.groupTagsState.pop();
        renderGroupTags();
    }
}

function addGroup(group) {
    group = group.trim();
    if (group && !ChannelState.groupTagsState.includes(group)) {
        ChannelState.groupTagsState.push(group);
        renderGroupTags();
    }
    document.getElementById('groupTagsInput').value = '';
    document.getElementById('groupDropdown').style.display = 'none';
}

function removeGroup(idx) {
    ChannelState.groupTagsState.splice(idx, 1);
    renderGroupTags();
}

function renderGroupTags() {
    const wrap = document.getElementById('groupTagsWrap');
    const input = document.getElementById('groupTagsInput');
    wrap.querySelectorAll('.model-tag').forEach(t => t.remove());
    ChannelState.groupTagsState.forEach((g, i) => {
        const tag = document.createElement('span');
        tag.className = 'model-tag';
        tag.innerHTML = `${escapeHtml(g)} <span class="tag-del" onclick="removeGroup(${i})">✕</span>`;
        wrap.insertBefore(tag, input);
    });
}

// ========== 模型映射编辑器 ==========
function addModelMappingRow(source='', target='') {
    ChannelState.modelMappingRows.push({source, target});
    renderModelMappingEditor();
}

function removeModelMappingRow(idx) {
    ChannelState.modelMappingRows.splice(idx, 1);
    renderModelMappingEditor();
}

function renderModelMappingEditor() {
    const editor = document.getElementById('modelMappingEditor');
    editor.innerHTML = ChannelState.modelMappingRows.map((row, i) => `
        <div class="kv-row">
            <input type="text" placeholder="客户端模型名" value="${escapeHtml(row.source)}" oninput="ChannelState.modelMappingRows[${i}].source=this.value">
            <span class="kv-sep">→</span>
            <input type="text" placeholder="上游模型名" value="${escapeHtml(row.target)}" oninput="ChannelState.modelMappingRows[${i}].target=this.value">
            <button class="kv-del-btn" onclick="removeModelMappingRow(${i})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
        </div>
    `).join('');
}

// ========== 预填分组按钮 ==========
function renderPrefillGroupButtons() {
    const container = document.getElementById('prefillGroupBtns');
    container.innerHTML = ChannelState.prefillGroups.map(g => `
        <button class="prefill-btn" onclick="addPrefillGroup(${g.id})">+ ${escapeHtml(g.name)}</button>
    `).join('');
}

function addPrefillGroup(id) {
    const group = ChannelState.prefillGroups.find(g => g.id === id);
    if (!group) return;
    let items = [];
    try {
        items = Array.isArray(group.items) ? group.items : JSON.parse(group.items);
    } catch {}
    const newModels = items.filter(m => m && !ChannelState.modelTagsState.includes(m));
    ChannelState.modelTagsState = [...ChannelState.modelTagsState, ...newModels];
    renderModelTags();
    showToast(`已添加 ${newModels.length} 个模型`, 'success');
}

// ========== 导航切换 ==========
function switchChannelSection(sectionId, btn) {
    document.querySelectorAll('.channel-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.channel-nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (btn) btn.classList.add('active');
}

// ========== 添加模式变更 ==========
function onAddModeChange() {
    const mode = document.getElementById('chMultiKeyMode').value;
    document.getElementById('chPollingModeRow').style.display = mode === 'multi_to_single' ? 'block' : 'none';
    document.getElementById('chBatchNameRow').style.display = mode === 'batch' ? 'block' : 'none';
}

// ========== 编辑渠道（快捷入口）==========
function editChannel(id) {
    openChannelModal(id);
}

// ========== 下拉菜单切换 ==========
function toggleActionMenu(event, channelId) {
    event.stopPropagation();
    const menu = document.getElementById(`actionMenu${channelId}`);
    const isShown = menu.classList.contains('show');
    document.querySelectorAll('.action-menu.show').forEach(m => m.classList.remove('show'));
    if (!isShown) menu.classList.add('show');
}

// ========== 查看密钥 ==========
async function revealChannelKey() {
    const id = document.getElementById('chId').value;
    if (!id) return;
    try {
        const res = await API.getChannelKey(parseInt(id));
        if (res.success && res.data) {
            const key = res.data.key;
            document.getElementById('chKey').value = key;
            showToast('密钥已加载', 'success');
        } else {
            showToast(res.message || '获取失败', 'error');
        }
    } catch (err) {
        showToast('获取失败', 'error');
    }
}

// ========== 密钥去重 ==========
function deduplicateKeys() {
    const textarea = document.getElementById('chKey');
    const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    const unique = [...new Set(lines)];
    const removed = lines.length - unique.length;
    textarea.value = unique.join('\n');
    if (removed > 0) {
        showToast(`已去除 ${removed} 个重复密钥`, 'success');
    } else {
        showToast('没有重复密钥', 'info');
    }
}

// ========== 工具函数 ==========
function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatMoney(val) {
    if (!val && val !== 0) return '-';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return '-';
    return num.toFixed(4);
}

function formatTime(timestamp) {
    if (!timestamp) return '-';
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'});
}

function getTypeLabel(type) {
    const t = ChannelState.channelTypes.find(t => t.value === type);
    if (!t) return `<span class="badge badge-gray">类型${type}</span>`;
    return `<span class="badge badge-blue">${t.icon} ${t.label}</span>`;
}

function getStatusBadge(status) {
    const map = {1:'badge-green',2:'badge-red',3:'badge-yellow'};
    const labels = {1:'启用',2:'禁用',3:'自动禁用'};
    const cls = map[status] || 'badge-gray';
    return `<span class="badge ${cls}">${labels[status] || '未知'}</span>`;
}

function getModelsPreview(models) {
    if (!models) return '-';
    const arr = models.split(',').map(m => m.trim()).filter(Boolean);
    if (!arr.length) return '-';
    if (arr.length <= 2) return arr.map(m => `<span class="model-count-badge">${escapeHtml(m)}</span>`).join(' ');
    return `<span class="model-count-badge">${arr.length} 个模型</span>`;
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

// ========== 测试弹窗功能 ==========
const TestModalState = {
    channelId: null,
    models: [],
    selectedModelIds: new Set(),
    testResults: {},
    isTesting: false,
    shouldStop: false
};

function openTestModal(channelId) {
    TestModalState.channelId = channelId;
    TestModalState.selectedModelIds.clear();
    TestModalState.testResults = {};
    TestModalState.isTesting = false;
    TestModalState.shouldStop = false;
    
    const channel = ChannelState.channels.find(ch => ch.id === channelId);
    if (!channel) return;
    
    document.getElementById('testModalChannelName').textContent = `- ${channel.name}`;
    TestModalState.models = (channel.models || '').split(',').map(m => m.trim()).filter(Boolean);
    
    renderTestModelTable();
    document.getElementById('channelTestModal').classList.remove('hidden');
}

function closeTestModal() {
    TestModalState.shouldStop = true;
    document.getElementById('channelTestModal').classList.add('hidden');
}

function renderTestModelTable() {
    const tbody = document.getElementById('testModelTableBody');
    const searchKw = document.getElementById('testModelSearch').value.toLowerCase();
    const filteredModels = searchKw ? TestModalState.models.filter(m => m.toLowerCase().includes(searchKw)) : TestModalState.models;
    
    tbody.innerHTML = filteredModels.map((model, idx) => {
        const result = TestModalState.testResults[model];
        const statusHtml = result ? getTestStatusHtml(result) : '<span class="test-result-idle">待测试</span>';
        const responseTime = result?.response_time ? `${result.response_time}ms` : '-';
        const checked = TestModalState.selectedModelIds.has(model) ? 'checked' : '';
        
        return `
            <tr>
                <td style="padding:10px 12px;"><input type="checkbox" class="test-model-checkbox" data-model="${escapeHtml(model)}" ${checked} onchange="toggleTestModelSelection('${escapeHtml(model)}', this.checked)"></td>
                <td style="padding:10px 12px;"><strong>${escapeHtml(model)}</strong></td>
                <td style="padding:10px 12px;">${statusHtml}</td>
                <td style="padding:10px 12px;">${responseTime}</td>
                <td style="padding:10px 12px;">
                    <button class="btn btn-sm btn-secondary" onclick="testSingleModel('${escapeHtml(model)}')" ${TestModalState.isTesting?'disabled':''}>测试</button>
                </td>
            </tr>
        `;
    }).join('');
    
    updateTestSummary();
}

function getTestStatusHtml(result) {
    if (result.success) return `<span class="test-result-success">✓ 成功</span>`;
    if (result.testing) return `<span class="test-result-testing">测试中...</span>`;
    return `<span class="test-result-error">✗ ${escapeHtml(result.message || '失败')}</span>`;
}

function toggleTestModelSelection(model, checked) {
    if (checked) TestModalState.selectedModelIds.add(model);
    else TestModalState.selectedModelIds.delete(model);
}

function toggleSelectAllTestModels(checked) {
    TestModalState.selectedModelIds.clear();
    if (checked) {
        TestModalState.models.forEach(m => TestModalState.selectedModelIds.add(m));
    }
    renderTestModelTable();
}

function filterTestModels(keyword) {
    renderTestModelTable();
}

async function testSingleModel(model) {
    TestModalState.testResults[model] = {testing: true};
    renderTestModelTable();
    
    try {
        const res = await API.testChannel(TestModalState.channelId);
        TestModalState.testResults[model] = {
            success: res.success,
            message: res.message,
            response_time: res.data?.response_time
        };
    } catch (err) {
        TestModalState.testResults[model] = {success: false, message: '网络错误'};
    }
    
    renderTestModelTable();
}

async function testSelectedModels() {
    if (TestModalState.selectedModelIds.size === 0) {
        showToast('请先选择要测试的模型', 'warning');
        return;
    }
    await batchTestModels([...TestModalState.selectedModelIds]);
}

async function testAllModels() {
    await batchTestModels(TestModalState.models);
}

async function batchTestModels(models) {
    TestModalState.isTesting = true;
    TestModalState.shouldStop = false;
    document.getElementById('testStopBtn').style.display = 'inline-flex';
    document.getElementById('testAllBtn').disabled = true;
    document.getElementById('testSelectedBtn').disabled = true;
    document.getElementById('testProgressWrap').style.display = 'block';
    
    let completed = 0;
    for (const model of models) {
        if (TestModalState.shouldStop) break;
        
        TestModalState.testResults[model] = {testing: true};
        renderTestModelTable();
        
        try {
            const res = await API.testChannel(TestModalState.channelId);
            TestModalState.testResults[model] = {
                success: res.success,
                message: res.message,
                response_time: res.data?.response_time
            };
        } catch (err) {
            TestModalState.testResults[model] = {success: false, message: '网络错误'};
        }
        
        completed++;
        const progress = (completed / models.length * 100).toFixed(0);
        document.getElementById('testProgressBar').style.width = `${progress}%`;
        document.getElementById('testProgressLabel').textContent = `${completed}/${models.length}`;
        document.getElementById('testProgressLabel').style.display = 'inline';
        
        renderTestModelTable();
    }
    
    TestModalState.isTesting = false;
    document.getElementById('testStopBtn').style.display = 'none';
    document.getElementById('testAllBtn').disabled = false;
    document.getElementById('testSelectedBtn').disabled = false;
    document.getElementById('testProgressLabel').style.display = 'none';
    
    showToast('批量测试完成', 'success');
    updateTestSummary();
}

function stopBatchTest() {
    TestModalState.shouldStop = true;
    showToast('正在停止测试...', 'info');
}

function updateTestSummary() {
    const results = Object.values(TestModalState.testResults);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => r.success === false).length;
    const totalTested = results.length;
    
    document.getElementById('testSummary').textContent = `已测试 ${totalTested}/${TestModalState.models.length}，成功 ${successCount}，失败 ${failCount}`;
    document.getElementById('applySuccessBtn').style.display = successCount > 0 ? 'inline-flex' : 'none';
}

function applySuccessModels() {
    const successModels = Object.entries(TestModalState.testResults)
        .filter(([_, result]) => result.success)
        .map(([model]) => model);
    
    ChannelState.modelTagsState = successModels;
    renderModelTags();
    showToast(`已应用 ${successModels.length} 个成功模型`, 'success');
    closeTestModal();
}

// ========== 修复筛选栏onChange ==========
// 添加筛选器监听器（需更新filters对象）
document.addEventListener('DOMContentLoaded', () => {
    const filterGroup = document.getElementById('filterGroup');
    const filterStatus = document.getElementById('filterStatus');
    const filterType = document.getElementById('filterType');
    
    if (filterGroup) {
        filterGroup.addEventListener('change', (e) => {
            ChannelState.filters.group = e.target.value;
            ChannelState.currentPage = 1;
            loadChannels();
        });
    }
    
    if (filterStatus) {
        filterStatus.addEventListener('change', (e) => {
            ChannelState.filters.status = e.target.value;
            ChannelState.currentPage = 1;
            loadChannels();
        });
    }
    
    if (filterType) {
        filterType.addEventListener('change', (e) => {
            ChannelState.filters.type = e.target.value;
            ChannelState.currentPage = 1;
            loadChannels();
        });
    }
});
