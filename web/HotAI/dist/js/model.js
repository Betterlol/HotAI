// 模型广场 - 数据管理与 UI 逻辑
// 使用 providers.js 和 api.js 获取后端数据

// 状态管理
let state = {
    // 数据
    models: [],
    vendors: [],
    vendorsMap: {},
    groupRatio: {},
    usableGroup: {},
    endpointMap: {},
    autoGroups: [],
    
    // 筛选
    filterVendor: 'all',
    filterGroup: 'all',
    filterQuotaType: 'all',
    filterTag: 'all',
    filterEndpointType: 'all',
    searchValue: '',
    
    // 显示设置
    isTableView: false,
    showPrice: true,
    showRate: false,
    currency: 'USD',
    unit: 'K',
    showWithRecharge: false,
    
    // UI 状态
    loading: true,
    selectedRowKeys: [],
    currentPage: 1,
    pageSize: 20
};

const USD_TO_CNY = 7.2;

// ============ 数据加载 ============

async function loadData() {
    state.loading = true;
    renderUI();
    
    try {
        // 使用 providers.js 加载数据
        const success = await AIProviders.load();
        if (!success) {
            showError('加载模型数据失败');
            state.loading = false;
            renderUI();
            return;
        }
        
        // 从 AIProviders 获取数据
        state.models = AIProviders.getModels();
        state.vendors = AIProviders.getProviders();
        
        // 构建 vendorsMap
        state.vendorsMap = {};
        state.vendors.forEach(vendor => {
            state.vendorsMap[vendor.id] = vendor;
        });
        
        // 获取额外的后端数据（group_ratio, usable_group 等）
        const response = await fetch('/api/pricing');
        const result = await response.json();
        
        if (result.success) {
            state.groupRatio = result.group_ratio || {};
            state.usableGroup = result.usable_group || {};
            state.endpointMap = result.supported_endpoint || {};
            state.autoGroups = result.auto_groups || [];
            
            // 为模型数据添加供应商信息
            state.models.forEach(model => {
                if (model.vendor_id && state.vendorsMap[model.vendor_id]) {
                    const vendor = state.vendorsMap[model.vendor_id];
                    model.vendor_name = vendor.name;
                    model.vendor_icon = vendor.icon;
                    model.vendor_description = vendor.description;
                }
            });
        }
        
        state.loading = false;
        renderUI();
        updateBanner();
        updateFilters();
        
    } catch (error) {
        console.error('加载数据失败:', error);
        showError('加载数据失败: ' + error.message);
        state.loading = false;
        renderUI();
    }
}

// ============ 工具函数 ============

function showError(message) {
    alert('错误: ' + message);
}

function formatValue(val) {
    let v = parseFloat(val);
    if (state.unit === 'M') v = v / 1000;
    let finalVal = v, prefix = '$';
    if (state.currency === 'CNY') {
        finalVal = v * USD_TO_CNY;
        prefix = '¥';
    }
    return `${prefix}${finalVal.toFixed(4)}`;
}

function formatRate(val) {
    return val ? parseFloat(val).toFixed(3) : '-';
}

// 获取供应商图标 HTML
function getVendorIcon(vendor) {
    if (!vendor) return '<div class="model-logo">?</div>';
    
    const iconUrl = AIProviders.getProviderIconUrl(vendor.icon || vendor.name);
    const abbr = AIProviders.getProviderAbbr(vendor.name);
    
    return `<div class="model-logo">
        <img src="${iconUrl}" 
             alt="${vendor.name}" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
             style="width: 100%; height: 100%; object-fit: contain;">
        <span style="display: none;">${abbr}</span>
    </div>`;
}

// 获取模型的供应商信息
function getModelVendor(model) {
    if (model.vendor_id && state.vendorsMap[model.vendor_id]) {
        return state.vendorsMap[model.vendor_id];
    }
    if (model.vendor_name) {
        return { name: model.vendor_name, icon: model.vendor_icon };
    }
    return null;
}

// 计算实际使用的分组倍率
function getUsedGroupRatio(model) {
    let usedGroup = state.filterGroup;
    let usedRatio = state.groupRatio[state.filterGroup];
    
    // 如果是"全部"或没有倍率，选择最小倍率的分组
    if (state.filterGroup === 'all' || usedRatio === undefined) {
        let minRatio = Infinity;
        if (model.enable_groups && Array.isArray(model.enable_groups)) {
            model.enable_groups.forEach(group => {
                const ratio = state.groupRatio[group];
                if (ratio !== undefined && ratio < minRatio) {
                    minRatio = ratio;
                    usedGroup = group;
                    usedRatio = ratio;
                }
            });
        }
        if (usedRatio === undefined) usedRatio = 1;
    }
    
    return { group: usedGroup, ratio: usedRatio };
}

// ============ 筛选逻辑 ============

