(function(){
  const form=document.getElementById('subscriptionForm');
  const message=document.getElementById('subscriptionMessage');
  const loginForm=document.getElementById('subscriberLoginForm');
  const loginMessage=document.getElementById('loginMessage');
  const pickerButton=document.getElementById('interestPickerButton');
  const menu=document.getElementById('interestMenu');
  const selectedBox=document.getElementById('selectedInterests');
  const otherField=document.getElementById('otherInterestField');
  const roleFields=document.getElementById('roleFields');
  const interestLabel=document.getElementById('interestLabel');
  const interests=[
    {group:'Agriculture & Raw Materials',items:['Agriculture & Agro-processing','Cassava','Rice','Maize','Shea','Sesame','Soybean','Groundnut','Palm Products','Food & Beverage']},
    {group:'Industrial & Manufacturing',items:['Chemicals & Petrochemicals','Construction Materials','Ceramics','Metals','Mining & Minerals','Manufacturing Technologies','Industrial Equipment','Packaging','Polymers & Plastics','Textiles & Leather']},
    {group:'Science, Technology & Sustainability',items:['Pharmaceuticals','Biotechnology','Digital Technologies','Renewable Energy','Bioenergy','Environmental Technologies','Water Technologies','Waste-to-Value']},
    {group:'Other',items:['Other']}
  ];
  let selected=new Set();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const notify=(el,text,error=false)=>{if(!el)return;el.textContent=text;el.classList.remove('hidden');el.classList.toggle('error',error)};
  function renderInterests(filter=''){
    const q=filter.trim().toLowerCase();
    const searchHtml='<div class="interest-search-wrap"><input id="interestSearch" type="search" placeholder="Search interests…" autocomplete="off" value="'+esc(filter)+'"></div>';
    menu.innerHTML=searchHtml+interests.map(({group,items})=>{
      const visible=items.filter(x=>!q||x.toLowerCase().includes(q)||group.toLowerCase().includes(q));
      if(!visible.length)return '';
      return `<div class="interest-group"><div class="interest-group-title">${esc(group)}</div><div class="interest-option-grid">${visible.map(x=>`<label class="interest-option"><input type="checkbox" value="${esc(x)}" ${selected.has(x)?'checked':''}/><span>${esc(x)}</span></label>`).join('')}</div></div>`;
    }).join('') || '<div class="interest-empty">No matching interest found.</div>';
    menu.querySelectorAll('input[type=checkbox]').forEach(i=>i.addEventListener('change',()=>{
      i.checked?selected.add(i.value):selected.delete(i.value);
      otherField.classList.toggle('hidden',!selected.has('Other'));
      renderSelected();
    }));
  }
  function renderSelected(){
    selectedBox.innerHTML=[...selected].map(x=>`<span>${esc(x)} <button type="button" data-remove="${esc(x)}" aria-label="Remove ${esc(x)}">×</button></span>`).join('');
    selectedBox.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{
      selected.delete(b.dataset.remove); renderInterests(menu.querySelector('#interestSearch')?.value||''); renderSelected(); otherField.classList.toggle('hidden',!selected.has('Other'));
    }));
    pickerButton.querySelector('span').textContent=selected.size?`${selected.size} selected`:'Select areas of interest';
  }
  pickerButton?.addEventListener('click',()=>{menu.classList.toggle('hidden');if(!menu.classList.contains('hidden')){document.getElementById('interestSearch')?.focus();}});
  document.addEventListener('click',e=>{if(!e.target.closest('#interestPicker'))menu?.classList.add('hidden')});
  menu?.addEventListener('input',e=>{if(e.target.id==='interestSearch')renderInterests(e.target.value)});
  renderInterests();

  const fieldTemplates={
    researcher:`<div class="field"><label for="institution">Institution <b>*</b></label><input id="institution" required/></div><div class="field"><label for="position">Position <b>*</b></label><input id="position" required/></div><div class="field"><label for="researchStage">Research Stage</label><select id="researchStage"><option value="">Select stage</option><option>Early research</option><option>Prototype development</option><option>Pilot / demonstration</option><option>Technology transfer</option><option>Commercialisation</option></select></div><div class="field"><label for="orcid">ORCID</label><input id="orcid" placeholder="0000-0000-0000-0000"/></div><div class="field span-two"><label for="bio">Professional Biography</label><textarea id="bio" rows="3" placeholder="Briefly describe your expertise and research focus."></textarea></div>`,
    investor:`<div class="field"><label for="orgType">Organisation Type <b>*</b></label><select id="orgType" required><option value="">Select type</option><option>Corporate Investor</option><option>Venture Capital</option><option>Private Equity</option><option>Development Finance Institution</option><option>Industrial Investor</option><option>Family Office</option><option>Other</option></select></div><div class="field"><label for="position">Position / Title <b>*</b></label><input id="position" required/></div><div class="field"><label for="preferredTrl">Preferred TRL Range</label><select id="preferredTrl"><option value="">Any TRL</option><option>TRL 1–3</option><option>TRL 4–5</option><option>TRL 6–7</option><option>TRL 8–9</option></select></div><div class="field"><label for="investmentStage">Investment Stage</label><select id="investmentStage"><option value="">Any stage</option><option>Early-stage</option><option>Growth</option><option>Scale-up</option><option>Commercial expansion</option><option>Multiple stages</option></select></div><div class="field"><label for="investmentSize">Typical Investment Size</label><input id="investmentSize" placeholder="e.g. ₦10m–₦100m"/></div><div class="field"><label for="engagementModels">Preferred Engagement</label><input id="engagementModels" placeholder="JV, licensing, equity, etc."/></div>`,
    library_user:`<div class="field"><label for="userCategory">User Category <b>*</b></label><select id="userCategory" required><option value="">Select category</option><option>Researcher</option><option>Student</option><option>Policy User</option><option>Information Professional</option><option>Industry / Organisation</option><option>Other</option></select></div><div class="field"><label for="alertFrequency">Alert Frequency</label><select id="alertFrequency"><option>Immediate</option><option>Daily digest</option><option>Weekly digest</option><option>Monthly digest</option></select></div><div class="field span-two"><label for="subjectAreas">Subject Areas</label><input id="subjectAreas" placeholder="Areas where you need research intelligence"/></div>`,
    fabricator:`<div class="field"><label for="fabricationSpecialisation">Fabrication Specialisation <b>*</b></label><input id="fabricationSpecialisation" required placeholder="e.g. processing equipment, automation"/></div><div class="field"><label for="equipmentCategories">Equipment / Machinery</label><input id="equipmentCategories" placeholder="e.g. dryers, reactors, mills"/></div><div class="field"><label for="capacity">Manufacturing Capacity</label><input id="capacity"/></div><div class="field"><label for="coverage">Geographic Coverage</label><input id="coverage" placeholder="States / regions"/></div><div class="field"><label for="certifications">Certifications</label><input id="certifications"/></div><div class="field span-two"><label for="servicesOffered">Services Offered</label><input id="servicesOffered" placeholder="Fabrication, installation, maintenance, scale-up support"/></div>`
  };
  document.querySelectorAll('input[name="userRole"]').forEach(r=>r.addEventListener('change',()=>{roleFields.innerHTML=fieldTemplates[r.value]||'';interestLabel.textContent=r.value==='investor'?'Investment Interests':r.value==='researcher'?'Research Interests':'Areas of Interest';}));
  function roleData(role){const ids={researcher:['institution','position','researchStage','orcid','bio'],investor:['orgType','position','preferredTrl','investmentStage','investmentSize','engagementModels'],library_user:['userCategory','alertFrequency','subjectAreas'],fabricator:['fabricationSpecialisation','equipmentCategories','capacity','coverage','certifications','servicesOffered']}[role]||[];return Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value?.trim()||'']));}
  async function saveProfile(profile,user){
    if(!window.db||!user)throw new Error('Authentication service is not configured.');
    const {data:existing,error:readError}=await window.db.from('profiles').select('id,role').eq('id',user.id).maybeSingle();
    if(readError)throw readError;
    if(existing && ['admin','editor'].includes(existing.role))return;
    const {error}=await window.db.from('profiles').upsert({id:user.id,full_name:profile.full_name,role:profile.role,email:user.email,organisation:profile.organisation,phone:profile.phone,research_areas:profile.interests,email_notifications:profile.email_alerts,whatsapp_alerts:profile.whatsapp_alerts},{onConflict:'id'});
    if(error)throw error;
    const rd=profile.role_data||{};
    let result;
    if(profile.role==='researcher')result=await window.db.from('researcher_profiles').upsert({profile_id:user.id,institution:rd.institution,position:rd.position,research_stage:rd.researchStage,orcid:rd.orcid,biography:rd.bio,location:profile.location,raw_materials_of_interest:[]},{onConflict:'profile_id'});
    if(profile.role==='investor')result=await window.db.from('investor_profiles').upsert({profile_id:user.id,organisation_type:rd.orgType,position:rd.position,location:profile.location,preferred_trl_min:rd.preferredTrl?Number(rd.preferredTrl.match(/\d+/)?.[0]||0)||null:null,preferred_trl_max:rd.preferredTrl?Number(rd.preferredTrl.match(/\d+$/)?.[0]||0)||null:null,investment_stage:rd.investmentStage?[rd.investmentStage]:[],engagement_preferences:rd.engagementModels?rd.engagementModels.split(',').map(x=>x.trim()).filter(Boolean):[]},{onConflict:'profile_id'});
    if(profile.role==='library_user')result=await window.db.from('library_user_profiles').upsert({profile_id:user.id,user_category:rd.userCategory,location:profile.location,subject_areas:rd.subjectAreas?rd.subjectAreas.split(',').map(x=>x.trim()).filter(Boolean):[],preferred_cas_topics:profile.interests,alert_frequency:rd.alertFrequency||'weekly'},{onConflict:'profile_id'});
    if(profile.role==='fabricator')result=await window.db.from('fabricator_profiles').upsert({profile_id:user.id,location:profile.location,fabrication_specialisation:rd.fabricationSpecialisation?rd.fabricationSpecialisation.split(',').map(x=>x.trim()).filter(Boolean):[],equipment_categories:rd.equipmentCategories?rd.equipmentCategories.split(',').map(x=>x.trim()).filter(Boolean):[],manufacturing_capacity:rd.capacity,geographic_coverage:rd.coverage?rd.coverage.split(',').map(x=>x.trim()).filter(Boolean):[],certifications:rd.certifications?rd.certifications.split(',').map(x=>x.trim()).filter(Boolean):[],services_offered:rd.servicesOffered?rd.servicesOffered.split(',').map(x=>x.trim()).filter(Boolean):[]},{onConflict:'profile_id'});
    if(result?.error)throw result.error;
    const {data:cats,error:catError}=await window.db.from('interest_categories').select('id,name').eq('is_active',true);
    if(catError)throw catError;
    const {error:deleteError}=await window.db.from('user_interests').delete().eq('profile_id',user.id);if(deleteError)throw deleteError;
    const rows=(cats||[]).filter(c=>profile.interests.includes(c.name)).map(c=>({profile_id:user.id,interest_category_id:c.id}));
    if(rows.length){const {error:interestError}=await window.db.from('user_interests').insert(rows);if(interestError)throw interestError;}
    const custom=profile.interests.filter(i=>!(cats||[]).some(c=>c.name===i));
    const {error:customDeleteError}=await window.db.from('custom_interests').delete().eq('profile_id',user.id);if(customDeleteError)throw customDeleteError;
    if(custom.length){const {error:customError}=await window.db.from('custom_interests').insert(custom.map(interest=>({profile_id:user.id,interest})));if(customError)throw customError;}
  }
  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!form.checkValidity()){form.reportValidity();return;}
    const role=document.querySelector('input[name="userRole"]:checked')?.value;
    if(!role)return notify(message,'Select a platform role.',true);
    if(!selected.size)return notify(message,'Select at least one area of interest.',true);
    const password=document.getElementById('subPassword').value,confirm=document.getElementById('subPasswordConfirm').value;
    if(password!==confirm)return notify(message,'Passwords do not match.',true);
    if(password.length<8)return notify(message,'Password must contain at least 8 characters.',true);
    const custom=document.getElementById('customInterests')?.value.trim();
    if(selected.has('Other')&&!custom)return notify(message,'Please specify your other interest.',true);
    const interests=[...selected].filter(x=>x!=='Other');if(custom)interests.push(custom);
    const profile={role,full_name:document.getElementById('subName').value.trim(),email:document.getElementById('subEmail').value.trim().toLowerCase(),phone:document.getElementById('subPhone').value.trim(),organisation:document.getElementById('subOrganisation').value.trim(),location:document.getElementById('subLocation').value.trim(),interests,email_alerts:document.getElementById('subEmailAlerts').checked,whatsapp_alerts:document.getElementById('subWhatsappAlerts').checked,role_data:roleData(role)};
    const button=form.querySelector('button[type=submit]');
    try{
      if(!window.db)throw new Error('Authentication service is not configured.');
      button.disabled=true;button.textContent='Creating account…';
      const {data,error}=await window.db.auth.signUp({email:profile.email,password,options:{data:{full_name:profile.full_name,role:profile.role,organisation:profile.organisation,phone:profile.phone,location:profile.location,interests:profile.interests,email_alerts:profile.email_alerts,whatsapp_alerts:profile.whatsapp_alerts,role_data:profile.role_data}}});
      if(error)throw error;
      if(!data?.user)throw new Error('Account could not be created.');
      if(Array.isArray(data.user.identities)&&data.user.identities.length===0)throw new Error('An account with this email already exists. Please sign in instead.');
      localStorage.setItem('rmrdc_platform_profile',JSON.stringify(profile));
      if(data.session)await saveProfile(profile,data.user);
      if(data.session){notify(message,'Account created successfully. Opening your workspace…');setTimeout(()=>window.RMRDCAuth?.routeAfterLogin(),400);}
      else notify(message,'Account created. Please confirm your email, then sign in to open your correct workspace.');
    }catch(err){console.error(err);notify(message,err.message||'Registration could not be completed.',true)}finally{button.disabled=false;button.textContent='Create RMRDC Intelligence Account';}
  });
  loginForm?.addEventListener('submit',async e=>{e.preventDefault();try{const email=document.getElementById('loginEmail').value.trim().toLowerCase(),password=document.getElementById('loginPassword').value;if(!window.db)throw new Error('Authentication service is not configured.');const {data,error}=await window.db.auth.signInWithPassword({email,password});if(error)throw error;if(!data?.session)throw new Error('Please confirm your email address before signing in.');notify(loginMessage,'Sign in successful. Opening your personalised workspace.');await window.RMRDCAuth?.routeAfterLogin();}catch(err){notify(loginMessage,err.message||'Sign in failed.',true)}});
  document.querySelectorAll('.auth-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.auth-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.getElementById('registerPanel').classList.toggle('hidden',btn.dataset.authTab!=='register');document.getElementById('loginPanel').classList.toggle('hidden',btn.dataset.authTab!=='login');}));
})();
