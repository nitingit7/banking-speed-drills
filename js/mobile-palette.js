/* Mobile-only layout controls; uses the unchanged exam/navigation handlers. */
(function(){
  'use strict';
  const screen = document.getElementById('screen-exam');
  const right = document.getElementById('rightDivision');
  if (!screen || !right) return;
  const drawerButton = document.createElement('button');
  drawerButton.id = 'mobile-palette-toggle';
  drawerButton.type = 'button';
  drawerButton.textContent = '☷ Questions';
  drawerButton.setAttribute('aria-label','Open question palette');
  drawerButton.setAttribute('aria-expanded','false');
  drawerButton.setAttribute('aria-controls','rightDivision');
  const closeButton = document.createElement('button');
  closeButton.id = 'mobile-palette-close';
  closeButton.type = 'button';
  closeButton.textContent = '✕ Close';
  closeButton.setAttribute('aria-label','Close question palette');
  const backdrop = document.createElement('div');
  backdrop.id = 'mobile-palette-backdrop';
  backdrop.setAttribute('aria-hidden','true');
  screen.append(drawerButton,backdrop);
  right.prepend(closeButton);
  const isPhone = () => window.matchMedia('(max-width:767px)').matches;
  function setOpen(open) {
    const yes=!!(open&&isPhone());
    document.body.classList.toggle('mobile-palette-open',yes);
    drawerButton.setAttribute('aria-expanded',String(yes));
    drawerButton.setAttribute('aria-label',yes?'Close question palette':'Open question palette');
    if(yes) closeButton.focus({preventScroll:true});
    else if(open===false&&isPhone()) drawerButton.focus({preventScroll:true});
  }
  drawerButton.addEventListener('click',()=>setOpen(!document.body.classList.contains('mobile-palette-open')));
  closeButton.addEventListener('click',()=>setOpen(false));
  backdrop.addEventListener('click',()=>setOpen(false));
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape'&&document.body.classList.contains('mobile-palette-open'))setOpen(false);
  });
  // Clicking one of the original question tiles performs the existing navigation.
  right.addEventListener('click',(e)=>{
    if(!isPhone()||!document.body.classList.contains('mobile-palette-open'))return;
    if(e.target.closest('.numpan,[id^="qtd"]')){
      // Do not intercept/cancel the original question handler.
      window.setTimeout(()=>setOpen(false),0);
    }
  });
  window.addEventListener('resize',()=>{if(!isPhone())setOpen(false)});
})();
