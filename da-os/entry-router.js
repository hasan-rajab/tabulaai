(() => {
  function routeFromHash() {
    const target = window.location.hash.replace('#', '').trim();
    if (!target) return;
    const button = document.querySelector(`[data-view="${CSS.escape(target)}"]`);
    if (button) button.click();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(routeFromHash, 0));
  else setTimeout(routeFromHash, 0);
})();
