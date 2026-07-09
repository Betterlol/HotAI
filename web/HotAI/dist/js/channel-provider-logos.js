// 供应商Logo工具函数
// 获取渠道类型图标（用于 logo 显示）
function getChannelTypeIcon(type) {
    const TYPE_TO_ICON = {
        1: 'OpenAI', 6: 'OpenAI', 7: 'OpenAI', 8: 'OpenAI', 58: 'NewAPI', 3: 'Azure',
        14: 'Claude', 24: 'Gemini', 11: 'Google', 41: 'Gemini',
        33: 'Aws', 39: 'Cloudflare',
        15: 'Baidu', 46: 'Baidu', 16: 'Zhipu', 26: 'Zhipu', 17: 'Qwen', 18: 'Spark',
        23: 'Hunyuan', 19: 'Ai360', 25: 'Moonshot', 31: 'Yi', 35: 'Minimax', 45: 'Volcengine',
        4: 'Ollama', 27: 'Perplexity', 34: 'Cohere', 42: 'Mistral', 43: 'DeepSeek',
        48: 'XAI', 49: 'Coze', 40: 'SiliconCloud', 44: 'OpenAI', 20: 'OpenRouter',
        2: 'Midjourney', 5: 'Midjourney', 50: 'Kling', 51: 'Jimeng', 52: 'Vidu',
        36: 'Suno', 55: 'OpenAI', 54: 'Doubao', 56: 'Replicate',
        37: 'Dify', 38: 'Jina', 22: 'FastGPT', 47: 'Xinference', 53: 'OpenAI',
        10: 'OpenAI', 21: 'OpenAI', 12: 'OpenAI', 13: 'OpenAI', 9: 'OpenAI'
    };
    return TYPE_TO_ICON[type] || 'OpenAI';
}

// 获取供应商 Logo URL（使用 CDN）
function getProviderLogoUrl(iconName) {
    return `https://unpkg.com/@lobehub/icons-static-svg@latest/light/${iconName}.svg`;
}

// 在类型选择器中选择某个类型
function selectType(value, label, iconName) {
    document.getElementById('chType').value = value;
    const logoUrl = getProviderLogoUrl(iconName);
    document.getElementById('typeComboboxLabel').innerHTML = `<img src="${logoUrl}" style="width:18px;height:18px;margin-right:6px;vertical-align:middle;" onerror="this.style.display='none';this.nextSibling.textContent='${label}'"/><span>${label}</span>`;
    document.getElementById('typeComboboxDropdown').classList.remove('show');
    document.getElementById('chModalTypeName').textContent = label;
    const iconImg = `<img src="${logoUrl}" style="width:20px;height:20px;" onerror="this.style.display='none'"/>`;
    document.getElementById('chModalTypeIcon').innerHTML = iconImg;
    onTypeChange(value);
}

// 更新类型下拉的DOM以包含logo
function updateTypeDropdownWithLogos() {
    const list = document.getElementById('typeComboboxList');
    if (!list) return;
    
    list.innerHTML = '';
    ChannelState.channelTypes.forEach(t => {
        const item = document.createElement('div');
        item.className = 'type-combobox-item';
        const iconName = getChannelTypeIcon(t.value);
        const logoUrl = getProviderLogoUrl(iconName);
        item.innerHTML = `<img src="${logoUrl}" style="width:20px;height:20px;margin-right:8px;" onerror="this.style.display='none'"/><span>${t.label}</span>`;
        item.onclick = () => selectType(t.value, t.label, iconName);
        item.setAttribute('data-search', t.label.toLowerCase());
        item.setAttribute('data-type', t.value);
        list.appendChild(item);
    });
}
