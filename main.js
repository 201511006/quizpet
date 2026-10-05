'use strict';
const $=id=>document.getElementById(id);
const subjects={DATABASE:'데이터베이스',OPERATING_SYSTEM:'운영체제',NETWORK:'네트워크',SECURITY:'정보보안',DATA_STRUCTURE:'자료구조',SOFTWARE_ENGINEERING:'소프트웨어공학',PROGRAMMING_LANGUAGE:'프로그래밍언어'};
const difficulties={EASY:'기초',MEDIUM:'보통',HARD:'심화'};
const stages=[
{id:'EGG',name:'두근두근, 알',label:'알',levels:'Lv. 1',exp:0,symbol:'◒',message:'첫 만남을 기다리고 있어요.'},
{id:'BABY',name:'안녕, 아기 모모',label:'아기',levels:'Lv. 2–3',exp:100,symbol:'♧',message:'만나서 반가워요! 함께 배워요.'},
{id:'BEGINNER',name:'호기심 많은 모모',label:'초급',levels:'Lv. 4–6',exp:900,symbol:'❀',message:'새로운 지식이 쑥쑥 자라고 있어요.'},
{id:'ADVANCED',name:'든든한 친구 모모',label:'고급',levels:'Lv. 7–9',exp:3600,symbol:'✧',message:'어려운 문제도 함께라면 괜찮아요.'},
{id:'MASTER',name:'척척박사 모모',label:'마스터',levels:'Lv. 10+',exp:8100,symbol:'♛',message:'꾸준히 쌓아온 노력이 빛나고 있어요.'}];
let questions=[],position=0,selected=null,current=null,busy=false,answered=false,historyCount=0,currentView='study';
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function sourceLabel(q){return '출처: '+(q.source==='QuizPet 자체 제작 · 실제 기출문제 아님'?'AI 제작 · ChatGPT':q.source||'출처 미확인');}
function error(message){$('error').textContent=message;$('error').classList.toggle('hidden',!message);}
async function api(path,options){return QuizPetStore.api(path,options);}
function lock(value){for(const id of ['subject','difficulty','study-mode','shuffle','skip','show-all'])$(id).disabled=value;}
function updateUser(user){
$('total-exp').textContent=user.totalExp.toLocaleString();$('attempts').textContent=user.uniqueSolved.toLocaleString();$('accuracy').textContent=user.uniqueSolved?Math.round(user.latestCorrect/user.uniqueSolved*100):'—';$('percent').textContent=user.uniqueSolved?'%':'';$('mistake-badge').textContent=user.reviewNeeded;$('bank-summary').textContent='전체 '+user.totalQuestions.toLocaleString()+'문항 · 안 푼 문제 '+(user.totalQuestions-user.uniqueSolved).toLocaleString()+'개 · 복습 필요한 오답 '+user.reviewNeeded+'개';$('practice-mistakes').disabled=user.reviewNeeded===0;
const stage=stages.find(s=>s.id===user.growthStage);$('pet-level').textContent='Lv. '+user.level;$('pet-name').textContent=stage.name;$('pet-message').textContent=stage.message;$('stage-label').textContent=stage.label+' 단계';
$('exp-label').textContent=user.totalExp.toLocaleString()+' / '+user.nextLevelExp.toLocaleString()+' EXP';$('exp-progress').max=user.nextLevelExp-user.levelStartExp;$('exp-progress').value=user.totalExp-user.levelStartExp;$('next-level').textContent=(user.level===1?'부화까지 ':'다음 레벨까지 ')+(user.nextLevelExp-user.totalExp).toLocaleString()+' EXP 남았어요';$('pet').className='pet'+(user.level>1?' hatched':'')+(user.level>=10?' master':'');
$('growth-stages').replaceChildren(...stages.map(s=>{const el=node('div',undefined,'growth-stage'+(s.id===user.growthStage?' current':''));el.append(node('span',s.symbol,'symbol'),node('strong',s.label),node('p',s.levels),node('p',s.exp.toLocaleString()+' EXP부터'));if(s.id===user.growthStage)el.append(node('p','지금 여기 있어요'));return el;}));
}
function shuffled(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function filters(){const p=new URLSearchParams({status:$('study-mode').value});if($('subject').value)p.set('subject',$('subject').value);if($('difficulty').value)p.set('difficulty',$('difficulty').value);return p;}
async function fetchQueue(focusId){
  questions=shuffled(await api('/questions?'+filters()));position=focusId?questions.findIndex(q=>q.id===focusId):0;
  if(position<0)throw new Error('선택한 문제를 찾을 수 없습니다.');
  $('question-count').textContent=questions.length+'문항';
  $('empty').classList.toggle('hidden',!!questions.length);$('quiz-content').classList.toggle('hidden',!questions.length);
  $('empty-message').textContent=$('study-mode').value==='unseen'?'이 조건의 문제를 모두 풀었어요! 다른 분야에 도전하거나 오답노트로 복습해 보세요.':$('study-mode').value==='review'?'이 조건에서 복습할 오답이 없어요. 잘하고 있어요!':'이 조건에 맞는 문제가 없어요. 분야나 난이도를 바꿔보세요.';
  if(questions.length)await loadQuestion();else current=null;
}
async function loadQuestions(){if(busy)return;busy=true;lock(true);error('');try{await fetchQueue();}catch(e){current=null;error(e.message);}finally{busy=false;lock(false);}}
async function loadQuestion(){
  selected=null;answered=false;current=null;$('submit').disabled=true;$('result').classList.add('hidden');$('next-row').classList.add('hidden');$('choices').replaceChildren();$('question-text').textContent='문제를 불러오는 중입니다.';$('code').classList.add('hidden');$('skip').classList.remove('hidden');
  current=await api('/questions/'+encodeURIComponent(questions[position].id));
  $('question-text').textContent=current.content;$('subject-tag').textContent=subjects[current.subject];$('difficulty-tag').textContent=difficulties[current.difficulty];$('question-position').textContent=(position+1)+' / '+questions.length;$('question-source').textContent=sourceLabel(current)+' · '+current.topic+' · '+current.practiceType;$('question-source').title=sourceLabel(current);
  $('submit').textContent='정답 확인하기 →';$('code').classList.toggle('hidden',!current.code);
  if(current.code){$('code-language').textContent=current.code.language;$('code-content').textContent=current.code.content;}
  for(const c of current.choices){const b=node('button',undefined,'choice');b.type='button';b.dataset.number=c.number;b.setAttribute('aria-pressed','false');b.append(node('span',c.number,'number'),node('span',c.content));b.addEventListener('click',()=>{if(busy||answered)return;selected=c.number;for(const other of $('choices').children){other.classList.toggle('selected',other===b);other.setAttribute('aria-pressed',String(other===b));}$('submit').disabled=false;});$('choices').append(b);}
}
$('submit').addEventListener('click',async()=>{
  if(!current||selected===null||busy||answered)return;busy=true;lock(true);$('submit').disabled=true;$('submit').textContent='채점 중…';error('');const choice=selected;
  for(const b of $('choices').children)b.disabled=true;
  try{
    const r=await api('/questions/'+encodeURIComponent(current.id)+'/answers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({selectedChoice:choice})});answered=true;
    for(const b of $('choices').children){b.classList.toggle('correct',Number(b.dataset.number)===r.correctChoice);b.classList.toggle('wrong',!r.isCorrect&&Number(b.dataset.number)===choice);}
    const box=$('result');box.className='result'+(r.isCorrect?'':' incorrect');box.replaceChildren(node('h4',r.isCorrect?'정답이에요! +10 EXP':'오답노트에 담았어요.'));
    if(!r.isCorrect)box.append(node('b','선택한 '+r.selectedChoice+'번이 틀린 이유'),node('p',r.wrongReason));
    box.append(node('b','정답 '+r.correctChoice+'번 · 해설'),node('p',r.explanation));
    if(r.isCorrect&&$('study-mode').value==='review')box.append(node('p','✓ 이 문제는 오답노트의 복습 완료로 이동했어요.'));
    if(r.leveledUp)box.append(node('p','✦ 레벨 업! Lv. '+r.level+' · '+stages.find(s=>s.id===r.growthStage).label+' 단계가 되었어요.'));
    $('submit').textContent='채점 완료 ✓';$('skip').classList.add('hidden');$('next-row').classList.remove('hidden');
    try{updateUser(await api('/user'));}catch(e){error('채점과 저장은 완료됐지만 현황을 불러오지 못했습니다. 새로고침해 주세요.');}
  }catch(e){error(e.message+' 네트워크 오류였다면 풀이 기록을 먼저 확인해 주세요.');$('submit').textContent='정답 확인하기 →';$('submit').disabled=false;for(const b of $('choices').children)b.disabled=false;}
  finally{busy=false;lock(false);}
});
async function changeQuestion(next){
  if(busy||!questions.length)return;busy=true;lock(true);$('next').disabled=true;$('retry').disabled=true;error('');
  try{if(next){position++;if(position>=questions.length){await fetchQueue();return;}}await loadQuestion();}
  catch(e){error(e.message);}finally{busy=false;lock(false);$('next').disabled=false;$('retry').disabled=false;}
}
$('next').addEventListener('click',()=>changeQuestion(true));$('skip').addEventListener('click',()=>changeQuestion(true));$('retry').addEventListener('click',()=>changeQuestion(false));
for(const id of ['subject','difficulty','study-mode'])$(id).addEventListener('change',loadQuestions);
$('shuffle').addEventListener('click',loadQuestions);$('show-all').addEventListener('click',()=>{$('study-mode').value='all';loadQuestions();});
async function revisit(id,review=false){
  if(busy)return;busy=true;lock(true);error('');
  try{$('subject').value='';$('difficulty').value='';$('study-mode').value=review?'review':'all';await fetchQueue(id);showView('study');}
  catch(e){error(e.message);}finally{busy=false;lock(false);}
}
let historyVersion=0;
async function history(append=false){
  const version=++historyVersion;if(!append){historyCount=0;$('history-list').replaceChildren();}$('more-history').disabled=true;
  try{const records=await api('/records?limit=50&offset='+historyCount);if(version!==historyVersion)return;historyCount+=records.length;
    if(!historyCount)$('history-list').append(node('div','아직 풀이 기록이 없어요. 첫 문제에 도전해 보세요.','empty'));
    for(const r of records){const row=node('div',undefined,'history-item'),info=node('div',undefined,'history-info');info.append(node('strong',r.content),node('small',sourceLabel(r),'source-credit'),node('small',subjects[r.subject]+' · 선택 '+r.selectedChoice+'번 · '+new Date(r.solvedAt).toLocaleString('ko-KR')));const button=node('button','다시 풀기 ↗','text-button');button.addEventListener('click',()=>revisit(r.questionId));row.append(node('span',r.isCorrect?'정답':'오답','badge '+(r.isCorrect?'good':'bad')),info,button);$('history-list').append(row);}$('more-history').classList.toggle('hidden',records.length<50);
  }catch(e){error(e.message);}finally{if(version===historyVersion)$('more-history').disabled=false;}
}
let notebookVersion=0;
async function notebook(){
  const version=++notebookVersion;$('mistake-list').replaceChildren(node('p','오답노트를 불러오는 중이에요.','muted'));
  try{const p=new URLSearchParams({status:$('mistake-status').value});if($('mistake-subject').value)p.set('subject',$('mistake-subject').value);const rows=await api('/mistakes?'+p);if(version!==notebookVersion)return;
    $('mistake-count').textContent=rows.length+'문제 · 중복 제외';$('mistake-list').replaceChildren();
    if(!rows.length)$('mistake-list').append(node('div',$('mistake-status').value==='resolved'?'아직 복습 완료한 문제가 없어요. 틀린 문제를 다시 맞혀보세요.':'여기에 모아둘 오답이 없어요. 새로운 문제에 도전해 보세요!','empty'));
    for(const r of rows){const card=node('article',undefined,'mistake-card');const top=node('div',undefined,'mistake-top');top.append(node('span',subjects[r.subject]+' · '+difficulties[r.difficulty],'tag'),node('span',r.status==='open'?'복습 필요':'복습 완료','badge '+(r.status==='open'?'bad':'good')));card.append(top,node('h3',r.content),node('p',sourceLabel(r),'source-credit'),node('p','틀린 횟수 '+r.wrongCount+'회 · 총 시도 '+r.attempts+'회 · 마지막 오답 '+new Date(r.lastWrongAt).toLocaleDateString('ko-KR'),'muted'));
      const actions=node('div',undefined,'mistake-actions');const details=node('details');details.append(node('summary','내 오답과 해설 보기'));const content=node('div',undefined,'note-explanation');if(r.code){const pre=node('pre');pre.append(node('span',r.code.language),node('code',r.code.content));content.append(pre);}content.append(node('b','마지막 오답 '+r.selectedChoice+'번 · '+r.selectedContent),node('p',r.wrongReason),node('b','정답 '+r.correctChoice+'번 · '+r.correctContent),node('p',r.explanation));details.append(content);const retry=node('button','다시 풀기 →','primary');retry.addEventListener('click',()=>revisit(r.questionId,r.status==='open'));actions.append(retry);card.append(details,actions);$('mistake-list').append(card);
    }
  }catch(e){if(version===notebookVersion){$('mistake-list').replaceChildren();error(e.message);}}
}
for(const id of ['mistake-status','mistake-subject'])$(id).addEventListener('change',notebook);
$('practice-mistakes').addEventListener('click',async()=>{if(busy)return;$('study-mode').value='review';$('subject').value=$('mistake-subject').value;$('difficulty').value='';await loadQuestions();showView('study');});
function showView(view){
  currentView=view;for(const name of ['study','history','growth','mistakes'])$(name+'-view').classList.toggle('hidden',view!==name);
  for(const b of document.querySelectorAll('.nav'))b.classList.toggle('active',b.dataset.view===view);
  const labels={study:['오늘의 학습','오늘도 한 문제, 한 걸음.','새로운 문제를 풀고, 헷갈렸던 개념은 오답노트로 복습해요.'],history:['풀이 기록','노력은 차곡차곡 남아요.','모든 시도는 기록하고, 풀어본 문제 수는 중복 없이 세어요.'],growth:['성장 도감','우리, 어디까지 자랄까요?','알에서 마스터까지, 배움과 함께 달라지는 모모를 만나보세요.'],mistakes:['오답노트','틀렸던 문제가, 내 실력이 되도록.','분야별 오답을 모아 다시 풀고, 복습 완료까지 이어가세요.']};
  $('page-label').textContent=labels[view][0];$('page-title').textContent=labels[view][1];$('page-description').textContent=labels[view][2];
  if(view==='history')history();if(view==='mistakes')notebook();
}
for(const b of document.querySelectorAll('.nav'))b.addEventListener('click',()=>{if(!busy)showView(b.dataset.view);});
$('refresh-history').addEventListener('click',()=>history());$('more-history').addEventListener('click',()=>history(true));
for(const [value,label] of Object.entries(subjects))for(const id of ['subject','mistake-subject']){const o=node('option',label);o.value=value;$(id).append(o);}
$('date').textContent=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
Promise.all([api('/user').then(updateUser),loadQuestions()]).catch(e=>error(e.message));

$('export-backup').addEventListener('click',()=>{try{const blob=new Blob([JSON.stringify(QuizPetStore.backup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='quizpet-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backup-message').textContent='백업 파일을 안전한 곳에 보관해 주세요.';}catch(e){error(e.message);}});
$('import-backup').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;if(busy){error('채점이 끝난 뒤 다시 가져와 주세요.');event.target.value='';return;}try{if(file.size>10000000)throw new Error('10MB 이하의 백업을 선택해 주세요.');const n=await QuizPetStore.restore(JSON.parse(await file.text()));updateUser(await api('/user'));await loadQuestions();if(currentView==='history')await history();if(currentView==='mistakes')await notebook();$('backup-message').textContent=n+'개의 새 기록을 가져왔어요. 기존 기록은 유지했어요.';}catch(e){error(e.message);}finally{event.target.value='';}});
window.addEventListener('storage',event=>{if(event.key===QuizPetStore.key)api('/user').then(updateUser).catch(e=>error(e.message));});