function getFilteredModels() {
    let filtered = state.models;
    
    // 供应商筛选
    if (state.filterVendor !== 'all') {
        if (state.filterVendor === 'unknown') {
            filtered = filtered.filter(m => !m.vendor_name);
        } else {
            filtered = filtered.filter(m => m.vendor_name === state.filterVendor);
        }
    }
    
    // 分组筛选
    if (state.filterGroup !== 'all') {
        filtered = filtered.filter(m => 
            m.enable_groups && m.enable_groups.includes(state.filterGroup)
        );
    }
    
    // 计费类型筛选
    if (state.filterQuotaType !== 'all') {
        // 0 = 按量计费，显示所有模型
        // 1 = 按次计费，由于所有模型都是按量计费，返回空
        if (state.filterQuotaType === 0) {
            // 显示所有模型（不做筛选）
        } else {
            // 按次计费 - 返回空结果
            filtered = [];
        }
    }
    
    // 端点类型筛选
    if (state.filterEndpointType !== 'all') {
        filtered = filtered.filter(m => 
            m.supported_endpoint_types && 
            m.supported_endpoint_types.includes(state.filterEndpointType)
        );
    }
    
    // 标签筛选
    if (state.filterTag !== 'all') {
        const tagLower = state.filterTag.toLowerCase();
        filtered = filtered.filter(m => {
            if (!m.tags) return false;
            const tags = m.tags.toLowerCase().split(/[,;|]+/).map(t => t.trim());
            return tags.includes(tagLower);
        });
    }
    
    // 搜索筛选
    if (state.searchValue) {
        const term = state.searchValue.toLowerCase();
        filtered = filtered.filter(m =>
            (m.model_name && m.model_name.toLowerCase().includes(term)) ||
            (m.description && m.description.toLowerCase().includes(term)) ||
            (m.tags && m.tags.toLowerCase().includes(term)) ||
            (m.vendor_name && m.vendor_name.toLowerCase().includes(term))
        );
    }
    
    return filtered;
}

// ============ UI 渲染 ============

function renderUI() {
    const filteredModels = getFilteredModels();
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const paginatedModels = filteredModels.slice(startIndex, startIndex + state.pageSize);
    
    const cardGrid = document.getElementById('cardGrid');
    const tableBody = document.getElementById('tableBody');
    
    if (!cardGrid || !tableBody) return;
    
    cardGrid.innerHTML = '';
    tableBody.innerHTML = '';
    
    document.getElementById('cardViewContainer').classList.toggle('hidden', state.isTableView);
    document.getElementById('tableViewContainer').classList.toggle('hidden', !state.isTableView);
    
    if (state.loading) {
        cardGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">加载中...</div>';
        return;
    }
    
    if (paginatedModels.length === 0) {
        cardGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">未找到匹配的模型</div>';
        return;
    }
    
    paginatedModels.forEach(model => {
        const vendor = getModelVendor(model);
        const { ratio: groupRatio } = getUsedGroupRatio(model);
        
        // 卡片视图
        const cardHtml = `
            <div class="model-card" data-id="${model.model_name}">
                <div class="card-left">
                    ${vendor ? getVendorIcon(vendor) : '<div class="model-logo">?</div>'}
                    <div class="model-info">
                        <div class="model-name">
                            <span class="model-text">${model.model_name}</span>
                            <span class="icon-copy-svg" onclick="copyModelName('${model.model_name}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </span>
                            <input type="checkbox" class="model-checkbox" data-name="${model.model_name}" style="margin-left:8px; transform: scale(1.2);">
                        </div>
                        ${renderPrices(model, groupRatio)}
                        ${renderRates(model, groupRatio)}
                    </div>
                </div>
                <div class="card-right">
                    ${renderBillingTag(model)}
                </div>
            </div>
        `;
        cardGrid.innerHTML += cardHtml;
        
        // 表格视图
        const tableHtml = `
            <tr class="table-data-row" data-id="${model.model_name}">
                <td class="checkbox-cell"><input type="checkbox" class="model-checkbox" data-name="${model.model_name}"></td>
                <td><div class="model-name-cell">${vendor ? getVendorIcon(vendor) : '<div class="icon">?</div>'}<span>${model.model_name}</span></div></td>
                <td><div class="supplier-cell">${vendor ? getVendorIcon(vendor) + ' ' + vendor.name : '-'}</div></td>
                <td>${model.description || '-'}</td>
                <td>${renderTagsColumn(model)}</td>
                <td><div class="tag-cell">${renderBillingTag(model)}</div></td>
                <td><div class="tag-cell">${renderEndpointTags(model)}</div></td>
                <td><div class="stacked-col">${renderRatesColumn(model, groupRatio)}</div></td>
                <td><div class="stacked-col">${renderPricesColumn(model, groupRatio)}</div></td>
            </tr>
        `;
        tableBody.innerHTML += tableHtml;
    });
    
    bindCheckboxEvents();
    updateSelectAllCheckbox();
}

function renderBillingTag(model) {
    // 所有模型统一显示为按量计费
    return '<span class="tag-billing">按量计费</span>';
}

function renderTagsColumn(model) {
    if (!model.tags) return '-';
    const tags = model.tags.split(',').slice(0, 3);
    return tags.map(tag => `<span class="tag-small">${tag.trim()}</span>`).join(' ');
}

function renderEndpointTags(model) {
    if (!model.supported_endpoint_types || model.supported_endpoint_types.length === 0) {
        return '-';
    }
    return model.supported_endpoint_types
        .map(type => `<span class="tag-endpoint">${type}</span>`)
        .join(' ');
}

