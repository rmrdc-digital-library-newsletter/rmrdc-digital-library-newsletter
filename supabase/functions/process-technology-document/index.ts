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
    return json(req,{error:`Could not create processing job: ${jobError.message}`},500);
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
    const source=chunks.map((x:any)=>`[${x.source_filename}, page ${x.page_number}]\n${x.content}`).join("\n\n").slice(0,60000);
    const fields=await gemini(`You are extracting factual RMRDC technology information. Use ONLY the document evidence below. Never guess. Use null or [] when absent. Every populated field must include a citation object with filename and page. Return JSON only with keys technology_name, abstract, executive_summary, problem, technology_description, trl, raw_materials, raw_material_locations, raw_material_availability, applications, production_process, production_capacity, target_industries, ip_status, patent_information, commercialisation_status, investment_requirements, benefits, environmental_social_benefits, research_institution, research_team, contact_information, engagement_models, machinery_equipment, energy_requirement, utilities_requirement, laboratory_pilot_evidence, production_cost, market_size, market_opportunity, regulatory_status, patent_reference, citations.\n\nDocument evidence:\n${source}`);
    const promotion=await admin.rpc('promote_document_processing',{p_document_id:documentId,p_job_id:job.id,p_technology_id:document.technology_id,p_access_tier:document.access_tier,p_filename:document.filename,p_chunks:chunks,p_fields:fields,p_abstract:fields.abstract||null,p_executive_summary:fields.executive_summary||null,p_citations:fields.citations||[],p_model:Deno.env.get("GEMINI_MODEL")||"gemini-2.5-flash"});
    if(promotion.error)throw new Error(`Document promotion failed: ${promotion.error.message}`);
    if(document.technology_id){
      const {data:existing}=await admin.from("technology_opportunities").select("*").eq("id",document.technology_id).maybeSingle();
      const patch:any={};
      const setIfMissing=(column:string,value:any)=>{if(value!==null&&value!==undefined&&value!==''&&(!existing?.[column]||(Array.isArray(existing[column])&&!existing[column].length)))patch[column]=value};
      const numberIfValid=(value:any)=>typeof value==='number'&&Number.isFinite(value)?value:null;
      setIfMissing('title',fields.technology_name);setIfMissing('abstract',fields.abstract);setIfMissing('executive_summary',fields.executive_summary);setIfMissing('short_summary',fields.abstract);setIfMissing('problem_addressed',fields.problem);setIfMissing('technical_specifications',fields.technology_description);setIfMissing('trl',Number.isInteger(fields.trl)?fields.trl:null);setIfMissing('raw_materials',fields.raw_materials);setIfMissing('raw_material_locations',fields.raw_material_locations);setIfMissing('raw_material_availability',fields.raw_material_availability);setIfMissing('production_process',fields.production_process);setIfMissing('production_capacity',fields.production_capacity);setIfMissing('machinery_equipment',fields.machinery_equipment);setIfMissing('energy_requirement',fields.energy_requirement);setIfMissing('utilities_requirement',fields.utilities_requirement);setIfMissing('waste_environmental_profile',fields.environmental_social_benefits);setIfMissing('laboratory_pilot_evidence',fields.laboratory_pilot_evidence);setIfMissing('commercialisation_status',fields.commercialisation_status);setIfMissing('patent_ip_status',fields.ip_status||fields.patent_information);setIfMissing('patent_reference',fields.patent_information);setIfMissing('regulatory_status',fields.regulatory_status);setIfMissing('engagement_models',fields.engagement_models);setIfMissing('researcher_name',Array.isArray(fields.research_team)?fields.research_team.join(', '):fields.research_team);setIfMissing('institution',fields.research_institution);setIfMissing('production_cost',numberIfValid(fields.production_cost));setIfMissing('estimated_investment',numberIfValid(fields.investment_requirements));setIfMissing('market_size',numberIfValid(fields.market_size));setIfMissing('market_summary',fields.market_opportunity);
      if(Object.keys(patch).length)await admin.from('technology_opportunities').update(patch).eq('id',document.technology_id);
    }
    await admin.from("technology_documents").update({status:"completed",page_count:extraction.page_count||chunks.length,last_processed_at:new Date().toISOString(),last_error:null,source_hash:extraction.source_hash||document.source_hash}).eq("id",documentId);
    await admin.from("document_processing_jobs").update({status:"completed",completed_at:new Date().toISOString(),error:null}).eq("id",job.id);
    return json(req,{status:"completed",document_id:documentId,pages:chunks.length});
  }catch(error){const message=error instanceof Error?error.message:"Document processing failed";const preservedStatus=previousStatus==='completed'?'completed':'failed';await admin.from("technology_documents").update({status:preservedStatus,last_error:message}).eq("id",documentId);if(job?.id)await admin.from("document_processing_jobs").update({status:"failed",completed_at:new Date().toISOString(),error:message}).eq("id",job.id);return json(req,{status:"failed",document_id:documentId,error:message},502)}
});
