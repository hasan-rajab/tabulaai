(() => {
  const routeResult=document.getElementById('routeResult');
  if(!routeResult)return;
  const panel=document.createElement('section');
  panel.id='aiRouteReview';panel.className='card ai-route-review hidden';
  panel.innerHTML=`<div class="card-header"><div><p class="section-kicker">V1.0 · OPTIONAL AI RECONSIDERATION</p><h2>Ambiguous route? Ask the semantic layer.</h2><p>AI can recommend one existing DA.OS workflow, but it cannot solve the assignment or silently replace the deterministic route.</p></div><span id="aiRouteStatus" class="confidence-box"><strong>Optional</strong></span></div><div class="action-row"><button id="aiRouteBtn" class="button button-primary">Ask AI to reconsider</button><a href="ai.html" class="button button-ghost" style="text-decoration:none;">AI settings</a></div><div id="aiRouteOutput" class="ai-route-output empty-state">Run the deterministic router first.</div>`;
  routeResult.parentNode.insertBefore(panel,routeResult.nextSibling);

  const button=document.getElementById('aiRouteBtn');const output=document.getElementById('aiRouteOutput');const status=document.getElementById('aiRouteStatus');
  function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function settings(){return window.DAOSAI?.loadSettings?.()||{enabled:false}}
  function showIfRouted(){panel.classList.toggle('hidden',!lastRouting)}
  document.getElementById('routeBtn')?.addEventListener('click',()=>setTimeout(showIfRouted,0));
  document.getElementById('sampleBtn')?.addEventListener('click',()=>setTimeout(showIfRouted,0));
  document.getElementById('clearBtn')?.addEventListener('click',()=>panel.classList.add('hidden'));

  async function reconsider(){
    if(!lastRouting){showToast('Run the deterministic router first.');return;}
    if(!settings().enabled){showToast('Enable AI reasoning in AI settings first.');return;}
    button.disabled=true;status.innerHTML='<strong>Reviewing…</strong>';output.className='ai-route-output';output.textContent='Semantic route review in progress…';
    try{
      const routeState={projectName:context.project?.project?.name||null,currentTask:currentTask()?.title||null,unfinishedTasks:unfinishedCount(),preflightAvailable:Boolean(context.preflight),evidenceItems:evidenceCount(),activeFeedbackRules:feedbackCount(),submissionPreviouslyRun:Boolean(context.submission?.lastRunAt)};
      const deterministic=lastRouting.ranked.slice(0,5).map(x=>({route:x.key,score:x.score,reason:x.why,signals:x.signals}));
      const response=await window.DAOSAI.reason('route_refine',{problem:lastRouting.problem,deterministic,routeState});
      const r=response.result||{};const route=DESTINATIONS[r.recommended]?r.recommended:null;
      if(!route)throw new Error('AI returned an unsupported destination.');
      const destination=DESTINATIONS[route];const agrees=route===lastRouting.recommended;
      lastRouting.aiReview={recommended:route,confidence:r.confidence||'unknown',why:r.why||'',nextAction:r.next_action||destination.action,alternatives:Array.isArray(r.alternatives)?r.alternatives:[],cautions:Array.isArray(r.cautions)?r.cautions:[],model:response.model,createdAt:new Date().toISOString()};
      localStorage.setItem('daos-v0.9-route-context',JSON.stringify(lastRouting));
      status.innerHTML=`<strong>${esc(r.confidence||'reviewed')}</strong><small>${agrees?'agrees with deterministic':'different recommendation'}</small>`;
      output.className='ai-route-output';
      output.innerHTML=`<div class="ai-route-decision ${agrees?'agree':'different'}"><span>${agrees?'AGREEMENT':'AI ALTERNATIVE'}</span><h3>${esc(destination.name)}</h3><p>${esc(r.why||destination.why)}</p><div class="route-action-box"><span>AI NEXT ACTION</span><p>${esc(r.next_action||destination.action)}</p></div>${(r.cautions||[]).length?`<div class="ai-route-cautions">${r.cautions.slice(0,5).map(x=>`<p>⚠ ${esc(x)}</p>`).join('')}</div>`:''}<div class="action-row"><a class="button button-primary" href="${destination.url}" style="text-decoration:none;">Open AI-recommended workflow →</a><a class="button button-ghost" href="${DESTINATIONS[lastRouting.recommended].url}" style="text-decoration:none;">Keep deterministic route</a></div></div>`;
    }catch(error){status.innerHTML='<strong>Unavailable</strong>';output.className='ai-route-output empty-state';output.textContent=`AI reconsideration unavailable: ${error.message}. Keep using the deterministic route.`;}
    finally{button.disabled=false;}
  }

  button.addEventListener('click',reconsider);
  const style=document.createElement('style');style.textContent=`.ai-route-review{margin-top:20px}.ai-route-output{margin-top:16px}.ai-route-decision{border:1px solid var(--border);border-radius:16px;padding:18px}.ai-route-decision>span{font-size:11px;font-weight:900;letter-spacing:.08em}.ai-route-decision h3{font-size:22px;margin:7px 0}.ai-route-decision.agree{background:#f5fbf6}.ai-route-decision.different{background:#fffaf0}.ai-route-cautions{margin:12px 0;color:var(--muted)}`;document.head.appendChild(style);
  showIfRouted();
})();