function renderPrices(model, groupRatio) {
    if (!state.showPrice) return '<div class="model-prices hidden"></div>';
    
    if (model.quota_type === 0) {
        // 按量计费
        const inputPrice = model.model_ratio * 2 * groupRatio;
        const outputPrice = model.model_ratio * 2 * model.completion_ratio * groupRatio;
        const cachePrice = model.cache_ratio ? model.model_ratio * 2 * model.cache_ratio * groupRatio : null;
        
        return `
            <div class="model-prices">
                <div class="price-item">输入价格 <span>${formatValue(inputPrice)} / 1${state.unit} Tokens</span></div>
                <div class="price-item">补全价格 <span>${formatValue(outputPrice)} / 1${state.unit} Tokens</span></div>
                ${cachePrice ? `<div class="price-item">缓存读取价格 <span>${formatValue(cachePrice)} / 1${state.unit} Tokens</span></div>` : ''}
            </div>
        `;
    } else if (model.quota_type === 1) {
        // 按次计费
        const price = parseFloat(model.model_price) * groupRatio;
        return `
            <div class="model-prices">
                <div class="price-item">模型价格 <span>${formatValue(price)} / 次</span></div>
            </div>
        `;
    }
    return '<div class="model-prices"></div>';
}

function renderPricesColumn(model, groupRatio) {
    if (!state.showPrice) return '<div style="color: #9CA3AF;">-</div>';
    return renderPrices(model, groupRatio).replace('model-prices', 'stacked-col');
}

function renderRates(model, groupRatio) {
    if (!state.showRate) return '';
    
    if (model.quota_type === 0) {
        return `
            <div class="rate-info">
                <div>模型倍率 <span>${formatRate(model.model_ratio)}</span></div>
                <div>补全倍率 <span>${formatRate(model.completion_ratio)}</span></div>
                <div>分组倍率 <span>${formatRate(groupRatio)}</span></div>
            </div>
        `;
    }
    return '';
}

function renderRatesColumn(model, groupRatio) {
    if (!state.showRate) return '<div style="color: #9CA3AF;">-</div>';
    
    if (model.quota_type === 0) {
        return `
            <div>模型倍率: <span>${formatRate(model.model_ratio)}</span></div>
            <div>补全倍率: <span>${formatRate(model.completion_ratio)}</span></div>
            <div>分组倍率: <span>${formatRate(groupRatio)}</span></div>
        `;
    }
    return '<div style="color: #9CA3AF;">-</div>';
}

// ============ 筛选器更新 ============

function updateFilters() {
    updateVendorFilters();
    updateGroupFilters();
    updateTagFilters();
    updateEndpointFilters();
}

function updateVendorFilters() {
    const container = document.querySelector('.filter-group:nth-child(2) .filter-options');
    if (!container) return;
    
    // 统计每个供应商的模型数量
    const vendorCounts = {};
    let unknownCount = 0;
    
    state.models.forEach(model => {
        if (model.vendor_name) {
            vendorCounts[model.vendor_name] = (vendorCounts[model.vendor_name] || 0) + 1;
        } else {
            unknownCount++;
        }
    });
    
    // 按供应商名称排序
    const vendors = Object.keys(vendorCounts).sort();
    
    // 更新"全部"按钮的文本和激活状态
    const allBtn = container.querySelector('[data-value="all"]');
    if (allBtn) {
        allBtn.textContent = `全部供应商 (${state.models.length})`;
        if (state.filterVendor === 'all') {
            allBtn.classList.add('active');
        } else {
            allBtn.classList.remove('active');
        }
    }
    
    // 移除所有动态生成的按钮（保留"全部"按钮）
    container.querySelectorAll('.filter-opt-btn:not([data-value="all"])').forEach(btn => btn.remove());
    
    // 生成其他按钮
    let html = '';
    vendors.forEach(vendor => {
        const count = vendorCounts[vendor];
        const isActive = state.filterVendor === vendor;
        // 尝试从 providers 获取供应商图标
        const vendorObj = state.vendors.find(v => v.name === vendor);
        const iconUrl = vendorObj ? AIProviders.getProviderIconUrl(vendorObj.icon || vendor) : null;
        
        if (iconUrl) {
            html += `<button class="filter-opt-btn ${isActive ? 'active' : ''}" data-filter="vendor" data-value="${vendor}">
                <img src="${iconUrl}" 
                     alt="${vendor}" 
                     style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"
                     onerror="this.style.display='none'">
                ${vendor} (${count})
            </button>`;
        } else {
            html += `<button class="filter-opt-btn ${isActive ? 'active' : ''}" data-filter="vendor" data-value="${vendor}">${vendor} (${count})</button>`;
        }
    });
    
    if (unknownCount > 0) {
        const isActive = state.filterVendor === 'unknown';
        html += `<button class="filter-opt-btn ${isActive ? 'active' : ''}" data-filter="vendor" data-value="unknown">未知供应商 (${unknownCount})</button>`;
    }
    
    // 追加到容器末尾
    container.insertAdjacentHTML('beforeend', html);
}

