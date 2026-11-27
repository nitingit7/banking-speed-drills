/* Read-only analyse mode in the exact original exam-page DOM and styles.
 * Fetches complete answer keys ONLY after the owning member's attempt ended.
 */
(function(){
 'use strict';
 const params=new URLSearchParams(location.search);
 if(params.get('mode')!=='analyse') return;
 const id=params.get('attempt'),$=s=>document.getElementById(s);
 const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
 let data,index=0,filter='all';
 const status=q=>{
   if(!q?.selected)return 'skipped';return Number(q.selected)===Number(q.correct_index)?'correct':'wrong'
 };
 const mapClass=q=>status(q)==='skipped'?'not_answered':status(q)==='correct'?'answered':'review';
 function message(text){const d=$('quesAnsContent');if(d)d.textContent=text}
 function setScreen(){
   for(const name of ['instructions','declaration','exam']){
     const s=$('screen-'+name);if(s)s.style.display=name==='exam'?'block':'none';
   }
   document.querySelectorAll('.instMockName, .mockName').forEach(el=>el.textContent='Banking Speed Drill');
   if($('exam_name_h1'))$('exam_name_h1').textContent='BANKING SPEED DRILL';
   document.querySelectorAll('.groupName').forEach(el=>el.textContent='Speed Drill');
   document.querySelectorAll('#viewSection b, #Physics, .subjectName').forEach(el=>{el.textContent='Speed Drill';el.title='Speed Drill'});
   const wrongMark=document.querySelector('.marking-details .negativeMarks');
   if(wrongMark?.nextElementSibling)wrongMark.nextElementSibling.textContent='0.25';

   document.querySelectorAll('#sections .subject-name').forEach((el,i)=>{
     if(i)el.style.display='none';else el.querySelectorAll('.sectionName').forEach(x=>x.textContent='Speed Drill');
   });
   document.querySelectorAll('#sectionId1,#sectionId2').forEach(el=>{const wrap=el.closest('.swiper-slide')||el;wrap.style.display='none'});
   const title=$('rightSectionDiv2')?.querySelector('.header b');if(title)title.textContent='Speed Drill';
   for(const el of document.querySelectorAll('.candOrigName,.candOriginalName,.userName1,.decl-cand-name'))el.textContent=DrillAPI.auth()?.displayName||'Candidate';
   for(const key of ['underreview','clearResponse','savenext','finalSubmit','finalSubmitMbl','savenextGroup',
     'underreviewMbl','clearResponseMbl','savenextMbl','optionselectionButton','optionselectionButtonMb1']){
     if($(key))$(key).style.display='none';
   }
   const bar=$('analyse-top-bar');if(bar)bar.style.display='flex';
   // Original re-attempt toggle depends on a new authenticated API capability;
   // leave visible but disabled rather than pretending to save local answers.
   const toggle=$('reattempt-switch');if(toggle){toggle.disabled=true;toggle.title='Exact re-attempt is not yet supported by the VM';}
   if($('btn-back-to-results'))$('btn-back-to-results').href='result.html?attempt='+encodeURIComponent(id);
   for(const key of ['btnAnalyseBackResult']){const b=$(key);if(b){b.href='result.html?attempt='+encodeURIComponent(id);b.style.display='inline-block'}}
   for(const key of ['previousBtn','previousBtnMbl','btnAnalyseNext']){if($(key))$(key).style.display='inline-block'}
   if($('analyse-filter-container'))$('analyse-filter-container').style.display='block';
   const filterSel=$('analyse-filter-select');if(filterSel){
     for(const opt of filterSel.options){
       if(['unseen','marked','slow'].includes(opt.value)){
         opt.disabled=true;
         opt.title='Not recorded individually by the VM in the current attempt';
       }
     }
     filterSel.onchange=()=>{filter=filterSel.value;showPalette();if(!matches(index)){const n=data.review.findIndex(q=>matches(q.index-1));if(n>=0)index=n;render()}};
   }
   for(const key of ['previousBtn','previousBtnMbl'])$(key)?.addEventListener('click',()=>move(-1));
   $('btnAnalyseNext')?.addEventListener('click',()=>move(1));
   $('btn-close-image-lightbox')?.addEventListener('click',()=>closeImage());
   $('modal-image-lightbox')?.addEventListener('click',e=>{if(e.target===$('modal-image-lightbox'))closeImage()});
   $('viewQPButton')?.addEventListener('click',()=>showQuestionPaper());
   $('VI')?.addEventListener('click',()=>showInstructions());
   if(window.Renderer?.applyUiScale)window.Renderer.applyUiScale();
 }
 function matches(i){const q=data.review[i];if(!q)return false;
   if(filter==='all')return true;
   if(filter==='incorrect')return status(q)==='wrong';
   if(filter==='wrong')return status(q)==='wrong';
   if(filter==='correct')return status(q)==='correct';
   if(filter==='skipped'||filter==='unseen')return status(q)==='skipped';
   return true;
 }
 function showPalette(){
   const container=$('numberpanelQues');if(!container)return;
   container.replaceChildren();
   data.review.forEach((q,i)=>{
     const wrap=create('div');wrap.id='qtd'+i;
     const item=create('span','tipIcon numpan auditlog '+mapClass(q),i+1);
     item.id=String(i);item.setAttribute('role','button');item.tabIndex=0;
     if(!matches(i))item.style.opacity='.35';
     if(i===index)item.setAttribute('aria-current','true');
     item.setAttribute('aria-label','Analyse Question '+(i+1));
     item.onclick=()=>{index=i;render()};
     item.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();index=i;render()}};
     wrap.append(item);container.append(wrap)
   });
   const c={answered:0,notAnswered:0};
   for(const q of data.review){if(q.selected)c.answered++;else c.notAnswered++}
   document.querySelectorAll('.answeredCount').forEach(x=>x.textContent=c.answered);
   document.querySelectorAll('.notAnsweredCount').forEach(x=>x.textContent=c.notAnswered);
   document.querySelectorAll('.notVisitedCount,.markedCount,.markedAnsweredCount').forEach(x=>x.textContent='0');
   if($('analyse-filter-count'))$('analyse-filter-count').textContent=data.review.filter((q,i)=>matches(i)).length+'/'+data.review.length;
 }
 function move(delta){let n=index+delta;while(n>=0&&n<data.review.length&&!matches(n))n+=delta;if(n<0||n>=data.review.length)return;index=n;render()}
 function closeImage(){if($('modal-image-lightbox'))$('modal-image-lightbox').style.display='none'}
 function addImg(uri,alt,host){
   if(!/^data:image\/(png|jpeg|webp|gif);base64,/.test(uri||''))return;
   const img=create('img','drill-question-image');img.src=uri;img.alt=alt;img.style.cssText='max-width:95%;max-height:390px;object-fit:contain;display:block;cursor:zoom-in;margin:10px auto';
   img.onclick=()=>{const modal=$('modal-image-lightbox'),full=$('lightbox-img');if(modal&&full){full.src=uri;modal.style.display='flex'}};
   host.append(img);
 }
 function render(){
   const q=data.review[index];if(!q)return;
   if($('divHeader_id'))$('divHeader_id').textContent='Question No. '+(index+1);
   // Use the original renderer and original option markup, with checked
   // options plus correct/incorrect colour styling in analysis mode.
   window.SHOW_QUESTION_NO_LABEL=true; // original exam renderer's question-number heading
   const qData={question:q.question_text||'',options:q.options||[],correct:Number(q.correct_index),
     marks:1,negative:.25,explanation:q.answer_note||''};
   const qState={selectedOption:q.selected?Number(q.selected):null,
     status:q.selected?'answered':'not-answered',timeSpent:0};
   try{Renderer.renderQuestion(document.querySelector('.leftDiv'),{
     qData,qState,questionNumber:index+1,isReview:true,isReattempt:false,qElapsed:0,originalTimeSpent:0
   })}catch(err){message('Unable to display review: '+err.message)}
   const host=$('quesAnsContent');if(host){
     const questionImg=create('div');addImg(q.question_image_data,'Question image',questionImg);
     if(questionImg.childElementCount)host.insertBefore(questionImg,host.firstChild);
     if(q.answer_image_data){const answerBox=create('div','solution-box');answerBox.append(create('div','solution-title','Source answer image'));addImg(q.answer_image_data,'Source answer image',answerBox);host.append(answerBox)}
   }
   const answerEl=create('div','solution-box');answerEl.append(create('div','solution-title','Answer Review'));
   answerEl.append(create('div','solution-content','Your answer: '+(q.selected?'Option '+q.selected:'Unattempted')+' · Correct: Option '+q.correct_index));
   $('quesAnsContent')?.append(answerEl);
   if($('previousBtn'))$('previousBtn').disabled=index===0;
   if($('btnAnalyseNext'))$('btnAnalyseNext').disabled=index===data.review.length-1;
   showPalette();
   // Analysis is not a live timed attempt; show neither a misleading clock
   // nor a fabricated per-question duration.
   document.querySelectorAll('#timeInMins').forEach(x=>x.textContent='Review');
   document.querySelectorAll('#showTime,#timeResp,#showTimee').forEach(x=>x.style.display='none');
   const timeBadge=$('q-timer');if(timeBadge){const corr=q.selected&&Number(q.selected)===Number(q.correct_index);const wrong=q.selected&&!corr;timeBadge.textContent='Marks: '+(corr?'+1':wrong?'−0.25':'0')+' · Question time not recorded';}

 }
 function showInstructions(){const modal=$('modal-instructions'),src=$('instructions-body'),dst=$('modal-instructions-body');if(dst&&src)dst.replaceChildren(src.cloneNode(true));if(modal)modal.style.display='flex'}
 function showQuestionPaper(){const modal=$('modal-qpaper'),body=$('modal-qpaper-body');if(body){body.replaceChildren();data.review.forEach((q,i)=>{const p=create('p',null,'Q'+(i+1)+'. '+String(q.question_text||'')+' ['+status(q)+']');body.append(p)})}if(modal)modal.style.display='flex'}
 async function init(){
   if(!id||!DrillAPI.auth()){location.replace('index.html?unlock=1');return;}
   try{data=await DrillAPI.result(id);setScreen();index=0;render()}
   catch(e){setScreen();message('Could not open analysis: '+e.message)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
