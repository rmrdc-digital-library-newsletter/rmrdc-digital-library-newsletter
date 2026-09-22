/* RMRDC platform authentication + role routing. Database-aligned with profiles + role profile tables. */
(function(){
  const ROLE_ROUTES={researcher:'researcher-portal.html',investor:'investor-portal.html',fabricator:'fabricator-portal.html',library_user:'user-dashboard.html',admin:'admin/index.html',editor:'admin/index.html'};
  const USER_ROLES=['researcher','investor','fabricator','library_user','admin','editor'];
  const safeRole=r=>USER_ROLES.includes(r)?r:'library_user';

  async function getPlatformIdentity(){
    if(!window.db)throw new Error('Authentication service is not configured.');
    const {data:{user},error}=await window.db.auth.getUser();
    if(error)throw error;if(!user)return null;
    const {data:baseProfile}=await window.db.from('profiles').select('*').eq('id',user.id).maybeSingle();
    let role=baseProfile?.role;
    if(!['admin','editor'].includes(role)) role=safeRole(role||user.user_metadata?.role);
    let detail=null;
    if(role==='researcher') detail=(await window.db.from('researcher_profiles').select('*').eq('profile_id',user.id).maybeSingle()).data;
    if(role==='investor') detail=(await window.db.from('investor_profiles').select('*').eq('profile_id',user.id).maybeSingle()).data;
    if(role==='library_user') detail=(await window.db.from('library_user_profiles').select('*').eq('profile_id',user.id).maybeSingle()).data;
    if(role==='fabricator') detail=(await window.db.from('fabricator_profiles').select('*').eq('profile_id',user.id).maybeSingle()).data;
    return {user,baseProfile,detail,role};
  }

  async function ensureProfileFromMetadata(user){
    if(!user||!window.db)return null;
    const meta=user.user_metadata||{};
    const {data:existing}=await window.db.from('profiles').select('id,role,full_name').eq('id',user.id).maybeSingle();
    if(existing?.role && ['admin','editor'].includes(existing.role))return existing;
    const role=safeRole(existing?.role||meta.role);
    const profile={id:user.id,full_name:existing?.full_name||meta.full_name||user.email,email:user.email,role,organisation:meta.organisation||'',phone:meta.phone||'',research_areas:Array.isArray(meta.interests)?meta.interests:[],email_notifications:meta.email_alerts!==false,whatsapp_alerts:meta.whatsapp_alerts===true};
    const {data:up,error}=await window.db.from('profiles').upsert(profile,{onConflict:'id'}).select('*').single();
    if(error)throw error;
    const rd=meta.role_data||{};
    if(role==='researcher')await window.db.from('researcher_profiles').upsert({profile_id:user.id,institution:rd.institution||'',position:rd.position||'',research_stage:rd.researchStage||'',orcid:rd.orcid||'',biography:rd.bio||'',location:meta.location||''},{onConflict:'profile_id'});
    if(role==='investor')await window.db.from('investor_profiles').upsert({profile_id:user.id,organisation_type:rd.orgType||'',position:rd.position||'',location:meta.location||'',investment_stage:rd.investmentStage?[rd.investmentStage]:[],engagement_preferences:rd.engagementModels?rd.engagementModels.split(',').map(x=>x.trim()).filter(Boolean):[]},{onConflict:'profile_id'});
    if(role==='library_user')await window.db.from('library_user_profiles').upsert({profile_id:user.id,user_category:rd.userCategory||'',location:meta.location||'',subject_areas:rd.subjectAreas?rd.subjectAreas.split(',').map(x=>x.trim()).filter(Boolean):[],preferred_cas_topics:Array.isArray(meta.interests)?meta.interests:[],alert_frequency:rd.alertFrequency||'weekly'},{onConflict:'profile_id'});
    if(role==='fabricator')await window.db.from('fabricator_profiles').upsert({profile_id:user.id,location:meta.location||'',fabrication_specialisation:rd.fabricationSpecialisation?rd.fabricationSpecialisation.split(',').map(x=>x.trim()).filter(Boolean):[],equipment_categories:rd.equipmentCategories?rd.equipmentCategories.split(',').map(x=>x.trim()).filter(Boolean):[],manufacturing_capacity:rd.capacity||'',geographic_coverage:rd.coverage?rd.coverage.split(',').map(x=>x.trim()).filter(Boolean):[],certifications:rd.certifications?rd.certifications.split(',').map(x=>x.trim()).filter(Boolean):[],services_offered:rd.servicesOffered?rd.servicesOffered.split(',').map(x=>x.trim()).filter(Boolean):[]},{onConflict:'profile_id'});
    return up;
  }

  async function routeAuthenticatedUser(){
    const identity=await getPlatformIdentity();
    if(!identity){window.location.href='subscribe.html';return null;}
    localStorage.setItem('rmrdc_platform_profile',JSON.stringify({full_name:identity.baseProfile?.full_name||identity.user.email,role:identity.role,organisation:identity.baseProfile?.organisation||'',location:identity.detail?.location||'',interests:identity.baseProfile?.research_areas||[]}));
    return identity;
  }
  async function routeAfterLogin(){
    const {data:{user}}=await window.db.auth.getUser();
    if(!user){window.location.href='subscribe.html';return null;}
    await ensureProfileFromMetadata(user);
    const identity=await routeAuthenticatedUser();
    if(identity)window.location.href=ROLE_ROUTES[identity.role]||'user-dashboard.html';
    return identity;
  }
  async function guardPage(allowedRoles){
    const identity=await getPlatformIdentity();
    if(!identity){window.location.href='subscribe.html';return null;}
    if(allowedRoles&&!allowedRoles.includes(identity.role)){window.location.href=ROLE_ROUTES[identity.role]||'user-dashboard.html';return null;}
    return identity;
  }
  window.RMRDCAuth={ROLE_ROUTES,getPlatformIdentity,ensureProfileFromMetadata,routeAuthenticatedUser,guardPage,routeAfterLogin};
})();
