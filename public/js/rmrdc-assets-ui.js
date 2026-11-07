(function(){
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assets=()=>window.RMRDC_ASSETS||[]; const pageSize=8;
function populateMetrics(rows){
  rows.forEach(row=>{
    if(!row.classList.contains('rmrdc-added-asset'))return;
    const cells=row.querySelectorAll('td');
    if(cells.length<7)return;
    if(cells[1]?.textContent.trim()==='RMRDC')cells[1].textContent='Not assessed';
    const action=cells[cells.length>=8?7:6]?.querySelector('button');
    if(action)action.textContent='View details';
  });
}
function asset(id){return assets().find(x=>x.id===id)}
function showResearcherAsset(a){
  let backdrop=document.getElementById('researcherAssetDetail');
  if(!backdrop){
    backdrop=document.createElement('div');backdrop.id='researcherAssetDetail';backdrop.className='asset-detail-backdrop';
    backdrop.innerHTML='<section class="asset-detail-card" role="dialog" aria-modal="true" aria-labelledby="assetDetailTitle"><button type="button" class="asset-detail-close" aria-label="Close technology details">×</button><div class="asset-detail-content"></div></section>';
    document.body.append(backdrop);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop||e.target.closest('.asset-detail-close'))backdrop.remove()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')backdrop.remove()});
  }
  backdrop.querySelector('.asset-detail-content').innerHTML=`<p class="asset-detail-kicker">RMRDC technology portfolio</p><h2 id="assetDetailTitle">${esc(a.title)}</h2><p class="asset-detail-summary">${esc(a.description||a.objective||'Technology profile')}</p><div class="asset-detail-grid"><section><h3>Overview</h3><p>${esc(a.objective||a.description||'Details are being prepared by RMRDC.')}</p></section><section><h3>Reference</h3><dl><dt>Asset type</dt><dd>${esc(a.type||'Technology')}</dd><dt>Patent or reference</dt><dd>${esc(a.patent_no||'Not provided')}</dd></dl></section>${a.raw_materials?`<section><h3>Raw materials</h3><p>${esc(a.raw_materials)}</p></section>`:''}${a.applications?`<section><h3>Applications</h3><p>${esc(a.applications)}</p></section>`:''}${a.relevance?`<section><h3>Potential impact</h3><p>${esc(a.relevance)}</p></section>`:''}</div><div class="asset-detail-footer"><button class="primary-btn" type="button" data-asset-interest="${esc(a.id)}">Express interest</button><button class="outline-btn asset-detail-close" type="button">Close</button></div>`;
  backdrop.querySelector('[data-asset-interest]').onclick=()=>window.rtiAssetInterest?.(a.id,a.title);
  backdrop.querySelector('.asset-detail-close').focus();
}
async function openRMRDCAsset(id){
 const a=asset(id); if(!a)return; const modal=document.getElementById('opportunityModal'); if(!modal){showResearcherAsset(a);return;}
 document.getElementById('oppTitle').textContent=a.title; document.getElementById('oppHeroTitle').textContent=a.title;
 const body=modal.querySelector('.modal-body'); const old=body.querySelector('.rmrdc-asset-detail'); if(old)old.remove();
 let active=false; try{active=await window.RMRDCWorkflow?.activeSubscription()}catch(e){}
 const publicDesc=a.description||a.objective||'RMRDC technology asset';
 const detail=document.createElement('div'); detail.className='rmrdc-asset-detail';
 const locked=()=>`<div class="rti-request-box"><span class="rti-badge">🔒 Subscriber access</span></div>`;
 detail.innerHTML=`<div class="metric-row"><div class="metric-box"><small>Asset Type</small><strong>${esc(a.type)}</strong></div><div class="metric-box"><small>Patent / Reference</small><strong>${esc(a.patent_no||'RMRDC TIC')}</strong></div><div class="metric-box"><small>RMRDC Status</small><strong>Institutional Asset</strong></div></div>
 <div class="intel-card"><h4>Free discovery</h4><p>${esc(publicDesc)}</p>${a.objective?`<div class="data-list"><span>Project objective<strong>${esc(a.objective)}</strong></span></div>`:''}${a.relevance?`<div class="data-list"><span>Socio-economic relevance<strong>${esc(a.relevance)}</strong></span></div>`:''}</div>
 ${active?`<div class="intel-card"><h4>Subscriber technology intelligence</h4><div class="data-list">${a.raw_materials?`<span>Raw materials<strong>${esc(a.raw_materials)}</strong></span>`:''}${a.applications?`<span>Industrial applications<strong>${esc(a.applications)}</strong></span>`:''}<span>Commercialisation intelligence<strong>Available for subscriber review</strong></span><span>IP / ownership intelligence<strong>Available for subscriber review</strong></span><span>Scale-up / deployment intelligence<strong>Available for subscriber review</strong></span></div></div>`:locked()}
 <div class="rti-actions asset-engagement-actions"><button class="primary-btn" onclick="rtiAssetInterest('${esc(a.id)}','${esc(a.title).replace(/'/g,"\\'")}')">Express Interest</button></div>`;
 body.prepend(detail); modal.classList.remove('hidden');
}
window.openRMRDCAsset=openRMRDCAsset;
window.rtiAssetInterest=async function(id,title){try{if(!window.rtiOpenEOI)throw new Error('Investor engagement form is not available. Please refresh the page.');await window.rtiOpenEOI(title,null,{demoFree:!!(asset(id)?.demo_free),assetId:id})}catch(e){console.error('Could not open investor engagement form:',e);alert('Unable to open the expression of interest form. Please try again later.')}};
window.rtiAssetResearcher=async function(id){try{if(!(await window.RMRDCWorkflow.activeSubscription())){window.RMRDCWorkflow.showSubscribe();return;}await window.RTIEngagement.submitInvestorRequest('researcher_meeting',null,'Request researcher engagement for RMRDC asset '+id,['researcher profile','technical discussion','RMRDC-facilitated meeting']);window.RTIEngagement.toast('Researcher engagement request sent to RMRDC.')}catch(e){console.error('Could not request researcher engagement:',e);alert('Could not send your researcher engagement request. Please try again later.')}};
window.rtiAssetFabrication=async function(id){try{if(!(await window.RMRDCWorkflow.activeSubscription())){window.RMRDCWorkflow.showSubscribe();return;}await window.RTIEngagement.requestFabrication(null,'RMRDC asset '+id+' requires fabrication / engineering / scale-up assessment.');window.RTIEngagement.toast('Fabrication/scale-up request sent to RMRDC for matching.')}catch(e){console.error('Could not request fabrication support:',e);alert('Could not send your fabrication request. Please try again later.')}};
function paginate(rows,root){let page=1;const render=()=>{const visible=rows.filter(r=>!r.dataset.hidden),pages=Math.max(1,Math.ceil(visible.length/pageSize));page=Math.min(page,pages);rows.forEach(r=>r.style.display='none');visible.slice((page-1)*pageSize,page*pageSize).forEach(r=>r.style.display='');root.querySelector('[data-page]').textContent='Page '+page+' of '+pages;root.querySelector('[data-prev]').disabled=page<=1;root.querySelector('[data-next]').disabled=page>=pages};root.querySelector('[data-prev]').onclick=()=>{page--;render()};root.querySelector('[data-next]').onclick=()=>{page++;render()};render();return render}
function researcher(){const rows=[...document.querySelectorAll('#techRows tr')],root=document.getElementById('researcherAssetPagination');if(!root)return;populateMetrics(rows);const render=paginate(rows,root);window.filterTechs=function(){const q=(document.getElementById('techSearch')?.value||'').toLowerCase(),st=document.getElementById('techStatus')?.value||'',ty=document.getElementById('techType')?.value||'';rows.forEach(r=>{const text=(r.innerText+' '+(r.dataset.search||'')).toLowerCase(),added=r.classList.contains('rmrdc-added-asset'),type=added?(r.dataset.asset||'').startsWith('patent-')?'Patent':'TIC Product':'Existing';r.dataset.hidden=(q&&!text.includes(q))||(st&&r.dataset.status!==st)||(ty&&type!==ty)?'1':''});render()};filterTechs()}
function investor(){const rows=[...document.querySelectorAll('#opportunityRows tr')],root=document.getElementById('investorAssetPagination');if(!root)return;populateMetrics(rows);const render=paginate(rows,root);window.filterInvestorAssets=function(){const q=(document.getElementById('investorTechSearch')?.value||'').toLowerCase(),ty=document.getElementById('investorAssetType')?.value||'';rows.forEach(r=>{const text=(r.innerText+' '+(r.dataset.search||'')).toLowerCase(),added=r.classList.contains('rmrdc-added-asset'),type=added?(r.dataset.asset||'').startsWith('patent-')?'Patent':'TIC Product':'Existing';r.dataset.hidden=(q&&!text.includes(q))||(ty&&type!==ty)?'1':''});render()};filterInvestorAssets()}
document.addEventListener('click',function(e){
 const b=e.target.closest('[data-open-title],[data-open-asset]');
 if(!b)return;
 e.preventDefault();
 if(b.dataset.openAsset){window.openRMRDCAsset?.(b.dataset.openAsset);return;}
 if(b.dataset.openTitle){window.openOpportunity?.(b.dataset.openTitle);return;}
});
document.addEventListener('DOMContentLoaded',()=>{researcher();investor()});})();
