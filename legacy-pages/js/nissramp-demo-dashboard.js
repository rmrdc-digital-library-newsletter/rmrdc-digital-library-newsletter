import { searchDummyNissramp } from "./dummy_nissramp.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

async function runNissrampDemo() {
  const input = document.getElementById("nissrampHsInput");
  const button = document.getElementById("nissrampSearchButton");
  const state = document.getElementById("nissrampResultState");
  const result = document.getElementById("nissrampResult");
  if (!input || !button || !state || !result) return;

  button.disabled = true;
  state.textContent = "Connecting to NISSRAMP demo registry...";
  result.hidden = true;

  try {
    const response = await searchDummyNissramp(input.value);
    if (response.status !== "success") throw new Error(response.message);

    state.textContent = "Demo match found";
    document.getElementById("nissrampCommodity").textContent = response.data.commodity;
    document.getElementById("nissrampHsCode").textContent = response.hs_code;
    document.getElementById("nissrampDependency").textContent = response.data.import_dependency;
    document.getElementById("nissrampAvailability").textContent = response.data.local_availability;
    document.getElementById("nissrampPatent").textContent = response.data.rmrdc_patent;
    document.getElementById("nissrampCompliance").innerHTML = escapeHtml(response.data.compliance_status);
    result.hidden = false;
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "Unable to search NISSRAMP.";
  } finally {
    button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("nissrampSearchButton")?.addEventListener("click", runNissrampDemo);
  document.getElementById("nissrampHsInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter") runNissrampDemo();
  });
});
