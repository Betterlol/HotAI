// API 基础配置
const API_BASE = '/api';

// 通用请求函数
async function apiRequest(url, options = {}) {
    try {
        // 从 localStorage 读取缓存的用户信息，自动附加 New-Api-User 头
        // 后端 UserAuth 中间件要求该头存在并与 session 中的 id 一致
        const extraHeaders = {};
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const userObj = JSON.parse(userStr);
                if (userObj && userObj.id) {
                    extraHeaders['New-Api-User'] = String(userObj.id);
                }
            }
        } catch (_) {
            // 解析失败则不添加该头，后端会正常返回 401
        }

        const response = await fetch(API_BASE + url, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...extraHeaders,
                ...options.headers
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.message || '请求失败' };
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        return { success: false, message: error.message || '网络错误' };
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

    deleteAccount: () =>
        apiRequest('/user/self', { method: 'DELETE' }),

    // ========== 令牌管理 ==========
    getTokens: (page = 1, size = 10) =>
        apiRequest(`/token/?p=${page}&page_size=${size}`),

    searchTokens: (keyword) =>
        apiRequest(`/token/search?keyword=${encodeURIComponent(keyword)}`),

    getToken: (id) => apiRequest(`/token/${id}`),

    getTokenKey: (id) =>
        apiRequest(`/token/${id}/key`, { method: 'POST' }),

    getTokenKeysBatch: (ids) =>
        apiRequest('/token/batch/keys', {
            method: 'POST',
            body: JSON.stringify({ ids })
        }),

    createToken: (data) =>
        apiRequest('/token/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateToken: (data) =>
        apiRequest('/token/', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    deleteToken: (id) =>
        apiRequest(`/token/${id}`, { method: 'DELETE' }),

    deleteTokenBatch: (ids) =>
        apiRequest('/token/batch', {
            method: 'POST',
            body: JSON.stringify({ ids })
        }),

    // ========== 模型相关 ==========
    getModels: () => apiRequest('/models'),

    // ========== 用户分组 ==========
    getUserGroups: () => apiRequest('/user/self/groups'),

    // ========== 渠道管理（管理员） ==========
    getChannels: (page = 1, size = 10) =>
        apiRequest(`/channel/?p=${page}&page_size=${size}`),

    searchChannels: (keyword) =>
        apiRequest(`/channel/search?keyword=${encodeURIComponent(keyword)}`),

    getChannel: (id) => apiRequest(`/channel/${id}`),

    createChannel: (data) =>
        apiRequest('/channel/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateChannel: (data) =>
        apiRequest('/channel/', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    deleteChannel: (id) =>
        apiRequest(`/channel/${id}`, { method: 'DELETE' }),

    testChannel: (id) =>
        apiRequest(`/channel/test/${id}`, { method: 'GET' }),

    testAllChannels: () =>
        apiRequest('/channel/test', { method: 'GET' }),

    updateChannelBalance: (id) =>
        apiRequest(`/channel/update_balance/${id}`, { method: 'GET' }),

    updateAllChannelBalance: () =>
        apiRequest('/channel/update_balance', { method: 'GET' }),

    // ========== 使用日志 ==========
    getUserLogs: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/log/self?${queryString}`);
    },

    searchUserLogs: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/log/self/search?${queryString}`);
    },

    getAllLogs: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/log/?${queryString}`);
    },

    searchAllLogs: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/log/search?${queryString}`);
    },

    getUserLogsStat: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/log/self/stat?${queryString}`);
    },

    getAllLogsStat: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/log/stat?${queryString}`);
    },

    // ========== 绘图日志 ==========
    getUserMidjourney: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/mj/self?${queryString}`);
    },

    getAllMidjourney: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/mj/?${queryString}`);
    },

    // ========== 任务日志 ==========
    getUserTask: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/task/self?${queryString}`);
    },

    getAllTask: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/task/?${queryString}`);
    },

    // ========== 数据统计 ==========
    getUserQuotaDates: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/data/self?${queryString}`);
    },

    getAllQuotaDates: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/data/?${queryString}`);
    },

    getQuotaDatesByUser: (params) => {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/data/users?${queryString}`);
    },

    // ========== 系统状态 ==========
    getStatus: () => apiRequest('/status'),

    // ========== 公告 ==========
    getNotice: () => apiRequest('/notice'),

    // ========== 兑换码管理（管理员） ==========
    getRedemptions: (page = 1, size = 10) =>
        apiRequest(`/redemption/?p=${page}&page_size=${size}`),

    searchRedemptions: (keyword) =>
        apiRequest(`/redemption/search?keyword=${encodeURIComponent(keyword)}`),

    getRedemption: (id) => apiRequest(`/redemption/${id}`),

    createRedemption: (data) =>
        apiRequest('/redemption/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateRedemption: (data) =>
        apiRequest('/redemption/', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    deleteRedemption: (id) =>
        apiRequest(`/redemption/${id}`, { method: 'DELETE' }),

    // batch-create redemptions (admin)
    createRedemptions: (data) =>
        apiRequest('/redemption/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    deleteInvalidRedemptions: () =>
        apiRequest('/redemption/invalid', { method: 'DELETE' }),

    // ========== 用户管理（管理员） ==========
    getUsers: (page = 1, size = 10) =>
        apiRequest(`/user/?p=${page}&page_size=${size}`),

    getAllUsers: (page = 1, size = 10) =>
        apiRequest(`/user/?p=${page}&page_size=${size}`),

    searchUsers: (keyword) =>
        apiRequest(`/user/search?keyword=${encodeURIComponent(keyword)}`),

    getUser: (id) => apiRequest(`/user/${id}`),

    createUser: (data) =>
        apiRequest('/user/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    // updateUser is both self-update (/user/self) and admin update (/user/)
    // For admin pages use updateUser with id; for self use updateUser without id
    updateUser: (data) => {
        if (data.id) {
            return apiRequest('/user/', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        }
        return apiRequest('/user/self', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    updateUserAdmin: (data) =>
        apiRequest('/user/', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    deleteUser: (id) =>
        apiRequest(`/user/${id}`, { method: 'DELETE' }),

    manageUser: (data) =>
        apiRequest('/user/manage', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    // manually topup a user (admin)
    topupUser: (id, quota) =>
        apiRequest('/user/manage', {
            method: 'POST',
            body: JSON.stringify({ id, action: 'topup', quota })
        }),

    getAllTopUps: () => apiRequest('/user/topup'),

    // ========== 系统设置（管理员） ==========
    getOptions: () => apiRequest('/option/'),

    updateOption: (key, value) =>
        apiRequest('/option/', {
            method: 'PUT',
            body: JSON.stringify({ key, value })
        }),

    // batch update options
    updateOptions: async (payload) => {
        const entries = Object.entries(payload);
        for (const [key, value] of entries) {
            const r = await apiRequest('/option/', {
                method: 'PUT',
                body: JSON.stringify({ key, value: String(value) })
            });
            if (!r.success) return r;
        }
        return { success: true };
    },

    // ========== 充值相关 ==========
    getTopUpInfo: () => apiRequest('/user/topup/info'),

    // user self topup history (log type=2 = topup)
    getTopupHistory: (page = 1, size = 20) =>
        apiRequest(`/log/self?p=${page}&page_size=${size}&type=2`),

    getUserTopUps: () => apiRequest('/user/topup/self'),

    // redeem a code
    redeemCode: (key) =>
        apiRequest('/user/topup', {
            method: 'POST',
            body: JSON.stringify({ key })
        }),

    topUp: (key) =>
        apiRequest('/user/topup', {
            method: 'POST',
            body: JSON.stringify({ key })
        }),

    requestEpay: (data) =>
        apiRequest('/user/pay', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    // ========== 推广/邀请 ==========
    getAffCode: () => apiRequest('/user/aff'),

    transferAffQuota: () =>
        apiRequest('/user/aff_transfer', { method: 'POST' }),

    // ========== Uptime 监控 ==========
    getUptimeStatus: () => apiRequest('/uptime/status'),

    // ========== 用户分组 ==========
    getGroups: () => apiRequest('/group/'),

    // ========== 订阅管理（管理员） ==========
    getSubscriptions: (page = 1, size = 10) =>
        apiRequest(`/subscription/?p=${page}&page_size=${size}`),

    searchSubscriptions: (keyword) =>
        apiRequest(`/subscription/search?keyword=${encodeURIComponent(keyword)}`),

    getSubscription: (id) => apiRequest(`/subscription/${id}`),

    createSubscription: (data) =>
        apiRequest('/subscription/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateSubscription: (data) =>
        apiRequest('/subscription/', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    deleteSubscription: (id) =>
        apiRequest(`/subscription/${id}`, { method: 'DELETE' }),

    getSubscriptionUsers: (id, page = 1, size = 10) =>
        apiRequest(`/subscription/${id}/users?p=${page}&page_size=${size}`),

    cancelUserSubscription: (userId, subscriptionId) =>
        apiRequest(`/subscription/${subscriptionId}/user/${userId}`, { method: 'DELETE' }),
};

// 导出 API（兼容模块和全局）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
