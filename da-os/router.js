const PROJECT_KEY='daos-v0.1-state';
const PREFLIGHT_KEY='daos-v0.5-preflight';
const EVIDENCE_KEY='daos-v0.7-evidence';
const MEMORY_KEY='daos-v0.4-feedback-memory';
const SUBMISSION_KEY='daos-v0.8-submission';
const ROUTER_KEY='daos-v0.9-router';
const ROUTE_CONTEXT_KEY='daos-v0.9-route-context';

const $=id=>document.getElementById(id);
const els={problemText:$('problemText'),routeBtn:$('routeBtn'),sampleBtn:$('sampleBtn'),clearBtn:$('clearBtn'),clearHistoryBtn:$('clearHistoryBtn'),projectContext:$('projectContext'),stateSignals:$('stateSignals'),routeResult:$('routeResult'),routeTitle:$('routeTitle'),routeWhy:$('routeWhy'),routeConfidence:$('routeConfidence'),routeScore:$('routeScore'),routeAction:$('routeAction'),routeEvidence:$('routeEvidence'),goBtn:$('goBtn'),rethinkBtn:$('rethinkBtn'),alternativesSection:$('alternativesSection'),alternativesList:$('alternativesList'),routeHistory:$('routeHistory'),toast:$('toast')};

const DESTINATIONS={
  adapter:{name:'Universal Assignment Adapter',url:'adapter.html',action:'Open the assignment brief/rubric and rebuild the requirements, constraints and task graph before doing more work.',why:'Use this when the problem is understanding what the assignment actually requires.'},
  preflight:{name:'Dataset Preflight',url:'preflight.html',action:'Load the current CSV/XLSX and inspect grain, types, missingness, duplicates, ranges, outliers and likely analytical roles before analysing.',why:'Use this when the blockage starts with understanding or validating the dataset.'},
  doctor:{name:'Error Doctor',url:'doctor.html',action:'Bring the exact error, traceback, formula symptom or wrong-result behavior and diagnose it before applying a fix.',why:'Use this when something is broken, failing, or producing a suspicious result.'},
  coach:{name:'Learning Coach',url:'coach.html',action:'Open the current NEXT task and work through the reasoning → structure → validation hint ladder.',why:'Use this when you know what the task is but do not yet know how to perform it.'},
  evidence:{name:'Rubric + Evidence',url:'evidence.html',action:'Map the actual workbook/query/notebook/dashboard/slide proof to the assignment criterion and verify that it satisfies the wording.',why:'Use this when the issue is proving completion or covering the rubric.'},
  memory:{name:'Feedback Memory',url:'memory.html',action:'Capture the correction as a reusable rule, including what went wrong, the permanent lesson, triggers and severity.',why:'Use this when you received feedback or discovered a mistake you do not want to repeat.'},
  submission:{name:'Submission Gate',url:'submission.html',action:'Run PASS/WARN/BLOCK checks, resolve blockers, complete final manual QA, and rerun the gate before submitting.',why:'Use this when you think the work is finished and need a final readiness check.'},
  next:{name:'NEXT',url:'index.html#next',action:'Return to the project plan and execute the first unfinished task. Use Coach or Doctor from there if the step becomes difficult.',why:'Use this when the assignment is understood and you mainly need to know what to do next.'}
};

