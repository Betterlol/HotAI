// ========== 模型管理页 ==========
let currentPage=1,pageSize=10,currentSortBy='id',currentSortOrder='desc',allVendors=[],allVendorsMap={},syncMethod='',syncLang='',deleteCallback=null,prefillModels=[];

document.addEventListener('DOMContentLoaded',async()=>{
  renderSidebar('model-management');
  await AIProviders.load();
  await loadVendors();
  await loadModels();
});

function showToast(msg,type='info'){
  const c=document.getElementById('toastContainer'),d=document.createElement('div');
  d.className='toast toast-'+type;
  const icons={success:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',error:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',info:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',warning:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'};
  d.innerHTML=(icons[type]||'')+`<div style="flex:1;">${msg}</div>`;
  c.appendChild(d);
  setTimeout(()=>d.remove(),3000);
}

async function loadVendors(){
  const r=await apiRequest('/vendors/');
  if(r.success&&r.data){
    // GetAllVendors 返回 pageInfo 对象: {items:[], total:N, ...}
    const items=Array.isArray(r.data)?r.data:(r.data.items||[]);
    allVendors=items.sort((a,b)=>a.name.localeCompare(b.name));
    allVendorsMap={};
    allVendors.forEach(v=>{allVendorsMap[v.id]=v;});
    const s=document.getElementById('filterVendor');
    s.innerHTML='<option value="">全部供应商</option>';
    allVendors.forEach(v=>{
      const o=document.createElement('option');
      o.value=v.id;o.textContent=v.name;
      s.appendChild(o);
    });
  }
}

async function loadModels(){
  const k=document.getElementById('searchKeyword').value.trim();
  const v=document.getElementById('filterVendor').value;
  let r;
  const orderParams='&order_by='+currentSortBy+'&order_dir='+currentSortOrder;
  if(k||v){
    const p=new URLSearchParams({keyword:k,vendor:v,p:currentPage,page_size:pageSize,order_by:currentSortBy,order_dir:currentSortOrder});
    r=await apiRequest('/models/search?'+p);
  }else{
    r=await apiRequest('/models/?p='+currentPage+'&page_size='+pageSize+orderParams);
  }
  if(r.success){
    // GetAllModelsMeta 返回 {items:[], total:N, page:N, page_size:N, vendor_counts:{}}
    const items=r.data&&r.data.items?r.data.items:(Array.isArray(r.data)?r.data:[]);
    const total=r.data&&r.data.total!=null?r.data.total:0;
    renderModelTable(items);
    renderPagination(total);
    document.getElementById('totalModels').textContent=total;
  }else{
    showToast(r.message||'加载失败','error');
  }
}

function renderModelTable(ms){
  const tb=document.getElementById('modelTableBody');
  if(!ms||ms.length===0){
    tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:60px 20px;"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><div>暂无模型数据</div></div></td></tr>';
    return;
  }
  const rm=['精确','前缀','包含','后缀'];
  const rc=['name-rule-exact','name-rule-prefix','name-rule-contains','name-rule-suffix'];
  tb.innerHTML=ms.map(m=>{
    const vd=allVendorsMap[m.vendor_id];
    const vn=vd?vd.name:'-';
    const lg=vd?AIProviders.getProviderIconUrl(vd.name):'';
    // endpoints 是 []string 数组（端点类型枚举），直接遍历
    let ep=[];
    if(m.endpoints){
      try{
        const parsed=JSON.parse(m.endpoints);
        ep=Array.isArray(parsed)?parsed:Object.keys(parsed);
      }catch(ex){}
    }
    const ct=m.created_time?new Date(m.created_time*1000).toLocaleString('zh-CN'):'-';
    const logoHtml=lg?
      `<img src="${lg}" class="provider-logo" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';">
       <span class="provider-logo-placeholder" style="display:none;">${vn.substring(0,2).toUpperCase()}</span>`:
      `<span class="provider-logo-placeholder">${vn.substring(0,2).toUpperCase()}</span>`;
    return `<tr>
      <td style="text-align:center;">${logoHtml}</td>
      <td style="text-align:center;"><strong>${m.model_name}</strong></td>
      <td style="text-align:center;"><span class="name-rule-badge ${rc[m.name_rule||0]}">${rm[m.name_rule||0]}</span></td>
      <td style="text-align:center;">${vn}</td>
      <td style="text-align:center;">${m.sync_official?'<span class="badge badge-green">是</span>':'<span class="badge badge-gray">否</span>'}</td>
      <td style="text-align:center;">${m.status?'<span class="badge badge-green">启用</span>':'<span class="badge badge-red">禁用</span>'}</td>
      <td style="text-align:center;">${ep.map(e=>`<span class="endpoint-tag">${e}</span>`).join('')}</td>
      <td style="text-align:center;font-size:12px;">${ct}</td>
      <td style="text-align:center;">
        <button class="btn btn-sm ${m.status?'btn-warning':'btn-success'}" onclick="toggleModelStatus(${m.id},${m.status?0:1})">${m.status?'禁用':'启用'}</button>
        <button class="btn btn-sm btn-secondary" onclick="editModel(${m.id})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteModel(${m.id})">删除</button>
      </td>
    </tr>`;
  }).join('');
}

