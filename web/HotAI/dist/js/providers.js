/**
 * AIProviders - AI 供应商和模型管理模块
 * 提供统一的接口获取供应商信息、模型列表，支持未登录访问
 */
let AIProviders = {
    // 私有状态
    _loaded: false,
    _loading: false,
    _providers: [],
    _models: [],
    _vendorMap: {},
    _modelVendorMap: {},
    
    // CDN 图标基址
    _iconCdnBase: 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1/icons',
    
    // 供应商官网映射表
    _websiteMap: {
        'OpenAI': 'https://openai.com',
        'Anthropic': 'https://anthropic.com',
        'Google': 'https://deepmind.google',
        'DeepSeek': 'https://deepseek.com',
        'Zhipu': 'https://zhipuai.cn',
        'Qwen': 'https://tongyi.aliyun.com',
        'Moonshot': 'https://moonshot.cn',
        'Baichuan': 'https://baichuan-ai.com',
        'Spark': 'https://xinghuo.xfyun.cn',
        'Hunyuan': 'https://cloud.tencent.com/product/hunyuan',
        'MiniMax': 'https://minimaxi.com',
        'Cohere': 'https://cohere.com',
        'Mistral': 'https://mistral.ai',
        'Doubao': 'https://volcengine.com/product/doubao',
        'Yi': 'https://lingyiwanwu.com',
        'Claude': 'https://anthropic.com',
        'Gemini': 'https://deepmind.google',
        'Azure': 'https://azure.microsoft.com',
        'Meta': 'https://llama.meta.com',
        'xAI': 'https://x.ai',
        'Jina': 'https://jina.ai',
        'Perplexity': 'https://perplexity.ai',
        'Amazon': 'https://aws.amazon.com/bedrock',
        'Stability AI': 'https://stability.ai',
        'AI360': 'https://ai.360.cn',
        'Wenxin': 'https://yiyan.baidu.com',
        'Minimax': 'https://minimaxi.com',
        'iFlytek': 'https://xinghuo.xfyun.cn',
        'Tencent': 'https://cloud.tencent.com/product/hunyuan',
        'Alibaba': 'https://tongyi.aliyun.com',
        'Baidu': 'https://yiyan.baidu.com',
        'Sensetime': 'https://sensetime.com',
        '01.AI': 'https://01.ai',
    },
    
    /**
     * 加载供应商和模型数据
     * @returns {Promise<boolean>} 成功返回 true
     */
    async load() {
        if (this._loaded) return true;
        if (this._loading) {
            // 等待正在进行的加载
            await new Promise(resolve => {
                const check = setInterval(() => {
                    if (!this._loading) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            });
            return this._loaded;
        }
        
        this._loading = true;
        
        try {
            const response = await fetch('/api/pricing');
            const result = await response.json();
            
            if (!result.success) {
                console.error('Failed to load pricing data:', result.message);
                return false;
            }
            
            // 解析供应商数据
            this._providers = Array.isArray(result.vendors) ? result.vendors : [];
            
            // 构建供应商映射表
            this._vendorMap = {};
            this._providers.forEach(vendor => {
                this._vendorMap[vendor.id] = vendor;
            });
            
            // 解析模型数据
            this._models = Array.isArray(result.data) ? result.data : [];
            
            // 构建模型 -> 供应商映射
            this._modelVendorMap = {};
            this._models.forEach(model => {
                if (model.vendor_id) {
                    this._modelVendorMap[model.model_name] = model.vendor_id;
                }
            });
            
            this._loaded = true;
            return true;
            
        } catch (error) {
            console.error('Error loading providers:', error);
            return false;
        } finally {
            this._loading = false;
        }
    },
    
    /**
     * 获取所有供应商列表
     * @returns {Array} 供应商数组
     */
    getProviders() {
        return this._providers;
    },
    
    /**
     * 获取所有模型列表
     * @returns {Array} 模型数组
     */
    getModels() {
        return this._models;
    },
    
    /**
     * 根据模型名获取供应商信息
     * @param {string} modelName - 模型名称
     * @returns {Object|null} 供应商对象或 null
     */
    getModelProvider(modelName) {
        const vendorId = this._modelVendorMap[modelName];
        return vendorId ? this._vendorMap[vendorId] : null;
    },
    
    /**
     * 根据供应商名称获取供应商信息
     * @param {string} name - 供应商名称
     * @returns {Object|null} 供应商对象或 null
     */
    getProviderByName(name) {
        return this._providers.find(p => p.name === name) || null;
    },
    
    /**
     * 根据 icon 名称获取 SVG 图标 URL
     * @param {string} iconName - 图标名称（如 "OpenAI"）
     * @returns {string} CDN 图标 URL
     */
    getProviderIconUrl(iconName) {
        if (!iconName) return '';
        
        // 转换为小写并处理空格
        const normalized = iconName.toLowerCase().replace(/\s+/g, '-');
        return `${this._iconCdnBase}/${normalized}.svg`;
    },
    
    /**
     * 根据供应商名称获取官网链接
     * @param {string} name - 供应商名称
     * @returns {string} 官网 URL 或空字符串
     */
    getProviderWebsite(name) {
        return this._websiteMap[name] || '';
    },
    
    /**
     * 获取供应商首字母缩写（用于降级显示）
     * @param {string} name - 供应商名称
     * @returns {string} 首字母缩写
     */
    getProviderAbbr(name) {
        if (!name) return '?';
        
        // 提取英文首字母
        const matches = name.match(/[A-Z]/g);
        if (matches && matches.length > 0) {
            return matches.slice(0, 2).join('');
        }
        
        // 如果没有大写字母，使用前两个字符
        return name.substring(0, 2).toUpperCase();
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    try {
        window.AIProviders = AIProviders;
    } catch (error) {
        console.warn('Unable to assign AIProviders to window:', error);
    }
}
