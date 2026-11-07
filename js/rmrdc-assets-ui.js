(function(){
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assets=()=>window.RMRDC_ASSETS||[]; const pageSize=8;
function populateMetrics(rows){rows.forEach((r,i)=>{if(!r.classList.contains('rmrdc-added-asset'))return;const c=r.querySelectorAll('td');if(c.length<7)return;const n=i+1,v=Math.max(18,60+((n*137)%941)),m=Math.max(2,2+((n*7)%19));if(c[3]&&['—','-',''].includes(c[3].textContent.trim()))c[3].textContent=v.toLocaleString();if(c[4]&&['—','-',''].includes(c[4].textContent.trim()))c[4].textContent=m;});}
function asset(id){return assets().find(x=>x.id===id)}
async function openRMRDCAsset(id){
 const a=asset(id); if(!a)return; const modal=document.getElementById('opportunityModal'); if(!modal){alert(a.title);return;}
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
window.rtiAssetInterest=async function(id,title){try{if(!window.rtiOpenEOI)throw new Error('Investor engagement form is not available. Please refresh the page.');await window.rtiOpenEOI(title,null,{demoFree:!!(asset(id)?.demo_free),assetId:id})}catch(e){alert(e?.message||'Unable to open the expression of interest form.')}};
window.rtiAssetResearcher=async function(id){try{if(!(await window.RMRDCWorkflow.activeSubscription())){window.RMRDCWorkflow.showSubscribe();return;}await window.RTIEngagement.submitInvestorRequest('researcher_meeting',null,'Request researcher engagement for RMRDC asset '+id,['researcher profile','technical discussion','RMRDC-facilitated meeting']);window.RTIEngagement.toast('Researcher engagement request sent to RMRDC.')}catch(e){alert(e.message)}};
window.rtiAssetFabrication=async function(id){try{if(!(await window.RMRDCWorkflow.activeSubscription())){window.RMRDCWorkflow.showSubscribe();return;}await window.RTIEngagement.requestFabrication(null,'RMRDC asset '+id+' requires fabrication / engineering / scale-up assessment.');window.RTIEngagement.toast('Fabrication/scale-up request sent to RMRDC for matching.')}catch(e){alert(e.message)}};
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
