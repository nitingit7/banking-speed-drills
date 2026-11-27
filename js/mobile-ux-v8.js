/* Phone-only exam layout corrections and question font controls. No scoring or data changes. */
(function(){'use strict';
  const exam=document.getElementById('screen-exam');
  if(!exam)return;
  const isPhone=()=>matchMedia('(max-width:767px)').matches;
  const q=document.getElementById('currentQues');
  const toolbar=document.createElement('div');toolbar.id='mobile-font-tools';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Question and option font size');
  let size=0;
  const small=document.createElement('button'),large=document.createElement('button');
  small.type=large.type='button';small.textContent='A−';large.textContent='A+';
  small.setAttribute('aria-label','Decrease question and option font size');
  large.setAttribute('aria-label','Increase question and option font size');
  small.title='Smaller question and options';large.title='Larger question and options';
  toolbar.append(small,large);q?.append(toolbar);
  let baseSize=18;
  const text=()=>document.querySelector('#quesAnsContent .textHighlighter')||document.querySelector('#quesAnsContent .opt-text');
  function applySize(){
    if(!size){document.body.classList.remove('bmt-font-adjusted');document.body.style.removeProperty('--bmt-q-font');}
    else{document.body.classList.add('bmt-font-adjusted');document.body.style.setProperty('--bmt-q-font',(baseSize+size)+'px');}
    small.disabled=baseSize+size<=12;large.disabled=baseSize+size>=32;
  }
  function change(delta){
    if(!size){const target=text();if(target){const actual=parseFloat(getComputedStyle(target).fontSize);if(Number.isFinite(actual)&&actual>0)baseSize=Math.round(actual)}}
    size=Math.max(12-baseSize,Math.min(32-baseSize,size+delta));applySize();
  }
  small.addEventListener('click',()=>change(-2));large.addEventListener('click',()=>change(2));
  // Keep the source layout intact on desktop. Move only the mobile Questions control.
  const timerBar=exam.querySelector('.headergrup .grup_components');
  const header=exam.querySelector('#sub-header');
  const palette=document.getElementById('mobile-palette-toggle');
  const label=document.createElement('span');label.id='mobile-subject-label';label.textContent='Speed Drill';
  timerBar?.prepend(label);
  function updateSubject(){
    // During live exams the VM sets this section label; Analyse is a read-only view.
    const active=document.querySelector('[id^="sectionId"].selectedsubject .sectionNameTxt');
    const other=document.querySelector('#sections .subject-name.selectedsubject .sectionName');
    const name=active?.textContent?.trim()||other?.textContent?.trim()||'Speed Drill';
    label.textContent=/^(Physics|Chemistry|Biology)$/i.test(name)?'Speed Drill':name;
  }
  function place(){
    if(!palette)return;
    if(isPhone()){
      const target=document.body.classList.contains('bankdrills-analyse-mode')?document.getElementById('analyse-top-bar'):timerBar;
      if(target&&palette.parentElement!==target)target.append(palette);
    }else if(palette.parentElement!==exam)exam.append(palette);
    syncHeight();
  }
  function syncHeight(){
    if(!isPhone()||!q)return;
    const top=q.getBoundingClientRect().top;
    if(!(top>=0&&top<innerHeight))return;
    const remaining=Math.max(140,innerHeight-top-115-7);
    q.style.setProperty('--bmt-v8-available-height',Math.round(remaining)+'px');
  }
  // Read changes only; no background timers or server activity.
  let pending=false;
  function requestLayout(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;updateSubject();place();syncHeight()})}
  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(()=>requestLayout());
    for(const el of [header,timerBar,exam.querySelector('.headergrup')])if(el)observer.observe(el);
  }
  window.addEventListener('resize',requestLayout);
  document.addEventListener('DOMContentLoaded',requestLayout,{once:true});
  // Real renderer updates the section buttons dynamically. Observe that source UI, not question answers.
  const sections=document.getElementById('sections');
  if(sections){new MutationObserver(()=>requestLayout()).observe(sections,{subtree:true,characterData:true,childList:true});}
  // Analyse starts asynchronously: its mode class is added after the VM returns.
  new MutationObserver(requestLayout).observe(document.body,{attributes:true,attributeFilter:['class']});
  applySize();requestLayout();
})();
