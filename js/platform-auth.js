/* RMRDC platform authentication + role routing. Database-aligned with profiles + role profile tables. */
(function(){
  const ROLE_ROUTES={researcher:'researcher-portal.html',investor:'investor-portal.html',fabricator:'fabricator-portal.html',library_user:'library-user-portal.html',admin:'admin/index.html',editor:'admin/index.html'};
  const USER_ROLES=['researcher','investor','fabricator','library_user','admin','editor'];
  const safeRole=r=>USER_ROLES.includes(r)?r:'library_user';

  function getCachedProfile(){
    try {
      return JSON.parse(localStorage.getItem('rmrdc_platform_profile') || 'null');
    } catch (error) {
      console.warn('Platform profile cache is unreadable:', error);
      return null;
    }
  }

  function setCachedProfile(identity, fallbackUser){
    const user = identity?.user || fallbackUser || {};
    const baseProfile = identity?.baseProfile || {};
    const detail = identity?.detail || {};
    const role = safeRole(identity?.role || baseProfile.role || 'library_user');
    const profile = {
      id: user.id || baseProfile.id || '',
      full_name: baseProfile.full_name || detail.full_name || user.email || 'RMRDC User',
      role,
      organisation: baseProfile.organisation || detail.organisation || '',
      location: detail.location || baseProfile.location || '',
      interests: Array.isArray(baseProfile.research_areas) ? baseProfile.research_areas : (Array.isArray(detail.research_areas) ? detail.research_areas : []),
      email: user.email || baseProfile.email || '',
      research_areas: Array.isArray(baseProfile.research_areas) ? baseProfile.research_areas : (Array.isArray(detail.research_areas) ? detail.research_areas : [])
    };
    try {
      localStorage.setItem('rmrdc_platform_profile', JSON.stringify(profile));
    } catch (error) {
      console.warn('Unable to cache platform profile:', error);
    }
    return profile;
  }

  async function getSafeProfileRow(tableName, keyName, value){
    if(!window.db || !tableName || !keyName) return null;
    try {
      const {data,error}=await window.db.from(tableName).select('*').eq(keyName, value).maybeSingle();
      if(error && error.code !== 'PGRST116') {
        console.warn(`Profile lookup failed for ${tableName}:`, error);
        return null;
      }
      return data || null;
    } catch (error) {
      console.warn(`Profile lookup error for ${tableName}:`, error);
      return null;
    }
  }

  async function getRoleProfile(tableName, value){
    return await getSafeProfileRow(tableName, 'user_id', value) || await getSafeProfileRow(tableName, 'profile_id', value);
  }

  async function getPlatformIdentity(){
    if(!window.db){
      throw new Error('Authentication service is not configured.');
    }

    const {data:{user},error}=await window.db.auth.getUser();
    if(error)throw error;
    if(!user){
      try { localStorage.removeItem('rmrdc_platform_profile'); } catch (e) { console.warn('Unable to clear stale platform profile cache:', e); }
      return null;
    }

    const legacyProfile = await getSafeProfileRow('profiles', 'id', user.id);
    const platformProfile = await getSafeProfileRow('platform_profiles', 'user_id', user.id);
    const rawMetadataRole = user.user_metadata?.role;
    const metadataRole = safeRole(rawMetadataRole);
    if(!legacyProfile && !platformProfile && !['researcher','investor','fabricator','library_user'].includes(rawMetadataRole)) throw new Error('Your account profile is missing or inaccessible. Please contact RMRDC support.');
    const baseProfile = {...(legacyProfile || {}), ...(platformProfile || {})};
    if(!legacyProfile && !platformProfile) {
      baseProfile.id = user.id;
      baseProfile.full_name = user.user_metadata?.full_name || user.email;
      baseProfile.role = metadataRole;
      baseProfile.organisation = user.user_metadata?.organisation || '';
      baseProfile.research_areas = user.user_metadata?.interests || [];
    }
    if(platformProfile?.role) {
      baseProfile.id = user.id;
      baseProfile.full_name = platformProfile.full_name || baseProfile.full_name;
      baseProfile.organisation = platformProfile.organisation || baseProfile.organisation;
      baseProfile.research_areas = Array.isArray(platformProfile.interest_data) ? platformProfile.interest_data : baseProfile.research_areas;
    }
    if(!platformProfile && legacyProfile?.role === 'viewer') throw new Error('Your account setup is incomplete. Please sign in again or contact RMRDC support.');
    let role = safeRole(platformProfile?.role || legacyProfile?.role || metadataRole);

    let detail=null;
    const roleTables={researcher:['researcher_profiles','user_id'],investor:['investor_profiles','profile_id'],library_user:['library_user_profiles','user_id'],fabricator:['fabricator_profiles','profile_id']};
    if(roleTables[role]) detail = await getRoleProfile(roleTables[role][0], user.id);

    const identity={user,baseProfile,detail,role};
    setCachedProfile(identity, user);
    return identity;
  }

  async function ensureProfileFromMetadata(user){
    if(!user||!window.db)return null;
    const meta=user.user_metadata||{};
    let existing=null;
    try {
      const {data}=await window.db.from('profiles').select('id,role,full_name').eq('id',user.id).maybeSingle();
      existing=data;
    } catch (error) {
      console.warn('Existing profile lookup failed:', error);
    }

    if(existing?.role && existing.role !== 'viewer') return existing;
    const requestedRole=['researcher','investor','fabricator','library_user'].includes(meta.role)?meta.role:'library_user';
    const role=existing?.role && existing.role!=='viewer' ? safeRole(existing.role) : requestedRole;
    const profile={id:user.id,full_name:existing?.full_name||meta.full_name||user.email,email:user.email,role,organisation:meta.organisation||'',phone:meta.phone||'',research_areas:Array.isArray(meta.interests)?meta.interests:[],email_notifications:meta.email_alerts!==false,whatsapp_alerts:meta.whatsapp_alerts===true};

    try {
      const {data:up,error}=await window.db.from('profiles').upsert(profile,{onConflict:'id'}).select('*').single();
      if(error) throw error;
      const rd=meta.role_data||{};
      const roleUpserts = {
        researcher:()=>window.db.from('researcher_profiles').upsert({user_id:user.id,institution:rd.institution||'',position:rd.position||'',research_areas:rd.researchAreas||'',orcid:rd.orcid||'',bio:rd.bio||''},{onConflict:'user_id'}),
        investor:()=>window.db.from('investor_profiles').upsert({profile_id:user.id,organisation_type:rd.orgType||'',position:rd.position||'',location:meta.location||'',investment_stage:rd.investmentStage?[rd.investmentStage]:[],engagement_preferences:rd.engagementModels?rd.engagementModels.split(',').map(x=>x.trim()).filter(Boolean):[]},{onConflict:'profile_id'}),
        library_user:()=>window.db.from('library_user_profiles').upsert({profile_id:user.id,user_category:rd.userCategory||'',location:meta.location||'',subject_areas:rd.subjectAreas?rd.subjectAreas.split(',').map(x=>x.trim()).filter(Boolean):[],preferred_cas_topics:Array.isArray(meta.interests)?meta.interests:[],alert_frequency:rd.alertFrequency||'weekly'},{onConflict:'profile_id'}),
        fabricator:()=>window.db.from('fabricator_profiles').upsert({profile_id:user.id,location:meta.location||'',fabrication_specialisation:rd.fabricationSpecialisation?rd.fabricationSpecialisation.split(',').map(x=>x.trim()).filter(Boolean):[],equipment_categories:rd.equipmentCategories?rd.equipmentCategories.split(',').map(x=>x.trim()).filter(Boolean):[],manufacturing_capacity:rd.capacity||'',geographic_coverage:rd.coverage?rd.coverage.split(',').map(x=>x.trim()).filter(Boolean):[],certifications:rd.certifications?rd.certifications.split(',').map(x=>x.trim()).filter(Boolean):[],services_offered:rd.servicesOffered?rd.servicesOffered.split(',').map(x=>x.trim()).filter(Boolean):[]},{onConflict:'profile_id'})
      };
      if(roleUpserts[role]) {
        const result=await roleUpserts[role]();
        if(result.error) throw result.error;
      }
      if(Array.isArray(meta.interests) && meta.interests.length){
        const {data:categories,error:categoriesError}=await window.db.from('interest_categories').select('id,name').eq('is_active',true);
        if(categoriesError)throw categoriesError;
        const selected=(categories||[]).filter(c=>meta.interests.includes(c.name));
        const custom=meta.interests.filter(name=>!(categories||[]).some(c=>c.name===name));
        const {error:oldInterestsError}=await window.db.from('user_interests').delete().eq('profile_id',user.id);
        if(oldInterestsError)throw oldInterestsError;
        if(selected.length){const {error:interestError}=await window.db.from('user_interests').insert(selected.map(c=>({profile_id:user.id,interest_category_id:c.id})));if(interestError)throw interestError;}
        const {error:oldCustomError}=await window.db.from('custom_interests').delete().eq('profile_id',user.id);
        if(oldCustomError)throw oldCustomError;
        if(custom.length){const {error:customError}=await window.db.from('custom_interests').insert(custom.map(interest=>({profile_id:user.id,interest})));if(customError)throw customError;}
      }
      return up;
    } catch (error) {
      console.error('Profile metadata sync failed:', error);
      throw new Error('We could not complete your account profile. Please try signing in again or contact RMRDC support.');
    }
  }

  async function routeAuthenticatedUser(){
    const identity=await getPlatformIdentity();
    if(!identity){window.location.href='subscribe.html';return null;}
    const cached = setCachedProfile(identity, identity.user);
    localStorage.setItem('rmrdc_platform_profile', JSON.stringify(cached));
    return identity;
  }

  async function routeAfterLogin(){
    if(!window.db || !window.db.auth || !window.db.auth.getUser){
      window.location.href='subscribe.html';
      return null;
    }
    const {data:{user},error}=await window.db.auth.getUser();
    if(error)throw error;
    if(!user){
      try { localStorage.removeItem('rmrdc_platform_profile'); } catch (e) { console.warn('Unable to clear stale platform profile cache:', e); }
      window.location.href='subscribe.html';
      return null;
    }
    await ensureProfileFromMetadata(user);
    const identity=await routeAuthenticatedUser();
    const requested= new URLSearchParams(window.location.search).get('next');
    const allowedPaths=Object.values(ROLE_ROUTES);
    const requestedPath=requested?.split(/[?#]/)[0];
    const safeRequested=requested && allowedPaths.includes(requestedPath) && requestedPath===ROLE_ROUTES[identity?.role] && !/[\\]/.test(requested) ? requested : '';
    if(safeRequested){window.location.href=safeRequested;return identity;}
    if(identity && ROLE_ROUTES[identity.role]) {
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      if(['login.html','subscribe.html','index.html'].includes(currentPath)) {
        window.location.href=ROLE_ROUTES[identity.role];
      }
    }
    return identity;
  }

  async function guardPage(allowedRoles){
    const identity=await getPlatformIdentity();
    const currentPath=window.location.pathname.split('/').pop()||'index.html';
    if(!identity){window.location.href=`login.html?next=${encodeURIComponent(currentPath+window.location.search+window.location.hash)}`;return null;}
    if(currentPath==='library-user-portal.html'&&['admin','editor'].includes(identity.role))return identity;
    if(allowedRoles&&!allowedRoles.includes(identity.role)){window.location.href=ROLE_ROUTES[identity.role]||'user-dashboard.html';return null;}
    return identity;
  }
  window.RMRDCAuth={ROLE_ROUTES,getPlatformIdentity,ensureProfileFromMetadata,routeAuthenticatedUser,guardPage,routeAfterLogin};
})();