const RULES=[
  {dest:'adapter',weight:6,patterns:[/don.?t understand.*assignment/i,/what.*assignment.*want/i,/brief/i,/rubric/i,/deliverable/i,/requirement/i,/instructions?/i,/what.*submit/i,/scope/i,/criteria/i,/grading/i]},
  {dest:'preflight',weight:6,patterns:[/new dataset/i,/new data/i,/inspect.*data/i,/clean.*data/i,/missing values?/i,/duplicates?/i,/data types?/i,/outliers?/i,/columns?/i,/rows?/i,/csv/i,/xlsx/i,/workbook.*data/i,/quality.*data/i,/profile.*data/i]},
  {dest:'doctor',weight:7,patterns:[/error/i,/traceback/i,/wrong result/i,/wrong total/i,/too high/i,/too low/i,/doesn.?t work/i,/not working/i,/broken/i,/fails?/i,/bug/i,/keyerror/i,/valueerror/i,/typeerror/i,/nameerror/i,/syntax/i,/div\/0/i,/#n\/a/i,/#value/i,/#ref/i,/join.*duplicate/i,/double count/i,/formula.*wrong/i]},
  {dest:'coach',weight:5,patterns:[/how do i/i,/how to/i,/don.?t know how/i,/teach me/i,/explain/i,/which chart/i,/what chart/i,/formula/i,/pivot/i,/group by/i,/window function/i,/dax/i,/calculated field/i,/how.*sql/i,/how.*python/i,/how.*excel/i,/how.*tableau/i,/how.*power bi/i]},
  {dest:'evidence',weight:6,patterns:[/evidence/i,/proof/i,/prove/i,/rubric coverage/i,/criterion/i,/criteria.*complete/i,/missing.*requirement/i,/what.*missing/i,/artifact/i,/coverage/i,/did i answer/i]},
  {dest:'memory',weight:7,patterns:[/instructor.*feedback/i,/feedback/i,/correction/i,/mistake/i,/don.?t repeat/i,/remember.*lesson/i,/reviewer/i,/teacher.*said/i,/told me/i,/lost marks/i]},
  {dest:'submission',weight:7,patterns:[/ready to submit/i,/can i submit/i,/finished/i,/i.?m done/i,/final check/i,/before.*submit/i,/hand in/i,/submission/i,/ready/i,/final version/i]},
  {dest:'next',weight:5,patterns:[/what.*next/i,/what do i do now/i,/where.*start/i,/what.*first/i,/next step/i,/continue/i,/then what/i,/what should i work on/i]}
];

let context=loadContext();
let lastRouting=null;

function loadJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function loadContext(){return{project:loadJson(PROJECT_KEY),preflight:loadJson(PREFLIGHT_KEY),evidence:loadJson(EVIDENCE_KEY),memory:loadJson(MEMORY_KEY),submission:loadJson(SUBMISSION_KEY)}}
function normalize(value){return String(value||'').toLowerCase().replace(/[^a-z0-9%#\/]+/g,' ').trim()}
function currentTask(){return context.project?.tasks?.find(t=>!t.done)||null}
function projectLoaded(){return Boolean(context.project?.project?.name||context.project?.project?.brief)}
function unfinishedCount(){return(context.project?.tasks||[]).filter(t=>!t.done).length}
function evidenceCount(){return(context.evidence?.evidence||[]).length}
function feedbackCount(){return(context.memory?.rules||[]).filter(r=>r.active!==false).length}
function relevantProblem(text,regex){return regex.test(text)}

function scoreRoutes(problem){
  const scores=Object.fromEntries(Object.keys(DESTINATIONS).map(k=>[k,{score:0,signals:[]}]))
  for(const rule of RULES){for(const pattern of rule.patterns){if(pattern.test(problem)){scores[rule.dest].score+=rule.weight;scores[rule.dest].signals.push(`Matched “${pattern.source.replaceAll('\\','')}”`);}}}
  const task=currentTask();
  if(!projectLoaded()){scores.adapter.score+=3;scores.adapter.signals.push('No current project is loaded');}
  if(projectLoaded()&&unfinishedCount()>0){scores.next.score+=1;scores.next.signals.push(`${unfinishedCount()} project task(s) remain`);}
  if(task){
    const taskText=normalize(`${task.title} ${task.category||''} ${task.action||''}`);
    if(/sql|python|excel|power bi|tableau|analysis|visual/.test(taskText)&&/how|learn|explain|chart|formula|query|method/.test(problem)){scores.coach.score+=3;scores.coach.signals.push(`Current NEXT task is ${task.category||'technical work'}`);}
    if(/sql|python|excel/.test(taskText)&&/error|wrong|fail|broken|total|syntax|formula/.test(problem)){scores.doctor.score+=3;scores.doctor.signals.push(`Error relates to current ${task.category||'technical'} task`);}
  }
  if(/data|dataset|csv|excel|xlsx|rows|columns/.test(problem)&&!context.preflight){scores.preflight.score+=2;scores.preflight.signals.push('No saved Dataset Preflight exists');}
  if(/submit|finished|done|ready|final/.test(problem)){
    scores.submission.score+=2;scores.submission.signals.push('Problem is about final readiness');
    if(evidenceCount()===0){scores.evidence.score+=2;scores.evidence.signals.push('No evidence records are saved yet');}
  }
  if(/feedback|mistake|correction/.test(problem)&&feedbackCount()===0){scores.memory.score+=1;scores.memory.signals.push('No active Feedback Memory rules exist yet');}
  if(/rubric|evidence|proof|criteria|criterion/.test(problem)&&evidenceCount()===0){scores.evidence.score+=2;scores.evidence.signals.push('Evidence register is currently empty');}
  if(Object.values(scores).every(v=>v.score===0)){
    const fallback=projectLoaded()&&unfinishedCount()>0?'next':'adapter';scores[fallback].score=2;scores[fallback].signals.push('Fallback based on current DA.OS project state');
  }
  return scores;
}

function routeProblem(){
  context=loadContext();
  const raw=els.problemText.value.trim();
  if(raw.length<4){showToast('Describe what is blocking you first.');els.problemText.focus();return;}
  const problem=normalize(raw);const scores=scoreRoutes(problem);
  const ranked=Object.entries(scores).map(([key,v])=>({key,...v,...DESTINATIONS[key]})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  const top=ranked[0],second=ranked[1];
  const margin=top.score-second.score;
  const confidence=top.score>=14&&margin>=5?'High':top.score>=7&&margin>=2?'Moderate':'Low';
  lastRouting={problem:raw,recommended:top.key,confidence,ranked,createdAt:new Date().toISOString(),projectName:context.project?.project?.name||null,currentTask:currentTask()?.title||null};
  localStorage.setItem(ROUTE_CONTEXT_KEY,JSON.stringify(lastRouting));
  saveHistory(lastRouting);
  renderRoute(lastRouting);renderHistory();
}

function renderRoute(result){
  const top=result.ranked[0];els.routeResult.classList.remove('hidden');els.routeTitle.textContent=top.name;els.routeWhy.textContent=top.why;els.routeAction.textContent=top.action;els.routeConfidence.textContent=result.confidence;els.routeScore.textContent=`route score ${top.score} · lead ${top.score-result.ranked[1].score}`;els.goBtn.href=top.url;els.goBtn.textContent=`Open ${top.name} →`;
  const signals=[...new Set(top.signals)].slice(0,5);els.routeEvidence.innerHTML=signals.map(s=>`<span class="route-signal-chip">${escapeHtml(s)}</span>`).join('');
  els.alternativesSection.classList.add('hidden');
}
function renderAlternatives(){if(!lastRouting)return;const items=lastRouting.ranked.slice(1,4);els.alternativesList.innerHTML=items.map(item=>`<div class="alternative"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.why)}</p><small>score ${item.score}</small><a href="${item.url}">Open →</a></div>`).join('');els.alternativesSection.classList.remove('hidden');}

function renderContext(){
  context=loadContext();const project=context.project?.project?.name;const task=currentTask();
  els.projectContext.innerHTML=project?`<span>CURRENT PROJECT</span><strong>${escapeHtml(project)}</strong><small>${task?`NEXT: ${escapeHtml(task.title)}`:'No unfinished NEXT task detected.'}</small>`:`<span>CURRENT CONTEXT</span><strong>No project loaded</strong><small>You can still route a general problem.</small>`;
  const signals=[
    {label:'Project',value:project?'Loaded':'Not loaded',tone:project?'good':'neutral'},
    {label:'NEXT queue',value:project?`${unfinishedCount()} unfinished`:'—',tone:unfinishedCount()?'warn':'good'},
    {label:'Dataset Preflight',value:context.preflight?'Available':'None saved',tone:context.preflight?'good':'neutral'},
    {label:'Evidence register',value:`${evidenceCount()} item(s)`,tone:evidenceCount()?'good':'neutral'},
    {label:'Feedback rules',value:`${feedbackCount()} active`,tone:feedbackCount()?'good':'neutral'},
    {label:'Submission QA',value:context.submission?.lastRunAt?'Run before':'Not run yet',tone:context.submission?.lastRunAt?'good':'neutral'}
  ];
  els.stateSignals.innerHTML=signals.map(s=>`<div class="state-signal ${s.tone}"><strong>${escapeHtml(s.label)}</strong><span>${escapeHtml(s.value)}</span></div>`).join('');
}

function saveHistory(route){const saved=loadJson(ROUTER_KEY)||{version:'0.9.0',history:[]};const entry={id:crypto.randomUUID(),problem:route.problem,recommended:route.recommended,confidence:route.confidence,createdAt:route.createdAt,projectName:route.projectName};saved.history=[entry,...(saved.history||[])].slice(0,12);localStorage.setItem(ROUTER_KEY,JSON.stringify(saved));}
function renderHistory(){const saved=loadJson(ROUTER_KEY);const history=saved?.history||[];if(!history.length){els.routeHistory.className='route-history empty-state';els.routeHistory.textContent='No routing history yet.';return;}els.routeHistory.className='route-history';els.routeHistory.innerHTML=history.map(item=>`<div class="history-row"><div><strong>${escapeHtml(DESTINATIONS[item.recommended]?.name||item.recommended)}</strong><p>${escapeHtml(item.problem)}</p></div><span>${formatDate(item.createdAt)} · ${escapeHtml(item.confidence)}</span></div>`).join('');}
function clearHistory(){localStorage.removeItem(ROUTER_KEY);renderHistory();showToast('Routing history cleared.');}
function clearCurrent(){els.problemText.value='';lastRouting=null;els.routeResult.classList.add('hidden');els.alternativesSection.classList.add('hidden');}
function loadExamples(){const examples=["I don't understand what this assignment wants me to deliver.","My SQL total doubled after I joined two tables.","I have a new Excel dataset and don't know what to clean first.","I know I need a Power BI chart but don't know which one to use.","My instructor said my recommendations are just observations.","I finished everything. Am I safe to submit?"];els.problemText.value=examples[Math.floor(Math.random()*examples.length)];routeProblem();}
function formatDate(value){try{return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value))}catch{return''}}
function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function showToast(message){els.toast.textContent=message;els.toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>els.toast.classList.remove('show'),2200)}

els.routeBtn.addEventListener('click',routeProblem);els.rethinkBtn.addEventListener('click',renderAlternatives);els.sampleBtn.addEventListener('click',loadExamples);els.clearBtn.addEventListener('click',clearCurrent);els.clearHistoryBtn.addEventListener('click',clearHistory);els.problemText.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')routeProblem()});els.quickPrompts.querySelectorAll('[data-prompt]').forEach(btn=>btn.addEventListener('click',()=>{els.problemText.value=btn.dataset.prompt;routeProblem()}));window.addEventListener('storage',renderContext);
renderContext();renderHistory();