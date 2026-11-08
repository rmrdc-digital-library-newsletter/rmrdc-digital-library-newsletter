(function () {
  const params = new URLSearchParams(location.search);
  const opportunityId = params.get("id");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const list = values => Array.isArray(values) && values.length ? `<ul>${values.map(value => `<li>${esc(value)}</li>`).join("")}</ul>` : "<p>Not evidenced yet.</p>";

  async function render() {
    const state = document.getElementById("opportunityState");
    if (!opportunityId) { state.textContent = "No investment opportunity was specified."; return; }

    try {
      await window.RMRDCAuth?.guardPage(["investor"]);
      const opportunityResponse = await db.from("technology_opportunities").select("*").eq("id", opportunityId).maybeSingle();
      if (opportunityResponse.error) throw opportunityResponse.error;
      const opportunity = opportunityResponse.data;
      if (!opportunity) throw new Error("This opportunity is not available.");

      const { data, error } = await db.functions.invoke("generate-investor-business-model", { body: { opportunity_id: opportunityId } });
      if (error) throw error;
      const model = data?.model || {};

      document.getElementById("opportunityTitle").textContent = opportunity.title || "Investment opportunity";
      document.getElementById("opportunitySummary").textContent = opportunity.executive_summary || opportunity.short_summary || model.opening_hook || "";
      document.getElementById("opportunitySector").textContent = opportunity.sector || "Not specified";
      document.getElementById("opportunityTrl").textContent = opportunity.trl ? `TRL ${opportunity.trl}` : "TRL not specified";

      document.getElementById("leanCanvas").innerHTML = `
        <article><small>Problem</small><p>${esc(model.problem || "Not evidenced yet.")}</p></article>
        <article><small>Solution</small><p>${esc(model.solution || "Not evidenced yet.")}</p></article>
        <article><small>Unique value proposition</small><p>${esc(model.unique_value || "Not evidenced yet.")}</p></article>
        <article><small>Customer segments</small>${list(model.customer_segments)}</article>
        <article><small>Revenue streams</small>${list(model.revenue_streams)}</article>
        <article><small>Channels</small>${list(model.channels)}</article>
        <article><small>Key resources</small>${list(model.key_resources)}</article>
        <article><small>Key activities</small>${list(model.key_activities)}</article>
        <article><small>Key partnerships</small>${list(model.key_partnerships)}</article>
        <article><small>Cost structure</small>${list(model.cost_structure)}</article>`;

      document.getElementById("economics").innerHTML = `
        <div><small>Pricing</small><strong>${esc(model.pricing || "Requires validation")}</strong></div>
        <div><small>Unit economics</small><strong>${esc(model.unit_economics || "Requires validation")}</strong></div>
        <div><small>Investment case</small><strong>${esc(model.investment_case || "Requires validation")}</strong></div>`;

      const projection = Array.isArray(model.five_year_revenue_projection) ? model.five_year_revenue_projection : [];
      document.getElementById("projection").innerHTML = projection.length
        ? `<div class="projection-table-wrap"><table><thead><tr><th>Year</th><th>Projected revenue</th><th>Basis</th><th>Confidence</th></tr></thead><tbody>${projection.map(row => `<tr><td>${esc(row.year)}</td><td>${esc(row.revenue)}</td><td>${esc(row.basis)}</td><td>${esc(row.confidence)}</td></tr>`).join("")}</tbody></table></div>`
        : '<div class="empty-state"><strong>Projection pending commercial validation.</strong><p>RMRDC has not released a revenue forecast unless supported and approved. No financial values have been inferred or fabricated.</p></div>';

      const assumptions = Array.isArray(model.assumptions) ? model.assumptions : [];
      document.getElementById("assumptions").innerHTML = assumptions.length ? list(assumptions) : "<p>No outstanding commercial assumptions were identified.</p>";
      state.hidden = true;
      document.getElementById("opportunityContent").hidden = false;
    } catch (error) {
      console.error(error);
      state.textContent = error?.message || "Unable to load this investment opportunity.";
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();