function renderPagination(t){
  const tp=Math.ceil(t/pageSize),c=document.getElementById('paginationPages');
  if(tp<=1){c.innerHTML='';return;}
  let h=`<button class="page-btn" ${currentPage===1?'disabled':''} onclick="goToPage(${currentPage-1})">上一页</button>`;
  for(let i=1;i<=tp;i++){
    if(i===1||i===tp||(i>=currentPage-2&&i<=currentPage+2)){
      h+=`<button class="page-btn ${i===currentPage?'active':''}" onclick="goToPage(${i})">${i}</button>`;
    }else if(i===currentPage-3||i===currentPage+3){
      h+=`<span style="padding:0 8px;">...</span>`;
    }
  }
  h+=`<button class="page-btn" ${currentPage===tp?'disabled':''} onclick="goToPage(${currentPage+1})">下一页</button>`;
  c.innerHTML=h;
}

function goToPage(p){currentPage=p;loadModels();}
function doSearch(){currentPage=1;loadModels();}

function resetFilters(){
  document.getElementById('searchKeyword').value='';
  document.getElementById('filterVendor').value='';
  currentPage=1;currentSortBy='id';currentSortOrder='desc';
  updateSortIndicators();loadModels();
}

function setSortBy(f){
  if(currentSortBy===f){currentSortOrder=currentSortOrder==='asc'?'desc':'asc';}
  else{currentSortBy=f;currentSortOrder='desc';}
  updateSortIndicators();loadModels();
}

function toggleSortOrder(){
  currentSortOrder=currentSortOrder==='asc'?'desc':'asc';
  const i=document.getElementById('sortIcon');
  i.innerHTML=currentSortOrder==='desc'?
    '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>':
    '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/>';
  loadModels();
}

function updateSortIndicators(){
  document.querySelectorAll('.sort-indicator').forEach(e=>{
    e.textContent='↕';e.parentElement.classList.remove('sort-active');
  });
  const i=document.getElementById('sort_'+currentSortBy);
  if(i){i.textContent=currentSortOrder==='asc'?'↑':'↓';i.parentElement.classList.add('sort-active');}
}

function openModelModal(){
  document.getElementById('modelModalTitle').textContent='新建模型';
  document.getElementById('modelId').value='';
  document.getElementById('modelName').value='';
  document.getElementById('modelNameRule').value='0';
  document.getElementById('vendorSearchInput').value='';
  document.getElementById('modelVendorId').value='';
  document.getElementById('modelIcon').value='';
  document.getElementById('modelDescription').value='';
  document.getElementById('modelTags').value='';
  document.getElementById('modelSyncOfficial').checked=true;
  document.getElementById('modelStatus').checked=true;
  document.getElementById('endpointEditor').innerHTML='';
  document.getElementById('modelModal').classList.remove('hidden');
  validateModelForm();
}

function closeModelModal(){document.getElementById('modelModal').classList.add('hidden');}

