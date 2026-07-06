// ========== 操练场配置状态 ==========
let playgroundConfig = {
    model: '',
    group: 'default',
    temperature: 0.7,
    top_p: 1,
    max_tokens: 4096,
    frequency_penalty: 0,
    presence_penalty: 0,
    seed: null,
    stream: true,
    imageEnabled: false,
    imageUrls: ['']
};

let allModels = [];
let allGroups = [];
let chatMessages = [];
let isGenerating = false;

// ========== 配置持久化 ==========
function loadConfig() {
    try {
        const saved = localStorage.getItem('playground_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            playgroundConfig = { ...playgroundConfig, ...parsed.inputs };
            return true;
        }
    } catch (error) {
        console.error('加载配置失败:', error);
    }
    return false;
}

function saveConfig() {
    try {
        const configToSave = {
            inputs: playgroundConfig,
            exportTime: new Date().toISOString(),
            version: '1.0'
        };
        localStorage.setItem('playground_config', JSON.stringify(configToSave));
    } catch (error) {
        console.error('保存配置失败:', error);
    }
}

function loadMessages() {
    try {
        const saved = localStorage.getItem('playground_messages');
        if (saved) {
            chatMessages = JSON.parse(saved);
            return true;
        }
    } catch (error) {
        console.error('加载消息失败:', error);
    }
    return false;
}

function saveMessages() {
    try {
        localStorage.setItem('playground_messages', JSON.stringify(chatMessages));
    } catch (error) {
        console.error('保存消息失败:', error);
    }
}

// ========== 加载模型列表 ==========
async function loadModels() {
    try {
        const success = await AIProviders.load();
        if (success) {
            const models = AIProviders.getModels();
            if (models.length === 0) {
                document.getElementById('configSelectedModel').textContent = I18n.t('config.no_models');
                return;
            }
            
            allModels = models.map(model => ({
                id: model.model_name,
                name: model.model_name,
                vendor_id: model.vendor_id
            }));
            
            // 按字典序排序
            allModels.sort((a, b) => a.id.localeCompare(b.id));
            
            renderModelList(allModels);
            
            // 默认选择第一个模型或已保存的模型
            if (!playgroundConfig.model || !allModels.find(m => m.id === playgroundConfig.model)) {
                playgroundConfig.model = allModels[0].id;
            }
            selectModel(playgroundConfig.model);
        } else {
            document.getElementById('configSelectedModel').textContent = I18n.t('main.load_failed');
        }
    } catch (error) {
        console.error('加载模型失败:', error);
        document.getElementById('configSelectedModel').textContent = I18n.t('main.load_failed');
    }
}

// ========== 加载分组列表 ==========
async function loadGroups() {
    try {
        const isAuth = await Auth.checkAuth();
        if (!isAuth) {
            // 未登录，显示默认分组
            allGroups = [{ value: 'default', label: 'default' }];
            document.getElementById('configSelectedGroup').textContent = 'default';
            document.getElementById('configGroupSelector').disabled = true;
            return;
        }
        
        const result = await API.getUserGroups();
        if (result.success && result.data) {
            allGroups = result.data.map(g => ({
                value: g,
                label: g
            }));
            
            if (allGroups.length === 0) {
                allGroups = [{ value: 'default', label: 'default' }];
            }
            
            renderGroupList(allGroups);
            
            // 选择已保存的分组或第一个
            if (!playgroundConfig.group || !allGroups.find(g => g.value === playgroundConfig.group)) {
                playgroundConfig.group = allGroups[0].value;
            }
            selectGroup(playgroundConfig.group);
            document.getElementById('configGroupSelector').disabled = false;
        }
    } catch (error) {
        console.error('加载分组失败:', error);
        allGroups = [{ value: 'default', label: 'default' }];
        document.getElementById('configSelectedGroup').textContent = 'default';
    }
}

