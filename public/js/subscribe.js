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
  function applyRole(role){roleFields.innerHTML=fieldTemplates[role]||'';interestLabel.textContent=role==='investor'?'Investment Interests':role==='researcher'?'Research Interests':'Areas of Interest';}
  document.querySelectorAll('input[name="userRole"]').forEach(r=>r.addEventListener('change',()=>applyRole(r.value)));
  applyRole(document.querySelector('input[name="userRole"]:checked')?.value||'library_user');
  const params=new URLSearchParams(location.search),requestedRole=params.get('role');
  if(['library_user','researcher','investor','fabricator'].includes(requestedRole)){const radio=document.querySelector(`input[name="userRole"][value="${requestedRole}"]`);if(radio){radio.checked=true;applyRole(requestedRole)}}
  function roleData(role){const ids={researcher:['institution','position','researchStage','orcid','bio'],investor:['orgType','position','preferredTrl','investmentStage','investmentSize','engagementModels'],library_user:['userCategory','alertFrequency','subjectAreas'],fabricator:['fabricationSpecialisation','equipmentCategories','capacity','coverage','certifications','servicesOffered']}[role]||[];return Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value?.trim()||'']));}
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
      const emailRedirectTo=new URL('subscribe.html?tab=login',window.location.href).href;
      const {data,error}=await window.db.auth.signUp({email:profile.email,password,options:{emailRedirectTo,data:{full_name:profile.full_name,role:profile.role,organisation:profile.organisation,phone:profile.phone,location:profile.location,interests:profile.interests,email_alerts:profile.email_alerts,whatsapp_alerts:profile.whatsapp_alerts,role_data:profile.role_data}}});
      if(error)throw error;
      if(!data?.user)throw new Error('Account could not be created.');
      if(Array.isArray(data.user.identities)&&data.user.identities.length===0)throw new Error('An account with this email already exists. Please sign in instead.');
      if(data.session){notify(message,'Account created successfully. Opening your workspace…');await window.RMRDCAuth.routeAfterLogin();}
      else notify(message,'Account created. Please confirm your email, then sign in here to open your workspace.');
    }catch(err){console.error(err);const safeMessage=err.message==='An account with this email already exists. Please sign in instead.'?err.message:'Registration could not be completed. Please try again later.';notify(message,safeMessage,true)}finally{button.disabled=false;button.textContent='Create RMRDC Intelligence Account';}
  });
  document.getElementById('resetPasswordBtn')?.addEventListener('click',async()=>{const email=document.getElementById('loginEmail')?.value.trim().toLowerCase();if(!email)return notify(loginMessage,'Enter your email address first, then choose “Forgot password”.',true);try{const redirectTo=new URL('reset-password.html',location.href).href;const {error}=await window.db.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;notify(loginMessage,'Password reset instructions have been sent to your email.')}catch(error){console.error('Password reset request failed:',error);notify(loginMessage,'Password reset could not be sent. Please try again later.',true)}});
  loginForm?.addEventListener('submit',async e=>{e.preventDefault();try{const email=document.getElementById('loginEmail').value.trim().toLowerCase();const password=document.getElementById('loginPassword').value;if(!window.db)throw new Error('Authentication service is temporarily unavailable.');try{localStorage.removeItem('rmrdc_platform_profile')}catch(error){console.warn('Unable to clear account profile cache:',error)}const {data,error}=await window.db.auth.signInWithPassword({email,password});if(error)throw error;if(!data?.session)throw new Error('Please confirm your email address before signing in.');notify(loginMessage,'Sign in successful. Opening your personalised workspace.');await window.RMRDCAuth?.routeAfterLogin();}catch(err){console.error('Sign-in failed:',err);const safeMessages=['Authentication service is temporarily unavailable.','Please confirm your email address before signing in.'];notify(loginMessage,safeMessages.includes(err.message)?err.message:'Sign in failed. Check your email and password and try again.',true)}});
  function showAuthTab(tab){document.querySelectorAll('.auth-tab').forEach(b=>{const active=b.dataset.authTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});document.getElementById('registerPanel')?.classList.toggle('hidden',tab!=='register');document.getElementById('loginPanel')?.classList.toggle('hidden',tab!=='login');params.set('tab',tab);history.replaceState(null,'',`${location.pathname}?${params.toString()}${location.hash}`)}
  document.querySelectorAll('.auth-tab').forEach(btn=>btn.addEventListener('click',()=>showAuthTab(btn.dataset.authTab)));
  showAuthTab(params.get('tab')==='login'?'login':'register');
  (async()=>{try{const {data:{session}}=await window.db?.auth.getSession()||{data:{session:null}};if(session)await window.RMRDCAuth?.routeAfterLogin()}catch(error){console.warn('Account session routing check failed:',error)}})();
})();

