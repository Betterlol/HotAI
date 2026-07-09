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
    ].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
    isEditing: false,
    editingId: null,
    modelTagsState: [],
    groupTagsState: [],
    modelMappingRows: []
};

// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
    // 渲染侧边栏
    renderSidebar('channel');
    
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
    initTypeDropdown(); // 初始化类型下拉
    await initFilters();
    initSearchListeners();
    
    // 加载渠道列表
    await loadChannels();
    
    // 点击外部关闭下拉
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.type-combobox-wrap')) {
            const dd = document.getElementById('typeComboboxDropdown');
            if (dd) dd.classList.remove('show');
        }
        if (!e.target.closest('#modelSelectBtn') && !e.target.closest('#modelSelectDropdown')) {
            const dd = document.getElementById('modelSelectDropdown');
            if (dd) dd.style.display = 'none';
        }
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.action-menu.show').forEach(m => m.classList.remove('show'));
        }
    });
    // 筛选器 change 监听（合并，避免重复 DOMContentLoaded）
    ['filterGroup','filterStatus','filterType'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', (e) => {
            const key = id.replace('filter','').toLowerCase();
            ChannelState.filters[key] = e.target.value;
            ChannelState.currentPage = 1;
            loadChannels();
        });
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
    // 加载带 logo 的模型列表（懒加载，只在首次打开时执行）
    loadModelSelectList().then(() => {
        // 刷新空状态显示
        const empty = document.getElementById('modelTagsEmpty');
        if (empty && ChannelState.modelTagsState.length === 0) empty.style.display = '';
    });
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
    // 重置类型选择器显示
    document.getElementById('typeComboboxLabel').innerHTML = '请选择渠道类型';
    document.getElementById('chModalTypeIcon').innerHTML = '';
    document.getElementById('chModalTypeName').textContent = '';
    // 关闭高级设置
    const advContent = document.getElementById('advancedSettingsContent');
    if (advContent) advContent.style.display = 'none';
    // 重置类型相关字段
    ['chOrgRow','chAzureEndpointRow','chOtherRow','chAwsKeyTypeRow','chVertexKeyTypeRow'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.getElementById('fetchModelsBtn').style.display = 'none';
    ChannelState.modelTagsState = [];
    ChannelState.groupTagsState = ['default'];
    ChannelState.modelMappingRows = [];
    renderModelTags();
    renderGroupTags();
    renderModelMappingEditor();
    // 滚动到顶部
    const formArea = document.getElementById('channelFormArea');
    if (formArea) formArea.scrollTop = 0;
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
    
    // 验证必填字段：名称、类型、密钥（新建时）、模型
    if (!formData.name || !formData.type || (!isEdit && !formData.key)) {
        showToast('请填写必填字段：名称、类型、密钥', 'error');
        return;
    }
    
    if (!formData.models || formData.models.trim() === '') {
        showToast('请至少选择一个模型', 'error');
        return;
    }
    
    // 清理新建时不需要的字段
    if (!isEdit) {
        delete formData.id;
    }

    try {
        const res = isEdit 
            ? await API.updateChannel(formData)
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
    const idVal = document.getElementById('chId').value;
    return {
        id: idVal ? parseInt(idVal) : undefined,
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
// 渠道类型 -> lobehub icon 名称映射
const CHANNEL_TYPE_TO_ICON = {
    1:'OpenAI',6:'OpenAI',7:'OpenAI',8:'OpenAI',58:'NewAPI',3:'Azure',
    14:'Claude',24:'Gemini',11:'Google',41:'Gemini',
    33:'Aws',39:'Cloudflare',
    15:'Baidu',46:'Baidu',16:'Zhipu',26:'Zhipu',17:'Qwen',18:'Spark',
    23:'Hunyuan',19:'Ai360',25:'Moonshot',31:'Yi',35:'Minimax',45:'Volcengine',
    4:'Ollama',30:'Ollama',27:'Perplexity',34:'Cohere',42:'Mistral',43:'DeepSeek',
    28:'DeepSeek',48:'XAI',49:'Coze',40:'SiliconCloud',44:'Doubao',20:'OpenRouter',
    2:'Midjourney',5:'Midjourney',50:'Kling',51:'Jimeng',52:'Vidu',
    36:'Suno',55:'OpenAI',54:'Doubao',56:'Replicate',
    37:'Dify',38:'Jina',22:'FastGPT',47:'Xinference',53:'OpenAI',
    10:'OpenAI',21:'OpenAI',12:'OpenAI',13:'OpenAI',9:'OpenAI',
    29:'Groq',32:'StepFun',36:'OpenRouter',47:'XAI'
};

function getChannelLogoUrl(type) {
    const iconName = CHANNEL_TYPE_TO_ICON[type] || 'OpenAI';
    if (window.AIProviders) {
        return AIProviders.getProviderIconUrl(iconName);
    }
    // 降级：直接拼 CDN URL
    const normalized = iconName.toLowerCase().replace(/\s+/g,'-').replace(/\./g,'-');
    return `https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1/icons/${normalized}.svg`;
}

function buildLogoImg(type, size) {
    const url = getChannelLogoUrl(type);
    const abbr = (ChannelState.channelTypes.find(t=>t.value===type)||{label:'?'}).label.charAt(0);
    return `<img src="${url}" style="width:${size}px;height:${size}px;flex-shrink:0;display:inline-block;vertical-align:middle;" alt="${escapeHtml(abbr)}" onerror="var p=this.parentNode;if(p){var s=document.createElement('span');s.textContent=this.alt||'?';s.style.cssText='display:inline-flex;align-items:center;justify-content:center;width:'+${size}+'px;height:'+${size}+'px;border-radius:50%;background:var(--c-bg-secondary);font-size:'+${Math.round(size*0.55)}+'px;color:var(--c-text-secondary);flex-shrink:0;';p.replaceChild(s,this);}" />`;
}

function initTypeDropdown() {
    const list = document.getElementById('typeComboboxList');
    list.innerHTML = '';
    ChannelState.channelTypes.forEach(t => {
        const item = document.createElement('div');
        item.className = 'type-combobox-item';
        item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;';
        item.setAttribute('data-search', t.label.toLowerCase());
        item.innerHTML = buildLogoImg(t.value, 18) + `<span>${t.label}</span>`;
        item.onclick = () => selectChannelType(t.value);
        list.appendChild(item);
    });
}

function selectChannelType(type) {
    document.getElementById('chType').value = type;
    updateTypeComboboxDisplay(type);
    document.getElementById('typeComboboxDropdown').classList.remove('show');
    onTypeChange(type);
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
    document.querySelectorAll('#typeComboboxList .type-combobox-item').forEach(opt => {
        const searchText = opt.getAttribute('data-search') || '';
        opt.style.display = searchText.includes(kw) ? 'flex' : 'none';
    });
}

function updateTypeComboboxDisplay(type) {
    const typeInfo = ChannelState.channelTypes.find(t => t.value === type);
    if (!typeInfo) return;
    document.getElementById('typeComboboxLabel').innerHTML =
        buildLogoImg(type, 18) + `<span style="margin-left:4px;">${typeInfo.label}</span>`;
    document.getElementById('chModalTypeIcon').innerHTML = buildLogoImg(type, 20);
    document.getElementById('chModalTypeName').textContent = typeInfo.label;
}

function toggleAdvancedSettings() {
    const content = document.getElementById('advancedSettingsContent');
    const icon = document.getElementById('advToggleIcon');
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    icon.innerHTML = isHidden ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>';
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
async function initFilters() {
    // 初始化类型筛选器 - 只显示有渠道的供应商类型
    await updateTypeFilter();
}

// 更新类型筛选器（只显示有渠道的类型）
async function updateTypeFilter() {
    try {
        // 获取所有渠道（不分页）以统计类型分布
        const res = await API.getChannelsEx({ p: 1, page_size: 2000 });
        if (!res.success || !res.data || !res.data.length) return;
        
        const typeCounts = {};
        res.data.forEach(ch => {
            typeCounts[ch.type] = (typeCounts[ch.type] || 0) + 1;
        });
        
        const typeSelect = document.getElementById('filterType');
        typeSelect.innerHTML = '<option value="">全部类型</option>';
        
        ChannelState.channelTypes
            .filter(t => typeCounts[t.value])
            .forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.value;
                opt.textContent = `${t.label} (${typeCounts[t.value]})`;
                typeSelect.appendChild(opt);
            });
    } catch (err) {
        console.error('更新类型筛选失败，使用默认列表:', err);
        // 降级：显示所有类型
        const typeSelect = document.getElementById('filterType');
        typeSelect.innerHTML = '<option value="">全部类型</option>';
        ChannelState.channelTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.value;
            opt.textContent = t.label;
            typeSelect.appendChild(opt);
        });
    }
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

// 与工具栏按钮对应的函数（与 user.html 一致）
function toggleSortOrder() {
    if (ChannelState.filters.sort_order === 'desc') {
        ChannelState.filters.sort_order = 'asc';
        document.getElementById('sortIcon').innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/>';
    } else {
        ChannelState.filters.sort_order = 'desc';
        document.getElementById('sortIcon').innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>';
    }
    ChannelState.currentPage = 1;
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

// ========== 模型多选下拉组件 ==========
// 所有可用模型列表（从 AIProviders 加载，含 logo 信息）
let _allModelsList = []; // [{name, vendorName, vendorIcon}, ...]

// 加载模型列表（使用 AIProviders.load() 获取带 logo 的模型）
async function loadModelSelectList() {
    if (_allModelsList.length > 0) return; // 已加载
    try {
        if (window.AIProviders) {
            await AIProviders.load();
            const models = AIProviders.getModels();
            if (models && models.length > 0) {
                _allModelsList = models.map(m => ({
                    name: m.model_name || m.id || m,
                    vendorName: m.vendor_name || '',
                    vendorIcon: m.vendor_icon || ''
                })).filter(m => m.name);
            }
        }
    } catch(e) { /* 不影响基础功能 */ }
    // 补充：把 allModels 中但不在 _allModelsList 的也加进来
    const existingNames = new Set(_allModelsList.map(m => m.name));
    ChannelState.allModels.forEach(name => {
        if (!existingNames.has(name)) {
            _allModelsList.push({name, vendorName:'', vendorIcon:''});
        }
    });
}

// 切换模型下拉
function toggleModelSelect() {
    const dd = document.getElementById('modelSelectDropdown');
    const isOpen = dd.style.display !== 'none';
    if (isOpen) {
        dd.style.display = 'none';
    } else {
        dd.style.display = 'flex';
        dd.style.flexDirection = 'column';
        renderModelSelectList('');
        setTimeout(() => document.getElementById('modelSelectSearch').focus(), 50);
    }
}

// 渲染模型下拉列表
function renderModelSelectList(keyword) {
    const list = document.getElementById('modelSelectList');
    if (!list) return;
    
    // 当前选中类型
    const currentType = parseInt(document.getElementById('chType').value) || 0;
    
    let candidates = _allModelsList;
    
    // 如果已选供应商类型，且有对应的 vendorName，则优先显示该供应商的模型
    let filteredByVendor = candidates;
    if (currentType > 0) {
        const iconName = CHANNEL_TYPE_TO_ICON[currentType] || '';
        // 尝试按 vendor icon 或 vendor name 过滤
        const vendorFiltered = candidates.filter(m => {
            if (!m.vendorIcon && !m.vendorName) return false;
            const vi = (m.vendorIcon || '').toLowerCase();
            const vn = (m.vendorName || '').toLowerCase();
            return vi.includes(iconName.toLowerCase()) || iconName.toLowerCase().includes(vi) || vn.includes(iconName.toLowerCase());
        });
        filteredByVendor = vendorFiltered.length > 0 ? vendorFiltered : candidates;
    }
    
    // 搜索过滤
    const kw = keyword.toLowerCase();
    const filtered = kw 
        ? filteredByVendor.filter(m => m.name.toLowerCase().includes(kw) || (m.vendorName||'').toLowerCase().includes(kw))
        : filteredByVendor;

    const sorted = filtered.slice(0).sort((a,b) => a.name.localeCompare(b.name));
    const displayList = sorted; // 显示所有模型，不限制数量
    
    if (displayList.length === 0) {
        list.innerHTML = '<div style="padding:16px;text-align:center;font-size:13px;color:var(--c-text-secondary);">无匹配模型</div>';
        return;
    }
    
    list.innerHTML = displayList.map(m => {
        const checked = ChannelState.modelTagsState.includes(m.name) ? 'checked' : '';
        const logoHtml = m.vendorIcon 
            ? `<img src="${AIProviders.getProviderIconUrl(m.vendorIcon)}" style="width:16px;height:16px;flex-shrink:0;" onerror="this.style.display='none'"/>`
            : '';
        const vendorText = m.vendorName ? `<span style="font-size:11px;color:var(--c-text-secondary);margin-left:auto;flex-shrink:0;">${escapeHtml(m.vendorName)}</span>` : '';
        return `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;font-size:13px;" onmouseenter="this.style.background='var(--c-bg-secondary)'" onmouseleave="this.style.background=''">
            <input type="checkbox" ${checked} onchange="toggleModelCheck('${escapeHtml(m.name)}', this.checked)" style="flex-shrink:0;">
            ${logoHtml}
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(m.name)}</span>
            ${vendorText}
        </label>`;
    }).join('');
}

// 搜索过滤模型列表
function filterModelOptions(keyword) {
    renderModelSelectList(keyword);
}

// 勾选/取消模型
function toggleModelCheck(modelName, checked) {
    if (checked) {
        if (!ChannelState.modelTagsState.includes(modelName)) {
            ChannelState.modelTagsState.push(modelName);
        }
    } else {
        ChannelState.modelTagsState = ChannelState.modelTagsState.filter(m => m !== modelName);
    }
    renderModelTags();
    updateModelSelectBtn();
}

// 更新选择按钮文字
function updateModelSelectBtn() {
    const count = ChannelState.modelTagsState.length;
    const btn = document.getElementById('modelSelectText');
    if (btn) {
        btn.textContent = count > 0 ? `已选 ${count} 个模型` : '点击选择模型...';
        btn.style.color = count > 0 ? 'var(--c-text-main)' : 'var(--c-text-secondary)';
    }
}

function addModel(model) {
    model = model.trim();
    if (model && !ChannelState.modelTagsState.includes(model)) {
        ChannelState.modelTagsState.push(model);
        renderModelTags();
        updateModelSelectBtn();
    }
}

function removeModel(modelName) {
    ChannelState.modelTagsState = ChannelState.modelTagsState.filter(m => m !== modelName);
    renderModelTags();
    updateModelSelectBtn();
    // 如果下拉是打开的，刷新列表中的勾选状态
    const dd = document.getElementById('modelSelectDropdown');
    if (dd && dd.style.display !== 'none') {
        renderModelSelectList(document.getElementById('modelSelectSearch')?.value || '');
    }
}

function renderModelTags() {
    const wrap = document.getElementById('modelTagsWrap');
    if (!wrap) return;
    wrap.querySelectorAll('.model-tag').forEach(t => t.remove());
    const emptySpan = document.getElementById('modelTagsEmpty');
    
    if (ChannelState.modelTagsState.length === 0) {
        if (emptySpan) emptySpan.style.display = '';
    } else {
        if (emptySpan) emptySpan.style.display = 'none';
        ChannelState.modelTagsState.forEach(m => {
            const tag = document.createElement('span');
            tag.className = 'model-tag';
            const safeName = escapeHtml(m);
            tag.innerHTML = `${safeName} <span class="tag-del" onclick="removeModel('${safeName}')">✕</span>`;
            wrap.appendChild(tag);
        });
    }
    updateModelSelectBtn();
}

function fillAllModels() {
    // 优先从已加载的模型列表填入，降级用 allModels
    const allNames = _allModelsList.length > 0 ? _allModelsList.map(m => m.name) : ChannelState.allModels;
    ChannelState.modelTagsState = [...new Set([...ChannelState.modelTagsState, ...allNames])];
    renderModelTags();
}

function clearModels() {
    ChannelState.modelTagsState = [];
    renderModelTags();
    // 刷新下拉勾选状态
    const dd = document.getElementById('modelSelectDropdown');
    if (dd && dd.style.display !== 'none') {
        renderModelSelectList(document.getElementById('modelSelectSearch')?.value || '');
    }
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
    const label = t ? t.label : `类型${type}`;
    return `<span class="badge badge-blue" style="display:inline-flex;align-items:center;gap:4px;">${buildLogoImg(type, 14)} <span>${label}</span></span>`;
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