function updateGroupFilters() {
    const container = document.querySelector('.filter-group:nth-child(3) .filter-options');
    if (!container) return;
    
    const groups = Object.keys(state.usableGroup);
    
    // 统计每个分组的模型数量
    const groupCounts = {};
    state.models.forEach(model => {
        if (model.enable_groups && Array.isArray(model.enable_groups)) {
            model.enable_groups.forEach(group => {
                groupCounts[group] = (groupCounts[group] || 0) + 1;
            });
        }
    });
    
    // 更新"全部"按钮
    const allBtn = container.querySelector('[data-value="all"]');
    if (allBtn) {
        allBtn.textContent = `全部分组 (${state.models.length})`;
        if (state.filterGroup === 'all') {
            allBtn.classList.add('active');
        } else {
            allBtn.classList.remove('active');
        }
    }
    
    // 移除动态生成的按钮
    container.querySelectorAll('.filter-opt-btn:not([data-value="all"])').forEach(btn => btn.remove());
    
    // 生成其他按钮
    let html = '';
    groups.forEach(group => {
        const ratio = state.groupRatio[group] || 1;
        const count = groupCounts[group] || 0;
        const isActive = state.filterGroup === group;
        html += `<button class="filter-opt-btn ${isActive ? 'active' : ''}" data-filter="group" data-value="${group}">${group}-${ratio}x (${count})</button>`;
    });
    
    container.insertAdjacentHTML('beforeend', html);
}

function updateTagFilters() {
    const container = document.querySelector('.filter-group:nth-child(5) .filter-options');
    if (!container) return;
    
    // 统计每个标签的模型数量
    const tagCounts = {};
    state.models.forEach(model => {
        if (model.tags) {
            model.tags.split(/[,;|]+/).forEach(tag => {
                const t = tag.trim();
                if (t) {
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                }
            });
        }
    });
    
    const tags = Object.keys(tagCounts).sort();
    
    // 更新"全部"按钮
    const allBtn = container.querySelector('[data-value="all"]');
    if (allBtn) {
        allBtn.textContent = `全部标签 (${state.models.length})`;
        if (state.filterTag === 'all') {
            allBtn.classList.add('active');
        } else {
            allBtn.classList.remove('active');
        }
    }
    
    // 移除动态生成的按钮
    container.querySelectorAll('.filter-opt-btn:not([data-value="all"])').forEach(btn => btn.remove());
    
    // 生成其他按钮
    let html = '';
    tags.forEach(tag => {
        const count = tagCounts[tag];
        const isActive = state.filterTag === tag;
        html += `<button class="filter-opt-btn ${isActive ? 'active' : ''}" data-filter="tag" data-value="${tag}">${tag} (${count})</button>`;
    });
    
    container.insertAdjacentHTML('beforeend', html);
}

function updateEndpointFilters() {
    const container = document.querySelector('.filter-group:nth-child(6) .filter-options');
    if (!container) return;
    
    // 统计每个端点类型的模型数量
    const endpointCounts = {};
    state.models.forEach(model => {
        if (model.supported_endpoint_types && Array.isArray(model.supported_endpoint_types)) {
            model.supported_endpoint_types.forEach(ep => {
                endpointCounts[ep] = (endpointCounts[ep] || 0) + 1;
            });
        }
    });
    
    const endpoints = Object.keys(endpointCounts).sort();
    
    // 更新"全部"按钮
    const allBtn = container.querySelector('[data-value="all"]');
    if (allBtn) {
        allBtn.textContent = `全部端点 (${state.models.length})`;
        if (state.filterEndpointType === 'all') {
            allBtn.classList.add('active');
        } else {
            allBtn.classList.remove('active');
        }
    }
    
    // 移除动态生成的按钮
    container.querySelectorAll('.filter-opt-btn:not([data-value="all"])').forEach(btn => btn.remove());
    
    // 生成其他按钮
    let html = '';
    endpoints.forEach(ep => {
        const count = endpointCounts[ep];
        const isActive = state.filterEndpointType === ep;
        html += `<button class="filter-opt-btn ${isActive ? 'active' : ''}" data-filter="endpoint" data-value="${ep}">${ep} (${count})</button>`;
    });
    
    container.insertAdjacentHTML('beforeend', html);
}

