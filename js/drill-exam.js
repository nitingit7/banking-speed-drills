/* Adapts the user's ORIGINAL exam.html DOM and CSS. Exam record, clock, score authoritative on VM. */
(function(){'use strict';
  const id=new URLSearchParams(location.search).get('attempt');
  const $=id=>document.getElementById(id);
  let a=null,busy=false,offset=0,refreshing=false,saveQueue=Promise.resolve(),lastChoice=null;
  const h=(tag,cl,txt)=>{const e=document.createElement(tag);if(cl)e.className=cl;if(txt!==undefined)e.textContent=String(txt);return e};
  function error(e){let t=$('drill-error');if(!t){t=h('div');t.id='drill-error';t.style.cssText='position:fixed;top:55px;left:50%;transform:translateX(-50%);z-index:999999;background:#fff3f3;border:1px solid #d88;border-radius:6px;padding:12px 20px;max-width:85vw;color:#861e1e;box-shadow:0 5px 20px #0003';document.body.append(t)}t.textContent=e.message||String(e);setTimeout(()=>{if(t)t.remove()},6000)}
  function summaryLink(){location.href='result.html?attempt='+encodeURIComponent(id)}
  function color(){return a?.mode==='challenge'?'#dc781c':'#198754'}
  function sourceTitle(){return a?.mode==='challenge'?'🔥 Challenge Drill':'Normal Speed Drill'}
  function setText(sel,t){document.querySelectorAll(sel).forEach(e=>e.textContent=t)}
  function setUp(){
    $('screen-instructions').style.display='none';$('screen-declaration').style.display='none';
    $('screen-exam').style.display='block';
    document.body.classList.add('drill-active');
    const style=h('style');style.textContent=`
      #drill-mode-flag{position:fixed;top:48px;right:300px;background:${color()};color:#fff;padding:5px 11px;border-radius:0 0 8px 8px;font:600 12px Arial;z-index:600}
      .drill-active #previousBtn,.drill-active #previousBtnMbl,.drill-active #previousBtnGroup{display:none!important}
      .drill-active #currentQues{height:auto!important;min-height:280px}
      .drill-active #quesOuterDiv,.drill-active #quesOuterDiv .leftDiv{height:auto!important;min-height:240px}
      .drill-active .drill-option{display:block; padding:11px 13px; border:1px solid #dadde1; border-radius:4px; margin:8px 6px 8px 3px; font-family:Arial;cursor:pointer}
      .drill-active .drill-option:has(input:checked){background:#eaf4fd;border-color:#147eb3}
      .drill-active .drill-option input{margin-right:12px;accent-color:#147eb3}
      .drill-active .drill-question-text{font:500 16px/1.75 Arial,Helvetica,sans-serif;white-space:pre-wrap;color:#20252c;margin:14px 5px}
      .drill-active .drill-question-image{display:block;max-width:100%;max-height:410px;object-fit:contain;margin:8px auto}
      .drill-active .drill-info{font:12px Arial;color:#7a5f38;margin:5px 7px}
      .drill-active .drill-palette-number{cursor:default!important}
      .drill-active #question_area{overflow-y:auto!important;max-height:42vh}
      @media(max-width:900px){#drill-mode-flag{top:50px;right:10px;font-size:10px}}
    `;document.head.appendChild(style);
    const flag=h('div','',sourceTitle());flag.id='drill-mode-flag';document.body.appendChild(flag);
    if($('exam_name_h1')) $('exam_name_h1').textContent='BANKING SPEED DRILL';
    setText('.instMockName','Banking Speed Drill');
    setText('.candOriginalName',DrillAPI.auth()?.displayName||'Candidate');
    if(document.querySelector('#questionContent .grup_head'))document.querySelector('#questionContent .grup_head').textContent='QUANTITATIVE APTITUDE';
    if($('sections'))$('sections').innerHTML='<div class="subject-name selectedsubject" role="tab" aria-selected="true"><span class="sectionName">Speed Drill</span></div>';
    if($('sectionId0')?.querySelector('.sectionNameTxt'))$('sectionId0').querySelector('.sectionNameTxt').textContent='Speed Drill';
    for(let n of ['sectionId1','sectionId2']) if($(n)) $(n).closest('.swiper-slide').style.display='none';
    if($('rightSectionDiv2')){const strong=$('rightSectionDiv2').querySelector('.header b');if(strong)strong.textContent='Speed Drill'}
    setText('.groupName','Speed Drill');
    setText('.notVisitedCount',String(Math.max(0,a.total-1)));
    setText('.notAnsweredCount','1');
    if($('questiontype-details_id'))$('questiontype-details_id').textContent='Question Type: MCQ';
    document.querySelectorAll('.negativeMarks~font').forEach(e=>e.textContent='0.25');
    if($('underreview'))$('underreview').value='Mark for Review & Next';
    if($('savenext'))$('savenext').value='Save & Next';
    if($('clearResponse'))$('clearResponse').value='Clear Response';
    if($('savenextMbl'))$('savenextMbl').value='Save & Next';
    if($('underreviewMbl'))$('underreviewMbl').value='Mark for Review & Next';
    for(const x of ['savenext','savenextMbl'])$(x)?.addEventListener('click',()=>next(false));
    for(const x of ['underreview','underreviewMbl'])$(x)?.addEventListener('click',()=>next(true));
    $('clearResponse')?.addEventListener('click',()=>{ document.querySelectorAll('input[name=drill_option]').forEach(x=>x.checked=false); saveChoice(null); });
    for(const x of ['finalSubmit','finalSubmitMbl'])$(x)?.addEventListener('click',submit);
    $('viewQuesInstru')?.addEventListener('click',()=>alert('You have '+a.total+' questions, '+a.seconds_per_question+' seconds per question. The timer is checked by the VM. Returning to expired questions is disabled.'));
    const tip=h('div','drill-info','Server timer • 1 mark correct • −0.25 wrong • no backtracking');
    $('quesOuterDiv')?.parentElement?.append(tip);
  }
  function selected(){const r=document.querySelector('input[name="drill_option"]:checked');return r?Number(r.value):null}
  function render(){
    if(!a)return;
    if(a.status==='completed'){summaryLink();return}
    $('divHeader_id').textContent='Question No. '+(a.current_index+1);
    const host=$('quesAnsContent');host.replaceChildren();
    const q=a.question;
    const qt=h('div','drill-question-text',q?.text||'Question unavailable.');host.append(qt);
    if(q?.question_image_data?.startsWith('data:image/')){const img=h('img','drill-question-image');img.src=q.question_image_data;img.alt='Question diagram';host.append(img)}
    const options=h('div','removeAria');options.setAttribute('role','radiogroup');
    (q?.options||[]).forEach((o,i)=>{
      const label=h('label','drill-option');const input=h('input');input.type='radio';input.name='drill_option';input.value=String(i+1);input.checked=Number(a.choice)===i+1;
      label.append(input,document.createTextNode((i+1)+'.  '+o));input.addEventListener('change',()=>saveChoice(i+1));options.append(label);
    });host.append(options);
    const pal=$('numberpanelQues');pal.replaceChildren();
    a.statuses.forEach((st,i)=>{
      const div=h('div');div.id='drill-pal-'+i;
      const map={active:'not_answered',answered:'answered','answered-marked':'review_answered','not-answered':'not_answered','marked':'review','not-visited':'not_visited'};
      const span=h('span','tipIcon numpan drill-palette-number '+(map[st]||'not_visited'),i+1);
      span.title='Question '+(i+1)+' — '+st+' (sequential drill; navigation locked)';div.append(span);pal.append(div);
    });
    const statuses=a.statuses||[];
    const summary={answered:0,notanswered:0,notvisited:0,marked:0,markedanswered:0};
    for(const status of statuses){ if(status==='answered')summary.answered++;else if(status==='not-answered'||status==='active')summary.notanswered++;else if(status==='marked')summary.marked++;else if(status==='answered-marked')summary.markedanswered++;else summary.notvisited++; }
    setText('.answeredCount',summary.answered);setText('.notAnsweredCount',summary.notanswered);setText('.notVisitedCount',summary.notvisited);setText('.markedCount',summary.marked);setText('.markedAnsweredCount',summary.markedanswered);
    setText('.timelabel','Time Left : ');
    const flag=$('drill-mode-flag');if(flag)flag.textContent=sourceTitle()+' • Q '+(a.current_index+1)+'/'+a.total;
    lastChoice=a.choice||null;
  }
  async function saveChoice(choice,mark=false){
    if(!a||a.status!=='active')return;
    const index=a.current_index;
    saveQueue=saveQueue.catch(()=>{}).then(async()=>{
      if(!a||a.current_index!==index)return;
      const next=await DrillAPI.answer(id,index,choice,mark);
      if(next.current_index!==index||next.status==='completed') {a=next;render();return}
      a=next;a.choice=choice;lastChoice=choice;
    }).catch(e=>{error(e);refresh()});
    return saveQueue;
  }
  async function next(mark){
    if(busy||!a||a.status!=='active')return;
    busy=true;for(const name of ['savenext','underreview','savenextMbl','underreviewMbl'])if($(name))$(name).disabled=true;
    try{
      const ix=a.current_index;
      await saveQueue.catch(()=>{});
      if(a.status!=='active'||a.current_index!==ix)return;
      const choice=selected()??lastChoice;
      await saveChoice(choice,mark);
      if(a.status!=='active'||a.current_index!==ix)return;
      a=await DrillAPI.advance(id,ix);offset=Date.parse(a.server_now)-Date.now();render();
    }catch(e){error(e);await refresh()}
    finally{busy=false;for(const name of ['savenext','underreview','savenextMbl','underreviewMbl'])if($(name))$(name).disabled=false}
  }
  async function submit(){if(busy)return;
    if(!confirm('Submit this drill now? Unanswered questions will be skipped. This cannot be undone.'))return;
    busy=true;try{a=await DrillAPI.submit(id);summaryLink()}catch(e){error(e)}finally{busy=false}
  }
  async function refresh(){if(refreshing)return;refreshing=true;
    try{a=await DrillAPI.current(id);offset=Date.parse(a.server_now)-Date.now();render()}catch(e){error(e)}finally{refreshing=false}
  }
  function tick(){if(!a||a.status!=='active')return;
    const now=Date.now()+offset;
    const rem=Math.max(0,Math.ceil((Date.parse(a.question_deadline_at)-now)/1000));
    const overall=Math.max(0,Math.ceil((Date.parse(a.overall_deadline_at)-now)/1000));
    const mm=String(Math.floor(rem/60)).padStart(2,'0');const ss=String(rem%60).padStart(2,'0');
    for(const elem of document.querySelectorAll('#timeInMins'))elem.textContent=mm+':'+ss;
    if($('m01_hrs'))$('m01_hrs').textContent='00';if($('min_val'))$('min_val').textContent=mm;if($('sec01_val'))$('sec01_val').textContent=ss;
    if(rem<=10){document.querySelectorAll('#timeInMins').forEach(el=>el.style.color='#d4472c')}
    else document.querySelectorAll('#timeInMins').forEach(el=>el.style.color='');
    if(rem===0){refresh();return}
    const totalSpan=$('showTime');if(totalSpan)totalSpan.title='Overall time remaining '+overall+' seconds';
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    if(!id){location.replace('index.html');return}
    if(!DrillAPI.auth()){location.replace('index.html?unlock=1');return}
    try{a=await DrillAPI.current(id);offset=Date.parse(a.server_now)-Date.now();setUp();render();tick();setInterval(tick,500);setInterval(()=>{if(!busy)refresh()},15000)}
    catch(e){document.body.innerHTML='';const div=h('div');div.style.cssText='font:16px Arial;margin:10vh auto;max-width:560px;padding:24px';div.textContent='Could not load secure drill: '+e.message+' ';const link=h('a','', 'Return to home');link.href='index.html';div.append(link);document.body.append(div)}
  });
})();
