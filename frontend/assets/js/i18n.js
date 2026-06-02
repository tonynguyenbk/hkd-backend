/* ══════════════════════════════════════════════════════
   i18n Engine — Vanilla JS
   Adapted from React i18next guide for Vanilla JS
══════════════════════════════════════════════════════ */
const LANG_KEY = 'hkd_lang';

window.i18n = {
  lang: localStorage.getItem(LANG_KEY) || 'vi',

  t(key, vars) {
    const keys = key.split('.');
    let obj = (window.translations || {})[this.lang] || (window.translations || {})['vi'] || {};
    for (const k of keys) {
      if (obj === undefined || obj === null) return key;
      obj = obj[k];
    }
    let str = (obj !== undefined && obj !== null) ? String(obj) : key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      });
    }
    return str;
  },

  setLang(lang) {
    this.lang = lang;
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    // Re-render static DOM elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = this.t(key);
      if (val !== key) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      const val = this.t(key);
      if (val !== key) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const val = this.t(key);
      if (val !== key) el.title = val;
    });
    // Re-render dynamic app content
    if (typeof renderCurrentStep === 'function') renderCurrentStep();
    if (typeof updateHeaderUserChip === 'function') updateHeaderUserChip();
    // Update page title
    document.title = this.t('meta.title');
  }
};

/* Global shorthand — matches guide's t() pattern */
window.t = (key, vars) => window.i18n.t(key, vars);