// ========== 渲染模型列表 ==========
function renderModelList(models) {
    const modelList = document.getElementById('configModelList');
    if (!modelList) return;
    
    modelList.innerHTML = '';
    
    models.forEach(model => {
        const div = document.createElement('div');
        div.className = 'config-dropdown-item';
        div.setAttribute('data-model', model.id);
        
        // 添加供应商图标
        if (window.AIProviders && AIProviders._loaded) {
            const provider = AIProviders.getModelProvider(model.id);
            if (provider && provider.icon) {
                const iconUrl = AIProviders.getProviderIconUrl(provider.icon);
                const logoImg = document.createElement('img');
                logoImg.src = iconUrl;
                logoImg.alt = provider.name;
                logoImg.style.width = '16px';
                logoImg.style.height = '16px';
                logoImg.style.objectFit = 'contain';
                logoImg.style.marginRight = '8px';
                
                logoImg.onerror = () => {
                    const abbr = AIProviders.getProviderAbbr(provider.name);
                    const fallback = document.createElement('span');
                    fallback.textContent = abbr;
                    fallback.style.fontSize = '10px';
                    fallback.style.fontWeight = 'bold';
                    fallback.style.color = '#999';
                    fallback.style.marginRight = '8px';
                    logoImg.replaceWith(fallback);
                };
                
                div.appendChild(logoImg);
            }
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = model.id;
        div.appendChild(nameSpan);
        
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            selectModel(model.id);
            document.getElementById('configModelDropdown').style.display = 'none';
        });
        
        modelList.appendChild(div);
    });
}

// ========== 渲染分组列表 ==========
function renderGroupList(groups) {
    const groupList = document.getElementById('configGroupList');
    if (!groupList) return;
    
    groupList.innerHTML = '';
    
    groups.forEach(group => {
        const div = document.createElement('div');
        div.className = 'config-dropdown-item';
        div.textContent = group.label;
        
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            selectGroup(group.value);
            document.getElementById('configGroupDropdown').style.display = 'none';
        });
        
        groupList.appendChild(div);
    });
}

// ========== 选择模型 ==========
function selectModel(modelId) {
    playgroundConfig.model = modelId;
    document.getElementById('configSelectedModel').textContent = modelId;
    
    // 更新选中状态
    const modelList = document.getElementById('configModelList');
    if (modelList) {
        modelList.querySelectorAll('.config-dropdown-item').forEach(item => {
            if (item.getAttribute('data-model') === modelId) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    saveConfig();
}

// ========== 选择分组 ==========
function selectGroup(groupValue) {
    playgroundConfig.group = groupValue;
    document.getElementById('configSelectedGroup').textContent = groupValue;
    saveConfig();
}

// ========== 模型搜索 ==========
function initModelSearch() {
    const searchInput = document.getElementById('configModelSearchInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (!searchTerm) {
            renderModelList(allModels);
            return;
        }
        
        const filtered = allModels.filter(model =>
            model.id.toLowerCase().includes(searchTerm)
        );
        
        // 保持排序
        filtered.sort((a, b) => a.id.localeCompare(b.id));
        
        renderModelList(filtered);
    });
    
    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// ========== 参数控件初始化 ==========
function initParameterControls() {
    // 温度滑块
    const tempSlider = document.getElementById('temperature');
    const tempValue = document.getElementById('temperatureValue');
    if (tempSlider) {
        tempSlider.value = playgroundConfig.temperature;
        tempValue.textContent = playgroundConfig.temperature;
        tempSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            playgroundConfig.temperature = value;
            tempValue.textContent = value;
            saveConfig();
        });
    }
    
    // Top P 滑块
    const topPSlider = document.getElementById('topP');
    const topPValue = document.getElementById('topPValue');
    if (topPSlider) {
        topPSlider.value = playgroundConfig.top_p;
        topPValue.textContent = playgroundConfig.top_p;
        topPSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            playgroundConfig.top_p = value;
            topPValue.textContent = value;
            saveConfig();
        });
    }
    
    // 最大Token
    const maxTokensInput = document.getElementById('maxTokens');
    if (maxTokensInput) {
        maxTokensInput.value = playgroundConfig.max_tokens;
        maxTokensInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value > 0) {
                playgroundConfig.max_tokens = value;
                saveConfig();
            }
        });
    }
    
    // 频率惩罚
    const freqSlider = document.getElementById('frequencyPenalty');
    const freqValue = document.getElementById('frequencyPenaltyValue');
    if (freqSlider) {
        freqSlider.value = playgroundConfig.frequency_penalty;
        freqValue.textContent = playgroundConfig.frequency_penalty;
        freqSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            playgroundConfig.frequency_penalty = value;
            freqValue.textContent = value;
            saveConfig();
        });
    }
    
    // 存在惩罚
    const presSlider = document.getElementById('presencePenalty');
    const presValue = document.getElementById('presencePenaltyValue');
    if (presSlider) {
        presSlider.value = playgroundConfig.presence_penalty;
        presValue.textContent = playgroundConfig.presence_penalty;
        presSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            playgroundConfig.presence_penalty = value;
            presValue.textContent = value;
            saveConfig();
        });
    }
    
    // 随机种子
    const seedInput = document.getElementById('seed');
    if (seedInput) {
        seedInput.value = playgroundConfig.seed || '';
        seedInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            playgroundConfig.seed = value ? parseInt(value) : null;
            saveConfig();
        });
    }
    
    // 图片上传开关
    const imageEnabledCheckbox = document.getElementById('imageEnabled');
    const imageUrlContainer = document.getElementById('imageUrlContainer');
    const imageUrlInput = document.getElementById('imageUrl');
    
    if (imageEnabledCheckbox) {
        imageEnabledCheckbox.checked = playgroundConfig.imageEnabled;
        imageUrlContainer.style.display = playgroundConfig.imageEnabled ? 'block' : 'none';
        
        imageEnabledCheckbox.addEventListener('change', (e) => {
            playgroundConfig.imageEnabled = e.target.checked;
            imageUrlContainer.style.display = e.target.checked ? 'block' : 'none';
            saveConfig();
        });
    }
    
    if (imageUrlInput) {
        imageUrlInput.value = playgroundConfig.imageUrls[0] || '';
        imageUrlInput.addEventListener('input', (e) => {
            playgroundConfig.imageUrls = [e.target.value.trim()];
            saveConfig();
        });
    }
    
    // 流式输出开关
    const streamCheckbox = document.getElementById('streamEnabled');
    if (streamCheckbox) {
        streamCheckbox.checked = playgroundConfig.stream;
        streamCheckbox.addEventListener('change', (e) => {
            playgroundConfig.stream = e.target.checked;
            saveConfig();
        });
    }
}

