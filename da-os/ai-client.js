(() => {
  const SETTINGS_KEY = 'daos-v1-ai-settings';
  const defaults = { enabled: false, endpoint: '/api/reason', healthEndpoint: '/api/health' };

  function loadSettings() {
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}) }; }
    catch { return { ...defaults }; }
  }

  function saveSettings(next) {
    const safe = {
      enabled: Boolean(next.enabled),
      endpoint: String(next.endpoint || defaults.endpoint).trim() || defaults.endpoint,
      healthEndpoint: String(next.healthEndpoint || defaults.healthEndpoint).trim() || defaults.healthEndpoint
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
    return safe;
  }

  async function requestJson(url, options = {}, timeoutMs = 90000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || `AI request failed (${response.status})`);
      return payload;
    } finally { clearTimeout(timer); }
  }

  async function health() {
    const settings = loadSettings();
    const inferred = settings.endpoint.replace(/\/api\/reason(?:\?.*)?$/, '/api/health');
    return requestJson(settings.healthEndpoint || inferred || '/api/health', { method: 'GET', headers: {} }, 12000);
  }

  async function reason(mode, data) {
    const settings = loadSettings();
    if (!settings.enabled) throw new Error('AI reasoning is disabled in DA.OS settings.');
    const payload = await requestJson(settings.endpoint, {
      method: 'POST',
      body: JSON.stringify({ mode, data })
    });
    if (!payload.result || typeof payload.result !== 'object') throw new Error('AI backend returned an invalid result.');
    return payload;
  }

  window.DAOSAI = { SETTINGS_KEY, loadSettings, saveSettings, health, reason };
})();
