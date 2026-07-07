// 兑换码管理逻辑（管理员）
let rdPage = 1;
const rdPageSize = 20;
let rdTotal = 0;

function showToast(msg, type='info') {
    const c=document.getElementById('toastContainer');if(!c)return;
    const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);
}
function escHtml(s){return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');}
function quotaToDisplay(q){if(!q)return '$0.0000';return '$'+(q/500000).toFixed(4);}
function formatTime(ts){if(!ts||ts<=0)return '-';return new Date(ts*1000).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}

async function loadRd() {
    const search = document.getElementById('rdSearch').value.trim();
    const tbody = document.getElementById('rdTableBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-overlay"><div class="loading-spinner"></div></div></td></tr>';

    let res;
    if (search) {
        res = await API.searchRedemptions(search);
    } else {
        res = await API.getRedemptions(rdPage, rdPageSize);
    }

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><span>${res.message||'加载失败'}</span></div></td></tr>`;
        return;
    }

    const items = res.data?.items || [];
    rdTotal = res.data?.total || items.length;
    document.getElementById('rdPageInfo').textContent = `共 ${rdTotal} 条`;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="table-empty"><span>暂无兑换码</span></div></td></tr>';
        renderPagination(); return;
    }

    tbody.innerHTML = items.map(rd => {
        const statusBadge = rd.status === 1
            ? '<span class="badge badge-green">可用</span>'
            : '<span class="badge badge-red">已使用</span>';
        return `<tr>
            <td><strong>${escHtml(rd.name||'-')}</strong></td>
            <td class="td-mono" style="font-size:12px;">${escHtml(rd.key||'-')}
                <button class="btn btn-secondary btn-sm" style="margin-left:4px;" onclick="navigator.clipboard.writeText('${escHtml(rd.key||'')}').then(()=>showToast('已复制','success'))">复制</button>
            </td>
            <td style="font-weight:600;">${quotaToDisplay(rd.quota)}</td>
            <td>${statusBadge}</td>
            <td>${escHtml(rd.used_username||'-')}</td>
            <td class="td-mono">${formatTime(rd.used_time)}</td>
            <td>
                <div class="td-actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteRd(${rd.id},'${escHtml(rd.name||'')}')">删除</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    renderPagination();
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
