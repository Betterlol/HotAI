// 主页逻辑
let selectedModel = null;
let chatMessages = []; // 存储对话历史
let allModels = []; // 存储所有模型列表，用于搜索

// 渲染合作平台图标
async function renderPlatformProviders() {
    const platformArea = document.getElementById('platformArea');
    if (!platformArea) return;
    
    try {
        // 加载供应商数据
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
        
        // 限制显示前 8 个供应商
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
            
            // Logo 容器
            const logoContainer = document.createElement('div');
            logoContainer.className = 'provider-logo-container';
            
            // 尝试加载 SVG 图标
            const img = document.createElement('img');
            img.src = iconUrl;
            img.alt = provider.name;
            img.className = 'provider-logo-img';
            
            // 降级为文字缩写
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
            
            // 公司名称
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

// 加载可用模型列表
async function loadModels() {
    try {
        const result = await API.getModels();
        if (result.success && result.data) {
            const models = Array.isArray(result.data) ? result.data : [];
            allModels = models; // 保存到全局变量用于搜索
            
            if (models.length === 0) {
                document.getElementById('selectedModelText').textContent = I18n.t('main.no_models');
                document.getElementById('modelList').innerHTML = `<div style="padding: 8px; color: #999;" data-i18n="main.no_models">${I18n.t('main.no_models')}</div>`;
                return;
            }
            
            // 渲染模型列表
            renderModelList(models);
            
            // 默认选择第一个模型
            if (models.length > 0) {
                const firstModel = models[0].id || models[0].name || models[0];
                selectModel(firstModel);
            }
        } else {
            document.getElementById('selectedModelText').textContent = I18n.t('main.load_failed');
            console.error('Failed to load models:', result);
        }
    } catch (error) {
        console.error('Error loading models:', error);
        document.getElementById('selectedModelText').textContent = I18n.t('main.load_failed');
        document.getElementById('modelList').innerHTML = `<div style="padding: 8px; color: #999;">${I18n.t('main.load_failed')}, ${I18n.t('main.retry')}</div>`;
    }
}

// 渲染模型列表
function renderModelList(models) {
    const modelList = document.getElementById('modelList');
    if (!modelList) return;
    
    modelList.innerHTML = '';
    
    models.forEach(model => {
        const modelId = model.id || model.name || model;
        const div = document.createElement('div');
        div.className = 'model-list-item';
        div.setAttribute('data-model', modelId);
        div.style.cursor = 'pointer';
        div.style.padding = '10px 16px';
        div.style.fontWeight = 'normal';
        div.style.color = 'var(--c-text-secondary)';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';
        
        // 尝试获取供应商信息并显示 logo
        if (window.AIProviders && AIProviders._loaded) {
            const provider = AIProviders.getModelProvider(modelId);
            if (provider && provider.icon) {
                const iconUrl = AIProviders.getProviderIconUrl(provider.icon);
                const logoImg = document.createElement('img');
                logoImg.src = iconUrl;
                logoImg.alt = provider.name;
                logoImg.style.width = '16px';
                logoImg.style.height = '16px';
                logoImg.style.objectFit = 'contain';
                logoImg.style.flexShrink = '0';
                
                // 图标加载失败时使用文字缩写
                logoImg.onerror = () => {
                    const abbr = AIProviders.getProviderAbbr(provider.name);
                    const fallback = document.createElement('span');
                    fallback.textContent = abbr;
                    fallback.style.fontSize = '10px';
                    fallback.style.fontWeight = 'bold';
                    fallback.style.color = '#999';
                    fallback.style.minWidth = '16px';
                    fallback.style.textAlign = 'center';
                    logoImg.replaceWith(fallback);
                };
                
                div.appendChild(logoImg);
            }
        }
        
        // 模型名称
        const nameSpan = document.createElement('span');
        nameSpan.textContent = modelId;
        nameSpan.style.flex = '1';
        div.appendChild(nameSpan);
        
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            selectModel(modelId);
            document.getElementById('modelDropdown').style.display = 'none';
        });
        
        div.addEventListener('mouseenter', () => {
            div.style.background = 'var(--c-primary-light)';
            div.style.color = 'var(--c-primary)';
        });
        
        div.addEventListener('mouseleave', () => {
            div.style.background = '';
            div.style.color = 'var(--c-text-secondary)';
        });
        
        modelList.appendChild(div);
    });
}

// 选择模型
function selectModel(modelId) {
    selectedModel = modelId;
    document.getElementById('selectedModelText').textContent = modelId;
    console.log('已选择模型:', modelId);
}

// 处理用户点击
function handleUserClick() {
    const confirmed = confirm('是否退出登录？');
    if (confirmed) {
        Auth.logout();
    }
}

