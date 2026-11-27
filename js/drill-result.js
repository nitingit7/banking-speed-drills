(function(){'use strict';const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('attempt');let data=null,filter='all';
 function node(tag,cl,text){const e=document.createElement(tag);if(cl)e.className=cl;if(text!==undefined)e.textContent=String(text);return e}
 function state(q){if(!q.selected)return 'skipped';return Number(q.selected)===Number(q.correct_index)?'correct':'wrong'}
 function addImg(parent,uri,label){if(typeof uri==='string'&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(uri)){const im=node('img');im.src=uri;im.alt=label;parent.append(im)}}
 function render(){if(!data)return;const mode=data.mode==='challenge'?'🔥 Challenge':'🟢 Normal';$('result-title').textContent=mode+' Drill · '+data.total+' Questions';$('result-desc').textContent=new Date(data.started_at).toLocaleString('en-IN')+' · '+data.topic_keys.join(', ');$('res-score').textContent=Number(data.score).toFixed(2)+' / '+data.total;const attempted=Number(data.correct)+Number(data.wrong);$('res-accuracy').textContent=attempted?(100*Number(data.correct)/attempted).toFixed(1)+'%':'—';$('res-correct').textContent=data.correct+' / '+data.wrong;$('res-skipped').textContent=data.skipped;const list=$('review-list');list.replaceChildren();let shown=0;
   for(const q of data.review){const s=state(q);if(filter!=='all'&&filter!==s)continue;shown++;
     const item=node('article','review-item');const head=node('h3','', 'Question '+q.index+' · '+(s==='correct'?'Correct':s==='wrong'?'Incorrect':'Skipped'));item.append(head);
     const mt=node('div','meta',q.topic_key+' · '+q.source_name+(q.source_page?' · Page '+q.source_page:''));item.append(mt);
     const question=node('div','question',q.question_text);item.append(question);addImg(item,q.question_image_data,'Question figure');
     (q.options||[]).forEach((o,i)=>{const v=i+1,box=node('div','option'+(v===Number(q.correct_index)?' correct':'')+(v===Number(q.selected)&&v!==Number(q.correct_index)?' incorrect':''));box.textContent=v+'. '+o+(v===Number(q.correct_index)?'  ✓ Correct':v===Number(q.selected)?'  ✗ Your choice':'');item.append(box)});
     const meta=node('div','note','Your answer: '+(q.selected?'Option '+q.selected:'Skipped')+' · Correct answer: Option '+q.correct_index);item.append(meta);
     if(q.answer_note)item.append(node('div','note',q.answer_note));addImg(item,q.answer_image_data,'Source final answer arrangement or diagram');list.append(item);
   }
   if(!shown)list.append(node('div','hint','No questions match this filter.'));
 }
 document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.getAttribute('data-filter');document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render()}));
 (async()=>{if(!id||!DrillAPI.auth()){location.replace('index.html?unlock=1');return}try{data=await DrillAPI.result(id);render()}catch(e){$('result-desc').textContent='Could not load results: '+e.message;const a=node('a','', 'Back to home');a.href='index.html';$('review-list').append(a)}})();
})();
