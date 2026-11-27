/* Shared auth + API client. Never stores question banks, scores or answer keys in frontend. */
window.DrillAPI = (() => {
  const base=(window.BANKDRILLS_API_BASE||'').replace(/\/+$/,'');
  const key='bankdrills_member_v1';
  function auth(){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function saveAuth(a){localStorage.setItem(key,JSON.stringify(a))}
  function signOut(){localStorage.removeItem(key)}
  async function request(path,{method='GET',body,publicCall=false}={}){
    if(!base || !base.startsWith('https://') && !base.startsWith('http://localhost')) throw new Error('Configure an HTTPS PocketBase API in config.js');
    const headers={'Accept':'application/json'};
    if(body!==undefined) headers['Content-Type']='application/json';
    if(!publicCall){const a=auth();if(!a||!a.token)throw new Error('Unlock your private drill account first');headers['Authorization']=a.token}
    let response;
    try{response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'})}
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
    start:(mode,topic_keys,count,subject_counts={})=>request('/api/bankdrills/attempts/start',{method:'POST',body:{mode,topic_keys,count,subject_counts}}),
    stats:()=>request('/api/bankdrills/stats'),
    current:(id)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)),
    answer:(id,index,choice,mark_for_review=false)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/answer',{method:'POST',body:{index,choice,mark_for_review}}),
    advance:(id,index)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/advance',{method:'POST',body:{index}}),
    submit:(id)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/submit',{method:'POST',body:{}}),
    result:(id)=>request('/api/bankdrills/attempts/'+encodeURIComponent(id)+'/result')
  };
  return api;
})();
