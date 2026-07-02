// 主页逻辑
let selectedModel = null;

// 加载可用模型列表
async function loadModels() {
    try {
        const result = await API.getModels();
        if (result.success && result.data) {
            const dropdown = document.getElementById('modelDropdown');
            dropdown.innerHTML = ''; // 清空占位内容
            
            const models = Array.isArray(result.data) ? result.data : [];
            
            if (models.length === 0) {
                dropdown.innerHTML = '<div style="padding: 8px; color: #999;">暂无可用模型</div>';
                document.getElementById('selectedModelText').textContent = '无可用模型';
                return;
            }
            
            // 动态创建模型选项
            models.forEach((model, index) => {
                const div = document.createElement('div');
                div.textContent = model.id || model.name || model;
                div.setAttribute('data-model', model.id || model.name || model);
                div.style.cursor = 'pointer';
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectModel(model.id || model.name || model);
                    dropdown.style.display = 'none';
                });
                dropdown.appendChild(div);
                
                // 默认选择第一个模型
                if (index === 0) {
                    selectModel(model.id || model.name || model);
                }
            });
        } else {
            document.getElementById('selectedModelText').textContent = '加载失败';
            console.error('Failed to load models:', result);
        }
    } catch (error) {
        console.error('Error loading models:', error);
        document.getElementById('selectedModelText').textContent = '加载失败';
        document.getElementById('modelDropdown').innerHTML = '<div style="padding: 8px; color: #999;">加载失败，请刷新重试</div>';
    }
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
function handleSendMessage() {
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
    
    // TODO: 实现聊天功能，调用 API
    console.log('发送消息:', message, '使用模型:', selectedModel);
    alert(`聊天功能开发中\n消息: ${message}\n模型: ${selectedModel}`);
    
    // 清空输入框
    input.value = '';
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
});
