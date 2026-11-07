const form = document.getElementById("mineralForm");
const coverInput = document.getElementById("coverImage");
const pilotPlantInput = document.getElementById("pilotPlantImage");
const previewImage = document.getElementById("previewImage");
const previewName = document.getElementById("previewName");
const previewDescription = document.getElementById("previewDescription");
const previewLocations = document.getElementById("previewLocations");
const previewUses = document.getElementById("previewUses");
const savedMinerals = document.getElementById("savedMinerals");
const clearUploads = document.getElementById("clearUploads");
const resetForm = document.getElementById("resetForm");
const yearNow = document.getElementById("yearNow");
const localImageUpload = document.getElementById("localImageUpload");
const imageLibraryGrid = document.getElementById("imageLibraryGrid");
const useAsCover = document.getElementById("useAsCover");
const useAsPilot = document.getElementById("useAsPilot");

if (yearNow) yearNow.textContent = new Date().getFullYear();

let selectedImage = "";
let selectedPilotImage = "";
let selectedLibraryImage = "";

function updatePreview() {
  previewName.textContent = document.getElementById("name").value || "Raw Material Name";
  previewDescription.textContent = document.getElementById("description").value || "Your raw material description will appear here.";
  previewLocations.textContent = document.getElementById("locations").value || "—";
  previewUses.textContent = document.getElementById("uses").value || "—";
}

["name", "description", "locations", "uses"].forEach(id => {
  document.getElementById(id).addEventListener("input", updatePreview);
});

function fileToDataUrl(file, callback) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = event => callback(event.target.result);
  reader.readAsDataURL(file);
}

coverInput.addEventListener("change", () => {
  const file = coverInput.files[0];
  fileToDataUrl(file, dataUrl => {
    selectedImage = dataUrl;
    previewImage.src = selectedImage;
  });
});

if (pilotPlantInput) {
  pilotPlantInput.addEventListener("change", () => {
    const file = pilotPlantInput.files[0];
    fileToDataUrl(file, dataUrl => {
      selectedPilotImage = dataUrl;
    });
  });
}

function renderImageLibrary() {
  if (!imageLibraryGrid) return;

  const images = getLocalImages();

  if (!images.length) {
    imageLibraryGrid.innerHTML = `<p class="muted image-library-empty">No local images uploaded yet.</p>`;
    return;
  }

  imageLibraryGrid.innerHTML = images.map(image => `
    <button type="button" class="library-image ${selectedLibraryImage === image.dataUrl ? "selected" : ""}" data-id="${image.id}">
      <img src="${image.dataUrl}" alt="${image.name}" />
      <span>${image.name}</span>
    </button>
  `).join("");

  document.querySelectorAll(".library-image").forEach(button => {
    button.addEventListener("click", () => {
      const image = getLocalImages().find(img => img.id === button.dataset.id);
      if (!image) return;
      selectedLibraryImage = image.dataUrl;
      renderImageLibrary();
    });
  });
}

if (localImageUpload) {
  localImageUpload.addEventListener("change", () => {
    const files = Array.from(localImageUpload.files || []);
    if (!files.length) return;

    let completed = 0;

    files.forEach(file => {
      fileToDataUrl(file, dataUrl => {
        addLocalImage({
          id: createSlug(file.name.replace(/\.[^/.]+$/, "")) + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
          name: file.name,
          dataUrl
        });

        completed += 1;
        if (completed === files.length) {
          localImageUpload.value = "";
          renderImageLibrary();
          alert("Image uploaded to local library.");
        }
      });
    });
  });
}

if (useAsCover) {
  useAsCover.addEventListener("click", () => {
    if (!selectedLibraryImage) {
      alert("Please select an image from the local image library first.");
      return;
    }

    selectedImage = selectedLibraryImage;
    previewImage.src = selectedImage;
    alert("Selected local image has been set as cover image.");
  });
}

if (useAsPilot) {
  useAsPilot.addEventListener("click", () => {
    if (!selectedLibraryImage) {
      alert("Please select an image from the local image library first.");
      return;
    }

    selectedPilotImage = selectedLibraryImage;
    alert("Selected local image has been set as pilot plant image.");
  });
}

function renderSavedMinerals() {
  const uploaded = getUploadedMinerals();

  if (!uploaded.length) {
    savedMinerals.innerHTML = `<p class="muted">No uploaded profiles yet.</p>`;
    return;
  }

  savedMinerals.innerHTML = uploaded.map(item => `
    <div class="saved-item">
      <img src="${item.image}" alt="${item.name}" />
      <div>
        <strong>${item.name}</strong>
        <p>${item.category === "agro" ? "Agro Raw Material" : "Mineral Raw Material"}</p>
        <p>${item.locations.join(", ")}</p>
        <a href="material.html?name=${item.id}">View profile</a>
      </div>
    </div>
  `).join("");
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const id = createSlug(name) + "-" + Date.now();
  const pilotPlantName = document.getElementById("pilotPlantName")?.value.trim() || `${name} Pilot Plant`;

  const material = {
    id,
    category: document.getElementById("category").value,
    name,
    image: selectedImage || "assets/rmrdc-logo.svg",
    description: document.getElementById("description").value.trim(),
    uses: splitItems(document.getElementById("uses").value),
    locations: splitItems(document.getElementById("locations").value),
    relevance: document.getElementById("relevance").value.trim(),
    pilotPlant: {
      name: pilotPlantName,
      image: selectedPilotImage || selectedImage || "assets/rmrdc-logo.svg"
    },
    valueChain: {
      "Raw Material": splitItems(document.getElementById("rawMineral").value || name),
      "Processed Material": splitItems(document.getElementById("processedMaterial").value),
      "Industrial Products": splitItems(document.getElementById("industrialProducts").value),
      "30% Value Addition Opportunities": splitItems(document.getElementById("valueAddition").value)
    }
  };

  const uploaded = getUploadedMinerals();
  uploaded.push(material);
  saveUploadedMinerals(uploaded);

  alert("Profile saved successfully. Go to Raw Materials page to see it.");
  form.reset();
  selectedImage = "";
  selectedPilotImage = "";
  selectedLibraryImage = "";
  previewImage.src = "assets/rmrdc-logo.svg";
  updatePreview();
  renderSavedMinerals();
  renderImageLibrary();
});

resetForm.addEventListener("click", () => {
  form.reset();
  selectedImage = "";
  selectedPilotImage = "";
  selectedLibraryImage = "";
  previewImage.src = "assets/rmrdc-logo.svg";
  updatePreview();
  renderImageLibrary();
});

clearUploads.addEventListener("click", () => {
  if (!confirm("Clear all uploaded profiles from this browser?")) return;
  saveUploadedMinerals([]);
  renderSavedMinerals();
});

updatePreview();
renderSavedMinerals();
renderImageLibrary();
