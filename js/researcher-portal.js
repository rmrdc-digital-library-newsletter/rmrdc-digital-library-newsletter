/* RMRDC Researcher Portal personalization — database aligned */
(function(){
  async function getProfile(){
    if(window.db){try{const identity=await window.RMRDCAuth?.getPlatformIdentity();if(identity)return {role:identity.role,full_name:identity.baseProfile?.full_name,organisation:identity.baseProfile?.organisation,location:identity.detail?.location||'',interests:identity.baseProfile?.research_areas||[],role_data:identity.detail||{},email:identity.user.email};}catch(e){console.warn('Researcher profile lookup failed',e)}}
    try{return JSON.parse(localStorage.getItem('rmrdc_platform_profile')||'null')}catch{return null}
  }
  const firstName=n=>String(n||'').trim().split(/\s+/)[0]||'Researcher';
  const initials=n=>(String(n||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('')||'R').toUpperCase();
  async function personalize(){const p=await getProfile();if(!p)return;const name=p.full_name||p.email||'Researcher';document.querySelectorAll('.profile-menu strong').forEach(el=>el.textContent=name);document.querySelectorAll('.profile-menu .avatar').forEach(el=>el.textContent=initials(name));document.querySelectorAll('.welcome-row h2').forEach(el=>el.textContent=`Welcome back, ${firstName(name)}! 👋`);document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=name);document.querySelectorAll('[data-user-organisation]').forEach(el=>el.textContent=p.organisation||'');}
  document.addEventListener('DOMContentLoaded',personalize);
})();
