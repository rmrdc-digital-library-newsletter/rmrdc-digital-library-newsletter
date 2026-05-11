const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

async function sendEmail(enquiry:any){
  const key=Deno.env.get("RESEND_API_KEY"), admin=Deno.env.get("ADMIN_EMAIL");
  if(!key||!admin) return {skipped:true,reason:"Missing email secrets"};
  const html=`<h2>New RMRDC CAS Enquiry</h2>
  <p><b>Name:</b> ${enquiry.full_name}</p><p><b>Email:</b> ${enquiry.email}</p>
  <p><b>Phone:</b> ${enquiry.phone}</p><p><b>Type:</b> ${enquiry.enquiry_type}</p>
  <p><b>Message:</b><br>${String(enquiry.message).replaceAll("\n","<br>")}</p>`;
  const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from:"RMRDC CAS <onboarding@resend.dev>",to:[admin],subject:`New RMRDC CAS Enquiry: ${enquiry.enquiry_type}`,html})});
  if(!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function sendWhatsApp(enquiry:any){
  const token=Deno.env.get("WHATSAPP_TOKEN"), phoneId=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"), admin=Deno.env.get("ADMIN_WHATSAPP_NUMBER");
  if(!token||!phoneId||!admin) return {skipped:true,reason:"Missing WhatsApp secrets"};
  const body=`New RMRDC CAS Enquiry\n\nName: ${enquiry.full_name}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone}\nType: ${enquiry.enquiry_type}\n\nMessage: ${enquiry.message}`;
  const res=await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:admin,type:"text",text:{body}})});
  if(!res.ok) throw new Error(await res.text());
  return await res.json();
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  try{
    const {enquiry}=await req.json();
    if(!enquiry) throw new Error("Missing enquiry");
    const results={
      email:await sendEmail(enquiry).catch(e=>({error:String(e.message||e)})),
      whatsapp:await sendWhatsApp(enquiry).catch(e=>({error:String(e.message||e)}))
    };
    return new Response(JSON.stringify({ok:true,results}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(e){
    return new Response(JSON.stringify({error:String(e.message||e)}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});