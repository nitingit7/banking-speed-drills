/* Server-backed adapter for the user's ORIGINAL result.html and result.js layout.
 * The original renderer never sees a live question bank. It receives only
 * completed-attempt data from an owner-authenticated PocketBase result route.
 */
(function(){
  'use strict';
  const id=new URLSearchParams(location.search).get('attempt');
  const $=x=>document.getElementById(x);
  const secLabel=s=>s||'Selected Topics';
  const num=v=>Number(v)||0;
  const dur=(n)=>{n=Math.max(0,Math.round(num(n)));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
  const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const toSeconds=(a)=>{
    const from=Date.parse(String(a?.started_at||''));const to=Date.parse(String(a?.finished_at||''));
    if(!Number.isFinite(from)||!Number.isFinite(to))return null;
    return Math.max(0,Math.min((to-from)/1000,num(a.total)*num(a.seconds_per_question||45)));
  };
  const subjMap=new Map();
  const safeDate=s=>{const dt=new Date(s);return Number.isFinite(dt.getTime())?dt.toLocaleString('en-IN'):'—'};
  function status(msg){$('result-overall').innerHTML='<h3>Your Result</h3><p>'+esc(msg)+'</p>'}
  async function start(){
    if(!id||!DrillAPI.auth()){location.replace('index.html?unlock=1');return}
    status('Loading your completed results securely from your VM…');
    try{
      const data=await DrillAPI.result(id);
      if(!Array.isArray(data.review)||!data.review.length)throw Error('This attempt has no completed question review');
      const [catalog,history]=await Promise.all([
        DrillAPI.catalog().catch(()=>({topics:[]})),
        DrillAPI.attempts().catch(()=>({attempts:[]}))
      ]);
      for(const item of catalog.topics||[])subjMap.set(String(item.key),String(item.subject));
      const groups=new Map();
      for(const q of data.review){
        const subject=secLabel(subjMap.get(String(q.topic_key))||String(q.topic_key||'Speed Drill'));
        if(!groups.has(subject))groups.set(subject,{sectionName:subject,totalQuestions:0,attempted:0,correct:0,wrong:0});
        const s=groups.get(subject);s.totalQuestions++;
        const selected=Number(q.selected);
        if(Number.isInteger(selected)&&selected>=1){s.attempted++;if(selected===num(q.correct_index))s.correct++;else s.wrong++}
      }
      const sections=[...groups.values()].map(s=>({
        ...s,accuracy:s.attempted?+(100*s.correct/s.attempted).toFixed(1):0,
        score:+(s.correct-s.wrong*.25).toFixed(2),totalMarks:s.totalQuestions,
        timeSpent:null,cutoff:null,passed:null,endReason:'-'
      }));
      const elapsed=toSeconds(data);
      const record={
        attemptId:id,candidateName:DrillAPI.auth()?.displayName||'Candidate',
        testName:'Speed Drill · '+(data.mode==='challenge'?'🔥 Challenge':'🟢 Normal'),
        totalScore:num(data.score),totalMarks:num(data.total),totalQ:num(data.total),
        totalCorrect:num(data.correct),totalWrong:num(data.wrong),totalUnattempted:num(data.skipped),
        totalAttempted:num(data.correct)+num(data.wrong),
        overallAccuracy:num(data.correct)+num(data.wrong)?+((num(data.correct)*100)/(num(data.correct)+num(data.wrong))).toFixed(1):0,
        totalTime:elapsed,submittedAt:data.finished_at,sectionResults:sections,
        overallPassed:null,questionTimes:[],integrity:null
      };
      // Virtual storage in memory only. Does not persist the answer key or
      // overwrite the actual browser-local exam/storage records.
      const all=[...(history.attempts||[])].filter(a=>a.status==='completed').reverse().map(a=>({
        attemptId:a.id,testName:(a.mode==='challenge'?'🔥 Challenge':'🟢 Normal')+' Speed Drill',
        totalScore:num(a.score),totalMarks:num(a.total),totalTime:Math.max(0,
          (Date.parse(String(a.finished_at))-Date.parse(String(a.started_at)))/1000)||0,
        submittedAt:a.finished_at,integrity:null
      }));
      const attempt={attemptId:id,submitted:true,testData:{meta:{
        examName:'Banking Speed Drill',testName:data.mode==='challenge'?'Challenge Mode':'Normal Mode',
        allowReattempt:true
      },sections:sections.map(s=>({name:s.sectionName,questions:[]}))}};
      window.Storage={loadActiveAttempt:()=>attempt,loadTestData:()=>attempt.testData,
        getAttemptById:x=>x===id?record:null,loadAttempts:()=>all,
        saveAnalysisAttempt:()=>{},clearActiveAttempt:()=>{},loadOriginalTestData:()=>null,
        saveTestData:()=>{}};
      window.State={calculateResults:()=>record};
      window.Timer={formatDuration:dur,formatHuman:dur};
      window.Sanitiser={escapeHtml:esc};
      // Use the source project's original result renderer, preserving its
      // original scorecards, tables, charts, and history layout.
      const js=document.createElement('script');js.src='js/result-original-adapted.js?v=4';
      js.onerror=()=>status('Could not load the original result renderer. Verify the GitHub Pages upload includes js/result-original-adapted.js.');
      document.body.appendChild(js);
      // Intercept only navigation features that originally depended on
      // non-server localStorage, keeping all their visible original buttons.
      document.addEventListener('click',e=>{
        const btn=e.target.closest('#btn-home,#btn-analyse,.btn-view-attempt');
        if(!btn)return;
        e.preventDefault();e.stopImmediatePropagation();
        if(btn.id==='btn-home'){location.href='index.html';return}
        if(btn.id==='btn-analyse'){location.href='drill.html?mode=analyse&attempt='+encodeURIComponent(id);return}
        if(btn.classList.contains('btn-view-attempt')){location.href='drill.html?mode=analyse&attempt='+encodeURIComponent(btn.dataset.id);return}
      },true);
    } catch(e){status('Unable to load result: '+(e?.message||e));}
  }
  // explicit home-button behavior even when results fail to load
  $('btn-home')?.addEventListener('click',()=>{location.href='index.html'});
  start();
})();
