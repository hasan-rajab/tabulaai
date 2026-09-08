(() => {
  const PROJECT_KEY = 'daos-v0.1-state';
  const MEMORY_KEY = 'daos-v0.4-feedback-memory';

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function currentTask(project) {
    return project?.tasks?.find(task => !task.done) || null;
  }

  function contextText(project, task) {
    return [
      project?.project?.name,
      project?.project?.brief,
      task?.title,
      task?.why,
      task?.action,
      task?.category,
      ...(project?.project?.tools || [])
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function severityRank(value) {
    return value === 'blocker' ? 3 : value === 'warning' ? 2 : 1;
  }

  function getMatches(project, memory) {
    const task = currentTask(project);
    if (!task || !Array.isArray(memory?.rules)) return [];
    const context = contextText(project, task);
    const selectedTools = project?.project?.tools || [];

    return memory.rules
      .filter(rule => rule.active)
      .map(rule => {
        const hits = (rule.triggers || []).filter(trigger => context.includes(String(trigger).toLowerCase()));
        let score = hits.length;
        if (rule.toolScope && rule.toolScope !== 'Any' && selectedTools.includes(rule.toolScope)) score += 1;
        return { rule, hits, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => severityRank(b.rule.severity) - severityRank(a.rule.severity) || b.score - a.score);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function render() {
    const project = load(PROJECT_KEY);
    const memory = load(MEMORY_KEY);
    const matches = getMatches(project, memory);
    document.querySelectorAll('.next-memory-alert').forEach(node => node.remove());
    if (!matches.length) return;

    const target = document.querySelector('.next-content .next-box');
    if (!target) return;

    const top = matches.slice(0, 3);
    const blockerCount = matches.filter(item => item.rule.severity === 'blocker').length;
    const panel = document.createElement('div');
    panel.className = `next-memory-alert ${blockerCount ? 'has-blocker' : ''}`;
    panel.innerHTML = `
      <div class="memory-alert-head">
        <span>FEEDBACK MEMORY</span>
        <strong>${matches.length} rule${matches.length === 1 ? '' : 's'} relevant to this step</strong>
      </div>
      ${top.map(({ rule }) => `
        <div class="memory-alert-rule">
          <b>${escapeHtml(rule.severity.toUpperCase())}</b>
          <p>${escapeHtml(rule.lesson)}</p>
        </div>
      `).join('')}
      <a href="memory.html">Review ${matches.length > 3 ? 'all ' : ''}before continuing →</a>
    `;
    target.insertAdjacentElement('afterend', panel);
  }

  window.addEventListener('storage', render);
  document.addEventListener('DOMContentLoaded', () => setTimeout(render, 0));
  document.addEventListener('click', (event) => {
    if (event.target.closest('#completeNextBtn, #deconstructBtn, #rebuildBtn, #sampleBtn')) {
      setTimeout(render, 50);
    }
  });
})();