async function editModel(id){
  const r=await apiRequest('/models/'+id);
  if(!r.success){showToast(r.message||'获取失败','error');return;}
  const m=r.data;
  document.getElementById('modelModalTitle').textContent='编辑模型';
  document.getElementById('modelId').value=m.id;
  document.getElementById('modelName').value=m.model_name||'';
  document.getElementById('modelNameRule').value=m.name_rule||0;
  if(m.vendor_id&&allVendorsMap[m.vendor_id]){
    document.getElementById('vendorSearchInput').value=allVendorsMap[m.vendor_id].name;
    document.getElementById('modelVendorId').value=m.vendor_id;
  }
  document.getElementById('modelIcon').value=m.icon||'';
  document.getElementById('modelDescription').value=m.description||'';
  document.getElementById('modelTags').value=m.tags||'';
  document.getElementById('modelSyncOfficial').checked=m.sync_official!==0;
  document.getElementById('modelStatus').checked=m.status!==0;
  const e=document.getElementById('endpointEditor');
  e.innerHTML='';
  if(m.endpoints){
    try{
      const ep=JSON.parse(m.endpoints);
      if(typeof ep==='object'&&!Array.isArray(ep)){
        Object.entries(ep).forEach(([k,v])=>addEndpointRow(k,v));
      }
    }catch(ex){}
  }
  document.getElementById('modelModal').classList.remove('hidden');
  validateModelForm();
}

async function saveModel(){
  const id=document.getElementById('modelId').value;
  const n=document.getElementById('modelName').value.trim();
  if(!n){showToast('模型名称不能为空','warning');return;}
  const ep={};
  document.querySelectorAll('#endpointEditor .kv-row').forEach(row=>{
    const k=row.querySelector('input:nth-child(1)').value.trim();
    const v=row.querySelector('input:nth-child(3)').value.trim();
    if(k&&v)ep[k]=v;
  });
  const d={
    model_name:n,
    name_rule:parseInt(document.getElementById('modelNameRule').value),
    vendor_id:parseInt(document.getElementById('modelVendorId').value)||0,
    icon:document.getElementById('modelIcon').value.trim(),
    description:document.getElementById('modelDescription').value.trim(),
    tags:document.getElementById('modelTags').value.trim(),
    endpoints:JSON.stringify(ep),
    sync_official:document.getElementById('modelSyncOfficial').checked?1:0,
    status:document.getElementById('modelStatus').checked?1:0
  };
  if(id)d.id=parseInt(id);
  const r=await apiRequest('/models/',{method:id?'PUT':'POST',body:JSON.stringify(d)});
  if(r.success){showToast(id?'更新成功':'创建成功','success');closeModelModal();loadModels();}
  else{showToast(r.message||'操作失败','error');}
}

function validateModelForm(){
  const n=document.getElementById('modelName').value.trim();
  document.getElementById('modelSaveBtn').disabled=!n;
}

