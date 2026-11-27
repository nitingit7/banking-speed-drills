/* VM-owned performance metrics; genuine 20-item server pagination and trends. */
(function(){'use strict';
  const $=id=>document.getElementById(id);
  const topicNames=new Map();let summary=null,history=null,historyPage=1,chartRequest=0;
  const stat=(id,value)=>$(id).textContent=value;
  function banner(message,good=false){const e=$('status-banner');e.textContent=message;e.style.background=good?'#edfbf4':'#fff5de';e.style.color=good?'#116443':'#795b21'}
  function shortDate(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—'}
  function timeLabel(seconds){if(!Number.isFinite(seconds)||seconds<0)return '—';const n=Math.round(seconds),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return h?`${h}h ${m}m ${s}s`:m?`${m}m ${s}s`:`${s}s`}
  function displaySummary(d){summary=d;const c=Number(d.completed||0),best=d.best_score||null;
    stat('stat-attempts',String(c));stat('stat-accuracy',c?Number(d.average_accuracy||0).toFixed(1)+'%':'—');
    const tracked=Number(d.practice_tracked_attempts||0);
    stat('stat-time',tracked?timeLabel(Number(d.practice_seconds||0)):'—');
    $('stat-time-note').textContent=tracked?`Foreground practice recorded in ${tracked} of ${c} attempts. Older attempts not estimated.`:'Actual foreground time will be tracked for new drills; earlier attempts did not record it.';
    stat('stat-best',best?Number(best.percentage).toFixed(1)+'%':'—');
    $('best-score-note').textContent=best?Number(best.score).toFixed(2)+' / '+best.total+' marks · '+(best.mode==='challenge'?'🔥 Challenge':'🟢 Normal'):'Percentage of maximum marks';
    const first=d.first_score,last=d.latest_score;
    if(!first||!last){stat('movement-value','—');$('movement-description').textContent='Finish a drill to start tracking improvement.';$('movement-first').textContent='First attempt —';$('movement-last').textContent='Latest —';$('movement-fill').style.width='0%';$('movement-note').textContent='Comparison begins after your first completed drill.';return}
    const diff=Number(d.score_improvement_points||0);
    stat('movement-value',(diff>0?'+':'')+diff.toFixed(1)+' pts');$('movement-value').className='movement-number'+(diff<0?' negative':'');
    $('movement-description').textContent='Latest score % compared with your first completed attempt.';
    $('movement-first').textContent='First attempt '+Number(first.percentage).toFixed(1)+'%';
    $('movement-last').textContent='Latest '+Number(last.percentage).toFixed(1)+'%';
    $('movement-fill').style.width=Math.max(0,Math.min(100,Number(last.percentage)))+'%';
    $('movement-note').textContent=c===1?'Complete another drill to compare improvement.':'Percent of maximum possible score, comparable across different test lengths.';
  }
  function badge(mode){const span=document.createElement('span');span.className='pill '+(mode==='challenge'?'challenge':'normal');span.textContent=mode==='challenge'?'🔥 Challenge':'🟢 Normal';return span}
  function drawHistory(){
    const rows=$('history-rows');rows.replaceChildren();const data=history?.attempts||[];
    if(!data.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.className='none';td.textContent='No attempts on this page.';tr.append(td);rows.append(tr)}
    else for(const [i,a] of data.entries()){
      const tr=document.createElement('tr'),names=(a.topics||[]).map(k=>topicNames.get(k)||k.replace(/-/g,' '));
      const title=names.slice(0,2).join(', ')+(names.length>2?' +'+(names.length-2):'');
      const vals=[String((history.page-1)*20+i+1),shortDate(a.started_at),title||'—',null,String(a.total||0),a.status==='completed'?Number(a.score).toFixed(2)+' / '+a.total:'In progress'];
      for(const [j,value] of vals.entries()){const td=document.createElement('td');if(j===3)td.append(badge(a.mode));else td.textContent=value;tr.append(td)}
      const td=document.createElement('td'),link=document.createElement('a');link.href=(a.status==='completed'?'result.html':'drill.html')+'?attempt='+encodeURIComponent(a.id);link.textContent=a.status==='completed'?'View results':'Resume';td.append(link);tr.append(td);rows.append(tr)
    }
    const pages=Math.max(1,Number(history?.pages||1)),page=Math.max(1,Number(history?.page||1)),total=Number(history?.total||0);
    $('history-range').textContent=total?`Showing ${(page-1)*20+1}–${Math.min(page*20,total)} of ${total} · Page ${page} of ${pages}`:'0 attempts · Page 1 of 1';
    $('history-prev').disabled=page<=1;$('history-next').disabled=page>=pages;
    const buttons=$('history-pages');buttons.replaceChildren();
    const choices=new Set([1,pages,page-2,page-1,page,page+1,page+2].filter(x=>x>=1&&x<=pages));
    let last=0;for(const n of [...choices].sort((a,b)=>a-b)){
      if(n-last>1){const dots=document.createElement('span');dots.textContent='…';buttons.append(dots)}
      const b=document.createElement('button');b.type='button';b.className='page-number'+(n===page?' current':'');b.textContent=n;
      b.setAttribute('aria-label','Attempt history page '+n);b.setAttribute('aria-current',n===page?'page':'false');b.disabled=n===page;
      b.onclick=()=>loadHistory(n);buttons.append(b);last=n;
    }
  }
  async function loadHistory(page){
    if(!DrillAPI.auth())return;
    $('history-prev').disabled=true;$('history-next').disabled=true;$('history-range').textContent='Loading history page '+page+'…';
    try{history=await DrillAPI.history(page);historyPage=history.page;drawHistory()}catch(e){banner('Could not load history: '+e.message)}
  }
  function drawTrend(points,truncated){
    const host=$('trend');host.replaceChildren();
    if(!points.length){const span=document.createElement('span');span.className='hint';span.textContent='No matching completed drills in this period. Subject-specific trends include single-subject tests only.';host.append(span);return}
    const metric=$('trend-metric').value==='accuracy'?'accuracy_pct':'score_pct',NS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 600 245');svg.classList.add('chart');
    svg.setAttribute('role','img');svg.setAttribute('aria-label',metric==='score_pct'?'Score percentage trend':'Accuracy percentage trend');
    const minimum=metric==='score_pct'?-25:0,top=100;
    function y(val){return 212-(Math.max(minimum,Math.min(top,Number(val)))-minimum)/(top-minimum)*180}
    const x=i=>46+(i*520/Math.max(1,points.length-1));
    function child(tag,attrs){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,String(v));svg.append(n);return n}
    for(const tick of [minimum,0,25,50,75,100].filter((v,i,a)=>a.indexOf(v)===i)){
      const yy=y(tick);child('line',{x1:42,y1:yy,x2:578,y2:yy,stroke:'#e0eaf2','stroke-width':1});
      const t=child('text',{x:35,y:yy+4,'text-anchor':'end','font-size':11,fill:'#71849b'});t.textContent=tick+'%';
    }
    const poly=child('polyline',{points:points.map((p,i)=>`${x(i)},${y(p[metric])}`).join(' '),fill:'none',stroke:'#147eb3','stroke-width':2.8,'stroke-linejoin':'round'});
    for(const [i,p] of points.entries()){
      const dot=child('circle',{cx:x(i),cy:y(p[metric]),r:points.length>75?2.5:4,fill:'#147eb3'});
      const title=document.createElementNS(NS,'title');title.textContent=shortDate(p.finished_at)+' · '+p.subject+' · '+Number(p[metric]).toFixed(1)+'%';dot.append(title);
    }
    host.append(svg);
    $('trend-description').textContent=(metric==='score_pct'?'Score as % of maximum marks (wrong answers can lower it).':'Accuracy = correct ÷ attempted × 100%.')+' Each point is one completed drill.';
    $('trend-note').textContent=points.length+' completed attempt'+(points.length===1?'':'s')+' in range'+(truncated?' · chart limited to newest 2,000 attempts':'');
  }
  async function loadTrend(){
    if(!DrillAPI.auth())return;
    const serial=++chartRequest;const host=$('trend');host.textContent='Loading trend from VM…';
    try{const data=await DrillAPI.trends($('trend-range').value,$('trend-subject').value);
      if(serial===chartRequest)drawTrend(data.points||[],!!data.truncated);
    }catch(e){if(serial===chartRequest){host.textContent='Could not load chart: '+e.message;$('trend-note').textContent=''}}
  }
  async function refresh(){
    const loading=$('performance-loading');loading.hidden=false;
    if(!DrillAPI.auth()){loading.hidden=true;banner('Sign in to load performance data.');return}
    banner('Syncing performance from your VM…');
    try{const [stats,cat]=await Promise.all([DrillAPI.stats(),DrillAPI.catalog()]);
      topicNames.clear();for(const t of cat.topics||[])topicNames.set(t.key,t.title);
      displaySummary(stats);await Promise.all([loadHistory(historyPage),loadTrend()]);
      banner('Your performance data is synced with the VM.',true);
      $('connection-state').textContent=DrillAPI.auth()?.displayName||'Connected';$('btn-unlock').textContent='Sign out';
    }catch(e){banner('Could not sync performance: '+e.message)}finally{loading.hidden=true}
  }
  const unlockVisible=v=>$('unlock-modal').classList.toggle('open',v);
  $('btn-unlock').onclick=()=>{if(DrillAPI.auth()){if(confirm('Sign out this device? Your attempts remain on the VM.')){DrillAPI.signOut();location.reload()}}else unlockVisible(true)};
  $('close-unlock').onclick=()=>unlockVisible(false);
  $('unlock-form').onsubmit=async e=>{e.preventDefault();$('unlock-error').textContent='';$('submit-unlock').disabled=true;try{await DrillAPI.unlock($('unlock-email').value.trim(),$('unlock-password').value);$('unlock-password').value='';unlockVisible(false);await refresh()}catch(err){$('unlock-error').textContent=err.message}finally{$('submit-unlock').disabled=false}};
  $('refresh').onclick=refresh;$('history-prev').onclick=()=>loadHistory(historyPage-1);$('history-next').onclick=()=>loadHistory(historyPage+1);
  for(const id of ['trend-range','trend-subject','trend-metric'])$(id).onchange=loadTrend;
  refresh();if(new URLSearchParams(location.search).has('unlock')&&!DrillAPI.auth())unlockVisible(true);
})();