function updateBanner() {
    const filtered = getFilteredModels();
    
    // 更新模型数量
    const modelCount = document.getElementById('bannerModelCount');
    if (modelCount) {
        modelCount.textContent = `共 ${filtered.length} 个模型`;
    }
    
    // 收集当前筛选结果中的供应商
    const vendorSet = new Set();
    filtered.forEach(model => {
        if (model.vendor_name) {
            vendorSet.add(model.vendor_name);
        }
    });
    
    const vendors = Array.from(vendorSet);
    
    // 更新供应商名称显示
    const vendorName = document.getElementById('bannerVendorName');
    const description = document.getElementById('bannerDescription');
    const logosContainer = document.getElementById('bannerLogos');
    
    if (state.filterVendor !== 'all') {
        // 单个供应商筛选
        if (state.filterVendor === 'unknown') {
            if (vendorName) vendorName.textContent = '未知供应商';
            if (description) description.textContent = '这些模型暂未关联到具体供应商';
            if (logosContainer) logosContainer.style.display = 'none';
        } else {
            if (vendorName) vendorName.textContent = state.filterVendor;
            const vendorObj = state.vendors.find(v => v.name === state.filterVendor);
            if (description && vendorObj && vendorObj.description) {
                description.textContent = vendorObj.description;
            } else if (description) {
                description.textContent = `查看 ${state.filterVendor} 提供的所有模型`;
            }
            
            // 显示单个供应商 logo
            if (logosContainer && vendorObj) {
                const iconUrl = AIProviders.getProviderIconUrl(vendorObj.icon || state.filterVendor);
                logosContainer.innerHTML = `<div class="vendor-logo-single">
                    <img src="${iconUrl}" alt="${state.filterVendor}" onerror="this.style.display='none'">
                </div>`;
                logosContainer.style.display = 'flex';
            }
        }
    } else if (vendors.length === 0) {
        // 无结果
        if (vendorName) vendorName.textContent = '无匹配结果';
        if (description) description.textContent = '请尝试调整筛选条件';
        if (logosContainer) logosContainer.style.display = 'none';
    } else if (vendors.length === 1) {
        // 筛选结果只有一个供应商
        const vendor = vendors[0];
        if (vendorName) vendorName.textContent = vendor;
        const vendorObj = state.vendors.find(v => v.name === vendor);
        if (description && vendorObj && vendorObj.description) {
            description.textContent = vendorObj.description;
        } else if (description) {
            description.textContent = `查看 ${vendor} 提供的所有模型`;
        }
        
        // 显示单个供应商 logo
        if (logosContainer && vendorObj) {
            const iconUrl = AIProviders.getProviderIconUrl(vendorObj.icon || vendor);
            logosContainer.innerHTML = `<div class="vendor-logo-single">
                <img src="${iconUrl}" alt="${vendor}" onerror="this.style.display='none'">
            </div>`;
            logosContainer.style.display = 'flex';
        }
    } else {
        // 多个供应商 - 显示轮播
        if (vendorName) vendorName.textContent = `${vendors.length} 个供应商`;
        if (description) description.textContent = '查看所有可用的AI模型供应商，包括众多知名供应商的模型';
        
        // 生成轮播 logo
        if (logosContainer) {
            let logosHtml = '<div class="vendor-logos-carousel">';
            vendors.forEach(vendor => {
                const vendorObj = state.vendors.find(v => v.name === vendor);
                if (vendorObj) {
                    const iconUrl = AIProviders.getProviderIconUrl(vendorObj.icon || vendor);
                    const abbr = AIProviders.getProviderAbbr(vendor);
                    logosHtml += `<div class="vendor-logo-item" title="${vendor}">
                        <img src="${iconUrl}" alt="${vendor}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <span class="vendor-logo-fallback" style="display:none;">${abbr}</span>
                    </div>`;
                }
            });
            logosHtml += '</div>';
            logosContainer.innerHTML = logosHtml;
            logosContainer.style.display = 'flex';
            
            // 启动轮播动画
            startLogoCarousel();
        }
    }
}

// Logo 轮播动画
let carouselInterval = null;
function startLogoCarousel() {
    if (carouselInterval) clearInterval(carouselInterval);
    
    const carousel = document.querySelector('.vendor-logos-carousel');
    if (!carousel) return;
    
    const items = carousel.querySelectorAll('.vendor-logo-item');
    if (items.length <= 5) return; // 5个以内不需要轮播
    
    let currentIndex = 0;
    carouselInterval = setInterval(() => {
        currentIndex = (currentIndex + 1) % items.length;
        const offset = -(currentIndex * 80); // 每个 logo 80px
        carousel.style.transform = `translateX(${offset}px)`;
    }, 3000);
}

// ============ 事件绑定 ============

// 使用事件委托绑定到侧边栏
function initFilterEvents() {
    const sidebar = document.querySelector('.sidebar-filters');
    if (!sidebar) return;
    
    sidebar.addEventListener('click', function(e) {
        const btn = e.target.closest('.filter-opt-btn');
        if (!btn) return;
        
        const filterType = btn.getAttribute('data-filter');
        const value = btn.getAttribute('data-value');
        
        if (!filterType || !value) return;
        
        // 更新按钮激活状态
        const container = btn.parentElement;
        container.querySelectorAll('.filter-opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 更新状态
        if (filterType === 'vendor') {
            state.filterVendor = value;
        } else if (filterType === 'group') {
            state.filterGroup = value;
        } else if (filterType === 'tag') {
            state.filterTag = value;
        } else if (filterType === 'endpoint') {
            state.filterEndpointType = value;
        } else if (filterType === 'billing') {
            state.filterQuotaType = value === 'all' ? 'all' : parseInt(value);
        }
        
        state.currentPage = 1;
        renderUI();
        updateBanner();
    });
}

function bindCheckboxEvents() {
    document.querySelectorAll('.model-checkbox').forEach(cb => {
        cb.addEventListener('change', function() {
            const modelName = this.getAttribute('data-name');
            const row = this.closest('.model-card') || this.closest('tr');
            
            if (this.checked) {
                if (!state.selectedRowKeys.includes(modelName)) {
                    state.selectedRowKeys.push(modelName);
                }
                if (row) row.classList.add('selected-row');
            } else {
                state.selectedRowKeys = state.selectedRowKeys.filter(k => k !== modelName);
                if (row) row.classList.remove('selected-row');
            }
            
            updateSelectAllCheckbox();
        });
    });
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (!selectAllCheckbox) return;
    
    const allCheckboxes = document.querySelectorAll('.model-checkbox');
    const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
    
    selectAllCheckbox.checked = allCheckboxes.length > 0 && checkedCount === allCheckboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
}

function copyModelName(name) {
    navigator.clipboard.writeText(name).then(() => {
        alert('已复制: ' + name);
    });
}

// ============ 控制按钮事件 ============

document.getElementById('copySelectedBtn')?.addEventListener('click', function() {
    if (state.selectedRowKeys.length === 0) {
        alert('请先勾选需要复制的模型！');
        return;
    }
    navigator.clipboard.writeText(state.selectedRowKeys.join('\n')).then(() => {
        alert(`成功复制 ${state.selectedRowKeys.length} 个模型名称到剪贴板`);
    });
});

document.getElementById('switchPrice')?.addEventListener('click', function() {
    this.classList.toggle('active');
    state.showPrice = this.classList.contains('active');
    renderUI();
});

document.getElementById('currencyBtn')?.addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('currencyDropdown').classList.toggle('show');
});

