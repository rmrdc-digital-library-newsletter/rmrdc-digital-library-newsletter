const dummyNissrampDatabase = {
  "1108140000": {
    commodity: "Industrial Cassava Starch",
    import_dependency: "65%",
    local_availability: "High (Ogun, Oyo, Benue)",
    rmrdc_patent: "RMRDC-CS-2026: Automated High-Speed Flash Dryer",
    compliance_status: "Fails 30% Local Value-Addition Rule without processing"
  },
  "2507000000": {
    commodity: "Refined Kaolin Clay (Paint & Paper Grade)",
    import_dependency: "80%",
    local_availability: "Abundant but unrefined (Katsina, Plateau)",
    rmrdc_patent: "RMRDC-MIN-2025: Fluidized Bed Calciner Process",
    compliance_status: "Raw export restricted under industrialization policy"
  },
  "1511100000": {
    commodity: "Crude Palm Oil (CPO)",
    import_dependency: "40%",
    local_availability: "Medium (Ondo, Cross River, Imo)",
    rmrdc_patent: "RMRDC-AGRO-2026: Low-FFA Extraction Mill System",
    compliance_status: "High domestic demand; tariff incentives apply"
  }
};

export default dummyNissrampDatabase;

export async function searchDummyNissramp(hsCode) {
  await new Promise(resolve => setTimeout(resolve, 800));
  const normalizedCode = String(hsCode || "").replace(/\D/g, "");
  const result = dummyNissrampDatabase[normalizedCode];
  if (!result) return { status: "error", message: "HS Code not found in the NISSRAMP demo registry." };
  return { status: "success", data: result, hs_code: normalizedCode };
}
