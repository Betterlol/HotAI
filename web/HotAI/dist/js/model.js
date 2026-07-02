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
        filtered = filtered.filter(m => m.quota_type === state.filterQuotaType);
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
    if (model.quota_type === 0) {
        return '<span class="tag-billing">按量计费</span>';
    } else if (model.quota_type === 1) {
        return '<span class="tag-billing">按次计费</span>';
    }
    return '<span class="tag-billing">未知</span>';
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
    const container = document.querySelector('.filter-group:nth-child(1) .filter-options');
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
    const container = document.querySelector('.filter-group:nth-child(2) .filter-options');
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
        html += `<button class="filter-opt-btn ${isActive ? 'active' : ''}" data-filter="group" data-value="${group}">${group} (${ratio}x, ${count})</button>`;
    });
    
    container.insertAdjacentHTML('beforeend', html);
}

function updateTagFilters() {
    const container = document.querySelector('.filter-group:nth-child(4) .filter-options');
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
    const container = document.querySelector('.filter-group:nth-child(5) .filter-options');
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

// ============ 初始化 ============

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initFilterEvents(); // 初始化筛选事件委托
    loadData();
});