document.querySelectorAll('#currencyDropdown li').forEach(item => {
    item.addEventListener('click', function() {
        state.currency = this.getAttribute('data-value');
        document.querySelector('#currencyBtn span').innerText = state.currency;
        document.getElementById('currencyDropdown').classList.remove('show');
        renderUI();
    });
});

document.addEventListener('click', function(e) {
    if (!e.target.closest('.currency-selector')) {
        document.getElementById('currencyDropdown')?.classList.remove('show');
    }
});

document.getElementById('switchRate')?.addEventListener('click', function() {
    this.classList.toggle('active');
    state.showRate = this.classList.contains('active');
    renderUI();
});

document.getElementById('switchViewBtn')?.addEventListener('click', function() {
    state.isTableView = !state.isTableView;
    this.innerText = state.isTableView ? '卡片视图' : '表格视图';
    this.classList.toggle('active');
    renderUI();
});

document.getElementById('switchUnitBtn')?.addEventListener('click', function() {
    state.unit = state.unit === 'K' ? 'M' : 'K';
    this.innerText = state.unit;
    renderUI();
});

document.getElementById('selectAllCheckbox')?.addEventListener('change', function() {
    const isChecked = this.checked;
    document.querySelectorAll('.model-checkbox').forEach(cb => {
        cb.checked = isChecked;
        const modelName = cb.getAttribute('data-name');
        const row = cb.closest('.model-card') || cb.closest('tr');
        
        if (isChecked) {
            if (!state.selectedRowKeys.includes(modelName)) {
                state.selectedRowKeys.push(modelName);
            }
            if (row) row.classList.add('selected-row');
        } else {
            state.selectedRowKeys = [];
            if (row) row.classList.remove('selected-row');
        }
    });
});

// 搜索输入
const searchInput = document.querySelector('.search-input-area input');
if (searchInput) {
    searchInput.addEventListener('input', function() {
        state.searchValue = this.value;
        state.currentPage = 1;
        renderUI();
        updateBanner();
    });
}

// 重置筛选
document.querySelector('.filter-reset')?.addEventListener('click', function() {
    state.filterVendor = 'all';
    state.filterGroup = 'all';
    state.filterQuotaType = 'all';
    state.filterTag = 'all';
    state.filterEndpointType = 'all';
    state.searchValue = '';
    state.currentPage = 1;
    
    if (searchInput) searchInput.value = '';
    
    // 重置所有筛选按钮
    document.querySelectorAll('.filter-opt-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('[data-value="all"]').forEach(btn => {
        btn.classList.add('active');
    });
    
    renderUI();
    updateBanner();
});

// ============ 模型详情抽屉 ============

let selectedModelData = null;

// 打开模型详情抽屉
function openModelDrawer(model) {
    selectedModelData = model;
    const overlay = document.getElementById('modelDrawerOverlay');
    const drawer = document.getElementById('modelDrawer');
    
    if (!overlay || !drawer) return;
    
    // 显示覆盖层和抽屉
    overlay.style.display = 'block';
    drawer.style.display = 'flex';
    
    // 触发动画
    setTimeout(() => {
        overlay.classList.add('show');
        drawer.classList.add('open');
    }, 10);
    
    // 渲染内容
    renderDrawerHeader(model);
    renderDrawerContent(model);
    
    // 阻止 body 滚动
    document.body.style.overflow = 'hidden';
}

// 关闭模型详情抽屉
function closeModelDrawer() {
    const overlay = document.getElementById('modelDrawerOverlay');
    const drawer = document.getElementById('modelDrawer');
    
    if (!overlay || !drawer) return;
    
    // 移除动画类
    overlay.classList.remove('show');
    drawer.classList.remove('open');
    
    // 动画结束后隐藏
    setTimeout(() => {
        overlay.style.display = 'none';
        drawer.style.display = 'none';
        selectedModelData = null;
    }, 300);
    
    // 恢复 body 滚动
    document.body.style.overflow = '';
}

// 渲染抽屉头部
function renderDrawerHeader(model) {
    const iconContainer = document.getElementById('drawerModelIcon');
    const nameContainer = document.getElementById('drawerModelName');
    
    if (!iconContainer || !nameContainer) return;
    
    const vendor = getModelVendor(model);
    iconContainer.innerHTML = vendor ? getVendorIcon(vendor) : '<div class="model-logo">?</div>';
    nameContainer.textContent = model.model_name || '未知模型';
}

