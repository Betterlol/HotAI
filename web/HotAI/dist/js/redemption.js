// 兑换码管理逻辑（管理员）
let rdPage = 1;
const rdPageSize = 20;
let rdTotal = 0;
let rdSortField = 'id';  // id, name, created_time
let rdSortOrder = 'desc'; // asc, desc

function showToast(msg, type='info') {
    const c=document.getElementById('toastContainer');if(!c)return;
    const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);
}
function escHtml(s){return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');}
function quotaToDisplay(q){if(!q)return '$0.0000';return '$'+(q/500000).toFixed(4);}
function formatTime(ts){if(!ts||ts<=0)return '-';return new Date(ts*1000).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function formatExpireTime(ts){if(!ts||ts<=0)return '永不过期';const now=Math.floor(Date.now()/1000);const isExpired=ts<now;const timeStr=formatTime(ts);return isExpired?`<span style="color:#dc2626;">${timeStr}</span>`:timeStr;}

async function loadRd() {
    const search = document.getElementById('rdSearch').value.trim();
    const tbody = document.getElementById('rdTableBody');
    tbody.innerHTML = '<tr><td colspan="9"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

    let res;
    if (search) {
        res = await API.searchRedemptions(search);
    } else {
        res = await API.getRedemptions(rdPage, rdPageSize);
    }

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="table-empty"><span>${res.message||'加载失败'}</span></div></td></tr>`;
        return;
    }

    let items = res.data?.items || [];
    rdTotal = res.data?.total || items.length;
    document.getElementById('rdPageInfo').textContent = `共 ${rdTotal} 条`;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="table-empty"><span>暂无兑换码</span></div></td></tr>';
        renderPagination(); return;
    }

    // 前端排序
    items = sortRedemptions(items);

    tbody.innerHTML = items.map(rd => {
        const statusBadge = rd.status === 1
            ? '<span class="badge badge-green">可用</span>'
            : (rd.status === 2 ? '<span class="badge badge-gray">禁用</span>' : '<span class="badge badge-red">已使用</span>');
        return `<tr data-key="${escHtml(rd.key||'')}">
            <td style="text-align:center;"><input type="checkbox" class="rd-checkbox" data-id="${rd.id}" onchange="toggleSelectRd(${rd.id})" ${selectedRds.has(rd.id)?'checked':''}></td>
            <td style="text-align:center;">${rd.id}</td>
            <td style="text-align:center;"><strong>${escHtml(rd.name||'-')}</strong></td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center;font-weight:600;">${quotaToDisplay(rd.quota)}</td>
            <td style="text-align:center;" class="td-mono">${formatTime(rd.created_time)}</td>
            <td style="text-align:center;" class="td-mono">${formatExpireTime(rd.expired_time)}</td>
            <td style="text-align:center;">${rd.used_user_id > 0 ? rd.used_user_id : '-'}</td>
            <td style="text-align:center;">
                <div class="td-actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteRd(${rd.id},'${escHtml(rd.name||'')}')">删除</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    renderPagination();
    updateCopyBtnState();
}

function renderPagination() {
    const pages = document.getElementById('rdPages');
    if (!pages) return;
    const total = Math.ceil(rdTotal / rdPageSize);
    let html = `<button class="page-btn" onclick="changeRdPage(${rdPage-1})" ${rdPage<=1?'disabled':''}>‹</button>`;
    for (let i = Math.max(1, rdPage-2); i <= Math.min(total, rdPage+2); i++) {
        html += `<button class="page-btn ${i===rdPage?'active':''}" onclick="changeRdPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="changeRdPage(${rdPage+1})" ${rdPage>=total?'disabled':''}>›</button>`;
    pages.innerHTML = html;
}

function changeRdPage(p) { if(p<1)return; rdPage=p; loadRd(); }

function openCreateRdModal() {
    document.getElementById('rdId').value='';
    document.getElementById('rdName').value='';
    document.getElementById('rdQuota').value='500000';
    document.getElementById('rdCount').value='1';
    document.getElementById('rdModal').classList.remove('hidden');
}

function closeRdModal() { document.getElementById('rdModal').classList.add('hidden'); }

async function saveRd() {
    const name = document.getElementById('rdName').value.trim();
    const quota = parseInt(document.getElementById('rdQuota').value)||500000;
    const count = parseInt(document.getElementById('rdCount').value)||1;
    if (!name) { showToast('请输入名称','warning'); return; }

    const res = await API.createRedemptions({ name, quota, count });
    if (res.success) {
        showToast(`成功生成 ${count} 个兑换码`, 'success');
        closeRdModal();
        loadRd();
    } else {
        showToast(res.message||'生成失败','error');
    }
}

async function deleteRd(id, name) {
    if (!confirm(`确定删除兑换码「${name}」？`)) return;
    const res = await API.deleteRedemption(id);
    if (res.success) { showToast('已删除','success'); loadRd(); }
    else showToast(res.message||'删除失败','error');
}

async function deleteInvalidRd() {
    if (!confirm('确定清理所有已使用的兑换码？此操作不可撤销。')) return;
    const res = await API.deleteInvalidRedemptions();
    if (res.success) { showToast('清理完成','success'); loadRd(); }
    else showToast(res.message||'清理失败','error');
}

// ========== 批量操作 ==========
let selectedRds = new Set();

function toggleSelectRd(id) {
    if (selectedRds.has(id)) selectedRds.delete(id);
    else selectedRds.add(id);
    updateRdBatchBar();
}

function toggleSelectAllRds(checked) {
    document.querySelectorAll('.rd-checkbox').forEach(cb => {
        const id = parseInt(cb.dataset.id);
        if (checked) { selectedRds.add(id); cb.checked = true; }
        else { selectedRds.delete(id); cb.checked = false; }
    });
    updateRdBatchBar();
}

function updateRdBatchBar() {
    const bar = document.getElementById('rdBatchBar');
    const count = document.getElementById('rdSelectedCount');
    if (bar) bar.style.display = selectedRds.size > 0 ? 'flex' : 'none';
    if (count) count.textContent = selectedRds.size;
}

async function batchDeleteRds() {
    if (!selectedRds.size) return;
    if (!confirm(`确定删除选中的 ${selectedRds.size} 个兑换码？`)) return;
    await Promise.all([...selectedRds].map(id => API.deleteRedemption(id)));
    showToast(`已删除 ${selectedRds.size} 个兑换码`, 'success');
    selectedRds.clear(); updateRdBatchBar(); loadRd();
}

// ========== 排序功能 ==========
function sortRedemptions(items) {
    return items.sort((a, b) => {
        let valA, valB;
        if (rdSortField === 'id') {
            valA = a.id; valB = b.id;
        } else if (rdSortField === 'name') {
            valA = (a.name || '').toLowerCase(); valB = (b.name || '').toLowerCase();
        } else if (rdSortField === 'created_time') {
            valA = a.created_time || 0; valB = b.created_time || 0;
        }
        if (rdSortOrder === 'asc') {
            return valA > valB ? 1 : valA < valB ? -1 : 0;
        } else {
            return valA < valB ? 1 : valA > valB ? -1 : 0;
        }
    });
}

function toggleRdSortOrder() {
    rdSortOrder = rdSortOrder === 'asc' ? 'desc' : 'asc';
    const icon = document.getElementById('rdSortIcon');
    if (icon) {
        if (rdSortOrder === 'asc') {
            icon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
        } else {
            icon.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>';
        }
    }
    loadRd();
}

function resetRdFilters() {
    rdSortField = 'id';
    rdSortOrder = 'desc';
    document.getElementById('rdSortField').value = 'id';
    const icon = document.getElementById('rdSortIcon');
    if (icon) icon.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>';
    document.getElementById('rdSearch').value = '';
    rdPage = 1;
    loadRd();
}

// ========== 复制功能 ==========
function updateCopyBtnState() {
    const btn = document.getElementById('copySelectedBtn');
    if (btn) btn.disabled = selectedRds.size === 0;
}

async function copySelectedRds() {
    if (!selectedRds.size) {
        showToast('请至少选择一条兑换码', 'warning');
        return;
    }
    const codes = [];
    document.querySelectorAll('tr[data-key]').forEach(row => {
        const checkbox = row.querySelector('.rd-checkbox');
        if (checkbox && selectedRds.has(parseInt(checkbox.dataset.id))) {
            const key = row.getAttribute('data-key');
            if (key) codes.push(key);
        }
    });
    if (codes.length === 0) {
        showToast('未找到兑换码', 'error');
        return;
    }
    try {
        await navigator.clipboard.writeText(codes.join('\n'));
        showToast(`已复制 ${codes.length} 个兑换码`, 'success');
    } catch (err) {
        showToast('复制失败', 'error');
    }
}

// ========== 导出兑换码 ==========
async function exportRds() {
    showToast('正在导出...', 'info');
    const res = await API.getRedemptions(1, 10000);
    if (!res.success || !res.data) { showToast('导出失败', 'error'); return; }

    const items = res.data?.items || [];
    const header = ['ID', '名称', '状态', '额度', '创建时间', '过期时间', '兑换人ID', '兑换码'];
    const rows = items.map(rd => [
        rd.id || '',
        rd.name || '',
        rd.status === 1 ? '可用' : (rd.status === 2 ? '禁用' : '已使用'),
        (rd.quota / 500000).toFixed(4),
        rd.created_time ? formatTime(rd.created_time) : '',
        rd.expired_time ? (rd.expired_time > 0 ? formatTime(rd.expired_time) : '永不过期') : '',
        rd.used_user_id > 0 ? rd.used_user_id : '',
        rd.key || '',
    ]);

    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redemptions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${items.length} 条兑换码`, 'success');
}

let searchTimer;
document.addEventListener('DOMContentLoaded', async () => {
    const res = await API.getUserInfo();
    if (!res.success||!res.data||(res.data.role||0)<10) {
        showToast('无权限访问','error');
        setTimeout(()=>window.location.href='console.html',1500);
        return;
    }
    renderSidebar('redemption');
    loadRd();

    const si = document.getElementById('rdSearch');
    if(si) si.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{rdPage=1;loadRd();},400);});
});