// ========== 下拉菜单交互 ==========
function initDropdowns() {
    // 模型选择器
    const modelSelector = document.getElementById('configModelSelector');
    const modelDropdown = document.getElementById('configModelDropdown');
    
    if (modelSelector && modelDropdown) {
        modelSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = modelDropdown.style.display === 'block';
            closeAllDropdowns();
            modelDropdown.style.display = isVisible ? 'none' : 'block';
        });
    }
    
    // 分组选择器
    const groupSelector = document.getElementById('configGroupSelector');
    const groupDropdown = document.getElementById('configGroupDropdown');
    
    if (groupSelector && groupDropdown) {
        groupSelector.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // 检查是否登录
            const isAuth = await Auth.checkAuth();
            if (!isAuth) {
                const confirmed = confirm(I18n.t('config.group_login_required'));
                if (confirmed) {
                    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
                }
                return;
            }
            
            const isVisible = groupDropdown.style.display === 'block';
            closeAllDropdowns();
            groupDropdown.style.display = isVisible ? 'none' : 'block';
        });
    }
    
    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', closeAllDropdowns);
}

function closeAllDropdowns() {
    document.getElementById('configModelDropdown').style.display = 'none';
    document.getElementById('configGroupDropdown').style.display = 'none';
}

// ========== 配置管理 ==========
function initConfigManagement() {
    // 导入配置
    document.getElementById('importConfigBtn')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (imported.inputs) {
                        playgroundConfig = { ...playgroundConfig, ...imported.inputs };
                        
                        // 更新UI
                        selectModel(playgroundConfig.model);
                        selectGroup(playgroundConfig.group);
                        initParameterControls();
                        
                        // 恢复消息
                        if (imported.messages && Array.isArray(imported.messages)) {
                            chatMessages = imported.messages;
                            saveMessages();
                            renderChatMessages();
                        }
                        
                        saveConfig();
                        alert(I18n.t('config.import_success'));
                    }
                } catch (error) {
                    console.error('导入配置失败:', error);
                    alert(I18n.t('config.import_error'));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });
    
    // 导出配置
    document.getElementById('exportConfigBtn')?.addEventListener('click', () => {
        const exportData = {
            inputs: playgroundConfig,
            messages: chatMessages,
            exportTime: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `playground-config-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // 重置配置
    document.getElementById('resetConfigBtn')?.addEventListener('click', () => {
        if (!confirm(I18n.t('config.reset_confirm'))) return;
        
        playgroundConfig = {
            model: allModels[0]?.id || '',
            group: 'default',
            temperature: 0.7,
            top_p: 1,
            max_tokens: 4096,
            frequency_penalty: 0,
            presence_penalty: 0,
            seed: null,
            stream: true,
            imageEnabled: false,
            imageUrls: ['']
        };
        
        initParameterControls();
        selectModel(playgroundConfig.model);
        selectGroup(playgroundConfig.group);
        saveConfig();
        
        alert(I18n.t('config.reset_success'));
    });
}

// ========== 发送消息 ==========
async function handleSendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) {
        alert(I18n.t('main.enter_message'));
        return;
    }
    
    if (!playgroundConfig.model) {
        alert(I18n.t('main.select_model'));
        return;
    }
    
    if (isGenerating) {
        alert(I18n.t('main.loading'));
        return;
    }
    
    // 检查登录状态
    const isAuth = await Auth.checkAuth();
    if (!isAuth) {
        const confirmed = confirm(I18n.t('main.login_required'));
        if (confirmed) {
            window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        }
        return;
    }
    
    // 构建用户消息
    let messageContent = message;
    if (playgroundConfig.imageEnabled && playgroundConfig.imageUrls[0]) {
        messageContent = [
            { type: 'text', text: message },
            { type: 'image_url', image_url: { url: playgroundConfig.imageUrls[0] } }
        ];
    }
    
    const userMessage = {
        role: 'user',
        content: messageContent
    };
    
    chatMessages.push(userMessage);
    
    // 显示用户消息
    appendChatMessage('user', message);
    
    // 清空输入框
    input.value = '';
    
    // 构建请求payload
    const payload = {
        model: playgroundConfig.model,
        messages: chatMessages,
        stream: playgroundConfig.stream,
        temperature: playgroundConfig.temperature,
        top_p: playgroundConfig.top_p,
        max_tokens: playgroundConfig.max_tokens,
        frequency_penalty: playgroundConfig.frequency_penalty,
        presence_penalty: playgroundConfig.presence_penalty
    };
    
    if (playgroundConfig.seed !== null) {
        payload.seed = playgroundConfig.seed;
    }
    
    // 禁用发送按钮
    const sendBtn = document.getElementById('sendBtn');
    const originalContent = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<div style="width: 20px; height: 20px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></div>';
    isGenerating = true;
    
    // 创建AI消息占位
    const aiMessageDiv = appendChatMessage('assistant', '');
    const aiContentDiv = aiMessageDiv.querySelector('.message-content');
    
    try {
        if (playgroundConfig.stream) {
            // 流式响应
            await sendStreamRequest(payload, aiContentDiv);
        } else {
            // 非流式响应
            const result = await API.sendChatMessage(chatMessages, playgroundConfig.model, false);
            if (result.choices && result.choices.length > 0) {
                const aiContent = result.choices[0].message.content;
                aiContentDiv.textContent = aiContent;
                chatMessages.push({
                    role: 'assistant',
                    content: aiContent
                });
            } else {
                throw new Error('获取回复失败');
            }
        }
        
        saveMessages();
        saveChatHistory(message);
    } catch (error) {
        console.error('聊天错误:', error);
        aiContentDiv.textContent = '❌ ' + I18n.t('main.send_failed') + '：' + (error.message || I18n.t('main.network_error'));
        chatMessages.pop(); // 移除失败的用户消息
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalContent;
        isGenerating = false;
    }
}

// ========== 流式请求 ==========
async function sendStreamRequest(payload, contentDiv) {
    const response = await fetch('/pg/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error('请求失败');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0].delta.content) {
                        const content = parsed.choices[0].delta.content;
                        fullContent += content;
                        contentDiv.textContent = fullContent;
                        
                        // 滚动到底部
                        const chatArea = document.getElementById('chatArea');
                        chatArea.scrollTop = chatArea.scrollHeight;
                    }
                } catch (e) {
                    console.error('解析SSE数据失败:', e);
                }
            }
        }
    }
    
    chatMessages.push({
        role: 'assistant',
        content: fullContent
    });
}

// ========== 添加聊天消息到界面 ==========
function appendChatMessage(role, content) {
    const chatArea = document.getElementById('chatArea');
    if (!chatArea) return null;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.textContent = role === 'user' ? 'U' : 'AI';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatArea.appendChild(messageDiv);
    
    // 滚动到底部
    chatArea.scrollTop = chatArea.scrollHeight;
    
    // 隐藏品牌标语和平台图标
    const brandLogo = document.querySelector('.brand-logo');
    const subtitle = document.querySelector('.subtitle');
    const platformArea = document.querySelector('.platform-area');
    if (brandLogo) brandLogo.style.display = 'none';
    if (subtitle) subtitle.style.display = 'none';
    if (platformArea) platformArea.style.display = 'none';
    
    // 显示聊天区域
    chatArea.style.display = 'flex';
    
    return messageDiv;
}

// ========== 渲染已保存的消息 ==========
function renderChatMessages() {
    const chatArea = document.getElementById('chatArea');
    if (!chatArea) return;
    
    chatArea.innerHTML = '';
    
    if (chatMessages.length === 0) return;
    
    chatMessages.forEach(msg => {
        const content = typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || '';
        appendChatMessage(msg.role, content);
    });
}

// ========== 历史记录功能 ==========
function initChatHistory() {
    loadChatHistory();
}

function loadChatHistory() {
    const historyList = document.getElementById('historyList');
    const historyPlaceholder = document.getElementById('historyPlaceholder');
    
    if (!historyList) return;
    
    const history = JSON.parse(localStorage.getItem('chat_history') || '[]');
    
    if (history.length === 0) {
        historyPlaceholder.style.display = 'block';
        return;
    }
    
    historyPlaceholder.style.display = 'none';
    historyList.innerHTML = '';
    
    history.slice(-20).reverse().forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'sidebar-btn';
        btn.textContent = item.content.substring(0, 20) + (item.content.length > 20 ? '...' : '');
        btn.title = item.content;
        
        btn.addEventListener('click', () => {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.value = item.content;
                chatInput.focus();
            }
        });
        
        historyList.appendChild(btn);
    });
}

function saveChatHistory(content) {
    const history = JSON.parse(localStorage.getItem('chat_history') || '[]');
    history.push({
        content,
        timestamp: Date.now()
    });
    
    if (history.length > 100) {
        history.shift();
    }
    
    localStorage.setItem('chat_history', JSON.stringify(history));
    loadChatHistory();
}

// ========== 渲染合作平台图标 ==========
async function renderPlatformProviders() {
    const platformArea = document.getElementById('platformArea');
    if (!platformArea) return;
    
    try {
        const success = await AIProviders.load();
        if (!success) {
            platformArea.innerHTML = '<div style="color: #999; font-size: 14px; text-align: center;">暂无可展示的模型提供商</div>';
            return;
        }
        
        const providers = AIProviders.getProviders();
        if (providers.length === 0) {
            platformArea.innerHTML = '<div style="color: #999; font-size: 14px; text-align: center;">暂无可展示的模型提供商</div>';
            return;
        }
        
        platformArea.innerHTML = '';
        
        const displayProviders = providers.slice(0, 8);
        
        displayProviders.forEach(provider => {
            const iconUrl = AIProviders.getProviderIconUrl(provider.icon || provider.name);
            const website = AIProviders.getProviderWebsite(provider.name);
            const abbr = AIProviders.getProviderAbbr(provider.name);
            
            const providerBtn = document.createElement('a');
            providerBtn.className = 'platform-provider-btn';
            providerBtn.href = website || '#';
            providerBtn.target = website ? '_blank' : '_self';
            providerBtn.rel = 'noopener noreferrer';
            providerBtn.title = provider.name;
            
            if (!website) {
                providerBtn.style.cursor = 'default';
                providerBtn.onclick = (e) => e.preventDefault();
            }
            
            const logoContainer = document.createElement('div');
            logoContainer.className = 'provider-logo-container';
            
            const img = document.createElement('img');
            img.src = iconUrl;
            img.alt = provider.name;
            img.className = 'provider-logo-img';
            
            const fallback = document.createElement('div');
            fallback.className = 'provider-logo-fallback';
            fallback.textContent = abbr;
            fallback.style.display = 'none';
            
            img.onerror = () => {
                img.style.display = 'none';
                fallback.style.display = 'flex';
            };
            
            logoContainer.appendChild(img);
            logoContainer.appendChild(fallback);
            
            const nameLabel = document.createElement('div');
            nameLabel.className = 'provider-name-label';
            nameLabel.textContent = provider.name;
            
            providerBtn.appendChild(logoContainer);
            providerBtn.appendChild(nameLabel);
            platformArea.appendChild(providerBtn);
        });
        
    } catch (error) {
        console.error('Error rendering platform providers:', error);
        platformArea.innerHTML = '<div style="color: #999; font-size: 14px; text-align: center;">加载失败，请刷新重试</div>';
    }
}

// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
    // 加载配置
    loadConfig();
    loadMessages();
    
    // 加载数据
    await loadModels();
    await loadGroups();
    
    // 初始化参数控件
    initParameterControls();
    
    // 初始化下拉菜单
    initDropdowns();
    
    // 初始化模型搜索
    initModelSearch();
    
    // 初始化配置管理
    initConfigManagement();
    
    // 初始化历史记录
    initChatHistory();
    
    // 渲染已保存的消息
    if (chatMessages.length > 0) {
        renderChatMessages();
    }
    
    // 渲染平台供应商
    renderPlatformProviders();
    
    // 发送按钮事件
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendMessage);
    }
    
    // 回车发送
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }
});
