
(function(){
const track=document.getElementById('popularCoverTrack');
let rafId=null;
let offset=0;
let speed=0.7;
let isPaused=false;
let isDragging=false;
let dragStartX=0;
let dragStartOffset=0;
let lastX=0;
let lastTime=0;
let pointerId=null;
function esc(v=''){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function card(pub){
  const title=esc(pub.title || 'Untitled');
  const cover=esc(pub.cover_url || 'assets/placeholder-cover.svg');

  return `
    <article class="popular-cover-slide">
      <a class="popular-cover-card" href="viewer.html?id=${encodeURIComponent(pub.id)}" aria-label="${title}">
        <div class="popular-cover-visual">
          <img src="${cover}" alt="${title}" loading="lazy">
          <div class="popular-cover-overlay">
            <div class="popular-cover-overlay-content">
              <span class="popular-cover-eye">👁</span>
              <p>View Details</p>
            </div>
          </div>
        </div>
      </a>
    </article>
  `;
}

function applyTransform(){
  if(!track)return;
  track.style.transform=`translate3d(${offset}px,0,0)`;
}

function setSpeed(){
  if(!track)return;
  const width=Math.max(track.scrollWidth/2,1);
  speed=width>0?width/18000:1;
}

function frame(now){
  if(!track)return;
  const delta=now-lastTime;
  if(delta>0 && !isPaused && !isDragging){
    offset-=speed*delta;
    const halfWidth=track.scrollWidth/2;
    if(Math.abs(offset)>=halfWidth){
      offset+=halfWidth;
    }
    applyTransform();
  }
  lastTime=now;
  rafId=requestAnimationFrame(frame);
}

function startAnimation(){
  if(rafId) cancelAnimationFrame(rafId);
  lastTime=performance.now();
  rafId=requestAnimationFrame(frame);
}

function pauseAnimation(){
  isPaused=true;
}

function resumeAnimation(){
  if(isDragging)return;
  isPaused=false;
  lastTime=performance.now();
}

function beginDrag(event){
  if(event.button!==0)return;
  isDragging=true;
  isPaused=true;
  pointerId=event.pointerId;
  dragStartX=event.clientX;
  dragStartOffset=offset;
  lastX=event.clientX;
  track.setPointerCapture(pointerId);
}

function moveDrag(event){
  if(!isDragging || event.pointerId!==pointerId)return;
  const delta=event.clientX-lastX;
  offset=dragStartOffset+delta;
  applyTransform();
  lastX=event.clientX;
}

function endDrag(event){
  if(!isDragging || event.pointerId!==pointerId)return;
  isDragging=false;
  isPaused=false;
  lastTime=performance.now();
  if(track.hasPointerCapture(pointerId)){
    track.releasePointerCapture(pointerId);
  }
  pointerId=null;
}

function bindInteractions(){
  if(!track)return;
  track.addEventListener('mouseenter',pauseAnimation);
  track.addEventListener('mouseleave',resumeAnimation);
  track.addEventListener('pointerdown',beginDrag);
  track.addEventListener('pointermove',moveDrag);
  track.addEventListener('pointerup',endDrag);
  track.addEventListener('pointercancel',endDrag);
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
   setSpeed();
   applyTransform();
   bindInteractions();
   startAnimation();
 }catch(e){
   console.warn(e);
 }
}

window.addEventListener('resize',()=>{
  if(!track)return;
  setSpeed();
  applyTransform();
});

document.addEventListener('DOMContentLoaded',loadPopular);
})();
