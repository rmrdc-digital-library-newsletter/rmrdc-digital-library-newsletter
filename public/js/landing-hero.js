(function(){
  const root = document.querySelector('.ri-hero');
  if(!root) return;
  const bgA = root.querySelector('.ri-hero-bg-a');
  const bgB = root.querySelector('.ri-hero-bg-b');
  const copy = root.querySelector('.ri-hero-dynamic-copy');
  const kicker = root.querySelector('[data-hero-kicker]');
  const title = root.querySelector('[data-hero-title]');
  const text = root.querySelector('[data-hero-text]');
  const tag = root.querySelector('[data-hero-tag]');
  const dots = root.querySelector('.ri-hero-dots');
  const lawDisplay = root.querySelector('.ranganathan-law');
  const lawNumber = root.querySelector('#ranganathanLawNumber');
  const lawText = root.querySelector('#ranganathanLawText');
  const rotationInterval = 7000;
  if(!bgA || !bgB || !copy || !title || !text) return;

  const slides = [
    { image:'assets/images/library-bg3.jpg', kicker:'RMRDC RESEARCH-TO-INDUSTRY INTELLIGENCE', title:'Turning research into <span>industrial opportunity.</span>', text:'Discover research outputs, technologies, raw-material intelligence and commercialization opportunities through one connected RMRDC intelligence platform.', tag:'Research → Technology → Industry' },
    { image:'assets/images/library-bg4.jpg', kicker:'CONNECTING RESEARCH TO INVESTMENT', title:'Give investors the intelligence they need to <span>act with confidence.</span>', text:'Structured technology profiles bring together readiness, production economics, market potential, raw-material supply and intellectual property information.', tag:'Technology → Investment → Commercialisation' },
    { image:'assets/images/library-bg5.jpg', kicker:'RMRDC TECHNOLOGY INTELLIGENCE', title:'Move promising technologies from <span>discovery to deployment.</span>', text:'Bring patents, TIC products, pilot plants, APIs, pharmaceutical excipients and other RMRDC-developed assets into a searchable technology ecosystem.', tag:'Discover → Assess → Engage' },
    { image:'assets/images/library-bg2.jpg', kicker:'FABRICATION & ENGINEERING CONNECTION', title:'Connect technology with the <span>people who can build it.</span>', text:'Match researchers and investors with suitable fabricators and engineering partners for prototyping, equipment, pilot plants, scale-up and deployment.', tag:'Technology → Fabrication → Scale-up' },
    { image:'assets/images/library-bg.jpg', kicker:'RMRDC INSTITUTIONAL SYNERGY', title:'One platform for <span>research, raw materials and industry.</span>', text:'CAS and SDI-powered intelligence helps RMRDC connect knowledge, technologies, investors, industries and deployment partners around real opportunities.', tag:'Intelligence → Collaboration → Impact' }
  ];
  let current = 0, timer;
  slides.forEach(s=>{const img=new Image(); img.src=s.image;});

  slides.forEach((s,i)=>{
    const d=document.createElement('button');
    d.type='button'; d.className='ri-hero-dot'+(i===0?' active':'');
    d.setAttribute('aria-label','Show hero slide '+(i+1));
    d.addEventListener('click',()=>show(i,true));
    dots && dots.appendChild(d);
  });
  const dotEls = dots ? [...dots.children] : [];

  function show(index,manual){
    current=(index+slides.length)%slides.length;
    const s=slides[current];
    copy.classList.remove('is-visible');
    root.classList.add('is-transitioning');
    setTimeout(()=>{
      kicker.textContent=s.kicker;
      title.innerHTML=s.title;
      text.textContent=s.text;
      if(tag) tag.textContent=s.tag;
      const nextBg = bgA.classList.contains('active') ? bgB : bgA;
      nextBg.style.backgroundImage=`url('${s.image}')`;
      bgA.classList.toggle('active', nextBg===bgA);
      bgB.classList.toggle('active', nextBg===bgB);
      dotEls.forEach((d,i)=>d.classList.toggle('active',i===current));
      copy.classList.add('is-visible');
      root.classList.remove('is-transitioning');
    },450);
    if(manual) restart();
  }
  function restart(){clearInterval(timer); timer=setInterval(()=>show(current+1,false),rotationInterval);}
  const laws = [
    'Books are for use.',
    'Every reader their book.',
    'Every book its reader.',
    'Save the time of the reader.',
    'The library is a growing organism.'
  ];
  let currentLaw = 0, lawTimer;
  function showLaw(index) {
    if (!lawDisplay || !lawNumber || !lawText) return;
    currentLaw = (index + laws.length) % laws.length;
    lawDisplay.classList.add('is-changing');
    window.setTimeout(() => {
      lawNumber.textContent = `Law ${currentLaw + 1} of ${laws.length}`;
      lawText.textContent = laws[currentLaw];
      lawDisplay.classList.remove('is-changing');
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350);
  }
  function restartLaws() {
    if (!lawDisplay || laws.length < 2) return;
    clearInterval(lawTimer);
    lawTimer = setInterval(() => showLaw(currentLaw + 1), rotationInterval);
  }
  bgA.style.backgroundImage=`url('${slides[0].image}')`; bgA.classList.add('active');
  copy.classList.add('is-visible');
  restart();
  restartLaws();
  root.addEventListener('mouseenter',()=>{clearInterval(timer);clearInterval(lawTimer);});
  root.addEventListener('mouseleave',()=>{restart();restartLaws();});
  root.addEventListener('focusin',()=>{clearInterval(timer);clearInterval(lawTimer);});
  root.addEventListener('focusout',()=>{restart();restartLaws();});
  document.addEventListener('visibilitychange',()=>document.hidden? (clearInterval(timer),clearInterval(lawTimer)) : (restart(),restartLaws()));
})();
