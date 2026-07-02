// API 基础配置
const API_BASE = '/api';

// 通用请求函数
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(API_BASE + url, {
            ...options,
            credentials: 'include', // 携带 Cookie
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || '请求失败');
        }
        
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// API 方法集合
const API = {
    // ========== 用户认证相关 ==========
    login: (username, password) => 
        apiRequest('/user/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        }),
    
    register: (username, password, email) =>
        apiRequest('/user/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, email })
        }),
    
    logout: () => apiRequest('/user/logout', { method: 'GET' }),
    
    // ========== 用户信息 ==========
    getUserInfo: () => apiRequest('/user/self'),
    
    updateUser: (data) => 
        apiRequest('/user/self', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),
    
    // ========== 令牌管理 ==========
    getTokens: () => apiRequest('/token/'),
    
    createToken: (data) =>
        apiRequest('/token/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    
    deleteToken: (id) =>
        apiRequest(`/token/${id}`, { method: 'DELETE' }),
    
    // ========== 模型相关 ==========
    getModels: () => apiRequest('/models'),
    
    // ========== 渠道管理 ==========
    getChannels: () => apiRequest('/channel/'),
    
    testChannel: (id) =>
        apiRequest(`/channel/test/${id}`, { method: 'GET' }),
    
    // ========== 使用统计 ==========
    getUsageLogs: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/log/?${queryString}`);
    },
    
    // ========== 系统状态 ==========
    getStatus: () => apiRequest('/status'),
    
    // ========== 公告 ==========
    getNotice: () => apiRequest('/notice'),
    
    // ========== 充值相关 ==========
    getTopupOptions: () => apiRequest('/topup/'),
    
    createTopup: (amount) =>
        apiRequest('/topup/', {
            method: 'POST',
            body: JSON.stringify({ amount })
        }),
    
    // ========== 仪表盘 ==========
    getDashboardStats: () => apiRequest('/dashboard/billing/subscription'),
    
    getUsageStats: () => apiRequest('/dashboard/billing/usage'),
    
    // ========== 聊天功能 ==========
    sendChatMessage: (messages, model, stream = true) =>
        apiRequest('/pg/chat/completions', {
            method: 'POST',
            body: JSON.stringify({ 
                model, 
                messages,
                stream 
            })
        })
};

// 导出 API（兼容模块和全局）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
