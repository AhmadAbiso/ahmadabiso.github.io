(() => {
  const key = 'ahmad-abiso-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  let toggle;
  const valid = value => value === 'light' || value === 'dark';
  try {
    const saved = localStorage.getItem(key);
    if (valid(saved)) preference = saved;
  } catch { /* The theme still works when browser storage is unavailable. */ }
  function apply() {
    const theme = preference || (system.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#080f0b' : '#f5f6f4';
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
      const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }
  }
  apply();
  system.addEventListener('change', () => { if (!preference) apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = valid(event.newValue) ? event.newValue : null;
      apply();
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;
    toggle.hidden = false;
    apply();
    toggle.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch { /* Keep this visit's choice. */ }
      apply();
    });
  });
})();
