// V0.5 privacy guard: raw dataset rows must never be written to localStorage or exported.
(() => {
  function sanitizeProfile(value) {
    if (!value) return value;
    const sanitized = { ...value };
    delete sanitized.preview;
    return sanitized;
  }

  // Replace the original saver before any user-triggered profiling action occurs.
  saveProfile = function saveProfileWithoutRows() {
    if (!profile) return;
    delete profile.preview;
    localStorage.setItem(PREFLIGHT_KEY, JSON.stringify(sanitizeProfile(profile)));
  };

  // Also sanitize exported profile JSON.
  exportProfile = function exportSanitizedProfile() {
    if (!profile) return;
    const sanitized = sanitizeProfile(profile);
    const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(profile.file?.name || 'dataset')}-preflight.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Dataset profile exported without raw rows.');
  };

  // If a profile from an earlier V0.5 draft contained preview rows, remove them immediately.
  if (profile?.preview) {
    delete profile.preview;
    localStorage.setItem(PREFLIGHT_KEY, JSON.stringify(sanitizeProfile(profile)));
    activeRows = [];
    renderPreview();
  }
})();