// 渲染抽屉内容
function renderDrawerContent(model) {
    const contentContainer = document.getElementById('drawerContent');
    if (!contentContainer) return;
    
    let html = '';
    
    // 基本信息区
    html += renderBasicInfoSection(model);
    
    // 端点信息区
    html += renderEndpointsSection(model);
    
    // 动态计费区（仅当 billing_mode === 'tiered_expr' 时显示）
    if (model.billing_mode === 'tiered_expr' && model.billing_expr) {
        html += renderDynamicPricingSection(model);
    }
    
    // 分组价格区
    html += renderGroupPricingSection(model);
    
    contentContainer.innerHTML = html;
}

// 渲染基本信息区
function renderBasicInfoSection(model) {
    const vendor = getModelVendor(model);
    const description = model.description || (vendor && vendor.description ? `供应商信息：${vendor.description}` : '暂无模型描述');
    const tags = model.tags ? model.tags.split(',').filter(t => t.trim()) : [];
    
    let html = '<div class="drawer-section">';
    html += '<div class="drawer-section-header">';
    html += '<div class="drawer-section-icon" style="background: #DBEAFE;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>';
    html += '<div><div class="drawer-section-title">基本信息</div><div class="drawer-section-subtitle">模型的详细描述和基本特性</div></div>';
    html += '</div>';
    html += '<div class="drawer-section-body">';
    html += `<div class="drawer-description">${description}</div>`;
    
    if (tags.length > 0) {
        html += '<div class="drawer-tags">';
        tags.forEach(tag => {
            html += `<span class="drawer-tag">${tag.trim()}</span>`;
        });
        html += '</div>';
    }
    
    html += '</div></div>';
    return html;
}

// 渲染端点信息区
function renderEndpointsSection(model) {
    const endpoints = model.supported_endpoint_types || [];
    
    let html = '<div class="drawer-section">';
    html += '<div class="drawer-section-header">';
    html += '<div class="drawer-section-icon" style="background: #F3E8FF;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7E22CE" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>';
    html += '<div><div class="drawer-section-title">API端点</div><div class="drawer-section-subtitle">模型支持的接口端点信息</div></div>';
    html += '</div>';
    html += '<div class="drawer-section-body">';
    
    if (endpoints.length === 0) {
        html += '<div style="color: var(--c-text-secondary); font-size: 13px;">暂无端点信息</div>';
    } else {
        html += '<div class="drawer-endpoint-list">';
        endpoints.forEach(type => {
            const info = state.endpointMap[type] || {};
            let path = info.path || '';
            if (path.includes('{model}')) {
                path = path.replaceAll('{model}', model.model_name || '');
            }
            const method = info.method || 'POST';
            
            html += '<div class="drawer-endpoint-item">';
            html += '<div style="flex: 1; min-width: 0;">';
            html += `<div class="drawer-endpoint-name"><span class="drawer-endpoint-badge"></span>${type}</div>`;
            if (path) {
                html += `<div class="drawer-endpoint-path">${path}</div>`;
            }
            html += '</div>';
            if (path) {
                html += `<div class="drawer-endpoint-method">${method}</div>`;
            }
            html += '</div>';
        });
        html += '</div>';
    }
    
    html += '</div></div>';
    return html;
}

// 渲染动态计费区（简化版，不解析复杂表达式）
function renderDynamicPricingSection(model) {
    let html = '<div class="drawer-section">';
    html += '<div class="drawer-section-header">';
    html += '<div class="drawer-section-icon" style="background: #FEF3C7;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></div>';
    html += '<div><div class="drawer-section-title">动态计费</div><div class="drawer-section-subtitle">价格根据用量档位和请求条件动态调整</div></div>';
    html += '</div>';
    html += '<div class="drawer-section-body">';
    html += `<div style="font-size: 12px; color: var(--c-text-secondary); background: var(--c-input-bg); padding: 10px 12px; border-radius: 8px; word-break: break-all; font-family: monospace;">${model.billing_expr}</div>`;
    html += '<div style="margin-top: 8px; font-size: 12px; color: var(--c-text-secondary);">* 动态计费表达式详情请查看管理后台</div>';
    html += '</div></div>';
    return html;
}

