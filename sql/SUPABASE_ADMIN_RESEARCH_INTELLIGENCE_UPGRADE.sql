-- RMRDC Staff Admin: richer researcher intelligence + staff-created investor technology records
-- Run after the existing RMRDC v3.2/v3 Research-to-Industry migrations.

-- Researcher-facing publication intelligence. These fields intentionally go beyond title/authors/abstract.
alter table public.publications add column if not exists research_significance text;
alter table public.publications add column if not exists key_findings text;
alter table public.publications add column if not exists methodology text;
alter table public.publications add column if not exists data_resources text;
alter table public.publications add column if not exists research_gaps text;
alter table public.publications add column if not exists research_implications text;
alter table public.publications add column if not exists context_geography text;
alter table public.publications add column if not exists keywords text[] default '{}';
alter table public.publications add column if not exists limitations text;
alter table public.publications add column if not exists recommended_for text;

-- Additional investor-ready technology intelligence used by the Staff Technology form.
alter table public.technology_opportunities add column if not exists product_consistency text;
alter table public.technology_opportunities add column if not exists shelf_life text;
alter table public.technology_opportunities add column if not exists input_output_yield text;
alter table public.technology_opportunities add column if not exists production_capacity text;
alter table public.technology_opportunities add column if not exists machinery_equipment text;
alter table public.technology_opportunities add column if not exists energy_requirement text;
alter table public.technology_opportunities add column if not exists utilities_requirement text;
alter table public.technology_opportunities add column if not exists waste_environmental_profile text;
alter table public.technology_opportunities add column if not exists laboratory_pilot_evidence text;
alter table public.technology_opportunities add column if not exists production_cost_text text;
alter table public.technology_opportunities add column if not exists raw_material_cost text;
alter table public.technology_opportunities add column if not exists operating_cost text;
alter table public.technology_opportunities add column if not exists expected_selling_price text;
alter table public.technology_opportunities add column if not exists profit_margin text;
alter table public.technology_opportunities add column if not exists expected_demand_cagr text;
alter table public.technology_opportunities add column if not exists payback_period text;
alter table public.technology_opportunities add column if not exists import_substitution_opportunity text;
alter table public.technology_opportunities add column if not exists raw_material_quantity text;
alter table public.technology_opportunities add column if not exists raw_material_seasonality text;
alter table public.technology_opportunities add column if not exists supplier_count text;
alter table public.technology_opportunities add column if not exists raw_material_market_price text;
alter table public.technology_opportunities add column if not exists transport_storage text;
alter table public.technology_opportunities add column if not exists raw_material_bottlenecks text;
alter table public.technology_opportunities add column if not exists patent_reference text;
alter table public.technology_opportunities add column if not exists patent_ownership text;
alter table public.technology_opportunities add column if not exists freedom_to_operate text;
alter table public.technology_opportunities add column if not exists licensing_terms text;
alter table public.technology_opportunities add column if not exists existing_licensees text;
alter table public.technology_opportunities add column if not exists nda_arrangement text;
alter table public.technology_opportunities add column if not exists international_standards text;
alter table public.technology_opportunities add column if not exists environmental_compliance text;
alter table public.technology_opportunities add column if not exists technical_support_after_engagement text;

create index if not exists publications_keywords_gin_idx on public.publications using gin(keywords);

-- Staff already have insert/update access through is_platform_staff() in the v3 migration.
-- This migration deliberately does not expose the sensitive technology columns through the public summary view.
