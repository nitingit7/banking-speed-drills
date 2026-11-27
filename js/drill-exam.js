/* Live drill controller for the EXACT original exam.html DOM/CSS supplied by user.
   Original js/exam.js is intentionally NOT loaded: it uses client-side question banks,
   local scoring and clock. PocketBase exclusively owns questions/answers/timing. */
(function(){
  'use strict';
  const $=name=>document.getElementById(name);
  const pendingKey='bankdrills_pending_start_v1';
  const params=new URLSearchParams(location.search);
  let attemptId=params.get('attempt'), pending=null, state=null, offset=0;
  let busy=false,refreshing=false,saveQueue=Promise.resolve(),lastChoice=null;
  let nextExpiryRefresh=0;
  let started=false;
  const create=(name,cls,text)=>{const el=document.createElement(name);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
  const selectors=(sel,cb)=>document.querySelectorAll(sel).forEach(cb);
  const setText=(sel,s)=>selectors(sel,x=>x.textContent=String(s));
  function warn(message){
    let el=$('drill-error');
    if(!el){el=create('div');el.id='drill-error';el.setAttribute('role','alert');el.style.cssText='position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:100000003;background:#fff5f5;border:1px solid #bf3333;color:#921616;padding:12px 18px;box-shadow:0 3px 16px #0003;max-width:min(90vw,650px);font:14px Arial';document.body.appendChild(el)}
    el.textContent=String(message?.message||message);clearTimeout(el._timeout);el._timeout=setTimeout(()=>el.remove(),6000);
  }
  function showScreen(name){
    for(const s of ['instructions','declaration','exam']){const el=$('screen-'+s);if(el)el.style.display=name===s?'block':'none'}
    // Returning from the original bottom-placed Next button must not hide the table.
    window.scrollTo(0,0);document.body.scrollTop=0;document.documentElement.scrollTop=0;
    const activeBody=$(name==='instructions'?'instructions-body':name==='declaration'?'declaration-body':'quesAnsContent');
    if(activeBody)activeBody.scrollTop=0;
  }
  function applyIdentity(){
    const name=DrillAPI.auth()?.displayName||'Candidate';
    setText('.instMockName, .mockName','Banking Speed Drill');
    setText('.candOrigName, .candOriginalName, .userName1, .decl-cand-name',name);
    setText('.mockCandId','Private Practice');
    if($('exam_name_h1'))$('exam_name_h1').textContent='BANKING SPEED DRILL';
  }
  function durationText(sec){const m=Math.floor(sec/60),rem=sec%60;return m+' min'+(rem?' '+rem+' sec':'')}
  function setDuration(){
    const count=pending?.count||state?.total||0,per=pending?.seconds||state?.seconds_per_question||45;
    setText('.completeDuration',durationText(count*per));
    const text=$('instructions-body');if(!text)return;
    const first=text.querySelector('ol li');
    if(first)first.textContent='Total duration of examination is '+durationText(count*per)+' ('+count+' questions × '+per+' seconds). One countdown covers the entire drill.';
    const items=[...text.querySelectorAll('li')];
    const navigation=items.find(li=>li.textContent.includes('question number in the Question Palette'));
    if(navigation){const guide=navigation.querySelector('ol');if(!guide){navigation.textContent='Click any question number in the palette to go directly to it. Palette navigation does not save a new answer; use Save & Next to save.'}}
    const sections=items.find(li=>li.textContent.includes('shuffle between sections'));
    if(sections)sections.textContent='You can revisit any question in the selected drill until the overall timer expires or you submit.';
    const language=items.find(li=>li.textContent.includes('change the language during the exam'));
    if(language)language.textContent='All currently imported questions are in English. Use your private member account to view this drill.';
  }
  function makeInstructionSummary(plan,isResume=false){
    const decl=$('declaration-body');if(!decl)return;
    decl.replaceChildren();
    const mode=plan.mode==='challenge'?'🔥 Challenge':'🟢 Normal',per=plan.seconds;
    const heading=create('h3',null,'Banking Speed Drill — '+mode+' Mode');heading.style.cssText='font-size:19px;margin:10px 0 18px';decl.append(heading);
    const table=create('table');table.className='drill-instruction-summary';table.setAttribute('aria-label','Test details');
    table.style.cssText='border-collapse:collapse;width:min(780px,100%);font-family:Arial,sans-serif;font-size:14px;margin:12px 0 18px';
    const header=create('thead'),tr=create('tr');for(const label of ['Subject / Section','No. of Questions','Time','Maximum Marks']){const th=create('th',null,label);th.style.cssText='border:1px solid #9faebe;background:#e7f2fa;padding:10px;text-align:left';tr.append(th)}header.append(tr);table.append(header);
    const rows=create('tbody');let breakdown=plan.counts||{};
    if(!Object.keys(breakdown).length)breakdown={'Selected topics':plan.count};
    for(const [subject,num] of Object.entries(breakdown)){
      const line=create('tr');for(const v of [subject,num,durationText(num*per),num]){
        const cell=create('td',null,v);cell.style.cssText='padding:10px;border:1px solid #9faebe';line.append(cell)
      }rows.append(line)
    }
    const total=create('tr');for(const v of ['Total',plan.count,durationText(plan.count*per),plan.count]){
      const cell=create('td',null,v);cell.style.cssText='padding:10px;border:1px solid #9faebe;font-weight:700;background:#f3f8fc';total.append(cell)
    }rows.append(total);table.append(rows);decl.append(table);
    const scoring=create('p',null,'Marking: +1 for correct, −0.25 for incorrect, 0 for unanswered.');decl.append(scoring);
    const directions=create('p',null,'You can navigate freely between questions using the original question palette or Previous button, and mark questions for review. Only your saved responses will be evaluated.');decl.append(directions);
    const timerNote=create('p',null,isResume?'This test was started earlier. Its server clock has been running continuously, including while your browser was closed.':'Your VM starts the total countdown only after you click “I am ready to begin”. The clock keeps running if you close the browser.');
    timerNote.style.cssText='margin-top:14px;font-weight:600';decl.append(timerNote);
  }
  function setupDeclarationButton(handler){
    const ch=$('decl-checkbox'),begin=$('readylink');
    const agreement=$('agreementMessageDef');if(agreement)agreement.textContent='I have read and understood the instructions, total test duration and question navigation.';
    if(ch&&begin){ch.checked=false;begin.disabled=true;begin.setAttribute('aria-disabled','true');ch.onchange=()=>{begin.disabled=!ch.checked;begin.setAttribute('aria-disabled',String(!ch.checked))};begin.onclick=handler}
    $('instPaginationa').onclick=()=>showScreen('declaration');
    $('PreviousInst').onclick=()=>showScreen('instructions');
  }
  function requestFullScreen(){
    if(document.fullscreenElement||!document.documentElement.requestFullscreen)return;
    // Must be invoked synchronously from a real click, before any await.
    try{const promise=document.documentElement.requestFullscreen();promise?.catch(()=>warn('Browser blocked full screen. You can press F11 to continue in full screen.'))}
    catch(_){warn('Full screen was blocked by your browser. Press F11 if needed.')}
  }
  function prepareIntro(){
    try{pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null')}catch{pending=null}
    if(!DrillAPI.auth()){location.replace('index.html?unlock=1');return}
    if(!pending||!Array.isArray(pending.keys)||!Number.isInteger(pending.count)||pending.count<1||pending.count>100){location.replace('index.html');return}
    applyIdentity();setDuration();
    const counts=pending.subjects?.length>1?pending.quotas:{[pending.subjects?.[0]||'Selected topics']:pending.count};
    makeInstructionSummary({mode:pending.mode,seconds:pending.seconds,count:pending.count,counts});
    setupDeclarationButton(async()=>{
      const begin=$('readylink');if(busy||!$('decl-checkbox')?.checked)return;
      requestFullScreen();busy=true;begin.disabled=true;
      try{
        const created=await DrillAPI.start(pending.mode,pending.keys,pending.count,pending.quotas||{});
        if(!created?.id)throw new Error('The VM did not return an attempt ID');
        attemptId=created.id;history.replaceState(null,'','drill.html?attempt='+encodeURIComponent(attemptId));
        sessionStorage.removeItem(pendingKey);
        state=await DrillAPI.current(attemptId);offset=Date.parse(state.server_now)-Date.now();activate();
      }catch(e){warn('Unable to start speed drill: '+e.message);begin.disabled=false}
      finally{busy=false}
    });
    showScreen('instructions');
  }
  function prepareResume(){
    if(!state||state.status!=='active'){activate();return}
    applyIdentity();setDuration();
    makeInstructionSummary({mode:state.mode,seconds:state.seconds_per_question,count:state.total,counts:state.subject_counts},true);
    const b=$('readylink');b.textContent='Resume drill';
    setupDeclarationButton(async()=>{
      if(busy||!$('decl-checkbox')?.checked)return;
      requestFullScreen();busy=true;b.disabled=true;
      try{state=await DrillAPI.current(attemptId);offset=Date.parse(state.server_now)-Date.now();activate()}
      catch(e){warn(e);b.disabled=false}finally{busy=false}
    });
    showScreen('declaration');
  }
  function modeText(){return state?.mode==='challenge'?'🔥 Challenge':'Normal'}
  function showModal(key){const mod=$('modal-'+key);if(!mod)return;mod.style.display='flex';mod.setAttribute('aria-hidden','false')}
  function closeAllModals(){selectors('.bmt-modal-overlay',e=>{e.style.display='none';e.setAttribute('aria-hidden','true')})}
  window.closeAllModals=closeAllModals;
  function instructionModal(){
    const dst=$('modal-instructions-body'),src=$('instructions-body');
    if(dst&&src){dst.replaceChildren(src.cloneNode(true));}showModal('instructions');
  }
  function questionPaperModal(){
    const box=$('modal-qpaper-body');if(!box||!state)return;
    box.replaceChildren();
    box.append(create('p',null,'Use the numbered palette to navigate between questions. Answers are saved only using Save & Next or Mark for Review & Next.'));
    const list=create('div');list.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:16px 0';
    (state.statuses||[]).forEach((st,i)=>{const n=create('span','tipIcon numpan '+paletteClass(st),i+1);n.title='Question '+(i+1)+': '+st;list.append(n)});
    box.append(list);
    box.append(create('p',null,'The VM sends only the requested question; it does not publish answer keys or the complete question bank.'));
    showModal('qpaper');
  }
  async function submitModal(){
    if(!state||state.status!=='active'||busy)return;
    const box=$('submit-summary'),confirm=$('btn-confirm-submit');
    showModal('submit');
    if(confirm)confirm.disabled=true;
    if(box)box.textContent='Updating question status…';
    busy=true;
    try{
      // The supplied original mock exam commits the current response when Submit
      // is opened. Match that behavior without exposing scoring on the client.
      await saveQueue.catch(()=>{});
      if(state.status!=='active')return;
      const currentChoice=choice();
      if(currentChoice!== (state.choice??null)){
        const status=(state.statuses||[])[state.current_index];
        const marked=status==='marked'||status==='answered-marked';
        state=await DrillAPI.answer(attemptId,state.current_index,currentChoice,marked);
      }
      if(state.status!=='active'){
        location.replace('result.html?attempt='+encodeURIComponent(attemptId));return;
      }
      // Same seven-column source-project table, with real VM palette statuses.
      // One combined section keeps these totals accurate even if a drill mixes
      // subjects (the VM shuffles all selected questions together).
      const summaryQuestions=(state.statuses||[]).map(st=>({sectionIndex:0,status:st}));
      if(box&&typeof Renderer!=='undefined'&&typeof Renderer.renderSubmitSummary==='function'){
        Renderer.renderSubmitSummary(box,{sections:[{name:'Speed Drill'}],questions:summaryQuestions});
        const counted=(state.statuses||[]).filter(st=>st==='answered'||st==='answered-marked').length;
        const note=create('p');
        note.style.cssText='margin:10px 0 0;font-size:12px;color:#444';
        note.textContent='Answers counted for evaluation: '+counted+' (Answered + Answered & Marked). Marked without an answer is not evaluated.';
        box.append(note);
      } else if(box)box.textContent='Unable to render the source submit summary. Please refresh and retry.';
    }catch(e){warn(e);if(box)box.textContent='Could not update the summary: '+(e?.message||e)}
    finally{busy=false;if(confirm&&box?.querySelector('table'))confirm.disabled=false}
  }
  async function submit(){if(busy||!state)return;busy=true;try{await saveQueue.catch(()=>{});state=await DrillAPI.submit(attemptId);location.replace('result.html?attempt='+encodeURIComponent(attemptId))}catch(e){warn(e)}finally{busy=false;closeAllModals()}}
  function setPaletteCollapsed(on){document.body.classList.toggle('is-palette-collapsed',on);selectors('.expand_icon',el=>el.style.display=on?'block':'none');sessionStorage.setItem('bankdrills_palette_collapsed',on?'1':'0')}
  function setupChrome(){
    for(const key of ['VI','VIMbl'])$(key)?.addEventListener('click',instructionModal);
    for(const key of ['viewQPButton','viewQPButtonMbl'])$(key)?.addEventListener('click',questionPaperModal);
    for(const key of ['viewQuesInstru','viewGrpInstru','viewSecInstru','viewGrpInstruDiv','viewSecInstruDiv','viewQuesInstruDiv'])$(key)?.addEventListener('click',instructionModal);
    for(const m of ['instructions','qpaper','submit']){
      const mod=$('modal-'+m);
      mod?.addEventListener('click',e=>{if(e.target===mod)closeAllModals()});
    }
    $('btn-cancel-submit-x')?.addEventListener('click',closeAllModals);
    $('btn-cancel-submit')?.addEventListener('click',closeAllModals);
    $('btn-confirm-submit')?.addEventListener('click',submit);
    for(const key of ['finalSubmit','finalSubmitMbl'])$(key)?.addEventListener('click',submitModal);
    for(const key of ['clearResponse','clearResponseMbl'])$(key)?.addEventListener('click',()=>{selectors('input[name=drill_option]',el=>el.checked=false);saveChoice(null)});
    for(const key of ['underreview','underreviewMbl'])$(key)?.addEventListener('click',()=>advance(true));
    for(const key of ['savenext','savenextMbl'])$(key)?.addEventListener('click',()=>advance(false));
    for(const key of ['previousBtn','previousBtnMbl'])$(key)?.addEventListener('click',()=>navigateTo(state?.current_index-1));
    selectors('.collapse_icon',el=>el.addEventListener('click',()=>setPaletteCollapsed(true)));
    selectors('.expand_icon, #showdet',el=>el.addEventListener('click',()=>setPaletteCollapsed(false)));
    if(sessionStorage.getItem('bankdrills_palette_collapsed')==='1')setPaletteCollapsed(true);
    $('btn-close-image-lightbox')?.addEventListener('click',closeAllModals);
    $('modal-image-lightbox')?.addEventListener('click',closeAllModals);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAllModals()});
  }
  function configureExam(){
    applyIdentity();setDuration();showScreen('exam');
    if(window.Renderer?.applyUiScale) window.Renderer.applyUiScale();
    // Preserve the original arrangement and assets; update only labels tied to source demo data.
    setText('.groupName','Speed Drill');
    setText('#Physics, #viewSection b','Speed Drill');
    setText('.subjectName','Speed Drill');
    const section=$('sectionId0');
    if(section){selectors('#sectionId0 .sectionNameTxt, #sectionId0 .sectionName',el=>el.textContent='Speed Drill')}
    for(const key of ['sectionId1','sectionId2']){const el=$(key);if(el){const wrap=el.closest('.swiper-slide')||el;wrap.style.display='none'}}
    selectors('#sections .subject-name', (el,i)=>{if(i===0){const t=el.querySelector('.sectionName');if(t)t.textContent='Speed Drill'}else el.style.display='none'});
    if($('rightSectionDiv2')){const head=$('rightSectionDiv2').querySelector('.header b');if(head)head.textContent='Speed Drill'}
    const type=$('questiontype-details_id');if(type){const label=type.querySelector('.questionType');if(label){const rest=type.lastChild;if(rest?.nodeType===3)rest.textContent='MCQ';}else type.textContent='Question Type: MCQ'}
    setText('.negativeMarks~font','0.25');
    if($('q-timer'))$('q-timer').style.display='none';
    // Restore the original Previous controls; backend now permits navigation.
    for(const key of ['previousBtn','previousBtnMbl']){const b=$(key);if(b){b.style.display='inline-block';b.style.pointerEvents='auto';b.style.opacity='1'}}
    const extras=create('style');extras.id='bankdrills-data-only-css';
    extras.textContent='\n.drill-question-image { max-width:100%;max-height:400px;object-fit:contain;cursor:zoom-in;display:block;margin:7px 0 }\n.drill-text-question { white-space:pre-wrap }\n';
    document.head.append(extras);
    setupChrome();
    started=true;
  }
  function paletteClass(st){return ({active:'not_answered',answered:'answered','answered-marked':'review_answered','not-answered':'not_answered',marked:'review','not-visited':'not_visited'})[st]||'not_visited'}
  function updatePalette(){
    const panel=$('numberpanelQues');if(!panel)return;
    panel.replaceChildren();
    (state.statuses||[]).forEach((st,i)=>{
      const div=create('div');div.id='qtd'+i;
      const el=create('span','tipIcon numpan auditlog '+paletteClass(st),i+1);el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label','Go to question '+(i+1)+': '+st);
      el.id=String(i);el.classList.add(String(i));
      el.title='Go to question '+(i+1)+(i===state.current_index?' (current)':'');
      if(i===state.current_index)el.setAttribute('aria-current','true');
      el.addEventListener('click',()=>navigateTo(i));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigateTo(i)}});
      div.append(el);panel.append(div);
    });
    const s={answered:0,notanswered:0,notvisited:0,marked:0,markedanswered:0};
    for(const st of state.statuses||[]){if(st==='answered')s.answered++;else if(st==='not-answered')s.notanswered++;else if(st==='marked')s.marked++;else if(st==='answered-marked')s.markedanswered++;else s.notvisited++}
    setText('.answeredCount',s.answered);setText('.notAnsweredCount',s.notanswered);setText('.notVisitedCount',s.notvisited);setText('.markedCount',s.marked);setText('.markedAnsweredCount',s.markedanswered);
    for(const key of ['previousBtn','previousBtnMbl']){const b=$(key);if(b){b.disabled=state.current_index<=0;b.style.opacity=b.disabled?'.45':'1'}}
  }
  async function navigateTo(index){
    if(busy||!state||state.status!=='active'||!Number.isInteger(index)||index<0||index>=state.total||index===state.current_index)return;
    busy=true;
    try{
      await saveQueue.catch(()=>{});
      state=await DrillAPI.navigate(attemptId,index);
      offset=Date.parse(state.server_now)-Date.now();render();tick();
    }catch(e){warn(e);await refresh()}finally{busy=false}
  }
  function makeAnswerOption(value,i){
    const label=create('label','optionLabel');label.setAttribute('for','drill-choice-'+(i+1));
    const radioWrap=create('span','opt-radio-wrap');
    const input=create('input','answer MCQanswer radioBtnClass');input.type='radio';input.name='drill_option';input.id='drill-choice-'+(i+1);input.value=i+1;input.checked=Number(state.choice)===i+1;
    input.addEventListener('change',()=>{lastChoice=i+1});radioWrap.append(input);
    const textParent=create('span','labelForOptText');const prefix=create('span','opt-prefix',(i+1)+'.');
    const textWrap=create('span','opt-text-wrap');const text=create('span','opt-text',value);textWrap.append(text);textParent.append(prefix,textWrap);
    label.append(radioWrap,textParent);return label;
  }
  function render(){
    if(!state)return;
    if(state.status==='completed'){location.replace('result.html?attempt='+encodeURIComponent(attemptId));return}
    const host=$('quesAnsContent');if(!host)return;
    const q=state.question||{};
    const hdr=$('divHeader_id');if(hdr){hdr.replaceChildren();const b=create('b');b.append(document.createTextNode('Question No. '+(state.current_index+1)));hdr.append(b)}
    host.replaceChildren();
    const question=create('div','textHighlighter drill-text-question',q.question_text||q.text||'Question unavailable.');
    question.style.cssText='width:98%;margin-left:5px;font-family:Arial,verdana,helvetica,sans-serif;padding-bottom:10px;padding-top:10px';host.append(question);
    const imgData=q.question_image_data||'';
    if(/^data:image\/(png|jpeg|webp|gif);base64,/.test(imgData)){
      const image=create('img','drill-question-image');image.src=imgData;image.alt='Question image';host.append(image);
      image.addEventListener('click',()=>{const modal=$('modal-image-lightbox');const zoom=$('lightbox-img');if(modal&&zoom){zoom.src=imgData;showModal('image-lightbox')}});
    }
    const choices=create('div','removeAria');choices.style.cssText='width:100%;font-family:Arial,verdana,helvetica,sans-serif;margin-top:5px';choices.setAttribute('role','radiogroup');
    const wrap=create('div');for(let i=0;i<(q.options||[]).length;i++)wrap.append(makeAnswerOption(q.options[i],i));choices.append(wrap);host.append(choices);
    lastChoice=state.choice??null;
    updatePalette();
    const title=$('exam_name_h1');if(title)title.textContent='BANKING SPEED DRILL';
  }
  function choice(){return Number(document.querySelector('input[name="drill_option"]:checked')?.value)||null}
  function saveChoice(value,mark=false){
    if(!state||state.status!=='active'||busy)return saveQueue;
    const idx=state.current_index;
    lastChoice=value;
    saveQueue=saveQueue.catch(()=>{}).then(async()=>{
      if(!state||state.status!=='active'||state.current_index!==idx)return;
      const snapshot=await DrillAPI.answer(attemptId,idx,value,mark);
      if(snapshot.status!=='active'||snapshot.current_index!==idx){state=snapshot;offset=Date.parse(state.server_now)-Date.now();render();return}
      state=snapshot;lastChoice=value;
    }).catch(async e=>{warn(e);await refresh()});
    return saveQueue;
  }
  async function advance(mark){
    if(busy||!state||state.status!=='active')return;
    busy=true;selectors('#savenext,#underreview,#savenextMbl,#underreviewMbl',b=>b.disabled=true);
    try{
      const idx=state.current_index;const chosen=choice()??lastChoice;
      await saveQueue.catch(()=>{});
      if(state.status!=='active'||state.current_index!==idx)return;
      state=await DrillAPI.answer(attemptId,idx,chosen,mark);
      if(state.status!=='active'||state.current_index!==idx){render();return}
      state=await DrillAPI.advance(attemptId,idx);offset=Date.parse(state.server_now)-Date.now();render();
    }catch(e){warn(e);await refresh()}
    finally{busy=false;selectors('#savenext,#underreview,#savenextMbl,#underreviewMbl',b=>b.disabled=false)}
  }
  async function refresh(){
    if(refreshing||!attemptId)return;
    refreshing=true;
    try{const snap=await DrillAPI.current(attemptId);if(!state||state.current_index!==snap.current_index||state.status!==snap.status){state=snap;render()}else{state=snap;updatePalette()}offset=Date.parse(state.server_now)-Date.now()}
    catch(e){warn(e)}finally{refreshing=false}
  }
  function tick(){
    if(!started||!state||state.status!=='active')return;
    const now=Date.now()+offset;
    const overall=Math.max(0,Math.ceil((Date.parse(state.overall_deadline_at)-now)/1000));
    const left=overall;
    const min=String(Math.floor(left/60)).padStart(2,'0');const sec=String(left%60).padStart(2,'0');
    setText('#timeInMins',min+':'+sec);
    if($('m01_hrs'))$('m01_hrs').textContent='00';if($('min_val'))$('min_val').textContent=min;if($('sec01_val'))$('sec01_val').textContent=sec;
    if(overall===0&&Date.now()>nextExpiryRefresh){nextExpiryRefresh=Date.now()+2000;refresh()}
    const el=$('showTime');if(el)el.title='Overall drill time remaining: '+overall+' seconds';
  }
  function activate(){
    if(!started)configureExam();
    showScreen('exam');render();tick();
    if(!window._bdTick)window._bdTick=setInterval(tick,500);
    if(!window._bdRefresh)window._bdRefresh=setInterval(()=>{if(!busy)refresh()},12000);
  }
  if(params.get('mode')==='analyse') return; // handled by read-only original-UI analyse adapter
  document.addEventListener('DOMContentLoaded',async()=>{
    if(!DrillAPI.auth()){location.replace('index.html?unlock=1');return}
    if(params.get('prepare')==='1'){prepareIntro();return}
    if(!attemptId){location.replace('index.html');return}
    try{state=await DrillAPI.current(attemptId);offset=Date.parse(state.server_now)-Date.now();prepareResume()}
    catch(e){showScreen('instructions');const el=$('instructions-body');if(el)el.textContent='Could not load your secure speed drill: '+e.message+' . Return to your practice hub and sign in again.';warn(e)}
  });
})();
