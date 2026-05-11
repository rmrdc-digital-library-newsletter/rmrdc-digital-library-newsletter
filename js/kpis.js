
(function(){
function animate(id,target){
 const el=document.getElementById(id);
 if(!el)return;
 if(String(target).includes('K')){el.textContent=target;return;}
 let start=0,end=Number(target)||0,dur=1200,startTime=null;
 function step(ts){
   if(!startTime)startTime=ts;
   const p=Math.min((ts-startTime)/dur,1);
   el.textContent=Math.floor(p*end).toLocaleString();
   if(p<1)requestAnimationFrame(step);
 }
 requestAnimationFrame(step);
}
async function loadKPIs(){
 try{
   let pubs=0,users=0;
   if(window.db){
     const p=await window.db.from('publications').select('*',{count:'exact',head:true});
     const u=await window.db.from('profiles').select('*',{count:'exact',head:true});
     pubs=p.count||0;
     users=u.count||0;
   }
   animate('kpiPublications',pubs);
   animate('kpiReaders',users);
   animate('kpiDownloads','1.2K');
   animate('kpiMostRead',850);
 }catch(e){console.warn(e);}
}
document.addEventListener('DOMContentLoaded',loadKPIs);
})();