function addEndpointRow(k,v){
  k=k||'';v=v||'';
  const e=document.getElementById('endpointEditor');
  const row=document.createElement('div');
  row.className='kv-row';
  row.innerHTML=`<input type="text" placeholder="端点名称（如 chat）" value="${k}"><span class="kv-sep">→</span><input type="text" placeholder="展示URL" value="${v}"><button class="kv-del-btn" onclick="this.parentElement.remove()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  e.appendChild(row);
}

function showVendorDropdown(){filterVendorsDropdown('');}
function hideVendorDropdown(){document.getElementById('vendorDropdown').style.display='none';}

function filterVendorsDropdown(q){
  const d=document.getElementById('vendorDropdown');
  const f=allVendors.filter(v=>v.name.toLowerCase().includes(q.toLowerCase()));
  if(f.length===0){
    d.innerHTML='<div style="padding:12px;text-align:center;color:var(--c-text-secondary);font-size:13px;">无匹配供应商</div>';
  }else{
    d.innerHTML=f.map(v=>`<div class="vendor-dropdown-item" onclick="selectVendor(${v.id},'${v.name}')">${v.name}</div>`).join('');
  }
  d.style.display='block';
}

function selectVendor(id,n){
  document.getElementById('vendorSearchInput').value=n;
  document.getElementById('modelVendorId').value=id;
  hideVendorDropdown();
}

async function toggleModelStatus(id,s){
  const r=await apiRequest('/models/?status_only=true',{method:'PUT',body:JSON.stringify({id,status:s})});
  if(r.success){showToast('状态更新成功','success');loadModels();}
  else{showToast(r.message||'更新失败','error');}
}

function confirmDeleteModel(id){
  document.getElementById('confirmMessage').textContent='确定要删除这个模型吗？此操作不可撤销。';
  deleteCallback=()=>deleteModel(id);
  document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal(){
  document.getElementById('confirmModal').classList.add('hidden');
  deleteCallback=null;
}

async function doConfirmDelete(){
  if(deleteCallback){await deleteCallback();deleteCallback=null;}
  closeConfirmModal();
}

async function deleteModel(id){
  const r=await apiRequest('/models/'+id,{method:'DELETE'});
  if(r.success){showToast('删除成功','success');loadModels();}
  else{showToast(r.message||'删除失败','error');}
}

function openSyncWizard(){
  syncMethod='';syncLang='';
  document.getElementById('syncStep1').style.display='block';
  document.getElementById('syncStep2').style.display='none';
  document.getElementById('syncPrevBtn').style.display='none';
  document.getElementById('syncNextBtn').textContent='下一步';
  document.getElementById('syncStepLabel').textContent='第 1 步 / 共 2 步';
  document.getElementById('syncDot1').style.background='var(--c-primary)';
  document.getElementById('syncDot1').style.color='#fff';
  document.getElementById('syncDot2').style.background='var(--c-border)';
  document.getElementById('syncDot2').style.color='var(--c-text-secondary)';
  document.getElementById('syncStep2Label').style.color='var(--c-text-secondary)';
  document.querySelectorAll('.sync-card').forEach(e=>e.classList.remove('selected'));
  document.querySelectorAll('.sync-lang-btn').forEach(e=>e.classList.remove('selected'));
  document.getElementById('syncWizardModal').classList.remove('hidden');
}

function closeSyncWizard(){document.getElementById('syncWizardModal').classList.add('hidden');}

function selectSyncMethod(m){
  syncMethod=m;
  document.querySelectorAll('.sync-card').forEach(e=>e.classList.remove('selected'));
  document.getElementById('syncCard'+(m==='official'?'Official':'Config')).classList.add('selected');
}

function selectSyncLang(l){
  syncLang=l;
  document.querySelectorAll('.sync-lang-btn').forEach(e=>e.classList.remove('selected'));
  document.querySelector('[data-lang="'+l+'"]').classList.add('selected');
}

function syncPrevStep(){
  document.getElementById('syncStep1').style.display='block';
  document.getElementById('syncStep2').style.display='none';
  document.getElementById('syncPrevBtn').style.display='none';
  document.getElementById('syncNextBtn').textContent='下一步';
  document.getElementById('syncStepLabel').textContent='第 1 步 / 共 2 步';
  document.getElementById('syncDot1').style.background='var(--c-primary)';
  document.getElementById('syncDot2').style.background='var(--c-border)';
  document.getElementById('syncStep2Label').style.color='var(--c-text-secondary)';
}

async function syncNextStep(){
  if(document.getElementById('syncStep1').style.display!=='none'){
    if(!syncMethod){showToast('请选择同步方式','warning');return;}
    document.getElementById('syncStep1').style.display='none';
    document.getElementById('syncStep2').style.display='block';
    document.getElementById('syncPrevBtn').style.display='inline-block';
    document.getElementById('syncNextBtn').textContent='执行同步';
    document.getElementById('syncStepLabel').textContent='第 2 步 / 共 2 步';
    document.getElementById('syncDot2').style.background='var(--c-primary)';
    document.getElementById('syncDot2').style.color='#fff';
    document.getElementById('syncStep2Label').style.color='var(--c-primary)';
  }else{
    if(!syncLang){showToast('请选择语言版本','warning');return;}
    const r=await apiRequest('/models/sync_upstream',{method:'POST',body:JSON.stringify({method:syncMethod,lang:syncLang})});
    if(r.success){showToast('同步成功','success');closeSyncWizard();loadModels();}
    else{showToast(r.message||'同步失败','error');}
  }
}

async function openPrefillGroupModal(){
  const r=await apiRequest('/prefill_group/?type=model');
  const l=document.getElementById('prefillGroupList');
  // GetAllPrefillGroups 直接返回数组
  const groups=r.success&&r.data?r.data:[];
  if(Array.isArray(groups)&&groups.length>0){
    l.innerHTML=groups.map(g=>`
      <div class="prefill-group-item">
        <div>
          <div style="font-weight:600;margin-bottom:4px;">
            ${g.name}
            <span class="badge badge-blue" style="margin-left:6px;font-size:11px;">${g.type||'model'}</span>
          </div>
          <div style="font-size:12px;color:var(--c-text-secondary);">${g.description||'无描述'}</div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="deletePrefillGroup(${g.id})">删除</button>
      </div>
    `).join('');
  }else{
    l.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><div>暂无预填组</div></div>';
  }
  document.getElementById('prefillGroupModal').classList.remove('hidden');
}

function closePrefillGroupModal(){document.getElementById('prefillGroupModal').classList.add('hidden');}

function openNewPrefillGroup(){
  document.getElementById('prefillGroupName').value='';
  document.getElementById('prefillGroupType').value='model';
  document.getElementById('prefillGroupDesc').value='';
  document.getElementById('prefillModelInput').value='';
  document.getElementById('prefillModelTagsWrap').querySelectorAll('.model-tag').forEach(e=>e.remove());
  prefillModels=[];
  document.getElementById('newPrefillGroupModal').classList.remove('hidden');
}

function closeNewPrefillGroup(){document.getElementById('newPrefillGroupModal').classList.add('hidden');}

function onPrefillModelKeyDown(e){
  if(e.key==='Enter'){
    e.preventDefault();
    const inp=e.target,val=inp.value.trim();
    if(val&&!prefillModels.includes(val)){
      prefillModels.push(val);
      const t=document.createElement('span');
      t.className='model-tag';
      t.innerHTML=val+' <span class="tag-del" onclick="removePrefillModel(\''+val+'\')">×</span>';
      inp.parentElement.insertBefore(t,inp);
      inp.value='';
    }
  }
}

function removePrefillModel(n){
  prefillModels=prefillModels.filter(m=>m!==n);
  document.getElementById('prefillModelTagsWrap').querySelectorAll('.model-tag').forEach(e=>{
    if(e.textContent.trim().startsWith(n))e.remove();
  });
}

async function savePrefillGroup(){
  const n=document.getElementById('prefillGroupName').value.trim();
  if(!n){showToast('组名称不能为空','warning');return;}
  const d={
    name:n,
    type:document.getElementById('prefillGroupType').value,
    description:document.getElementById('prefillGroupDesc').value.trim(),
    items:JSON.stringify(prefillModels)
  };
  const r=await apiRequest('/prefill_group/',{method:'POST',body:JSON.stringify(d)});
  if(r.success){showToast('创建成功','success');closeNewPrefillGroup();openPrefillGroupModal();}
  else{showToast(r.message||'创建失败','error');}
}

async function deletePrefillGroup(id){
  if(!confirm('确定要删除这个预填组吗？'))return;
  const r=await apiRequest('/prefill_group/'+id,{method:'DELETE'});
  if(r.success){showToast('删除成功','success');openPrefillGroupModal();}
  else{showToast(r.message||'删除失败','error');}
}

function openVendorModal(){
  document.getElementById('vendorName').value='';
  document.getElementById('vendorStatus').checked=true;
  document.getElementById('vendorModal').classList.remove('hidden');
}

function closeVendorModal(){document.getElementById('vendorModal').classList.add('hidden');}

async function saveVendor(){
  const n=document.getElementById('vendorName').value.trim();
  if(!n){showToast('供应商名称不能为空','warning');return;}
  const d={name:n,status:document.getElementById('vendorStatus').checked?1:0};
  const r=await apiRequest('/vendors/',{method:'POST',body:JSON.stringify(d)});
  if(r.success){showToast('创建成功','success');closeVendorModal();await loadVendors();}
  else{showToast(r.message||'创建失败','error');}
}