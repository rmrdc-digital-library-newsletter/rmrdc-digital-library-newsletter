const grid = document.getElementById("materialsGrid");
const searchInput = document.getElementById("searchInput");
const stateFilter = document.getElementById("stateFilter");
const resultsText = document.getElementById("resultsText");
const statMineralCount = document.getElementById("statMineralCount");
const statAgroCount = document.getElementById("statAgroCount");
const yearNow = document.getElementById("yearNow");
const categoryButtons = document.querySelectorAll(".profile-type-card");

const allMinerals = getAllMinerals();
let activeCategory = "mineral";

function populateStats() {
  if (statMineralCount) statMineralCount.textContent = allMinerals.filter(m => (m.category || "mineral") === "mineral").length;
  if (statAgroCount) statAgroCount.textContent = allMinerals.filter(m => m.category === "agro").length;
  if (yearNow) yearNow.textContent = new Date().getFullYear();
}

function populateStates() {
  const states = [...new Set(allMinerals.flatMap(m => m.locations || []))].sort();
  states.forEach(state => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    stateFilter.appendChild(option);
  });
}

function getSearchText(material) {
  const chainText = Object.values(material.valueChain || {}).flat().join(" ");
  const pilot = material.pilotPlant ? `${material.pilotPlant.name}` : "";
  return `${material.name} ${material.description} ${(material.uses || []).join(" ")} ${(material.locations || []).join(" ")} ${chainText} ${pilot}`.toLowerCase();
}

function getCategoryLabel(category) {
  return category === "agro" ? "Agro" : "Mineral";
}

function renderCards() {
  const search = searchInput.value.toLowerCase().trim();
  const selectedState = stateFilter.value;

  const filtered = allMinerals.filter(m => {
    const category = m.category || "mineral";
    const matchesCategory = category === activeCategory;
    const matchesSearch = getSearchText(m).includes(search);
    const matchesState = !selectedState || (m.locations || []).includes(selectedState);
    return matchesCategory && matchesSearch && matchesState;
  });

  if (resultsText) {
    const label = activeCategory === "agro" ? "agro raw material" : "mineral raw material";
    resultsText.textContent = `${filtered.length} ${label} profile${filtered.length === 1 ? "" : "s"} found`;
  }

  grid.innerHTML = filtered.map(m => `
    <article class="material-card" onclick="openMaterial('${m.id}')" title="Open ${m.name} profile">
      <span class="category-badge ${m.category || "mineral"}">${getCategoryLabel(m.category || "mineral")}</span>
      <img src="${m.image}" alt="${m.name}" loading="lazy" />
      <div class="card-overlay">
        <h2>${m.name}</h2>
        <p>${(m.locations || []).slice(0, 3).join(", ")}</p>
      </div>
    </article>
  `).join("");

  if (!filtered.length) {
    grid.innerHTML = `<p class="empty card">No profile found. Try another search, category, or location.</p>`;
  }
}

function openMaterial(id) {
  window.location.href = `material.html?name=${id}`;
}

categoryButtons.forEach(button => {
  button.addEventListener("click", () => {
    categoryButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    activeCategory = button.dataset.category;
    renderCards();
  });
});

populateStats();
populateStates();
renderCards();
searchInput.addEventListener("input", renderCards);
stateFilter.addEventListener("change", renderCards);
