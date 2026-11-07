/* RMRDC admin helper: keeps the richer research-intelligence fields discoverable in one place. */
window.RMRDCResearchIntelligence = {
  fields: [
    'researchSignificance','keyFindings','methodology','dataResources','researchGap',
    'researchImplications','contextGeography','keywords','researchLimitations','recommendedFor'
  ],
  normalize(value){
    return [...new Set(String(value || '').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean))];
  }
};
