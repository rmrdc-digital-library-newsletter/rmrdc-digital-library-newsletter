
(function(){
const track=document.getElementById('popularCoverTrack');

function esc(v=''){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function card(pub){
return `<a class="popular-cover-card" href="viewer.html?id=${encodeURIComponent(pub.id)}">
<img src="${esc(pub.cover_url || 'assets/placeholder-cover.svg')}" alt="${esc(pub.title || 'Publication')}">
<span>${esc(pub.title || 'Untitled')}</span>
</a>`;
}

async function loadPopular(){
 if(!track)return;
 try{
   let data=[];
   if(window.db){
      let res=await window.db.from('publications_with_stats').select('*').order('view_count',{ascending:false}).limit(12);
      data=res.data||[];
      if(!data.length){
         let fb=await window.db.from('publications').select('*').limit(12);
         data=fb.data||[];
      }
   }
   if(!data.length){
      track.innerHTML='<div class="popular-loading">No publications available.</div>';
      return;
   }
   const items=[...data,...data];
   track.innerHTML=items.map(card).join('');
 }catch(e){
   console.warn(e);
 }
}
document.addEventListener('DOMContentLoaded',loadPopular);
})();
