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

        // 处理 401 未授权响应（参照 web/default 的 axios 拦截器）
        if (response.status === 401) {
            // 清除本地认证状态
            localStorage.removeItem('user');
            // 如果不是明确跳过错误处理的请求，则重定向到登录页
            if (!options.skipErrorHandler) {
                const currentPath = window.location.pathname + window.location.search;
                window.location.href = `login.html?redirect=${encodeURIComponent(currentPath)}`;
            }
            // 标记会话已失效，方便循环调用方提前退出
            return { success: false, message: '会话已过期，请重新登录', _authExpired: true };
        }

        // 检查响应的 Content-Type，防止非 JSON 响应导致解析错误
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            // 非 JSON 响应，尝试读取文本内容
            const text = await response.text();
            console.error('Non-JSON response:', text);
            return { 
                success: false, 
                message: response.ok ? '服务器返回了非预期的响应格式' : `请求失败 (${response.status})` 
            };
        }

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.message || '请求失败' };
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        // 区分不同类型的错误
        if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
            return { success: false, message: '服务器响应格式错误，请稍后重试' };
        }
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

    updateTokenStatus: (id, status) =>
        apiRequest('/token/?status_only=true', {
            method: 'PUT',
            body: JSON.stringify({ id, status })
        }),

    // ========== 模型相关 ==========
    getModels: () => apiRequest('/models'),

    getPricing: () => apiRequest('/pricing'),

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

    // manually set user quota (admin) - override mode
    topupUser: (id, quota) =>
        apiRequest('/user/manage', {
            method: 'POST',
            body: JSON.stringify({ id, action: 'add_quota', mode: 'override', value: quota })
        }),

    getAllTopUps: () => apiRequest('/user/topup'),

    // ========== 系统设置（管理员） ==========
    getOptions: () => apiRequest('/option/'),

    updateOption: (key, value) =>
        apiRequest('/option/', {
            method: 'PUT',
            body: JSON.stringify({ key, value })
        }),

    // batch update options — preserves native JS types:
    // boolean stays boolean, number stays number, string stays string
    // 改进：遇到会话失效立即退出；其余错误收集后汇总（参照 web/default 的独立保存模式）
    updateOptions: async (payload) => {
        const entries = Object.entries(payload);
        const errors = [];
        let successCount = 0;
        
        for (const [key, value] of entries) {
            try {
                // Keep boolean and number as-is so the backend receives correct types.
                // Legacy callers may pass string 'true'/'false'/'1'/etc. — leave those as strings too.
                const bodyValue = (typeof value === 'boolean' || typeof value === 'number') ? value : String(value);
                const r = await apiRequest('/option/', {
                    method: 'PUT',
                    body: JSON.stringify({ key, value: bodyValue })
                });
                
                if (r.success) {
                    successCount++;
                } else if (r._authExpired) {
                    // 会话已失效，apiRequest 已处理跳转，立即退出避免大量无效请求
                    return r;
                } else {
                    errors.push({ key, message: r.message || '保存失败' });
                }
            } catch (error) {
                errors.push({ key, message: error.message || '网络错误' });
            }
        }
        
        if (errors.length === 0) {
            return { success: true };
        } else if (successCount > 0) {
            // 部分成功
            const failedKeys = errors.map(e => e.key).join(', ');
            return { 
                success: false, 
                message: `已保存 ${successCount} 项设置，但以下 ${errors.length} 项失败：${failedKeys}` 
            };
        } else {
            // 全部失败
            return { 
                success: false, 
                message: errors[0]?.message || '保存失败' 
            };
        }
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

    // ========== 订阅管理（管理员）- 新接口 ==========
    getAdminPlans: () =>
        apiRequest('/subscription/admin/plans'),

    createAdminPlan: (data) =>
        apiRequest('/subscription/admin/plans', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateAdminPlan: (id, data) =>
        apiRequest(`/subscription/admin/plans/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    patchPlanStatus: (id, enabled) =>
        apiRequest(`/subscription/admin/plans/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ enabled })
        }),

    deleteAdminPlan: (id) =>
        apiRequest(`/subscription/admin/plans/${id}`, { method: 'DELETE' }),

    // ========== 订阅管理（管理员）- 兼容旧接口 ==========
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

    // ========== 管理员用户订阅管理 ==========
    getUserSubscriptions: (userId) =>
        apiRequest(`/subscription/admin/users/${userId}/subscriptions`),

    createUserSubscription: (userId, data) =>
        apiRequest(`/subscription/admin/users/${userId}/subscriptions`, {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    invalidateUserSubscription: (userSubscriptionId) =>
        apiRequest(`/subscription/admin/user_subscriptions/${userSubscriptionId}/invalidate`, {
            method: 'POST'
        }),

    deleteUserSubscription: (userSubscriptionId) =>
        apiRequest(`/subscription/admin/user_subscriptions/${userSubscriptionId}`, {
            method: 'DELETE'
        }),

    // ========== 管理员重置用户认证 ==========
    resetUserPasskey: (userId) =>
        apiRequest(`/user/admin/${userId}/reset_passkey`, { method: 'DELETE' }),

    resetUser2FA: (userId) =>
        apiRequest(`/user/admin/${userId}/2fa`, { method: 'DELETE' }),

    // ========== 渠道管理（增强版，全量接口）==========

    // 搜索渠道（支持 keyword/model/group/status/type/sort_by/sort_order/p/page_size）
    searchChannelsEx: (params) => {
        const qs = new URLSearchParams(
            Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])
        ).toString();
        return apiRequest(`/channel/search?${qs}`);
    },

    // 获取渠道列表（增强版，支持多种筛选/排序参数）
    getChannelsEx: (params) => {
        const qs = new URLSearchParams(
            Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])
        ).toString();
        return apiRequest(`/channel/?${qs}`);
    },

    // 更新渠道状态（单个）
    updateChannelStatus: (id, status) =>
        apiRequest(`/channel/${id}/status`, {
            method: 'POST',
            body: JSON.stringify({ status })
        }),

    // 批量更新渠道状态
    batchUpdateChannelStatus: (ids, status) =>
        apiRequest('/channel/status/batch', {
            method: 'POST',
            body: JSON.stringify({ ids, status })
        }),

    // 批量删除渠道
    batchDeleteChannels: (ids) =>
        apiRequest('/channel/batch', {
            method: 'POST',
            body: JSON.stringify({ ids })
        }),

    // 批量设置渠道标签
    batchSetChannelTag: (ids, tag) =>
        apiRequest('/channel/batch/tag', {
            method: 'POST',
            body: JSON.stringify({ ids, tag: tag || null })
        }),

    // 复制/克隆渠道（支持 suffix, reset_balance 参数）
    copyChannel: (id, params) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest(`/channel/copy/${id}${qs}`, { method: 'POST' });
    },

    // 从上游获取模型列表（已存在的渠道）
    fetchUpstreamModels: (id) =>
        apiRequest(`/channel/fetch_models/${id}`),

    // 从自定义端点获取模型（创建时用）
    fetchModelsFromEndpoint: (type, key, base_url) =>
        apiRequest('/channel/fetch_models', {
            method: 'POST',
            body: JSON.stringify({ type, key, base_url: base_url || '' })
        }),

    // 查看渠道密钥（需 2FA/Passkey 验证 code）
    getChannelKey: (id, code) =>
        apiRequest(`/channel/${id}/key`, {
            method: 'POST',
            body: code ? JSON.stringify({ code }) : undefined
        }),

    // 多密钥管理
    manageMultiKeys: (params) =>
        apiRequest('/channel/multi_key/manage', {
            method: 'POST',
            body: JSON.stringify(params)
        }),

    // 修复渠道能力
    fixChannelAbilities: () =>
        apiRequest('/channel/fix', { method: 'POST' }),

    // 删除所有禁用渠道
    deleteDisabledChannels: () =>
        apiRequest('/channel/disabled', { method: 'DELETE' }),

    // 获取全部模型列表
    getAllChannelModels: () =>
        apiRequest('/channel/models'),

    // 获取启用的模型列表
    getEnabledChannelModels: () =>
        apiRequest('/channel/models_enabled'),

    // 获取渠道运维摘要（重试次数等）
    getChannelOps: () =>
        apiRequest('/channel/ops'),

    // 标签操作：按标签启用
    enableTagChannels: (tag) =>
        apiRequest('/channel/tag/enabled', {
            method: 'POST',
            body: JSON.stringify({ tag })
        }),

    // 标签操作：按标签禁用
    disableTagChannels: (tag) =>
        apiRequest('/channel/tag/disabled', {
            method: 'POST',
            body: JSON.stringify({ tag })
        }),

    // 批量编辑标签渠道的配置
    editTagChannels: (params) =>
        apiRequest('/channel/tag', {
            method: 'PUT',
            body: JSON.stringify(params)
        }),

    // 获取指定标签的模型列表
    getTagModels: (tag) =>
        apiRequest(`/channel/tag/models?tag=${encodeURIComponent(tag)}`),

    // 预填分组（快速选模型）
    getPrefillGroups: (type) =>
        apiRequest(`/prefill_group?type=${type || 'model'}`),

    // ========== 模型管理（管理员）==========
    getModels: (page = 1, size = 10) =>
        apiRequest(`/models/?p=${page}&page_size=${size}`),

    searchModels: (params) => {
        const qs = new URLSearchParams(
            Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])
        ).toString();
        return apiRequest(`/models/search?${qs}`);
    },

    getModel: (id) => apiRequest(`/models/${id}`),

    createModel: (data) =>
        apiRequest('/models/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateModel: (data) =>
        apiRequest('/models/', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    updateModelStatus: (id, status) =>
        apiRequest('/models/?status_only=true', {
            method: 'PUT',
            body: JSON.stringify({ id, status })
        }),

    deleteModel: (id) =>
        apiRequest(`/models/${id}`, { method: 'DELETE' }),

    syncUpstreamModels: (data) =>
        apiRequest('/models/sync_upstream', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    syncUpstreamPreview: () =>
        apiRequest('/models/sync_upstream/preview'),

    getMissingModels: () =>
        apiRequest('/models/missing'),

    // ========== 供应商管理（管理员）==========
    getVendors: () => apiRequest('/vendors/'),

    searchVendors: (keyword) =>
        apiRequest(`/vendors/search?keyword=${encodeURIComponent(keyword)}`),

    getVendor: (id) => apiRequest(`/vendors/${id}`),

    createVendor: (data) =>
        apiRequest('/vendors/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updateVendor: (data) =>
        apiRequest('/vendors/', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    deleteVendor: (id) =>
        apiRequest(`/vendors/${id}`, { method: 'DELETE' }),

    // ========== 预填组管理（管理员）==========
    createPrefillGroup: (data) =>
        apiRequest('/prefill_group/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    updatePrefillGroup: (data) =>
        apiRequest('/prefill_group/', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    deletePrefillGroup: (id) =>
        apiRequest(`/prefill_group/${id}`, { method: 'DELETE' }),

    // 仅检测上游模型更新（不同步）
    checkUpstreamModelUpdate: (id) =>
        apiRequest('/channel/upstream_updates/detect', {
            method: 'POST',
            body: JSON.stringify({ id })
        }),

    // 处理上游模型更新（同步最新模型列表）
    syncUpstreamModelUpdate: (id) =>
        apiRequest('/channel/upstream_updates/apply', {
            method: 'POST',
            body: JSON.stringify({ id })
        }),
};

// 导出 API（兼容模块和全局）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
