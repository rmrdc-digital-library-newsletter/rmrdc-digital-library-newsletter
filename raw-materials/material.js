const params = new URLSearchParams(window.location.search);
const id = params.get("name");
const allMinerals = getAllMinerals();
const mineral = allMinerals.find(m => m.id === id) || allMinerals[0];
const yearNow = document.getElementById("yearNow");

if (yearNow) yearNow.textContent = new Date().getFullYear();
document.title = `${mineral.name} | RMRDC Digital Library`;

const typeLabel = (mineral.category || "mineral") === "agro"
  ? "Agro Raw Materials Profile"
  : "Mineral Raw Material Profile";

document.getElementById("detailHero").innerHTML = `
  <img src="${mineral.image}" alt="${mineral.name}" />
  <div class="detail-hero-text">
    <p class="section-tag">${typeLabel}</p>
    <h1>${mineral.name}</h1>
    <p>${mineral.description}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#valueChain">View Value Chain</a>
      <a class="btn btn-secondary" href="index.html">Explore More Profiles</a>
    </div>
  </div>
`;

function renderList(items) {
  return items.map(item => `<li>${item}</li>`).join("");
}

function renderPilotPlant() {
  const plant = mineral.pilotPlant || {
    name: `${mineral.name} Pilot Plant`,
    image: mineral.image
  };

  return `
    <div class="pilot-plant-panel" id="pilotPlantPanel">
      <div>
        <p class="section-tag">Relevant Pilot Plant</p>
        <h3>${plant.name}</h3>
        <p>This pilot plant is displayed in line with the selected 30% value addition opportunity for ${mineral.name}.</p>
      </div>
      <img src="${plant.image}" alt="${plant.name}" />
    </div>
  `;
}

function renderValueChainTree(chain) {
  const branches = Object.entries(chain).map(([stage, products], index) => {
    const isValueAdd = stage.toLowerCase().includes("30%");
    const valueClass = isValueAdd ? " value-add" : "";
    const plantAttr = isValueAdd ? ' data-show-pilot="true"' : "";
    return `
      <li class="tree-branch ${index > 0 ? "collapsed" : ""}">
        <button class="tree-node stage${valueClass}" type="button" aria-expanded="${index === 0 ? "true" : "false"}"${plantAttr}>
          <span class="toggle-icon">⌄</span>
          ${stage}
        </button>
        <ul class="tree-children">
          ${products.map(product => `
            <li>
              <span class="tree-node product${valueClass}">${product}</span>
            </li>
          `).join("")}
        </ul>
      </li>
    `;
  }).join("");

  return `
    <section class="value-chain" id="valueChain">
      <div class="value-chain-head">
        <div>
          <p class="section-tag">Interactive Product Tree</p>
          <h2>Value Chain & 30% Value Addition Opportunities</h2>
          <p class="section-intro">
            Click each stage to expand or collapse the products. When you click the 30% value addition stage,
            the relevant pilot plant will display in the middle.
          </p>
        </div>
        <div class="tree-actions">
          <button class="tree-btn" type="button" onclick="expandAll()">Expand all</button>
          <button class="tree-btn" type="button" onclick="collapseAll()">Collapse all</button>
        </div>
      </div>

      <div class="value-chain-layout">
      <div class="tree">
        <ul>
          <li>
            <span class="tree-node root">${mineral.name}</span>
            <ul>${branches}</ul>
          </li>
        </ul>
      </div>
      ${renderPilotPlant()}
    </div>
      <span class="tree-hint">Tip: tap the light-green 30% value addition stage to show the pilot plant</span>
    </section>
  `;
}

document.getElementById("detailContent").innerHTML = `
  <section class="info-grid">
    <div class="info-card">
      <h2>Description</h2>
      <p>${mineral.description}</p>
    </div>

    <div class="info-card">
      <h2>Where It Can Be Found</h2>
      <ul>${renderList(mineral.locations)}</ul>
    </div>

    <div class="info-card">
      <h2>Major Uses</h2>
      <ul>${renderList(mineral.uses)}</ul>
    </div>

    <div class="info-card">
      <h2>Industrial Relevance</h2>
      <p>${mineral.relevance}</p>
    </div>
  </section>

  ${renderValueChainTree(mineral.valueChain)}

  <section class="subscribe-box">
    <p class="section-tag">CAS / SDI Alert</p>
    <h2>Subscribe for Updates on ${mineral.name}</h2>
    <p>Connect this button to your newsletter, Supabase form, or user interest profile later.</p>
    <button onclick="alert('Connect this button to your newsletter or Supabase subscription form.')">Subscribe for Updates</button>
  </section>
`;

function setBranch(branch, collapsed) {
  const button = branch.querySelector(":scope > .tree-node.stage");
  branch.classList.toggle("collapsed", collapsed);
  if (button) button.setAttribute("aria-expanded", String(!collapsed));
}

function showPilotPlant() {
  const panel = document.getElementById("pilotPlantPanel");
  if (!panel) return;
  panel.classList.add("show");
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.querySelectorAll(".tree-node.stage").forEach(button => {
  button.addEventListener("click", () => {
    const branch = button.closest(".tree-branch");
    setBranch(branch, !branch.classList.contains("collapsed"));

    if (button.dataset.showPilot === "true") {
      showPilotPlant();
    }
  });
});

function expandAll() {
  document.querySelectorAll(".tree-branch").forEach(branch => setBranch(branch, false));
}

function collapseAll() {
  document.querySelectorAll(".tree-branch").forEach(branch => setBranch(branch, true));
}
