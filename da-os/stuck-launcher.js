(()=>{
  const path=location.pathname;
  function addPill(id,href,text,bottom,bg){if(document.getElementById(id))return;const a=document.createElement('a');a.id=id;a.href=href;a.textContent=text;a.setAttribute('aria-label',text);Object.assign(a.style,{position:'fixed',right:'18px',bottom:`${bottom}px`,zIndex:'9999',padding:'10px 14px',borderRadius:'999px',background:bg,color:'#fff',fontWeight:'800',fontSize:'13px',textDecoration:'none',boxShadow:'0 8px 24px rgba(15,23,42,.22)',border:'1px solid rgba(255,255,255,.14)',transition:'transform .15s ease'});a.addEventListener('mouseenter',()=>a.style.transform='translateY(-1px)');a.addEventListener('mouseleave',()=>a.style.transform='translateY(0)');document.body.appendChild(a)}
  if(!path.endsWith('/router.html'))addPill('daos-stuck-launcher','router.html',"I'm stuck",18,'#111827');
  if(!path.endsWith('/ai.html'))addPill('daos-ai-launcher','ai.html','AI',64,'#334155');
  function load(src){return new Promise((resolve,reject)=>{if([...document.scripts].some(s=>s.src.endsWith('/'+src)||s.getAttribute('src')===src)){resolve();return;}const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});}
  if(path.endsWith('/adapter.html'))load('ai-client.js').then(()=>load('ai-adapter.js')).catch(()=>{});
  if(path.endsWith('/router.html'))load('ai-client.js').then(()=>load('ai-router.js')).catch(()=>{});
})();