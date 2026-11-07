/* RMRDC platform authentication + role routing. Database-aligned with profiles + role profile tables. */
(function(){
  const ROLE_ROUTES={researcher:'researcher-portal.html',investor:'investor-portal.html',fabricator:'fabricator-portal.html',library_user:'library-user-portal.html',admin:'admin/index.html',editor:'admin/index.html'};
  const USER_ROLES=['researcher','investor','fabricator','library_user','admin','editor'];
  const safeRole=r=>USER_ROLES.includes(r)?r:'library_user';
  const resolveRole=(platformProfile,legacyProfile,researcherProfile)=>{
    // Staff roles are stored in the legacy profiles table. Keep them authoritative
    // if an old or duplicate platform_profiles row also exists for that user.
    if(['admin','editor'].includes(legacyProfile?.role))return legacyProfile.role;
    // A role-specific profile is evidence that the account belongs to that portal.
    // Prefer it when a stale central profile contains a default or different role.
    if(researcherProfile&&['library_user','viewer',undefined].includes(platformProfile?.role||legacyProfile?.role))return 'researcher';
    if(legacyProfile?.role==='researcher')return 'researcher';
    return safeRole(platformProfile?.role||legacyProfile?.role||(researcherProfile?'researcher':''));
  };
  let routePromise = null;

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

  async function getRoleProfile(tableName, value, preferredKey = 'profile_id'){
    const alternateKey = preferredKey === 'profile_id' ? 'user_id' : 'profile_id';
    return await getSafeProfileRow(tableName, preferredKey, value) || await getSafeProfileRow(tableName, alternateKey, value);
  }

  async function getPlatformIdentity(){
    if(!window.db) throw new Error('Authentication service is not configured.');
    const {data:{user},error}=await window.db.auth.getUser();
    if(error) throw error;
    if(!user){try{localStorage.removeItem('rmrdc_platform_profile')}catch(e){console.warn('Unable to clear stale platform profile cache:',e)}return null;}

    const [platformProfile,legacyProfile,researcherProfile]=await Promise.all([
      getSafeProfileRow('platform_profiles','user_id',user.id),
      getSafeProfileRow('profiles','id',user.id),
      getRoleProfile('researcher_profiles',user.id,'profile_id')
    ]);
    if(!platformProfile&&!legacyProfile&&!researcherProfile) throw new Error('Your account profile is missing. Please use the central registration page or contact RMRDC support.');
    if(!platformProfile&&legacyProfile?.role==='viewer') throw new Error('Your account setup is incomplete. Please sign in through the central account page or contact RMRDC support.');

    const baseProfile={...(legacyProfile||{}),...(platformProfile||{})};
    baseProfile.id=user.id;
    baseProfile.full_name=platformProfile?.full_name||legacyProfile?.full_name||user.user_metadata?.full_name||user.email;
    baseProfile.organisation=platformProfile?.organisation||legacyProfile?.organisation||'';
    baseProfile.research_areas=Array.isArray(platformProfile?.interest_data)?platformProfile.interest_data:(Array.isArray(legacyProfile?.research_areas)?legacyProfile.research_areas:[]);
    const role=resolveRole(platformProfile,legacyProfile,researcherProfile);
    const roleTables={researcher:['researcher_profiles','profile_id'],investor:['investor_profiles_v2','user_id'],library_user:['library_user_profiles','user_id'],fabricator:['fabricator_profiles_v2','user_id']};
    const detail=roleTables[role]?await getRoleProfile(roleTables[role][0],user.id,roleTables[role][1]):null;
    const identity={user,baseProfile,detail,role};
    setCachedProfile(identity,user);
    return identity;
  }

  async function ensureProfileFromMetadata(user){
    if(!user||!window.db)return null;
    const platformProfile=await getSafeProfileRow('platform_profiles','user_id',user.id);
    if(platformProfile?.role)return platformProfile;
    const existing=await getSafeProfileRow('profiles','id',user.id);
    if(existing?.role&&existing.role!=='viewer')return existing;
    const requestedRole=['researcher','investor','fabricator','library_user'].includes(user.user_metadata?.role)?user.user_metadata.role:'library_user';
    if(existing?.role==='viewer'){
      const {data,error}=await window.db.from('profiles').update({role:requestedRole,full_name:existing.full_name||user.user_metadata?.full_name||user.email,email:user.email}).eq('id',user.id).select('*').single();
      if(error)throw new Error('Your account profile could not be completed. Please contact RMRDC support.');
      return data;
    }
    throw new Error('Your account profile has not been created. Please contact RMRDC support.');
  }

  async function routeAuthenticatedUser(){
    const identity=await getPlatformIdentity();
    if(!identity) throw new Error('No authenticated account was found. Please sign in again.');
    const cached = setCachedProfile(identity, identity.user);
    localStorage.setItem('rmrdc_platform_profile', JSON.stringify(cached));
    return identity;
  }

  async function routeAfterLogin(){
    if(routePromise) return routePromise;
    routePromise = routeAfterLoginOnce();
    try { return await routePromise; } finally { routePromise = null; }
  }

  async function routeAfterLoginOnce(){
    if(!window.db || !window.db.auth || !window.db.auth.getUser){
      throw new Error('Authentication service is not configured.');
    }
    const {data:{user},error}=await window.db.auth.getUser();
    if(error)throw error;
    if(!user){
      try { localStorage.removeItem('rmrdc_platform_profile'); } catch (e) { console.warn('Unable to clear stale platform profile cache:', e); }
      throw new Error('Your session has expired. Please sign in again.');
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
        window.location.replace(ROLE_ROUTES[identity.role]);
      }
    }
    if(!identity || !ROLE_ROUTES[identity.role]) throw new Error('Your account role is not configured for a portal.');
    return identity;
  }

  async function guardPage(allowedRoles){
    const identity=await getPlatformIdentity();
    const currentPath=window.location.pathname.split('/').pop()||'index.html';
    if(!identity){window.location.href=`login.html?next=${encodeURIComponent(currentPath+window.location.search+window.location.hash)}`;return null;}
    if(allowedRoles&&!allowedRoles.includes(identity.role)){window.location.href=ROLE_ROUTES[identity.role]||'researcher-login.html';return null;}
    return identity;
  }
  window.RMRDCAuth={ROLE_ROUTES,getPlatformIdentity,ensureProfileFromMetadata,routeAuthenticatedUser,guardPage,routeAfterLogin};
})();
