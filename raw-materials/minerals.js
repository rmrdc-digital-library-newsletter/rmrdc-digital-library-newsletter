const minerals = [
  {
    id: "bentonite",
    category: "mineral",
    name: "Bentonite",
    image: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=900&q=80",
    description: "A clay mineral used in drilling mud, foundry binding, absorbents, sealing, cosmetics, and industrial processing.",
    uses: ["Drilling mud", "Foundry binder", "Sealants", "Absorbents", "Cosmetics"],
    locations: ["Borno", "Adamawa", "Edo", "Delta"],
    relevance: "Supports oil and gas drilling, foundry operations, environmental sealing, and absorbent product manufacturing.",
    pilotPlant: { name: "Bentonite Processing Pilot Plant", image: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Mineral": ["Bentonite clay"],
      "Processed Material": ["Washed bentonite", "Dried bentonite", "Milled bentonite powder", "Activated bentonite"],
      "Industrial Products": ["Drilling mud", "Bleaching earth", "Foundry binder", "Sealants", "Cat litter"],
      "30% Value Addition Opportunities": ["Packaged drilling-grade bentonite", "Cosmetics-grade clay", "Processed bleaching earth", "Industrial absorbent products"]
    }
  },
  {
    id: "limestone",
    category: "mineral",
    name: "Limestone",
    image: "https://images.unsplash.com/photo-1603484477859-abe6a73f9366?auto=format&fit=crop&w=900&q=80",
    description: "A sedimentary rock rich in calcium carbonate, widely used in cement, construction, agriculture, and chemical industries.",
    uses: ["Cement production", "Lime", "Construction aggregate", "Soil conditioning", "Glass production"],
    locations: ["Ogun", "Kogi", "Benue", "Sokoto", "Cross River"],
    relevance: "Critical raw material for cement, construction, lime production, and industrial chemical processes.",
    pilotPlant: { name: "Limestone & Lime Processing Pilot Plant", image: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Mineral": ["Limestone rock"],
      "Processed Material": ["Crushed limestone", "Ground calcium carbonate", "Quicklime", "Hydrated lime"],
      "Industrial Products": ["Cement", "Paint filler", "Agricultural lime", "Glass", "Water treatment chemicals"],
      "30% Value Addition Opportunities": ["Bagged agricultural lime", "Precipitated calcium carbonate", "High-purity lime products", "Construction-grade aggregates"]
    }
  },
  {
    id: "kaolin",
    category: "mineral",
    name: "Kaolin",
    image: "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=900&q=80",
    description: "A fine white clay used in ceramics, paper coating, paints, rubber, pharmaceuticals, and cosmetics.",
    uses: ["Ceramics", "Paper coating", "Paints", "Rubber filler", "Cosmetics"],
    locations: ["Katsina", "Kogi", "Ogun", "Plateau", "Niger"],
    relevance: "Useful for local ceramic production, industrial fillers, paper processing, cosmetics, and pharmaceutical materials.",
    pilotPlant: { name: "Ceramic & Kaolin Processing Pilot Plant", image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Mineral": ["Raw kaolin clay"],
      "Processed Material": ["Washed kaolin", "Beneficiated kaolin", "Calcined kaolin"],
      "Industrial Products": ["Ceramic tiles", "Porcelain", "Paper coating material", "Paint filler", "Cosmetic clay"],
      "30% Value Addition Opportunities": ["Refined ceramic-grade kaolin", "Calcined kaolin for paints", "Cosmetic-grade packaged kaolin", "Pharmaceutical excipient-grade kaolin"]
    }
  },
  {
    id: "barite",
    category: "mineral",
    name: "Barite",
    image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=80",
    description: "A high-density barium sulfate mineral mainly used as a weighting agent in drilling fluids.",
    uses: ["Drilling mud", "Paint filler", "Rubber filler", "Radiation shielding", "Chemicals"],
    locations: ["Benue", "Nasarawa", "Cross River", "Taraba"],
    relevance: "Important for oil and gas drilling operations and several industrial filler applications.",
    pilotPlant: { name: "Barite Beneficiation Pilot Plant", image: "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Mineral": ["Barite ore"],
      "Processed Material": ["Crushed barite", "Washed barite", "Milled barite powder", "API-grade barite"],
      "Industrial Products": ["Drilling mud weighting agent", "Paint filler", "Rubber filler", "Barium chemicals"],
      "30% Value Addition Opportunities": ["API-grade packaged barite", "Micronized barite filler", "Barite-based radiation shielding blocks", "Specialty barium chemical feedstock"]
    }
  },
  {
    id: "gypsum",
    category: "mineral",
    name: "Gypsum",
    image: "https://images.unsplash.com/photo-1621504450181-5d356f61d307?auto=format&fit=crop&w=900&q=80",
    description: "A soft sulfate mineral used in cement, plaster, wallboard, agriculture, and building materials.",
    uses: ["Cement retarder", "Plaster of Paris", "Wallboard", "Soil conditioner", "Moulds"],
    locations: ["Yobe", "Borno", "Sokoto", "Edo", "Gombe"],
    relevance: "Supports cement production, building materials, agriculture, and mould-making industries.",
    pilotPlant: { name: "Gypsum Products Pilot Plant", image: "https://images.unsplash.com/photo-1581093458791-9f3c3f7b2f07?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Mineral": ["Gypsum rock"],
      "Processed Material": ["Crushed gypsum", "Calcined gypsum", "Plaster of Paris"],
      "Industrial Products": ["Cement additive", "Gypsum board", "Ceiling tiles", "Medical casts", "Soil conditioner"],
      "30% Value Addition Opportunities": ["Packaged Plaster of Paris", "Decorative ceiling panels", "Gypsum wallboard", "Agricultural gypsum products"]
    }
  },
  {
    id: "iron-ore",
    category: "mineral",
    name: "Iron Ore",
    image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
    description: "A metallic mineral source of iron used mainly for steel and engineering materials.",
    uses: ["Steel production", "Construction materials", "Machinery", "Automotive parts", "Tools"],
    locations: ["Kogi", "Niger", "Enugu", "Kaduna", "Zamfara"],
    relevance: "Essential for steel production, manufacturing, engineering, construction, and industrial development.",
    pilotPlant: { name: "Iron Ore Beneficiation Pilot Plant", image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Mineral": ["Iron ore"],
      "Processed Material": ["Crushed ore", "Concentrate", "Pellets", "Sponge iron"],
      "Industrial Products": ["Steel billets", "Rebars", "Sheets", "Machine parts", "Tools"],
      "30% Value Addition Opportunities": ["Iron ore pellets", "Direct reduced iron", "Locally rolled steel bars", "Fabricated steel components"]
    }
  },
  {
    id: "silica-sand",
    category: "mineral",
    name: "Silica Sand",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    description: "High-silica sand used in glass, foundry casting, ceramics, filtration, and construction materials.",
    uses: ["Glass making", "Foundry moulds", "Water filtration", "Ceramics", "Construction"],
    locations: ["Lagos", "Ogun", "Ondo", "Rivers", "Delta"],
    relevance: "Important for glass manufacturing, foundry industries, water treatment, ceramics, and construction.",
    pilotPlant: { name: "Silica Sand Processing Pilot Plant", image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Mineral": ["Silica sand"],
      "Processed Material": ["Washed silica sand", "Dried silica sand", "Graded silica sand", "High-purity silica"],
      "Industrial Products": ["Glass bottles", "Flat glass", "Foundry sand", "Filter media", "Ceramic glaze"],
      "30% Value Addition Opportunities": ["High-purity glass-grade silica", "Packaged filter sand", "Foundry-grade silica sand", "Specialty silica fillers"]
    }
  },
  {
    id: "cassava",
    category: "agro",
    name: "Cassava",
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80",
    description: "A major agro raw material used for starch, flour, ethanol, animal feed, food products, and industrial processing.",
    uses: ["Starch", "Cassava flour", "Garri", "Ethanol", "Animal feed"],
    locations: ["Benue", "Kogi", "Ogun", "Oyo", "Cross River"],
    relevance: "Supports food processing, starch-based industries, bioethanol production, livestock feed, and SME value chains.",
    pilotPlant: { name: "Cassava Processing Pilot Plant", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Material": ["Fresh cassava tubers"],
      "Processed Material": ["Cassava chips", "Cassava flour", "Cassava starch", "Fermented cassava mash"],
      "Industrial Products": ["High quality cassava flour", "Industrial starch", "Ethanol", "Glucose syrup", "Animal feed"],
      "30% Value Addition Opportunities": ["Packaged HQCF", "Modified starch", "Bioethanol products", "Fortified cassava flour", "Packaged garri"]
    }
  },
  {
    id: "shea-nut",
    category: "agro",
    name: "Shea Nut",
    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=80",
    description: "An agro raw material processed into shea butter for cosmetics, food, pharmaceuticals, and export markets.",
    uses: ["Shea butter", "Cosmetics", "Soap", "Confectionery fat", "Pharmaceutical base"],
    locations: ["Niger", "Kwara", "Kebbi", "Kaduna", "Oyo"],
    relevance: "Important for women-led enterprises, cosmetics, export earnings, food processing, and local industrial development.",
    pilotPlant: { name: "Shea Butter Processing Pilot Plant", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Material": ["Shea nuts"],
      "Processed Material": ["Dried shea kernels", "Crushed kernels", "Unrefined shea butter", "Refined shea butter"],
      "Industrial Products": ["Body cream", "Soap", "Hair products", "Confectionery fat", "Medicinal balms"],
      "30% Value Addition Opportunities": ["Packaged refined shea butter", "Branded skincare products", "Shea-based soap", "Export-grade shea butter", "Cosmetic formulation base"]
    }
  },
  {
    id: "oil-palm",
    category: "agro",
    name: "Oil Palm",
    image: "https://images.unsplash.com/photo-1590514539423-42f23b0a7a93?auto=format&fit=crop&w=900&q=80",
    description: "A strategic agro raw material used for edible oil, oleochemicals, soap, cosmetics, biodiesel, and animal feed.",
    uses: ["Palm oil", "Palm kernel oil", "Soap", "Margarine", "Biodiesel"],
    locations: ["Edo", "Delta", "Rivers", "Akwa Ibom", "Cross River"],
    relevance: "Supports food industries, cosmetics, oleochemical production, soap manufacturing, and rural enterprise development.",
    pilotPlant: { name: "Oil Palm Processing Pilot Plant", image: "https://images.unsplash.com/photo-1590514539423-42f23b0a7a93?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Material": ["Fresh fruit bunches", "Palm kernels"],
      "Processed Material": ["Crude palm oil", "Palm kernel oil", "Palm kernel cake"],
      "Industrial Products": ["Refined palm oil", "Soap noodles", "Margarine", "Cosmetics", "Biodiesel"],
      "30% Value Addition Opportunities": ["Packaged refined palm oil", "Palm-based soap", "Oleochemical products", "Branded cosmetics", "Animal feed from kernel cake"]
    }
  },
  {
    id: "cotton",
    category: "agro",
    name: "Cotton",
    image: "https://images.unsplash.com/photo-1502395809857-fd80069897d0?auto=format&fit=crop&w=900&q=80",
    description: "A fibre crop used in textiles, garments, medical supplies, oil extraction, and livestock feed.",
    uses: ["Textiles", "Garments", "Cottonseed oil", "Medical cotton", "Animal feed"],
    locations: ["Kano", "Kaduna", "Katsina", "Zamfara", "Sokoto"],
    relevance: "Supports textile manufacturing, garment production, oil mills, medical supplies, and cottonseed value chains.",
    pilotPlant: { name: "Cotton/Textile Processing Pilot Plant", image: "https://images.unsplash.com/photo-1502395809857-fd80069897d0?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Material": ["Seed cotton"],
      "Processed Material": ["Lint cotton", "Cotton yarn", "Cottonseed", "Cottonseed oil"],
      "Industrial Products": ["Textiles", "Garments", "Medical cotton", "Cooking oil", "Cottonseed cake"],
      "30% Value Addition Opportunities": ["Spun yarn", "Branded garments", "Medical-grade cotton wool", "Refined cottonseed oil", "Textile fabrics"]
    }
  },
  {
    id: "ginger",
    category: "agro",
    name: "Ginger",
    image: "https://images.unsplash.com/photo-1603431777007-61db97f0f9f3?auto=format&fit=crop&w=900&q=80",
    description: "A spice and medicinal agro raw material used in food processing, beverages, pharmaceuticals, and essential oils.",
    uses: ["Spice", "Ginger powder", "Beverages", "Essential oil", "Pharmaceuticals"],
    locations: ["Kaduna", "Nasarawa", "Gombe", "Bauchi", "Benue"],
    relevance: "Supports spice processing, beverage industries, export markets, herbal products, and pharmaceutical raw materials.",
    pilotPlant: { name: "Ginger Processing Pilot Plant", image: "https://images.unsplash.com/photo-1603431777007-61db97f0f9f3?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Material": ["Fresh ginger rhizomes"],
      "Processed Material": ["Dried ginger", "Ginger powder", "Ginger oleoresin", "Ginger oil"],
      "Industrial Products": ["Spice blends", "Herbal tea", "Soft drinks", "Pharmaceutical extracts", "Confectionery"],
      "30% Value Addition Opportunities": ["Packaged ginger powder", "Ginger tea bags", "Ginger essential oil", "Ginger-based drinks", "Export-grade dried ginger"]
    }
  },
  {
    id: "cocoa",
    category: "agro",
    name: "Cocoa",
    image: "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=900&q=80",
    description: "A high-value agro raw material used for chocolate, cocoa butter, cocoa powder, cosmetics, and beverages.",
    uses: ["Chocolate", "Cocoa powder", "Cocoa butter", "Beverages", "Cosmetics"],
    locations: ["Ondo", "Osun", "Oyo", "Ekiti", "Cross River"],
    relevance: "Supports confectionery, beverage manufacturing, cosmetics, export earnings, and agro-processing industries.",
    pilotPlant: { name: "Cocoa Processing Pilot Plant", image: "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=900&q=80" },
    valueChain: {
      "Raw Material": ["Cocoa pods", "Cocoa beans"],
      "Processed Material": ["Fermented beans", "Dried beans", "Cocoa liquor", "Cocoa butter", "Cocoa powder"],
      "Industrial Products": ["Chocolate", "Cocoa beverages", "Cosmetic butter", "Bakery ingredients", "Confectionery"],
      "30% Value Addition Opportunities": ["Branded cocoa powder", "Chocolate bars", "Cocoa butter cosmetics", "Instant cocoa drinks", "Export-grade processed cocoa"]
    }
  }
];