// 渲染分组价格区
function renderGroupPricingSection(model) {
    const modelEnableGroups = Array.isArray(model.enable_groups) ? model.enable_groups : [];
    const autoChain = state.autoGroups.filter(g => modelEnableGroups.includes(g));
    const availableGroups = Object.keys(state.usableGroup || {})
        .filter(g => g !== '' && g !== 'auto')
        .filter(g => modelEnableGroups.includes(g));
    
    let html = '<div class="drawer-section">';
    html += '<div class="drawer-section-header">';
    html += '<div class="drawer-section-icon" style="background: #FED7AA;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>';
    html += '<div><div class="drawer-section-title">分组价格</div><div class="drawer-section-subtitle">不同用户分组的价格信息</div></div>';
    html += '</div>';
    html += '<div class="drawer-section-body">';
    
    // auto 调用链路
    if (autoChain.length > 0) {
        html += '<div class="drawer-auto-chain">';
        html += '<span class="drawer-auto-chain-label">auto分组调用链路</span>';
        html += '<span class="drawer-auto-chain-arrow">→</span>';
        autoChain.forEach((g, idx) => {
            html += `<span class="drawer-group-tag">${g}分组</span>`;
            if (idx < autoChain.length - 1) {
                html += '<span class="drawer-auto-chain-arrow">→</span>';
            }
        });
        html += '</div>';
    }
    
    // 价格表格
    if (availableGroups.length === 0) {
        html += '<div style="color: var(--c-text-secondary); font-size: 13px;">暂无可用分组</div>';
    } else {
        html += '<div class="drawer-pricing-groups">';
        
        availableGroups.forEach(group => {
            const { ratio: groupRatio } = getUsedGroupRatio({ ...model, enable_groups: [group] });
            const billingType = model.billing_mode === 'tiered_expr' ? '动态计费' :
                               model.quota_type === 0 ? '按量计费' :
                               model.quota_type === 1 ? '按次计费' : '-';
            const billingClass = model.billing_mode === 'tiered_expr' ? 'dynamic' :
                                model.quota_type === 0 ? 'quantity' :
                                model.quota_type === 1 ? 'per-call' : '';
            
            html += '<div class="drawer-pricing-group-card">';
            
            // 分组头部
            html += '<div class="drawer-pricing-group-header">';
            html += `<span class="drawer-group-tag">${group}分组</span>`;
            html += `<span class="drawer-ratio-tag">${groupRatio}x</span>`;
            html += `<span class="drawer-billing-tag ${billingClass}">${billingType}</span>`;
            html += '</div>';
            
            // 价格详情
            html += '<div class="drawer-pricing-details">';
            
            if (model.billing_mode === 'tiered_expr') {
                html += '<div class="drawer-price-note">见上方动态计费详情</div>';
            } else if (model.quota_type === 0) {
                // 按量计费 - 使用胶囊样式
                const inputPrice = model.model_ratio * 2 * groupRatio;
                const outputPrice = model.model_ratio * 2 * model.completion_ratio * groupRatio;
                const cachePrice = model.cache_ratio ? model.model_ratio * 2 * model.cache_ratio * groupRatio : null;
                
                html += `<div class="drawer-price-capsule">
                    <span class="drawer-price-label">输入价格</span>
                    <span class="drawer-price-value">${formatValue(inputPrice)} / 1${state.unit} Tokens</span>
                </div>`;
                html += `<div class="drawer-price-capsule">
                    <span class="drawer-price-label">补全价格</span>
                    <span class="drawer-price-value">${formatValue(outputPrice)} / 1${state.unit} Tokens</span>
                </div>`;
                if (cachePrice) {
                    html += `<div class="drawer-price-capsule">
                        <span class="drawer-price-label">缓存读取价格</span>
                        <span class="drawer-price-value">${formatValue(cachePrice)} / 1${state.unit} Tokens</span>
                    </div>`;
                }
                
                // 显示倍率详情
                html += '<div class="drawer-ratio-details">';
                html += `<span class="drawer-ratio-detail-item">模型倍率: ${formatRate(model.model_ratio)}</span>`;
                html += `<span class="drawer-ratio-detail-item">补全倍率: ${formatRate(model.completion_ratio)}</span>`;
                html += `<span class="drawer-ratio-detail-item">分组倍率: ${formatRate(groupRatio)}</span>`;
                html += '</div>';
            } else if (model.quota_type === 1) {
                // 按次计费
                const price = parseFloat(model.model_price) * groupRatio;
                html += `<div class="drawer-price-capsule">
                    <span class="drawer-price-label">模型价格</span>
                    <span class="drawer-price-value">${formatValue(price)} / 次</span>
                </div>`;
            }
            
            html += '</div>'; // drawer-pricing-details
            html += '</div>'; // drawer-pricing-group-card
        });
        
        html += '</div>'; // drawer-pricing-groups
    }
    
    html += '</div></div>';
    return html;
}

// 绑定抽屉事件
function initDrawerEvents() {
    // 关闭按钮
    const closeBtn = document.getElementById('drawerCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModelDrawer);
    }
    
    // 覆盖层点击关闭
    const overlay = document.getElementById('modelDrawerOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeModelDrawer);
    }
    
    // ESC 键关闭
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && selectedModelData) {
            closeModelDrawer();
        }
    });
}

// 绑定卡片和表格行的点击事件
function bindModelClickEvents() {
    // 使用事件委托监听卡片点击
    const cardGrid = document.getElementById('cardGrid');
    if (cardGrid) {
        cardGrid.addEventListener('click', function(e) {
            // 如果点击的是复选框或复制按钮，不触发
            if (e.target.closest('.model-checkbox') || e.target.closest('.icon-copy-svg')) {
                return;
            }
            
            const card = e.target.closest('.model-card');
            if (card) {
                const modelName = card.getAttribute('data-id');
                const model = state.models.find(m => m.model_name === modelName);
                if (model) {
                    openModelDrawer(model);
                }
            }
        });
    }
    
    // 使用事件委托监听表格行点击
    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
        tableBody.addEventListener('click', function(e) {
            // 如果点击的是复选框，不触发
            if (e.target.closest('.model-checkbox')) {
                return;
            }
            
            const row = e.target.closest('tr');
            if (row && row.classList.contains('table-data-row')) {
                const modelName = row.getAttribute('data-id');
                const model = state.models.find(m => m.model_name === modelName);
                if (model) {
                    openModelDrawer(model);
                }
            }
        });
    }
}

// ============ 初始化 ============

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initFilterEvents(); // 初始化筛选事件委托
    initDrawerEvents(); // 初始化抽屉事件
    bindModelClickEvents(); // 绑定模型点击事件
    loadData();
});
