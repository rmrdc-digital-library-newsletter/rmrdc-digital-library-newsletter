
function showDemo(){document.getElementById('demoModal')?.classList.remove('hidden')}
function hideDemo(){document.getElementById('demoModal')?.classList.add('hidden')}
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideDemo()})
document.addEventListener('click',e=>{if(e.target.id==='demoModal')hideDemo()})
