function toggleSide(){const sidebar=document.getElementById('sidebar');const overlay=document.getElementById('overlay');if(!sidebar)return;const isOpen=!sidebar.classList.contains('open');sidebar.classList.toggle('open',isOpen);overlay?.classList.toggle('open',isOpen);sidebar.setAttribute('aria-hidden',String(!isOpen));}
document.addEventListener('DOMContentLoaded',()=>{const sidebar=document.getElementById('sidebar');const overlay=document.getElementById('overlay');if(sidebar){sidebar.classList.remove('open');sidebar.setAttribute('aria-hidden','true')}if(overlay){overlay.classList.remove('open')}
})
function openResearchModal(){document.getElementById('researchModal')?.classList.remove('hidden')}
function closeResearchModal(){document.getElementById('researchModal')?.classList.add('hidden')}
function openInvestorRequest(){document.getElementById('investorModal')?.classList.remove('hidden')}
function closeInvestorRequest(){document.getElementById('investorModal')?.classList.add('hidden')}
async function openOpportunity(title){
 const t=document.getElementById('oppTitle');if(t)t.textContent=title;
 const modal=document.getElementById('opportunityModal');if(!modal)return;
 const row=[...document.querySelectorAll('#opportunityRows tr')].find(item=>(item.querySelector('.tech-title')?.textContent||'').trim()===String(title).trim());
 modal.dataset.technologyId=row?.dataset.opportunityId||'';
 window.__currentOpportunityId=modal.dataset.technologyId||null;
 modal.classList.remove('hidden');
 const subscribed=window.RMRDCWorkflow?await window.RMRDCWorkflow.activeSubscription():false;
 modal.querySelectorAll('.intel-pane').forEach(p=>{p.classList.toggle('rti-locked',!subscribed);p.querySelectorAll('.data-list,.intel-grid,.sub-chart,.real-ng-map,.researcher-mini,.choice-grid,.readiness-row,.badge-row').forEach(x=>x.classList.toggle('rti-sensitive-content',!subscribed))});
 let gate=modal.querySelector('.rti-modal-gate');
 if(!subscribed){if(!gate){gate=document.createElement('div');gate.className='rti-modal-gate';gate.innerHTML='<div><strong>🔒 Full technology intelligence is subscriber-only</strong><p>Subscribe to unlock validated technical specifications, production economics, market intelligence, IP/legal information, supply-chain evidence and researcher engagement details.</p></div><a class="primary-btn" href="subscribe.html">Subscribe for Full Access</a>';modal.querySelector('.modal-body')?.prepend(gate)}}else if(gate)gate.remove();
 const interest=modal.querySelector('.hero-actions .primary-btn');
 const demoRow=[...document.querySelectorAll('#opportunityRows tr[data-demo-free="true"]')].find(r=>r.innerText.toLowerCase().includes(title.toLowerCase()));
 const allowFreeDemo=!!demoRow;
 if(interest){interest.textContent='Express Interest';interest.onclick=async()=>{if(!subscribed&&!allowFreeDemo){window.RMRDCWorkflow?.showSubscribe();return}let oid=null;if(window.db){const r=await db.from('technology_opportunities').select('id').eq('title',title).maybeSingle();oid=r.data?.id||null;}rtiOpenEOI(title,oid,allowFreeDemo)}}
 const actions=modal.querySelectorAll('.decision-actions button');actions.forEach(btn=>{if(btn.textContent.includes('Start Engagement'))btn.onclick=async()=>{if(!subscribed){window.RMRDCWorkflow?.showSubscribe();return}try{let oid=null;if(window.db){const r=await db.from('technology_opportunities').select('id').eq('title',title).maybeSingle();oid=r.data?.id||null;}await window.RTIEngagement.submitInvestorRequest('engagement',oid,'Start RMRDC-facilitated engagement for '+title,['researcher','fabricator/engineer','RMRDC representative']);window.RTIEngagement.toast('Engagement request submitted to RMRDC.')}catch(e){alert(e.message)}}});
}
function closeOpportunity(){document.getElementById('opportunityModal')?.classList.add('hidden')}
function filterTechs(){const q=(document.getElementById('techSearch')?.value||'').toLowerCase();const status=document.getElementById('techStatus')?.value||'';document.querySelectorAll('#techRows tr').forEach(r=>{const okText=r.innerText.toLowerCase().includes(q),okStatus=!status||r.dataset.status===status;r.style.display=okText&&okStatus?'':'none'})}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeResearchModal();closeInvestorRequest();closeOpportunity()}})
document.addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))e.target.classList.add('hidden')})
document.querySelectorAll('.filter-chip').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active')}))
document.addEventListener('click',e=>{const b=e.target.closest('.intel-tabs button');if(!b)return;const tab=b.dataset.tab;b.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');const root=b.closest('.opportunity-modal');root.querySelectorAll('.intel-pane').forEach(x=>x.classList.remove('active'));root.querySelector('#intel-'+tab)?.classList.add('active')});
window.rtiOpenEOI = rtiOpenEOI;
