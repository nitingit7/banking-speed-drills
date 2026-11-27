/* PocketBase completed-attempt analysis in the user's original TCS-style exam UI.
   Practice re-attempt is an in-page, non-scored exercise. Original results are
   immutable; answer keys are obtained ONLY after the VM confirms completion. */
(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('mode')!=='analyse')return;
  const id=params.get('attempt'),$=s=>document.getElementById(s);
  const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
  let data=null,index=0,filter='all',practice=false;
  const tries=new Map();
  const originalStatus=q=>{
    if(q?.selected===null||q?.selected===undefined||q?.selected==='')return 'skipped';
    return Number(q.selected)===Number(q.correct_index)?'correct':'wrong';
  };
  // In completed-attempt Analyse, colors reflect CORRECTNESS, not how the
  // user navigated during the exam. Answered & Marked remains distinctive.
  const originalClass=q=>{
    if(q?.marked)return originalStatus(q)==='skipped'?'review':'review_answered';
    if(originalStatus(q)==='correct')return 'answered';
    if(originalStatus(q)==='wrong')return 'not_answered';
    return 'not_visited'; // Skipped and Unseen: same grey as in the exam.
  };
  function message(text){const host=$('quesAnsContent');if(host)host.textContent=String(text);}
  function matching(i){
    const q=data?.review?.[i];if(!q)return false;
    switch(filter){
      case 'correct': return originalStatus(q)==='correct';
      case 'wrong':case 'incorrect':return originalStatus(q)==='wrong';
      case 'skipped':return originalStatus(q)==='skipped';
      case 'unseen':return q.visited===false;
      case 'marked':return q.marked===true;
      case 'slow':return Number.isFinite(Number(q.time_spent_seconds))&&q.time_spent_seconds!==null&&Number(q.time_spent_seconds)>Number(data.mean_question_seconds||Infinity);
      default:return true;
    }
  }
  function firstMatch(){return data.review.findIndex((_,i)=>matching(i));}
  function closeImage(){if($('modal-image-lightbox'))$('modal-image-lightbox').style.display='none';}
  function addImg(uri,alt,host){
    if(!/^data:image\/(png|jpeg|webp|gif);base64,/.test(uri||''))return;
    const img=create('img','drill-question-image');img.src=uri;img.alt=alt;
    img.style.cssText='max-width:95%;max-height:390px;object-fit:contain;display:block;cursor:zoom-in;margin:10px auto';
    img.onclick=()=>{const modal=$('modal-image-lightbox'),full=$('lightbox-img');if(modal&&full){full.src=uri;modal.style.display='flex';}};
    host.append(img);
  }
  function updatePalette(){
    const panel=$('numberpanelQues');if(!panel)return;
    panel.replaceChildren();
    const c={answered:0,notAnswered:0,notVisited:0,marked:0,markedAnswered:0};
    for(const [i,q] of data.review.entries()){
      const st=originalStatus(q);
      if(q.marked){if(st==='skipped')c.marked++;else c.markedAnswered++;}
      else if(st==='correct')c.answered++;
      else if(st==='wrong')c.notAnswered++;
      else c.notVisited++;
      if(!matching(i))continue; // Actual filter, not just a faded badge.
      const wrap=create('div');wrap.id='qtd'+i;
      const item=create('span','tipIcon numpan auditlog '+originalClass(q),i+1);
      item.id=String(i);item.setAttribute('role','button');item.tabIndex=0;
      if(i===index)item.setAttribute('aria-current','true');
      item.setAttribute('aria-label','Review question '+(i+1));
      item.title='Question '+(i+1)+' — '+(q.marked?(st==='skipped'?'Marked without answer':'Answered & Marked · '+st):st)+(tries.has(i)?' — practised':'');
      item.onclick=()=>{index=i;render();};
      item.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();index=i;render();}};
      wrap.append(item);panel.append(wrap);
    }
    for(const [cls,num] of [['.answeredCount',c.answered],['.notAnsweredCount',c.notAnswered],['.notVisitedCount',c.notVisited],['.markedCount',c.marked],['.markedAnsweredCount',c.markedAnswered]]){
      document.querySelectorAll(cls).forEach(el=>el.textContent=String(num));
    }
    if($('analyse-filter-count'))$('analyse-filter-count').textContent=data.review.filter((_,i)=>matching(i)).length+'/'+data.review.length;
  }
  function currentAvailable(){return matching(index);}
  function setNavigation(){
    const matches=data.review.map((_,i)=>i).filter(i=>matching(i));
    const pos=matches.indexOf(index);
    for(const key of ['previousBtn','previousBtnMbl'])if($(key))$(key).disabled=pos<=0;
    if($('btnAnalyseNext'))$('btnAnalyseNext').disabled=pos<0||pos>=matches.length-1;
  }
  function move(step){
    const matches=data.review.map((_,i)=>i).filter(i=>matching(i));
    const pos=matches.indexOf(index),target=matches[pos+step];
    if(target===undefined)return;
    index=target;render();
  }
  function answerPractice(selected){
    if(!practice||tries.has(index)||!currentAvailable())return;
    const q=data.review[index];
    const choice=Number(selected),correct=Number(q.correct_index);
    if(!Number.isInteger(choice)||choice<1||choice>(q.options||[]).length)return;
    tries.set(index,{selectedOption:choice,isCorrect:choice===correct,timeSpent:0});
    render();
  }
  function render(){
    if(!data)return;
    if(!currentAvailable()){
      const next=firstMatch();if(next>=0){index=next;}else{
        const left=document.querySelector('.leftDiv');
        if(left)left.innerHTML='<div id="divHeader_id" class="divHeader"><b>No matching questions</b></div><div id="quesAnsContent" class="Ans_Area" style="padding:18px;">No questions match this original-test filter. Choose another filter.</div>';
        updatePalette();setNavigation();return;
      }
    }
    const q=data.review[index],reAnswer=practice?tries.get(index):null;
    const origSelected=q.selected===null||q.selected===undefined||q.selected===''?null:Number(q.selected);
    const qData={question:q.question_text||'',options:q.options||[],correct:Number(q.correct_index),marks:1,negative:.25,explanation:''};
    const qState={selectedOption:practice?null:origSelected,status:practice?'not-answered':(origSelected?'answered':'not-answered'),timeSpent:0};
    window.SHOW_QUESTION_NO_LABEL=true;
    try{
      // Renderer is byte-identical to the user's original JS. It hides option
      // correctness until reattemptAnswer exists, then colours correct green,
      // selected-wrong red and locks the answered option for that question.
      Renderer.renderQuestion(document.querySelector('.leftDiv'),{
        qData,qState,questionNumber:index+1,isReview:!practice,isReattempt:practice,
        reattemptAnswer:reAnswer||null,qElapsed:0,originalTimeSpent:0
      });
    }catch(err){message('Unable to display this question: '+err.message);return;}
    const host=$('quesAnsContent');
    if(host){
      // Source ID is intentionally revealed only in completed-attempt Analyse.
      // Do not derive it from the current number or expose it during an exam.
      const sourceRef=typeof q.source_ref==='string'?q.source_ref.trim():'';
      const sourceBox=create('div','analyse-source-id');
      const reveal=create('button','analyse-source-id-show','Show Question ID');
      reveal.type='button';
      reveal.setAttribute('aria-controls','analyse-source-id-details');
      reveal.setAttribute('aria-expanded','false');
      reveal.setAttribute('aria-label','Show source ID for question '+(index+1));
      const details=create('div','analyse-source-id-details');
      details.id='analyse-source-id-details';
      details.hidden=true;
      const sourceLabel=create('span','analyse-source-id-label','Question ID:');
      const sourceValue=create('span','analyse-source-id-value',sourceRef||'Not available for this question');
      const copy=create('button','analyse-source-id-copy','Copy ID');
      copy.type='button';
      copy.disabled=!sourceRef;
      copy.setAttribute('aria-label','Copy source ID for question '+(index+1));
      const feedback=create('span','analyse-source-id-feedback');
      feedback.setAttribute('role','status');
      feedback.setAttribute('aria-live','polite');
      reveal.addEventListener('click',()=>{
        details.hidden=!details.hidden;
        reveal.setAttribute('aria-expanded',String(!details.hidden));
        reveal.textContent=details.hidden?'Show Question ID':'Hide Question ID';
      });
      copy.addEventListener('click',async()=>{
        if(!sourceRef)return;
        let copied=false;
        try{
          if(navigator.clipboard?.writeText){
            await navigator.clipboard.writeText(sourceRef);
            copied=true;
          }
        }catch(_err){/* Try the legacy copy method below. */}
        if(!copied){
          // Compatibility fallback for browsers that do not grant Clipboard API.
          const field=create('textarea');
          field.value=sourceRef;
          field.readOnly=true;
          field.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;';
          document.body.append(field);
          field.focus();field.select();
          try{copied=!!document.execCommand('copy');}catch(_err){copied=false;}
          field.remove();
        }
        feedback.textContent=copied?'Copied!':'Clipboard unavailable. Please copy the displayed ID manually.';
      });
      details.append(sourceLabel,sourceValue,copy,feedback);
      sourceBox.append(reveal,details);
      host.insertBefore(sourceBox,host.firstChild);
      const qi=create('div');addImg(q.question_image_data,'Question image',qi);
      if(qi.childElementCount)host.insertBefore(qi,host.children[1]||null);
      if(!practice||reAnswer){
        if(String(q.answer_note||'').trim()){
          const box=create('div','solution-box');box.append(create('div','solution-title','Solution from source PDF'));
          box.append(create('div','solution-content source-solution-text',q.answer_note));host.append(box);
        }
        if(q.answer_image_data){
          const box=create('div','solution-box');box.append(create('div','solution-title','Solution from source PDF'));
          addImg(q.answer_image_data,'Original PDF worked solution',box);host.append(box);
        }else if(!String(q.answer_note||'').trim()){
          const box=create('div','solution-box');box.append(create('div','solution-title','Solution'));
          box.append(create('div','solution-content','No solution available for this question.'));
          host.append(box);
        }
        const answer=create('div','solution-box');answer.append(create('div','solution-title',practice?'Re-attempt feedback':'Answer Review'));
        const info=practice
          ? (reAnswer.isCorrect?'Correct!':'Incorrect.')+' Your practice choice: Option '+reAnswer.selectedOption+' · Correct: Option '+q.correct_index
          : 'Your original answer: '+(origSelected?'Option '+origSelected:'Unattempted')+' · Correct: Option '+q.correct_index;
        answer.append(create('div','solution-content',info));host.append(answer);
      }else{
        const instruction=create('div','solution-box');instruction.append(create('div','solution-title','Re-attempt mode'));
        instruction.append(create('div','solution-content','Select an option to check your answer. Original and correct options are hidden until you answer.'));
        host.append(instruction);
        host.querySelectorAll('input[name="answers"]').forEach(input=>{
          input.disabled=false;input.addEventListener('change',()=>answerPractice(input.value));
        });
      }
    }
    const badge=$('q-timer');if(badge){
      badge.textContent=practice?(reAnswer?(reAnswer.isCorrect?'Practice answer: Correct':'Practice answer: Incorrect'):'Choose an answer to check'):'Original answer review';
      badge.style.display='inline-block';
    }
    // Analysis does not run an exam timer or manufacture per-question times.
    document.querySelectorAll('#timeInMins').forEach(x=>x.textContent='Review');
    document.querySelectorAll('#showTime,#timeResp,#showTimee').forEach(x=>x.style.display='none');
    updatePalette();setNavigation();
  }
  function setFilter(value){
    filter=value;
    const first=firstMatch();if(first>=0&&!matching(index))index=first;
    render();
  }
  function togglePractice(enabled){
    practice=enabled;
    tries.clear();
    if($('btn-reattempt-reset'))$('btn-reattempt-reset').style.display=enabled?'inline-block':'none';
    if($('reattempt-switch'))$('reattempt-switch').checked=enabled;
    render();
  }
  function setScreen(){
    document.body.classList.add('bankdrills-analyse-mode');
    for(const name of ['instructions','declaration','exam']){
      const s=$('screen-'+name);if(s)s.style.display=name==='exam'?'block':'none';
    }
    document.querySelectorAll('.instMockName,.mockName').forEach(el=>el.textContent='Banking Speed Drill');
    if($('exam_name_h1'))$('exam_name_h1').textContent='BANKING SPEED DRILL';
    document.querySelectorAll('.groupName').forEach(el=>el.textContent='Speed Drill');
    document.querySelectorAll('#viewSection b,#Physics,.subjectName').forEach(el=>{el.textContent='Speed Drill';el.title='Speed Drill';});
    document.querySelectorAll('#sections .subject-name').forEach((el,i)=>{
      if(i)el.style.display='none';else el.querySelectorAll('.sectionName').forEach(x=>x.textContent='Speed Drill');
    });
    document.querySelectorAll('#sectionId1,#sectionId2').forEach(el=>{const wrap=el.closest('.swiper-slide')||el;wrap.style.display='none';});
    const title=$('rightSectionDiv2')?.querySelector('.header b');if(title)title.textContent='Speed Drill';
    for(const el of document.querySelectorAll('.candOrigName,.candOriginalName,.userName1,.decl-cand-name'))el.textContent=DrillAPI.auth()?.displayName||'Candidate';
    for(const key of ['underreview','clearResponse','savenext','finalSubmit','finalSubmitMbl','savenextGroup',
      'underreviewMbl','clearResponseMbl','savenextMbl','optionselectionButton','optionselectionButtonMb1']){
      if($(key))$(key).style.display='none';
    }
    // Adapt the original palette legend ONLY in read-only Analyse view.
    for(const [sel,text] of [['.answeredLabel','Correct'],['.notAnsweredLabel','Wrong'],
      ['.notVisitedLabel','Skipped / Not Visited'],['.markedLabel','Marked (No Answer)']]){
      document.querySelectorAll(sel).forEach(el=>el.textContent=text);
    }
    document.querySelectorAll('.markedAnsweredCount').forEach(el=>el.title='Answered & Marked for Review (correct or wrong, see answer review)');
    const bar=$('analyse-top-bar');if(bar)bar.style.display='flex';
    const toggle=$('reattempt-switch');if(toggle){
      toggle.disabled=false;toggle.checked=false;toggle.removeAttribute('title');
      toggle.onchange=()=>togglePractice(toggle.checked);
    }
    $('btn-reattempt-reset')?.addEventListener('click',()=>{tries.clear();render();});
    if($('btn-back-to-results'))$('btn-back-to-results').href='result.html?attempt='+encodeURIComponent(id);
    for(const key of ['btnAnalyseBackResult']){
      const b=$(key);if(b){b.href='result.html?attempt='+encodeURIComponent(id);b.style.display='inline-block';}
    }
    for(const key of ['previousBtn','previousBtnMbl','btnAnalyseNext'])if($(key))$(key).style.display='inline-block';
    if($('analyse-filter-container'))$('analyse-filter-container').style.display='block';
    const sel=$('analyse-filter-select');if(sel){
      const hasVisit=data.review.every(q=>typeof q.visited==='boolean');
      const hasMarked=data.review.every(q=>typeof q.marked==='boolean');
      const validTimes=data.review.every(q=>Number.isFinite(Number(q.time_spent_seconds))&&q.time_spent_seconds!==null);
      // Legacy VM results don't supply marked/visited/time. Never invent them.
      for(const opt of sel.options){
        const unavailable=(opt.value==='marked'&&!hasMarked)||(opt.value==='unseen'&&!hasVisit)||(opt.value==='slow'&&!validTimes);
        opt.disabled=unavailable;
        if(unavailable)opt.title='Not recorded for this completed attempt by the VM';
      }
      sel.value='all';sel.onchange=()=>setFilter(sel.value);
    }
    for(const key of ['previousBtn','previousBtnMbl'])$(key)?.addEventListener('click',()=>move(-1));
    $('btnAnalyseNext')?.addEventListener('click',()=>move(1));
    $('btn-close-image-lightbox')?.addEventListener('click',closeImage);
    $('modal-image-lightbox')?.addEventListener('click',e=>{if(e.target===$('modal-image-lightbox'))closeImage();});
    $('viewQPButton')?.addEventListener('click',()=>showQuestionPaper());
    $('VI')?.addEventListener('click',()=>showInstructions());
    if(window.Renderer?.applyUiScale)window.Renderer.applyUiScale();
  }
  function showInstructions(){
    const modal=$('modal-instructions'),src=$('instructions-body'),dst=$('modal-instructions-body');
    if(dst&&src)dst.replaceChildren(src.cloneNode(true));if(modal)modal.style.display='flex';
  }
  function showQuestionPaper(){
    const modal=$('modal-qpaper'),body=$('modal-qpaper-body');
    if(body){body.replaceChildren();for(const [i,q] of data.review.entries()){
      body.append(create('p',null,'Q'+(i+1)+'. '+(q.question_text||'')+' ['+originalStatus(q)+']'));
    }}if(modal)modal.style.display='flex';
  }
  async function init(){
    if(!id||!DrillAPI.auth()){location.replace('index.html?unlock=1');return;}
    try{
      data=await DrillAPI.result(id);
      if(!Array.isArray(data.review)||!data.review.length)throw Error('No completed question review was returned');
      setScreen();render();
    }catch(e){setScreen();message('Could not open analysis: '+e.message);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
