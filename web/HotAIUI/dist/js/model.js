const modelData = [
    {
        id: 1,
        name: 'deepseek-v4-flash',
        supplier: 'DeepSeek',
        tags: ['按量计费'],
        type: 'openai',
        rates: {input: 1.0000, output: 1.0000, cache: 0.0200},
        multipliers: {model: 0.5, completion: 1, group: 1}
    },
    {
        id: 2,
        name: 'deepseek-v4-pro',
        supplier: 'DeepSeek',
        tags: ['按量计费'],
        type: 'openai',
        rates: {input: 3.0000, output: 6.0000, cache: 0.0250},
        multipliers: {model: 1.5, completion: 2, group: 1}
    }
];

let state = {isTableView: false, showPrice: true, showRate: false, currency: 'USD', unit: 'K'};
const USD_TO_CNY = 7.2;

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
    return val;
}

function renderUI() {
    const cardGrid = document.getElementById('cardGrid');
    const tableBody = document.getElementById('tableBody');
    cardGrid.innerHTML = '';
    tableBody.innerHTML = '';

    document.getElementById('cardViewContainer').classList.toggle('hidden', state.isTableView);
    document.getElementById('tableViewContainer').classList.toggle('hidden', !state.isTableView);

    modelData.forEach(model => {
        // 卡片
        const cardHtml = `
                <div class="model-card" data-id="${model.id}">
                    <div class="card-left">
                        <div class="model-logo">${model.supplier.charAt(0)}</div>
                        <div class="model-info">
                            <div class="model-name">
                                <span class="model-text">${model.name}</span>
                                <span class="icon-copy-svg">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                </span>
                                <input type="checkbox" class="model-checkbox" style="margin-left:8px; transform: scale(1.2);">
                            </div>
                            <div class="model-prices ${state.showPrice ? '' : 'hidden'}">
                                <div class="price-item">输入价格 <span>${formatValue(model.rates.input)} / 1${state.unit} Tokens</span></div>
                                <div class="price-item">补全价格 <span>${formatValue(model.rates.output)} / 1${state.unit} Tokens</span></div>
                                <div class="price-item">缓存读取价格 <span>${formatValue(model.rates.cache)} / 1${state.unit} Tokens</span></div>
                            </div>
                            <div class="rate-info ${state.showRate ? '' : 'hidden'}">
                                <div>模型倍率: <span>${formatRate(model.multipliers.model)}</span></div>
                                <div>补全倍率: <span>${formatRate(model.multipliers.completion)}</span></div>
                                <div>分组倍率: <span>${formatRate(model.multipliers.group)}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="card-right">
                        <span class="tag-billing">${model.tags[0]}</span>
                    </div>
                </div>
            `;
        cardGrid.innerHTML += cardHtml;

        // 表格
        const priceHtml = state.showPrice ? `
                <div>输入价格 <span>${formatValue(model.rates.input)} / 1${state.unit} Tokens</span></div>
                <div>补全价格 <span>${formatValue(model.rates.output)} / 1${state.unit} Tokens</span></div>
                <div>缓存读取价格 <span>${formatValue(model.rates.cache)} / 1${state.unit} Tokens</span></div>
            ` : '<div style="color: #9CA3AF;">-</div>';

        const rateHtml = state.showRate ? `
                <div>模型倍率: <span>${formatRate(model.multipliers.model)}</span></div>
                <div>补全倍率: <span>${formatRate(model.multipliers.completion)}</span></div>
                <div>分组倍率: <span>${formatRate(model.multipliers.group)}</span></div>
            ` : '<div style="color: #9CA3AF;">-</div>';

        const tableHtml = `
                <tr class="table-data-row" data-id="${model.id}">
                    <td class="checkbox-cell"><input type="checkbox" class="model-checkbox"></td>
                    <td><div class="model-name-cell"><div class="icon">${model.supplier.charAt(0)}</div><span>${model.name}</span></div></td>
                    <td><div class="supplier-cell"><div class="icon">${model.supplier.charAt(0)}</div> ${model.supplier}</div></td>
                    <td>-</td>
                    <td>-</td>
                    <td><div class="tag-cell"><span class="tag-billing">${model.tags[0]}</span></div></td>
                    <td><div class="tag-cell"><span class="tag-endpoint">${model.type}</span></div></td>
                    <td><div class="stacked-col">${rateHtml}</div></td>
                    <td><div class="stacked-col">${priceHtml}</div></td>
                </tr>
            `;
        tableBody.innerHTML += tableHtml;
    });

    // 事件绑定
    document.querySelectorAll('.model-checkbox').forEach(cb => {
        cb.addEventListener('change', function () {
            const row = this.closest('.model-card') || this.closest('tr');
            if (row) row.classList.toggle('selected-row', this.checked);
        });
    });
    document.getElementById('selectAllCheckbox').addEventListener('change', function () {
        const isChecked = this.checked;
        document.querySelectorAll('.model-checkbox').forEach(cb => {
            cb.checked = isChecked;
            const row = cb.closest('.model-card') || cb.closest('tr');
            if (row) row.classList.toggle('selected-row', isChecked);
        });
    });
}

// 按钮绑定
document.getElementById('copySelectedBtn').addEventListener('click', function () {
    const checkedBoxes = document.querySelectorAll('.model-checkbox:checked');
    if (checkedBoxes.length === 0) return alert('请先勾选需要复制的模型！');
    const selectedModels = [];
    checkedBoxes.forEach(cb => {
        let name = '';
        const card = cb.closest('.model-card');
        const tableRow = cb.closest('tr.table-data-row');
        if (card) name = card.querySelector('.model-text').innerText;
        if (tableRow) name = tableRow.querySelector('.model-name-cell span').innerText;
        if (name) selectedModels.push(name);
    });
    alert(`成功复制以下模型数据到剪贴板：\n\n${selectedModels.join('\n')}`);
});

document.getElementById('switchPrice').addEventListener('click', function () {
    this.classList.toggle('active');
    state.showPrice = this.classList.contains('active');
    renderUI();
});

document.getElementById('currencyBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    document.getElementById('currencyDropdown').classList.toggle('show');
});
document.querySelectorAll('#currencyDropdown li').forEach(item => {
    item.addEventListener('click', function () {
        state.currency = this.getAttribute('data-value');
        document.querySelector('#currencyBtn span').innerText = state.currency;
        document.getElementById('currencyDropdown').classList.remove('show');
        renderUI();
    });
});
document.addEventListener('click', function (e) {
    if (!e.target.closest('.currency-selector')) document.getElementById('currencyDropdown').classList.remove('show');
});

document.getElementById('switchRate').addEventListener('click', function () {
    this.classList.toggle('active');
    state.showRate = this.classList.contains('active');
    renderUI();
});

document.getElementById('switchViewBtn').addEventListener('click', function () {
    state.isTableView = !state.isTableView;
    this.innerText = state.isTableView ? '卡片视图' : '表格视图';
    this.classList.toggle('active');
    renderUI();
});

document.getElementById('switchUnitBtn').addEventListener('click', function () {
    state.unit = state.unit === 'K' ? 'M' : 'K';
    this.innerText = state.unit;
    renderUI();
});

// 页面加载完成后初始化
renderUI();
