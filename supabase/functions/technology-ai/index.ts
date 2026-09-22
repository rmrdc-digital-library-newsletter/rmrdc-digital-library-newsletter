import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins=(Deno.env.get("CORS_ALLOWED_ORIGINS")||"http://localhost:5501,http://127.0.0.1:5501").split(',').map(x=>x.trim()).filter(Boolean);
const responseHeaders=(req:Request)=>({"Access-Control-Allow-Origin":allowedOrigins.includes(req.headers.get('origin')||'')?req.headers.get('origin')||'':allowedOrigins[0],"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"});
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:responseHeaders(req)});

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:responseHeaders(req)});
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return json(req,{error:"Authentication required"},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,key=Deno.env.get("GEMINI_API_KEY");
  if(!key)return json(req,{error:"AI service is not configured"},503);
  const db=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user}}=await db.auth.getUser(token);if(!user)return json(req,{error:"Authentication required"},401);
  const body=await req.json().catch(()=>({}));const question=String(body.question||"").trim();const technologyId=String(body.technology_id||body.technologyId||"");
  if(!question||!technologyId)return json(req,{error:"question and technology_id are required"},400);
  const {data:chunks,error:chunkError}=await db.rpc("retrieve_technology_document_context",{p_technology_id:technologyId,p_query:question,p_limit:12});
  if(chunkError)return json(req,{error:"Document retrieval failed"},502);
  const {data:technology}=await db.from("public_technology_opportunities").select("id,title,sector,trl,short_summary,problem_addressed,raw_material_availability,patent_ip_status,commercialisation_status").eq("id",technologyId).maybeSingle();
  if(!chunks?.length&&!technology)return json(req,{answer:"That information is not available in the RMRDC documents.",sources:[]});
  const context=(chunks||[]).map((chunk:any)=>`SOURCE: ${chunk.source_filename}, page ${chunk.page_number}\n${chunk.content}`).join("\n\n").slice(0,50000);
  const prompt=`You are the RMRDC Investor Technology Assistant. Answer only from the RMRDC technology record and document evidence below. Do not use general knowledge, do not infer missing technical/commercial/IP/financial facts, and do not reveal any content absent from the supplied context. If the answer is absent, say exactly: "That information is not available in the RMRDC documents." Include a short Sources section listing only citations present in the evidence.\n\nTechnology record:\n${JSON.stringify(technology||{})}\n\nDocument evidence:\n${context}\n\nInvestor question:\n${question}`;
  try{
    const model=Deno.env.get("GEMINI_MODEL")||"gemini-2.5-flash";
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.1,maxOutputTokens:1200}})});
    if(!response.ok)throw new Error(await response.text());
    const result=await response.json();const answer=result?.candidates?.[0]?.content?.parts?.[0]?.text||"That information is not available in the RMRDC documents.";
    return json(req,{answer,sources:(chunks||[]).map((x:any)=>({filename:x.source_filename,page:x.page_number}))});
  }catch(error){return json(req,{error:"The RMRDC AI service is temporarily unavailable."},502)}
});
