(() => {
  let reviewPayload=null;
  const host=document.querySelector('.task-graph-card');
  if(!host)return;

  const panel=document.createElement('section');
  panel.className='card ai-review-panel';
  panel.innerHTML=`
    <div class="card-header">
      <div><p class="section-kicker">V1.0 · OPTIONAL SEMANTIC REVIEW</p><h2>Ask AI what the deterministic parser may have missed.</h2><p class="muted-copy">AI cannot remove requirements or invent rubric weights. You review every suggestion; “Apply safe additions” only appends new deliverables, constraints, ambiguities and tasks.</p></div>
      <span id="aiAdapterStatus" class="adapter-badge neutral">Optional</span>
    </div>
    <div class="action-row"><button id="aiReviewBtn" class="button button-primary">Run semantic review</button><a href="ai.html" class="button button-ghost" style="text-decoration:none;">AI settings</a></div>
    <div id="aiReviewResult" class="ai-review-result empty-state">Run the normal assignment analysis first, then use AI only if the wording is unusual, ambiguous, or high stakes.</div>`;
  host.parentNode.insertBefore(panel,host);

  const status=document.getElementById('aiAdapterStatus');
  const resultBox=document.getElementById('aiReviewResult');
  const runBtn=document.getElementById('aiReviewBtn');

  function esc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function canon(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function arr(value){return Array.isArray(value)?value:[]}
  function cleanItem(item){return item&&typeof item==='object'?item:null}
  function currentSettings(){return window.DAOSAI?.loadSettings?.()||{enabled:false}}

  async function runReview(){
    if(!currentSettings().enabled){status.className='adapter-badge low';status.textContent='AI disabled';showToast('Enable AI reasoning in AI settings first.');return;}
    if(!analysis){analyseAssignment();if(!analysis)return;}
    status.className='adapter-badge medium';status.textContent='Reviewing…';runBtn.disabled=true;
    resultBox.className='ai-review-result';resultBox.textContent='Semantic review in progress…';
    try{
      const deterministic={
        types:analysis.types,tools:analysis.tools,
        deliverables:analysis.deliverables.map(x=>({text:x.text,kind:x.kind})),
        constraints:analysis.constraints.map(x=>({text:x.text,kind:x.kind})),
        rubric:analysis.rubric.map(x=>({text:x.text,weight:x.weight,category:x.category})),
        ambiguities:analysis.ambiguities,
        tasks:analysis.tasks.map(x=>({title:x.title,why:x.why,action:x.action,category:x.category,evidence:x.evidence,validation:x.validation}))
      };
      const response=await window.DAOSAI.reason('assignment_refine',{assignmentName:analysis.name,brief:analysis.brief,rubric:analysis.rubricText,deterministic});
      reviewPayload={result:response.result,model:response.model,createdAt:new Date().toISOString()};
      renderReview();
      const confidence=String(response.result.confidence||'moderate').toLowerCase();
      status.className=`adapter-badge ${confidence==='high'?'high':confidence==='low'?'low':'medium'}`;
      status.textContent=`AI ${response.result.confidence||'review'}`;
    }catch(error){status.className='adapter-badge low';status.textContent='AI unavailable';resultBox.className='ai-review-result empty-state';resultBox.textContent=`AI review unavailable: ${error.message}. The deterministic plan is unchanged.`;}
    finally{runBtn.disabled=false;}
  }

  function renderReview(){
    const r=reviewPayload?.result||{};
    const deliverables=arr(r.additional_deliverables).map(cleanItem).filter(Boolean).slice(0,8);
    const constraints=arr(r.additional_constraints).map(cleanItem).filter(Boolean).slice(0,8);
    const ambiguities=arr(r.ambiguities).map(cleanItem).filter(Boolean).slice(0,8);
    const tasks=arr(r.task_additions).map(cleanItem).filter(Boolean).slice(0,10);
    const revisions=arr(r.task_revisions).map(cleanItem).filter(Boolean).slice(0,8);
    const warnings=arr(r.warnings).filter(x=>typeof x==='string').slice(0,8);
    const total=deliverables.length+constraints.length+ambiguities.length+tasks.length;
    resultBox.className='ai-review-result';
    resultBox.innerHTML=`
      <div class="ai-review-summary"><strong>${esc(r.summary||'Semantic review complete.')}</strong><span>${esc(reviewPayload.model||'server-selected model')}</span></div>
      ${warnings.length?`<div class="ai-suggestion-group"><span>CAUTIONS</span>${warnings.map(x=>`<p>⚠ ${esc(x)}</p>`).join('')}</div>`:''}
      ${deliverables.length?`<div class="ai-suggestion-group"><span>POSSIBLE MISSING DELIVERABLES</span>${deliverables.map(x=>`<p><strong>${esc(x.text)}</strong><small>${esc(x.reason||'')}</small></p>`).join('')}</div>`:''}
      ${constraints.length?`<div class="ai-suggestion-group"><span>POSSIBLE MISSED CONSTRAINTS</span>${constraints.map(x=>`<p><strong>${esc(x.text)}</strong><small>${esc(x.reason||'')}</small></p>`).join('')}</div>`:''}
      ${ambiguities.length?`<div class="ai-suggestion-group"><span>AMBIGUITIES TO CONFIRM</span>${ambiguities.map(x=>`<p><strong>${esc(x.text)}</strong><small>${esc(x.why||'')}</small></p>`).join('')}</div>`:''}
      ${tasks.length?`<div class="ai-suggestion-group"><span>SAFE TASK ADDITIONS</span>${tasks.map(x=>`<p><strong>${esc(x.title)}</strong><small>${esc(x.reason||x.why||'')}</small></p>`).join('')}</div>`:''}
      ${revisions.length?`<div class="ai-suggestion-group"><span>REVIEW-ONLY TASK REVISIONS</span>${revisions.map(x=>`<p><strong>${esc(x.title)}</strong><small>${esc(x.suggestion||'')} ${esc(x.reason||'')}</small></p>`).join('')}</div>`:''}
      <div class="action-row"><button id="applyAIAdditions" class="button button-primary" ${total?'':'disabled'}>Apply safe additions (${total})</button><button id="discardAIReview" class="button button-ghost">Discard AI review</button></div>`;
    document.getElementById('applyAIAdditions')?.addEventListener('click',applySafeAdditions);
    document.getElementById('discardAIReview')?.addEventListener('click',()=>{reviewPayload=null;resultBox.className='ai-review-result empty-state';resultBox.textContent='AI suggestions discarded. The deterministic plan remains unchanged.';});
  }

  function applySafeAdditions(){
    if(!analysis||!reviewPayload)return;
    const r=reviewPayload.result||{};
    const deliverableKeys=new Set(analysis.deliverables.map(x=>canon(x.text)));
    arr(r.additional_deliverables).slice(0,8).forEach(x=>{if(x?.text&&!deliverableKeys.has(canon(x.text))){deliverableKeys.add(canon(x.text));analysis.deliverables.push({text:String(x.text).trim(),kind:String(x.kind||'Analysis').trim(),source:'AI semantic review'});}});
    const constraintKeys=new Set(analysis.constraints.map(x=>canon(x.text)));
    arr(r.additional_constraints).slice(0,8).forEach(x=>{if(x?.text&&!constraintKeys.has(canon(x.text))){constraintKeys.add(canon(x.text));analysis.constraints.push({text:String(x.text).trim(),kind:String(x.kind||'Requirement').trim(),source:'AI semantic review'});}});
    const ambiguityKeys=new Set(analysis.ambiguities.map(canon));
    arr(r.ambiguities).slice(0,8).forEach(x=>{const text=String(x?.text||'').trim();if(text&&!ambiguityKeys.has(canon(text))){ambiguityKeys.add(canon(text));analysis.ambiguities.push(`${text} [AI suggestion — confirm against the brief]`);}});
    const taskKeys=new Set(analysis.tasks.map(x=>canon(x.title)));
    const allowed=new Set(['Scope','Data','Metric','SQL','Python','Statistics','Analysis','Visualisation','Synthesis','Delivery','QA']);
    arr(r.task_additions).slice(0,10).forEach(x=>{
      const title=String(x?.title||'').trim();if(!title||taskKeys.has(canon(title)))return;taskKeys.add(canon(title));
      const category=allowed.has(x.category)?x.category:'Analysis';
      const task=makeTask(title,String(x.why||'AI identified a potentially missing step.').trim(),String(x.action||'Review this suggested step against the assignment before executing it.').trim(),category,String(x.evidence||'Retain evidence that demonstrates this step was completed.').trim(),String(x.validation||'Confirm the output directly answers a stated assignment requirement.').trim());
      task.source='AI semantic review';analysis.tasks.push(task);
    });
    analysis.version='1.0.0';analysis.aiSemanticReview={appliedAt:new Date().toISOString(),model:reviewPayload.model,summary:r.summary||'',confidence:r.confidence||'unknown',reviewOnlyTaskRevisions:arr(r.task_revisions),warnings:arr(r.warnings)};
    analysis.evidence=deriveEvidence(analysis.tasks);analysis.validation=deriveValidation(analysis.tasks);renderAnalysis();
    showToast('AI additions applied. Re-check the plan before committing it to DA.OS.');
  }

  runBtn.addEventListener('click',runReview);
  const style=document.createElement('style');style.textContent=`.ai-review-panel{margin-bottom:20px}.ai-review-result{margin-top:16px;display:grid;gap:14px}.ai-review-summary{display:flex;justify-content:space-between;gap:12px;padding:14px;border:1px solid var(--border);border-radius:14px}.ai-review-summary span{color:var(--muted);font-size:12px}.ai-suggestion-group{border:1px solid var(--border);border-radius:14px;padding:14px}.ai-suggestion-group>span{display:block;font-size:11px;font-weight:900;letter-spacing:.08em;margin-bottom:8px}.ai-suggestion-group p{margin:7px 0;display:grid;gap:2px}.ai-suggestion-group small{color:var(--muted)}`;document.head.appendChild(style);
})();