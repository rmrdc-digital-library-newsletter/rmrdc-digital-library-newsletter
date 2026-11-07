(function(){
  const DEFAULT_WEIGHTS={sector_match:25,technology_interest:20,raw_material_interest:15,trl_compatibility:15,geographic_fit:10,commercial_interest:10,engagement_preference:5};
  const norm=v=>String(v||'').toLowerCase().trim();
  const list=v=>Array.isArray(v)?v:(v?String(v).split(/[,;|]/).map(x=>x.trim()).filter(Boolean):[]);
  function overlap(a,b){const A=new Set(list(a).map(norm));return list(b).some(x=>A.has(norm(x)));}
  function trlCompatible(pref,trl){if(!pref||!trl)return false;const n=Number(String(trl).replace(/\D/g,''));if(!n)return false;const p=norm(pref);if(p.includes('all'))return true;if(p.includes('1–3')||p.includes('1-3'))return n<=3;if(p.includes('4–5')||p.includes('4-5'))return n>=4&&n<=5;if(p.includes('6–7')||p.includes('6-7'))return n>=6&&n<=7;if(p.includes('8–9')||p.includes('8-9'))return n>=8&&n<=9;return false;}
  function score(profile,opportunity,weights=DEFAULT_WEIGHTS){
    const reasons=[];let total=0;
    if(overlap(profile.interests,opportunity.sectors)){total+=weights.sector_match;reasons.push('sector alignment')}
    if(overlap(profile.interests,opportunity.technology_interests||opportunity.sectors)){total+=weights.technology_interest;reasons.push('technology interest')}
    if(overlap(profile.interests,opportunity.raw_materials)){total+=weights.raw_material_interest;reasons.push('raw-material interest')}
    if(trlCompatible(profile.role_data?.preferredTrl,opportunity.trl)){total+=weights.trl_compatibility;reasons.push('preferred TRL range')}
    if(overlap(profile.location,opportunity.locations)){total+=weights.geographic_fit;reasons.push('geographic fit')}
    if(overlap(profile.role_data?.investmentStage,opportunity.commercialisation_stage)){total+=weights.commercial_interest;reasons.push('commercialisation-stage fit')}
    if(overlap(profile.role_data?.engagementModels,opportunity.engagement_models)){total+=weights.engagement_preference;reasons.push('engagement preference')}
    return {score:Math.min(100,Math.round(total)),reasons};
  }
  window.RMRDCMatching={score,DEFAULT_WEIGHTS};
})();
