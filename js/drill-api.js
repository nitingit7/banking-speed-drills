/* Shared auth + API client. Never stores question banks, scores or answer keys in frontend. */
window.DrillAPI = (() => {
  const base=(window.BANKDRILLS_API_BASE||'').replace(/\/+$/,'');
  const key='bankdrills_member_v1';
  function auth(){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function saveAuth(a){localStorage.setItem(key,JSON.stringify(a))}
  function signOut(){localStorage.removeItem(key)}
  async function request(path,{method='GET',body,publicCall=false,keepalive=false}={}){
    if(!base || !base.startsWith('https://') && !base.startsWith('http://localhost')) throw new Error('Configure an HTTPS PocketBase API in config.js');
    const headers={'Accept':'application/json'};
    if(body!==undefined) headers['Content-Type']='application/json';
    if(!publicCall){const a=auth();if(!a||!a.token)throw new Error('Unlock your private drill account first');headers['Authorization']=a.token}
    let response;
    try{response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',keepalive})}
    catch(_){throw new Error('Cannot reach VM API. Check domain, HTTPS, and deployment.')}
    const json=await response.json().catch(()=>({}));
    if(!response.ok){if(response.status===401)signOut();throw new Error(json.message||json.data?.message||('API error '+response.status))}
    return json;
  }
  async function unlock(identity,password){
    const d=await request('/api/collections/drill_members/auth-with-password',{method:'POST',body:{identity,password},publicCall:true});
    if(!d.token||!d.record?.id)throw new Error('Login was not accepted');
    saveAuth({token:d.token,memberId:d.record.id,displayName:d.record.display_name||'Candidate'});return auth();
  }
  const api={base,auth,unlock,signOut,request,
    catalog:()=>request('/api/bankdrills/catalog'),
    attempts:()=>request('/api/bankdrills/attempts'),
    unfinished:()=>request('/api/bankdrills/attempts/unfinished'),
    cancelAllUnfinished:()=>request('/api/bankdrills/attempts/cancel-active',{method:'POST',body:{}}),
    history:(page=1)=>request('/api/bankdrills/attempts/history?page='+encodeURIComponent(page)),
    trends:(range='30d',subject='all')=>request('/api/bankdrills/trends?range='+encodeURIComponent(range)+'&subject='+encodeURIComponent(subject)),
    start:(mode,topic_keys,count,subject_counts={},subject_seconds_per_question={})=>request('/api/bankdrills/attempts/start',{method:'POST',body:{mode,topic_keys,count,subject_counts,subject_seconds_per_question}}),
    stats:()=>request('/api/bankdrills/stats'),
    current:(id)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)),
    answer:(id,index,choice,mark_for_review=false)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/answer',{method:'POST',body:{index,choice,mark_for_review}}),
    navigate:(id,index)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/navigate',{method:'POST',body:{index}}),
    advance:(id,index)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/advance',{method:'POST',body:{index}}),
    submit:(id,section_index=null)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/submit',{method:'POST',body:{section_index}}),
    heartbeat:(id,visible=true,resuming=false)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/heartbeat',{method:'POST',body:{visible,resuming},keepalive:visible===false}),
    result:(id)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/result')
  };
  return api;
})();
