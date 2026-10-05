'use strict';
// Only public practice questions are fetched. Personal records never leave this browser.
window.QuizPetStore=(()=>{
 const key='quizpet-pages-v1:'+new URL('.',location.href).pathname;
 let bankPromise;
 const bank=()=>bankPromise??=(fetch('./questions.json').then(r=>{if(!r.ok)throw Error('문제 파일을 불러오지 못했어요. 새로고침해 주세요.');return r.json();}).catch(e=>{bankPromise=null;throw e;}));
 const read=()=>{let value;try{value=localStorage.getItem(key);}catch{throw Error('브라우저 저장소를 사용할 수 없어요. 일반 브라우저 창에서 열어 주세요.');}if(!value)return [];try{const data=JSON.parse(value);if(data.version!==1||!Array.isArray(data.records))throw Error();return data.records;}catch{throw Error('저장된 기록을 읽을 수 없어요. 브라우저 데이터를 삭제하지 말고 백업 파일을 확인해 주세요.');}};
 const write=records=>{try{localStorage.setItem(key,JSON.stringify({version:1,records}));}catch{throw Error('기록을 저장하지 못했어요. 저장 공간을 확인해 주세요. 이번 답은 저장되지 않았어요.');}};
 const progress=exp=>{const level=Math.floor(Math.sqrt(exp/100))+1;return {totalExp:exp,level,growthStage:level===1?'EGG':level<=3?'BABY':level<=6?'BEGINNER':level<=9?'ADVANCED':'MASTER',levelStartExp:100*(level-1)**2,nextLevelExp:100*level**2};};
 const latest=records=>{const result=new Map();for(const r of records){const prior=result.get(r.question_id);if(!prior||Date.parse(r.solved_at)>=Date.parse(prior.solved_at))result.set(r.question_id,r);}return result;};
 const stats=(records,questions)=>{const last=[...latest(records).values()],correct=records.filter(r=>r.correct).length,latestCorrect=last.filter(r=>r.correct).length;return {id:'this-browser',...progress(correct*10),attempts:records.length,correct,uniqueSolved:last.length,latestCorrect,reviewNeeded:last.length-latestCorrect,totalQuestions:questions.length};};
 async function exclusive(fn){return navigator.locks? navigator.locks.request(key,fn):fn();}
 async function api(path,options={}){
  const questions=await bank(),byId=new Map(questions.map(q=>[q.id,q])),url=new URL(path,'https://quizpet.invalid'),parts=url.pathname.split('/').filter(Boolean),p=url.searchParams,records=read(),last=latest(records);
  const qFor=id=>{const q=byId.get(id);if(!q)throw Error('문제를 찾을 수 없어요.');return q;};
  if(options.method==='POST'){
   if(parts[0]!=='questions'||parts[2]!=='answers')throw Error('지원하지 않는 요청입니다.');
   const q=qFor(parts[1]),selected=JSON.parse(options.body).selectedChoice;
   if(!Number.isInteger(selected)||selected<1||selected>4)throw Error('답을 1~4번 중에서 골라 주세요.');
   return exclusive(()=>{const fresh=read(),previous=stats(fresh,questions),correct=selected===q.correctChoice;
    const r={id:crypto.randomUUID(),question_id:q.id,selected,correct:Number(correct),solved_at:new Date().toISOString()};write([...fresh,r]);const updated=stats([...fresh,r],questions);
    return {recordId:r.id,questionId:q.id,isCorrect:correct,correctChoice:q.correctChoice,explanation:q.explanation,expGained:correct?10:0,leveledUp:updated.level>previous.level,...progress(updated.totalExp),selectedChoice:selected,wrongReason:q.choices.find(c=>c.number===selected).wrongReason||q.explanation};});
  }
  if(parts[0]==='user')return stats(records,questions);
  if(parts[0]==='questions'&&parts.length===1)return questions.filter(q=>(!p.get('subject')||q.subject===p.get('subject'))&&(!p.get('difficulty')||q.difficulty===p.get('difficulty'))&&(p.get('status')!=='unseen'||!last.has(q.id))&&(p.get('status')!=='review'||last.get(q.id)?.correct===0)).map(q=>({id:q.id,content:q.content,subject:q.subject,difficulty:q.difficulty}));
  if(parts[0]==='questions'&&parts.length===2){const q=qFor(parts[1]);return {...q,topic:q.topic||'전산직',practiceType:q.practiceType||'개념',answered:last.has(q.id)};}
  const sorted=[...records].reverse().sort((a,b)=>Date.parse(b.solved_at)-Date.parse(a.solved_at));
  if(parts[0]==='records')return sorted.slice(Number(p.get('offset')||0),Number(p.get('offset')||0)+Number(p.get('limit')||100)).map(r=>({id:r.id,questionId:r.question_id,source:qFor(r.question_id).source,selectedChoice:r.selected,isCorrect:!!r.correct,solvedAt:r.solved_at,content:qFor(r.question_id).content,subject:qFor(r.question_id).subject}));
  if(parts[0]==='mistakes'){
   const wrong=new Map();for(const r of sorted)if(!r.correct&&!wrong.has(r.question_id))wrong.set(r.question_id,r);
   return [...wrong.values()].map(r=>{const q=qFor(r.question_id),status=last.get(q.id).correct?'resolved':'open',choice=q.choices.find(c=>c.number===r.selected);return {questionId:q.id,source:q.source,content:q.content,subject:q.subject,difficulty:q.difficulty,code:q.code,status,wrongCount:records.filter(x=>x.question_id===q.id&&!x.correct).length,attempts:records.filter(x=>x.question_id===q.id).length,lastWrongAt:r.solved_at,lastSolvedAt:last.get(q.id).solved_at,selectedChoice:r.selected,selectedContent:choice.content,correctChoice:q.correctChoice,correctContent:q.choices.find(c=>c.number===q.correctChoice).content,wrongReason:choice.wrongReason||q.explanation,explanation:q.explanation};}).filter(r=>(!p.get('subject')||r.subject===p.get('subject'))&&(!p.get('status')||p.get('status')==='all'||r.status===p.get('status')));
  }
  throw Error('지원하지 않는 요청입니다.');
 }
 function backup(){return {format:'quizpet-backup',version:1,exportedAt:new Date().toISOString(),records:read()};}
 async function restore(data){const questions=await bank(),byId=new Map(questions.map(q=>[q.id,q]));if(!data||!Array.isArray(data.records)||data.records.length>50000)throw Error('올바른 QuizPet 백업 파일을 선택해 주세요.');
  const imported=data.records.map(r=>{if(!r||typeof r!=='object')throw Error('백업에 잘못된 기록이 있어요.');const q=byId.get(r.question_id);if(!q||!(typeof r.id==='string'&&r.id.length>0&&r.id.length<200||Number.isSafeInteger(r.id))||!Number.isInteger(r.selected)||r.selected<1||r.selected>4||r.correct!==Number(r.selected===q.correctChoice)||typeof r.solved_at!=='string'||!Number.isFinite(Date.parse(r.solved_at)))throw Error('백업에 잘못된 기록이 있어요. 기존 기록은 유지됩니다.');return {id:Number.isSafeInteger(r.id)?'local-'+r.id:r.id,question_id:q.id,selected:r.selected,correct:r.correct,solved_at:new Date(r.solved_at).toISOString()};});
  return exclusive(()=>{const fresh=read(),ids=new Set(fresh.map(r=>r.id)),added=[];for(const r of imported)if(!ids.has(r.id)){ids.add(r.id);added.push(r);}write([...fresh,...added].sort((a,b)=>Date.parse(a.solved_at)-Date.parse(b.solved_at)));return added.length;});
 }
 return {api,backup,restore,key};
})();
