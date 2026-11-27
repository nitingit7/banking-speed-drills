/* Drill selection only. The exam screen lives in drill.html and is untouched. */
(function(){'use strict';
  const $=id=>document.getElementById(id);
  const SYLLABUS={
    'Quantitative Aptitude':['Number System','Simplification','Approximation','Decimal Fractions','Time and Work','Age Problems','Percentage','Permutation and Combination','HCF and LCM','Simple Interest','Time and Distance','Ratio and Proportion','Probability','Profit and Loss','Compound Interest','Average','Partnership','Data Interpretation','Data Sufficiency','Quadratic Equations'],
    'Reasoning Ability':['Box-Based Puzzle','Floor or Floor-flat-based Puzzles','Day/ Month/ Year-Based Puzzle','Comparison/Categorised/ Uncertain Puzzles Miscellaneous','Ranking and Time','Word Formation','Alphabet/ Number/ Symbol Series','Inequality','Syllogism','Order & Ranking','Coding-Decoding','Direction-sense','Blood-Relation','Circular/ Triangular/ Rectangular/ Square Seating Arrangement','Linear Seating Arrangement Puzzles'],
    'English Language':['Reading Comprehension','Cloze Test','Para Jumbles / Sentence Rearrangement / Paragraph Completion','Error Spotting / Sentence Correction','Fill in the Blanks & Vocabulary / Multiple Meaning']
  };
  const slug=t=>t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const keyFor=(s,t)=>s==='Quantitative Aptitude'&&t==='Data Sufficiency'?'quant-data-sufficiency':slug(t);
  const topics=Object.entries(SYLLABUS).flatMap(([subject,names],i)=>names.map((title,j)=>({subject,title,key:keyFor(subject,title),available:0,position:i*100+j})));
  let currentSubject='Quantitative Aptitude';const selected=new Set(),allocation={},allocationCustom={};let pending=null,unfinished=[];
  function banner(message,good=false){const b=$('status-banner');b.textContent=message;b.style.background=good?'#edfbf4':'#fff5de';b.style.color=good?'#116443':'#795b21'}
  function selectedTopics(){return topics.filter(t=>selected.has(t.key))}
  function selectedSubjects(){return Object.keys(SYLLABUS).filter(s=>selectedTopics().some(t=>t.subject===s))}
  function availableFor(subject){return selectedTopics().filter(t=>t.subject===subject).reduce((n,t)=>n+Number(t.available||0),0)}
  function allSelectedAvailability(){return selectedTopics().reduce((n,t)=>n+Number(t.available||0),0)}
  function drawSubjects(){const tab=$('subject-tabs');tab.replaceChildren();for(const name of Object.keys(SYLLABUS)){const amount=selectedTopics().filter(t=>t.subject===name).length;const b=document.createElement('button');b.className='subject-tab'+(currentSubject===name?' active':'');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(currentSubject===name));b.textContent=name+(amount?'  ('+amount+')':'');b.onclick=()=>{currentSubject=name;drawSubjects();drawTopics()};tab.append(b)}}
  function drawTopics(){const root=$('topic-list');root.replaceChildren();$('subject-heading').textContent=currentSubject;const list=topics.filter(t=>t.subject===currentSubject);for(const t of list){const label=document.createElement('label');label.className='topic'+(selected.has(t.key)?' checked':'');const input=document.createElement('input');input.type='checkbox';input.checked=selected.has(t.key);input.onchange=()=>{if(input.checked)selected.add(t.key);else selected.delete(t.key);drawSubjects();drawTopics()};const body=document.createElement('div');body.className='name';body.textContent=t.title;const count=document.createElement('span');count.className='count';count.textContent=t.available+' approved questions';body.append(count);label.append(input,body);root.append(label)}
    $('select-all').disabled=list.every(t=>selected.has(t.key));$('clear-subject').disabled=!list.some(t=>selected.has(t.key));drawSelectionSummary();drawCounts();}
  function drawSelectionSummary(){const chosen=selectedTopics(),available=allSelectedAvailability();$('selection-help').textContent=chosen.length+' topic'+(chosen.length===1?'':'s')+' selected · '+available+' approved questions available';const chips=$('selected-subject-chips');chips.replaceChildren();for(const s of selectedSubjects()){const tag=document.createElement('span');tag.className='subject-chip';tag.textContent=s+': '+chosen.filter(t=>t.subject===s).length+' topics';chips.append(tag)}}
  const presetValues=['5','10','15','20','25','30','40','50','75','100'];
  function makeSelect(value,onChange){const select=document.createElement('select');select.setAttribute('aria-label','Question count preset');for(const p of presetValues){const opt=document.createElement('option');opt.value=p;opt.textContent=p+' questions';select.append(opt)}const other=document.createElement('option');other.value='custom';other.textContent='Custom';select.append(other);select.value=presetValues.includes(String(value))?String(value):'custom';select.onchange=()=>onChange(select.value);return select}
  function drawCounts(){const subs=selectedSubjects();const multi=subs.length>1;$('single-count').hidden=multi;$('multi-count').hidden=!multi;
    const preset=$('question-preset');const input=$('question-count');input.hidden=preset.value!=='custom';if(preset.value!=='custom')input.value=preset.value;
    $('count-hint').textContent='Available in selected topics: '+allSelectedAvailability()+' · maximum 100 questions';
    const fields=$('subject-count-fields');fields.replaceChildren();if(multi){for(const s of subs){if(!Number.isFinite(allocation[s]))allocation[s]=10;const row=document.createElement('div');row.className='allocation-row';const details=document.createElement('div');details.className='allocation-subject';const name=document.createElement('strong');name.textContent=s;const hint=document.createElement('span');hint.className='hint';hint.textContent=availableFor(s)+' available';details.append(name,hint);const controls=document.createElement('div');controls.className='allocation-controls';const v=allocation[s];const select=makeSelect(v,newValue=>{allocationCustom[s]=newValue==='custom';if(newValue!=='custom')allocation[s]=Number(newValue);drawCounts()});if(allocationCustom[s])select.value='custom';select.setAttribute('aria-label',s+' preset question count');const custom=document.createElement('input');custom.type='number';custom.min='1';custom.max='100';custom.step='1';custom.value=String(v);custom.setAttribute('aria-label',s+' custom question count');custom.hidden=select.value!=='custom';custom.oninput=()=>{allocation[s]=Number(custom.value);updateAllocationTotal()};controls.append(select,custom);row.append(details,controls);fields.append(row)}}updateAllocationTotal()}
  function updateAllocationTotal(){const subs=selectedSubjects();let total=0;for(const s of subs)total+=Number(allocation[s]||0);$('allocated-total').textContent=total+' / 100';$('allocated-total').classList.toggle('invalid',total>100||total<1);$('allocation-hint').textContent=subs.length+' subjects · '+subs.map(s=>s+': '+(allocation[s]||0)).join(' · ')}
  function prettySeconds(sec){const m=Math.floor(sec/60),r=sec%60;return m?m+'m '+(r?r+'s':''):r+'s'}
  function currentPer(){return document.querySelector('input[name="mode"]:checked')?.value==='challenge'?30:45}
  function countForSubject(subject){
    const subs=selectedSubjects();
    if(subs.length>1)return Number(allocation[subject]||0);
    return Number($('question-preset').value==='custom'?$('question-count').value:$('question-preset').value)||0;
  }
  function settings(){if(!DrillAPI.auth()){unlockVisible(true);return null}if(!selected.size){banner('Choose at least one topic first.');return null}
    const subs=selectedSubjects();const isMulti=subs.length>1;const quotas={};let count=0;if(isMulti){for(const s of subs){const n=Number(allocation[s]);if(!Number.isInteger(n)||n<1||n>100){banner('Enter 1–100 whole-number questions for each selected subject.');return null}if(n>availableFor(s)){banner('Only '+availableFor(s)+' approved questions available in '+s+'. Reduce this subject\'s count.');return null}quotas[s]=n;count+=n}}
    else{count=Number($('question-preset').value==='custom'?$('question-count').value:$('question-preset').value);if(count>allSelectedAvailability()){banner('Only '+allSelectedAvailability()+' approved questions available in the selected topics.');return null}}
    if(!Number.isInteger(count)||count<1||count>100){banner('Select a total of 1–100 whole-number questions.');return null}
    const mode=document.querySelector('input[name="mode"]:checked')?.value||'normal';
    const secondsPerSubject=Object.fromEntries(subs.map(subject=>[subject,currentPer()]));
    return{count,mode,seconds:mode==='challenge'?30:45,keys:[...selected],quotas,subjects:subs,section_seconds:secondsPerSubject};}
  function unlockVisible(v){$('unlock-modal').classList.toggle('open',v)}
  function loginGate(){
    const loggedIn=!!DrillAPI.auth();
    $('protected-drill').classList.toggle('locked',!loggedIn);
    $('login-mask').hidden=loggedIn;
    $('start-drill').disabled=!loggedIn;
    if(!loggedIn){$('connection-state').textContent='Private practice space';$('btn-unlock').textContent='Sign in';}
  }
  function drawResume(){
    const box=$('resume-area'),list=$('resume-list');list.replaceChildren();
    box.hidden=!unfinished.length;
    for(const a of unfinished){
      const wrap=document.createElement('div');wrap.className='resume-row';
      const detail=document.createElement('div');
      const label=document.createElement('strong');label.textContent=(a.mode==='challenge'?'🔥 Challenge':'🟢 Normal')+' · '+a.total+' questions';
      const sub=document.createElement('small');sub.textContent='Started '+new Date(a.started_at).toLocaleString('en-IN')+' · opens question '+Math.min(Number(a.current_index||0)+1,a.total);
      detail.append(label,sub);
      const link=document.createElement('a');link.className='resume-btn';link.href='drill.html?attempt='+encodeURIComponent(a.id);link.textContent='Resume Test';
      wrap.append(detail,link);list.append(wrap);
    }
  }
  async function refresh(){
    loginGate();
    if(!DrillAPI.auth()){
      unfinished=[];drawResume();$('status-banner').hidden=true;
      return;
    }
    banner('Loading question availability and unfinished tests…');$('status-banner').hidden=false;
    try{
      const [data,history]=await Promise.all([DrillAPI.catalog(),DrillAPI.attempts()]);
      const lookup=new Map((data.topics||[]).map(t=>[t.key,t]));
      for(const t of topics){const server=lookup.get(t.key);t.available=server&&server.subject===t.subject?Number(server.available)||0:0}
      unfinished=(history.attempts||[]).filter(a=>a.status==='active');
      drawSubjects();drawTopics();drawResume();
      $('connection-state').textContent=DrillAPI.auth()?.displayName||'Connected';$('btn-unlock').textContent='Sign out';
      $('status-banner').hidden=true;
    }catch(e){banner('Unable to load your account data: '+e.message);$('status-banner').hidden=false}
  }
  $('btn-unlock').onclick=()=>{if(DrillAPI.auth()){if(confirm('Sign out this device? Your history remains on your VM.')){DrillAPI.signOut();location.reload()}}else unlockVisible(true)};
  $('close-unlock').onclick=()=>unlockVisible(false);
  $('unlock-form').onsubmit=async e=>{e.preventDefault();$('unlock-error').textContent='';$('submit-unlock').disabled=true;try{await DrillAPI.unlock($('unlock-email').value.trim(),$('unlock-password').value);$('unlock-password').value='';unlockVisible(false);await refresh()}catch(err){$('unlock-error').textContent=err.message}finally{$('submit-unlock').disabled=false}};
  $('unlock-in-panel').onclick=()=>unlockVisible(true);
  $('select-all').onclick=()=>{for(const t of topics.filter(t=>t.subject===currentSubject))selected.add(t.key);drawSubjects();drawTopics()};
  $('clear-subject').onclick=()=>{for(const t of topics.filter(t=>t.subject===currentSubject))selected.delete(t.key);drawSubjects();drawTopics()};
  $('question-preset').onchange=()=>drawCounts();
  
  $('start-drill').onclick=()=>{pending=settings();if(!pending)return;const total=pending.subjects.reduce((n,sub)=>n+(pending.quotas[sub]||pending.count)*pending.section_seconds[sub],0);const summary=$('start-summary');summary.replaceChildren();const intro=document.createElement('strong');intro.textContent=(pending.mode==='challenge'?'🔥 Challenge':'🟢 Normal')+' · '+pending.count+' questions · sectional timing';summary.append(intro);const d=document.createElement('div');d.className='hint';d.textContent='Maximum total '+Math.floor(total/60)+'m '+(total%60)+'s · '+pending.keys.length+' selected topics';summary.append(d);if(pending.subjects.length>1){const ul=document.createElement('ul');ul.className='allocation-list';for(const s of pending.subjects){const li=document.createElement('li');li.textContent=s+': '+pending.quotas[s]+' questions · '+prettySeconds(pending.quotas[s]*pending.section_seconds[s]);ul.append(li)}summary.append(ul)}$('start-error').textContent='';
    const warn=$('unfinished-warning');warn.hidden=!unfinished.length;
    warn.textContent=unfinished.length?'You have '+unfinished.length+' unfinished test'+(unfinished.length===1?'':'s')+'. Starting another will NOT pause or delete the existing test. Its VM timer continues. Choose Start to proceed or Back to cancel.':'';
    $('start-modal').classList.add('open')};
  $('cancel-start').onclick=()=>$('start-modal').classList.remove('open');
  $('confirm-start').onclick=async()=>{if(!pending)return;$('confirm-start').disabled=true;$('start-error').textContent='';try{sessionStorage.setItem('bankdrills_pending_start_v1',JSON.stringify(pending));location.href='drill.html?prepare=1'}catch(e){$('start-error').textContent=e.message}finally{$('confirm-start').disabled=false}};
  loginGate();drawSubjects();drawTopics();refresh();if(new URLSearchParams(location.search).has('unlock')&&!DrillAPI.auth())unlockVisible(true);
})();
