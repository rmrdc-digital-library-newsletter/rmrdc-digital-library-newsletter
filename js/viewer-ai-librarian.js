(function(){
const form=document.getElementById('viewerAiForm'), input=document.getElementById('viewerAiInput'), msgs=document.getElementById('viewerAiMessages');
const id=()=>new URLSearchParams(location.search).get('id');
function add(t,w='bot'){const d=document.createElement('div');d.className='ai-message '+w;d.textContent=t;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}
async function ask(q){
 for(const fn of ['ai-librarian','ask-ai-librarian','rag-librarian','chat-with-publication']){
  try{const {data,error}=await window.db.functions.invoke(fn,{body:{question:q,publication_id:id()}}); if(!error&&(data?.answer||data?.message||data?.response)) return data.answer||data.message||data.response;}catch(e){}
 }
 const {data:pub,error}=await window.db.from('publications_with_stats').select('*').eq('id',id()).single(); if(error) throw error;
 const l=q.toLowerCase();
 if(l.includes('isbn')) return pub.isbn?`The ISBN is ${pub.isbn}.`:'No ISBN is recorded.';
 if(l.includes('doi')) return pub.doi?`The DOI is ${pub.doi}.`:'No DOI is recorded.';
 if(l.includes('author')) return pub.authors?`Author(s): ${pub.authors}.`:'No author information is recorded.';
 return pub.abstract||`This publication is titled "${pub.title}".`;
}
form?.addEventListener('submit',async e=>{e.preventDefault();const q=input.value.trim();if(!q)return;add(q,'user');input.value='';add('Searching this publication...','bot');try{msgs.lastChild.textContent=await ask(q);}catch(err){msgs.lastChild.textContent='I could not query this publication right now.';}});
})();