import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins=(Deno.env.get("CORS_ALLOWED_ORIGINS")||"http://localhost:5501,http://127.0.0.1:5501").split(',').map(x=>x.trim()).filter(Boolean);
const responseHeaders=(req:Request)=>({"Access-Control-Allow-Origin":allowedOrigins.includes(req.headers.get('origin')||'')?req.headers.get('origin')||'':allowedOrigins[0],"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-internal-processing-secret","Content-Type":"application/json"});
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:responseHeaders(req)});

async function gemini(prompt:string){
  const key=Deno.env.get("GEMINI_API_KEY");
  if(!key) throw new Error("GEMINI_API_KEY is not configured");
  const model=Deno.env.get("GEMINI_MODEL")||"gemini-2.5-flash";
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.1,responseMimeType:"application/json",maxOutputTokens:3000}})});
  if(!response.ok)throw new Error(`Gemini request failed: ${await response.text()}`);
  const data=await response.json();
  const text=data?.candidates?.[0]?.content?.parts?.[0]?.text||"{}";
  return JSON.parse(text.replace(/^```json\s*|\s*```$/g,""));
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:responseHeaders(req)});
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  const internal=Boolean(Deno.env.get('DOCUMENT_PROCESSING_INTERNAL_SECRET')&&req.headers.get('X-Internal-Processing-Secret')===Deno.env.get('DOCUMENT_PROCESSING_INTERNAL_SECRET'));
  if(!token&&!internal)return json(req,{error:"Authentication required"},401);
  const url=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")||serviceKey,{global:{headers:{Authorization:`Bearer ${token||serviceKey}`}}});
  const {data:{user}}=token?await userClient.auth.getUser(token):{data:{user:null}};
  if(!internal&&!user)return json(req,{error:"Authentication required"},401);
  const {data:isStaff}=internal?{data:true}:await userClient.rpc("is_platform_staff");
  if(!isStaff)return json(req,{error:"Staff authorization required"},403);
  const body=await req.json().catch(()=>({}));
  const documentId=String(body.document_id||"");
  if(!documentId)return json(req,{error:"document_id is required"},400);
  const admin=createClient(url,serviceKey);
  const {data:document,error:documentError}=await admin.from("technology_documents").select("*").eq("id",documentId).single();
  if(documentError||!document)return json(req,{error:"Document not found"},404);
  const previousStatus=document.status;
  const {data:job,error:jobError}=await admin.from("document_processing_jobs").insert({document_id:documentId,status:"processing",attempts:1,started_at:new Date().toISOString(),requested_by:user?.id||null}).select("id").single();
  if(jobError){
    if(jobError.code==='23505')return json(req,{status:'already_processing',document_id:documentId},202);
    console.error("Could not create document processing job:", jobError);
    return json(req,{error:"Document processing could not be started. Please try again later."},500);
  }
  await admin.from('technology_documents').update({last_error:null,updated_at:new Date().toISOString()}).eq('id',documentId);
  try{
    const {data:signed,error:signedError}=await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path,600);
    if(signedError||!signed?.signedUrl)throw new Error("Could not create a private document URL");
    const worker=await fetch(`${Deno.env.get("PADDLEOCR_SERVICE_URL")}/process`,{method:"POST",headers:{"Content-Type":"application/json","X-Worker-Secret":Deno.env.get("PADDLEOCR_WORKER_SECRET")||""},body:JSON.stringify({document_id:documentId,technology_id:document.technology_id,source_url:signed.signedUrl,source_name:document.filename,source_hash:document.source_hash})});
    if(!worker.ok)throw new Error(`PaddleOCR-VL failed: ${await worker.text()}`);
    const extraction=await worker.json();
    const chunks=(extraction.pages||[]).map((page:any,index:number)=>({document_id:documentId,technology_id:document.technology_id,page_number:page.page_number||index+1,chunk_index:index,section:"document",content:String(page.content||"").slice(0,50000),structured_content:page.structured||{},access_tier:document.access_tier,source_filename:document.filename})).filter((x:any)=>x.content.trim());
    if(!chunks.length){const emptyStatus=previousStatus==='completed'?'completed':'empty';await admin.from("technology_documents").update({status:emptyStatus,page_count:extraction.page_count||0,last_error:"No extractable content"}).eq("id",documentId);await admin.from("document_processing_jobs").update({status:previousStatus==='completed'?'failed':'empty',completed_at:new Date().toISOString(),error:"No extractable content"}).eq("id",job.id);return json(req,{status:"empty",document_id:documentId})}
    const source=chunks.map((x:any)=>`[${x.source_filename}, page ${x.page_number}]\n${x.content}`).join("\n\n").slice(0,100000);
    const fields=await gemini(`You are RMRDC's evidence-grounded technology dossier extractor. Extract only facts explicitly stated in the supplied evidence. Do not infer missing facts. Keep units with costs and quantities. Use null for missing scalar values and [] for missing lists. Return JSON only.

Required keys: technology_name, category, sector, abstract, executive_summary, problem, technology_description, product_specification, product_consistency, shelf_life, input_output_yield, trl, raw_materials, raw_material_locations, raw_material_availability, raw_material_quantity, raw_material_seasonality, supplier_count, raw_material_market_price, raw_material_bottlenecks, transport_storage, applications, production_process, production_capacity, target_industries, machinery_equipment, energy_requirement, utilities_requirement, waste_environmental_profile, laboratory_pilot_evidence, prototype_status, demonstration_results, production_cost, raw_material_cost, operating_cost, investment_requirements, expected_selling_price, profit_margin, market_size, expected_demand_cagr, payback_period, import_substitution_opportunity, market_opportunity, ip_status, patent_information, patent_reference, patent_ownership, freedom_to_operate, licensing_terms, existing_licensees, nda_arrangement, commercialisation_status, research_institution, research_team, contact_information, engagement_models, regulatory_status, international_standards, environmental_compliance, pilot_plant_availability, existing_partnerships, fabrication_requirements, scale_up_requirements, technical_support_after_engagement, benefits, environmental_social_benefits, citations.

TRL rules: return an integer 1-9 only when the evidence supports it. Laboratory-only work is usually 4, pilot work 5-6, system demonstration 7, qualified system 8, and commercial operation 9.
IP rules: use patent granted, patent pending, proprietary know-how, open / unprotected, or not assessed only where supported. Put patent numbers in patent_reference.
Every populated value should have supporting evidence. Put field-level citations in citations keyed by field name when possible.

Document evidence:
${source}`);
    const promotion=await admin.rpc('promote_document_processing',{p_document_id:documentId,p_job_id:job.id,p_technology_id:document.technology_id,p_access_tier:document.access_tier,p_filename:document.filename,p_chunks:chunks,p_fields:fields,p_abstract:fields.abstract||null,p_executive_summary:fields.executive_summary||null,p_citations:fields.citations||[],p_model:Deno.env.get("GEMINI_MODEL")||"gemini-2.5-flash"});
    if(promotion.error)throw new Error(`Document promotion failed: ${promotion.error.message}`);
    if(document.technology_id){
      const {data:existing}=await admin.from("technology_opportunities").select("*").eq("id",document.technology_id).maybeSingle();
      const patch:any={};
      const setIfMissing=(column:string,value:any)=>{if(value!==null&&value!==undefined&&value!==''&&(!existing?.[column]||(Array.isArray(existing[column])&&!existing[column].length)))patch[column]=value};
      const numberIfValid=(value:any)=>{if(typeof value==='number'&&Number.isFinite(value))return value;const parsed=typeof value==='string'?Number(value.replace(/[^0-9.-]/g,'')):NaN;return Number.isFinite(parsed)?parsed:null};
      const textValue=(value:any)=>typeof value==='string'?value.trim():Array.isArray(value)?value.join(', '):typeof value==='number'?String(value):null;
      const listValue=(value:any)=>Array.isArray(value)?value.filter(Boolean):typeof value==='string'?value.split(/[,;\n]/).map((item:string)=>item.trim()).filter(Boolean):[];
      setIfMissing('title',textValue(fields.technology_name));setIfMissing('sector',textValue(fields.sector));setIfMissing('category',textValue(fields.category));
      setIfMissing('abstract',textValue(fields.abstract));setIfMissing('executive_summary',textValue(fields.executive_summary));setIfMissing('short_summary',textValue(fields.abstract||fields.problem));setIfMissing('problem_addressed',textValue(fields.problem));setIfMissing('technical_specifications',textValue(fields.technology_description||fields.product_specification));
      setIfMissing('trl',Number.isInteger(fields.trl)&&fields.trl>=1&&fields.trl<=9?fields.trl:null);
      setIfMissing('raw_materials',listValue(fields.raw_materials));setIfMissing('raw_material_locations',listValue(fields.raw_material_locations));setIfMissing('raw_material_availability',textValue(fields.raw_material_availability));setIfMissing('raw_material_quantity',textValue(fields.raw_material_quantity));setIfMissing('raw_material_seasonality',textValue(fields.raw_material_seasonality));setIfMissing('supplier_count',textValue(fields.supplier_count));setIfMissing('raw_material_market_price',textValue(fields.raw_material_market_price));setIfMissing('raw_material_bottlenecks',textValue(fields.raw_material_bottlenecks));setIfMissing('transport_storage',textValue(fields.transport_storage));
      setIfMissing('production_process',textValue(fields.production_process));setIfMissing('production_capacity',textValue(fields.production_capacity));setIfMissing('machinery_equipment',textValue(fields.machinery_equipment));setIfMissing('energy_requirement',textValue(fields.energy_requirement));setIfMissing('utilities_requirement',textValue(fields.utilities_requirement));setIfMissing('waste_environmental_profile',textValue(fields.waste_environmental_profile||fields.environmental_social_benefits));setIfMissing('laboratory_pilot_evidence',textValue(fields.laboratory_pilot_evidence));setIfMissing('product_consistency',textValue(fields.product_consistency));setIfMissing('shelf_life',textValue(fields.shelf_life));setIfMissing('input_output_yield',textValue(fields.input_output_yield));
      setIfMissing('production_cost_text',textValue(fields.production_cost));setIfMissing('raw_material_cost',textValue(fields.raw_material_cost));setIfMissing('operating_cost',textValue(fields.operating_cost));setIfMissing('estimated_investment',numberIfValid(fields.investment_requirements));setIfMissing('expected_selling_price',textValue(fields.expected_selling_price));setIfMissing('profit_margin',textValue(fields.profit_margin));setIfMissing('market_size',numberIfValid(fields.market_size));setIfMissing('expected_demand_cagr',textValue(fields.expected_demand_cagr));setIfMissing('payback_period',textValue(fields.payback_period));setIfMissing('import_substitution_opportunity',textValue(fields.import_substitution_opportunity));setIfMissing('market_summary',textValue(fields.market_opportunity));
      setIfMissing('patent_ip_status',textValue(fields.ip_status||fields.patent_information));setIfMissing('patent_reference',textValue(fields.patent_reference||fields.patent_information));setIfMissing('patent_ownership',textValue(fields.patent_ownership));setIfMissing('freedom_to_operate',textValue(fields.freedom_to_operate));setIfMissing('licensing_terms',textValue(fields.licensing_terms));setIfMissing('existing_licensees',textValue(fields.existing_licensees));setIfMissing('nda_arrangement',textValue(fields.nda_arrangement));setIfMissing('commercialisation_status',textValue(fields.commercialisation_status));setIfMissing('regulatory_status',textValue(fields.regulatory_status));setIfMissing('international_standards',textValue(fields.international_standards));setIfMissing('environmental_compliance',textValue(fields.environmental_compliance));setIfMissing('prototype_status',textValue(fields.prototype_status));setIfMissing('pilot_plant_availability',textValue(fields.pilot_plant_availability));setIfMissing('demonstration_results',textValue(fields.demonstration_results));setIfMissing('existing_partnerships',textValue(fields.existing_partnerships));setIfMissing('fabrication_requirements',textValue(fields.fabrication_requirements));setIfMissing('scale_up_requirements',textValue(fields.scale_up_requirements));setIfMissing('technical_support_after_engagement',textValue(fields.technical_support_after_engagement));setIfMissing('engagement_models',listValue(fields.engagement_models));setIfMissing('researcher_name',textValue(Array.isArray(fields.research_team)?fields.research_team.join(', '):fields.research_team));setIfMissing('institution',textValue(fields.research_institution));
      if(Object.keys(patch).length)await admin.from('technology_opportunities').update(patch).eq('id',document.technology_id);
    }
    await admin.from("technology_documents").update({status:"completed",page_count:extraction.page_count||chunks.length,last_processed_at:new Date().toISOString(),last_error:null,source_hash:extraction.source_hash||document.source_hash}).eq("id",documentId);
    await admin.from("document_processing_jobs").update({status:"completed",completed_at:new Date().toISOString(),error:null}).eq("id",job.id);
    return json(req,{status:"completed",document_id:documentId,pages:chunks.length});
  }catch(error){const message=error instanceof Error?error.message:"Document processing failed";console.error("Document processing failed:",error);const preservedStatus=previousStatus==='completed'?'completed':'failed';await admin.from("technology_documents").update({status:preservedStatus,last_error:message}).eq("id",documentId);if(job?.id)await admin.from("document_processing_jobs").update({status:"failed",completed_at:new Date().toISOString(),error:message}).eq("id",job.id);return json(req,{status:"failed",document_id:documentId,error:"Document processing failed. Please try again later."},502)}
});