// 处理发送消息
async function handleSendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) {
        alert('请输入消息内容');
        return;
    }
    
    if (!selectedModel) {
        alert('请先选择模型');
        return;
    }
    
    // 检查登录状态
    const isAuth = await Auth.checkAuth();
    if (!isAuth) {
        const confirmed = confirm('您需要登录才能使用聊天功能，是否跳转到登录页面？');
        if (confirmed) {
            window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        }
        return;
    }
    
    // 添加用户消息到对话历史
    chatMessages.push({
        role: 'user',
        content: message
    });
    
    // 保存到历史记录
    saveChatHistory(message);
    
    // 显示用户消息
    appendChatMessage('user', message);
    
    // 清空输入框
    input.value = '';
    
    // 禁用发送按钮，防止重复提交
    const sendBtn = document.querySelector('.send-btn');
    const originalContent = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<div style="width: 20px; height: 20px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></div>';
    
    try {
        // 调用聊天API（非流式）
        const result = await API.sendChatMessage(chatMessages, selectedModel, false);
        
        if (result.success !== false && result.choices && result.choices.length > 0) {
            const aiMessage = result.choices[0].message.content;
            
            // 添加AI回复到对话历史
            chatMessages.push({
                role: 'assistant',
                content: aiMessage
            });
            
            // 显示AI回复
            appendChatMessage('assistant', aiMessage);
        } else {
            throw new Error(result.message || '获取回复失败');
        }
    } catch (error) {
        console.error('聊天错误:', error);
        alert('发送失败：' + (error.message || '网络错误'));
        
        // 失败时移除刚添加的用户消息
        chatMessages.pop();
    } finally {
        // 恢复发送按钮
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalContent;
    }
}

// 添加聊天消息到界面
function appendChatMessage(role, content) {
    const chatArea = document.getElementById('chatArea');
    if (!chatArea) return;
    
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
    
    // 如果是第一条消息，隐藏品牌标语和平台图标
    const brandLogo = document.querySelector('.brand-logo');
    const subtitle = document.querySelector('.subtitle');
    const platformArea = document.querySelector('.platform-area');
    if (brandLogo) brandLogo.style.display = 'none';
    if (subtitle) subtitle.style.display = 'none';
    if (platformArea) platformArea.style.display = 'none';
    
    // 显示聊天区域
    chatArea.style.display = 'flex';
}

// 添加旋转动画CSS（如果页面没有的话）
if (!document.querySelector('#spin-animation-style')) {
    const style = document.createElement('style');
    style.id = 'spin-animation-style';
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
}

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    // 模型选择器点击事件
    const modelSelector = document.getElementById('modelSelector');
    if (modelSelector) {
        modelSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('modelDropdown');
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });
    }
    
    // 发送按钮点击事件
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendMessage);
    }
    
    // 用户栏点击事件
    const userBtn = document.querySelector('.sidebar-bottom .sidebar-btn');
    if (userBtn) {
        userBtn.addEventListener('click', handleUserClick);
    }
    
    // 模型管理按钮
    const modelMgmtBtn = document.querySelector('.sidebar-top .sidebar-btn');
    if (modelMgmtBtn) {
        modelMgmtBtn.addEventListener('click', () => {
            window.location.href = 'model.html';
        });
    }
    
    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', () => {
        const dropdown = document.getElementById('modelDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    });
    
    // 回车发送
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSendMessage();
            }
        });
    }
    
    // 延迟加载模型列表，等待认证完成
    setTimeout(loadModels, 500);
    
    // ========== 渲染平台供应商 ==========
    renderPlatformProviders();
    
    // ========== 历史记录功能 ==========
    initChatHistory();
    
    // ========== 模型搜索功能 ==========
    initModelSearch();
    
    // ========== 模型管理按钮 ==========
    const modelManagementBtn = document.getElementById('modelManagementBtn');
    if (modelManagementBtn) {
        modelManagementBtn.addEventListener('click', () => {
            window.location.href = 'model.html';
        });
    }
});
// ========== 历史记录功能 ==========
function initChatHistory() {
    loadChatHistory();
    
    // 监听语言变化，重新渲染占位符
    window.addEventListener('languageChanged', () => {
        const historyList = document.getElementById('historyList');
        const historyPlaceholder = document.getElementById('historyPlaceholder');
        if (historyList && historyList.children.length === 0 && historyPlaceholder) {
            historyPlaceholder.style.display = 'block';
        }
    });
}

function loadChatHistory() {
    const historyList = document.getElementById('historyList');
    const historyPlaceholder = document.getElementById('historyPlaceholder');
    
    if (!historyList) return;
    
    // 从 localStorage 读取历史记录
    const history = JSON.parse(localStorage.getItem('chat_history') || '[]');
    
    if (history.length === 0) {
        historyPlaceholder.style.display = 'block';
        return;
    }
    
    historyPlaceholder.style.display = 'none';
    historyList.innerHTML = '';
    
    // 显示最近 20 条记录（倒序）
    history.slice(-20).reverse().forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'sidebar-btn';
        btn.textContent = item.content.substring(0, 20) + (item.content.length > 20 ? '...' : '');
        btn.title = item.content;
        
        btn.addEventListener('click', () => {
            // 点击历史记录，将内容填入输入框
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
    
    // 最多保存 100 条
    if (history.length > 100) {
        history.shift();
    }
    
    localStorage.setItem('chat_history', JSON.stringify(history));
    loadChatHistory();
}

// ========== 模型搜索功能 ==========
function initModelSearch() {
    const modelSearchInput = document.getElementById('modelSearchInput');
    
    if (!modelSearchInput) return;
    
    modelSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (!searchTerm) {
            // 无搜索词，显示所有模型
            renderModelList(allModels);
            return;
        }
        
        // 过滤模型列表
        const filteredModels = allModels.filter(model => {
            const modelId = (model.id || model.name || model).toLowerCase();
            return modelId.includes(searchTerm);
        });
        
        renderModelList(filteredModels);
    });
    
    // 阻止搜索框点击事件冒泡，避免关闭下拉菜单
    modelSearchInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}
