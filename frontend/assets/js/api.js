const API_BASE = window.location.hostname === 'localhost' ||
                 window.location.hostname === '127.0.0.1' ||
                 window.location.protocol === 'file:'
  ? 'http://localhost:3000'
  : 'https://hkd-backend-production.up.railway.app';
/* ── Auth state ─────────────────────────────────────── */
let authState = {
  user:         JSON.parse(localStorage.getItem('hkd_user')||'null'),
  accessToken:  localStorage.getItem('hkd_access')||'',
  refreshToken: localStorage.getItem('hkd_refresh')||'',
  hkdProfiles:  [],
  activeHkdId:  localStorage.getItem('hkd_active_id')||''
};

function saveAuth(user, accessToken, refreshToken) {
  authState.user = user;
  authState.accessToken = accessToken;
  authState.refreshToken = refreshToken;
  localStorage.setItem('hkd_user',    JSON.stringify(user));
  localStorage.setItem('hkd_access',  accessToken);
  localStorage.setItem('hkd_refresh', refreshToken);
  /* Tự load HKD profile đầu tiên sau khi login */
  setTimeout(async () => {
    await loadHkdProfiles();
    if (authState.hkdProfiles.length > 0 && !authState.activeHkdId) {
      authState.activeHkdId = authState.hkdProfiles[0].id;
      localStorage.setItem('hkd_active_id', authState.activeHkdId);
    }
  }, 300);
}

function clearAuth() {
  authState = { user:null, accessToken:'', refreshToken:'', hkdProfiles:[], activeHkdId:'' };
  ['hkd_user','hkd_access','hkd_refresh','hkd_active_id'].forEach(k=>localStorage.removeItem(k));
}

function isLoggedIn() { return !!authState.user && !!authState.accessToken; }

/* ── API fetch wrapper (auto refresh token) ──────────── */
async function apiFetch(path, opts={}) {
  if (!authState.accessToken && !path.includes('/auth/')) {
    showAuthModal(); throw new Error('Chưa đăng nhập');
  }
  const headers = { 'Content-Type':'application/json', ...(opts.headers||{}) };
  if (authState.accessToken) headers['Authorization'] = 'Bearer ' + authState.accessToken;

  let res = await fetch(API_BASE + path, { ...opts, headers });

  /* Token hết hạn → thử refresh */
  if (res.status === 401 && authState.refreshToken) {
    const refreshRes = await fetch(API_BASE + '/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ refreshToken: authState.refreshToken })
    });
    if (refreshRes.ok) {
      const { accessToken } = await refreshRes.json();
      authState.accessToken = accessToken;
      localStorage.setItem('hkd_access', accessToken);
      headers['Authorization'] = 'Bearer ' + accessToken;
      res = await fetch(API_BASE + path, { ...opts, headers });
    } else {
      clearAuth(); showAuthModal(); throw new Error('Phiên hết hạn');
    }
  }
  return res;
}

/* ── Load HKD profiles from server ───────────────────── */
async function loadHkdProfiles() {
  if (!isLoggedIn()) return;
  try {
    const res = await apiFetch('/api/hkd');
    if (res.ok) {
      const { profiles } = await res.json();
      authState.hkdProfiles = profiles;
    }
  } catch {}
}

/* ── Save analysis to server (with localStorage fallback) ── */
async function saveSnapshotRemote(snap, hkd_id) {
  if (!isLoggedIn() || !hkd_id) return null;
  try {
    const res = await apiFetch('/api/analysis', {
      method: 'POST',
      body: JSON.stringify({
        hkd_id,
        period:           snap.period,
        period_label:     snap.periodLabel,
        score:            snap.score,
        classification:   snap.score>=70?'safe':snap.score>=40?'warn':'danger',
        input_revenue:    snap.data.revenue,
        input_expenses:   snap.data.expenses,
        input_assets:     snap.data.assets,
        ratios:           snap.ratios,
        summary:          snap.summary,
        import_source:    snap.importSource||'manual'
      })
    });
    if (res.ok) { const d = await res.json(); return d.analysis?.id; }
  } catch {}
  return null;
}

/* ── Load history from server ───────────────────────── */
async function loadHistoryRemote(hkd_id) {
  if (!isLoggedIn() || !hkd_id) return null;
  try {
    const res = await apiFetch(`/api/analysis/history/${hkd_id}`);
    if (res.ok) { const d = await res.json(); return d.analyses; }
  } catch {}
  return null;
}

/* ── AI via backend proxy ─────────────────────────────── */
async function fetchAIRemote(prompt, analysisId) {
  if (!isLoggedIn()) return null;
  try {
    const res = await apiFetch('/api/ai/analyze', {
      method:'POST',
      body: JSON.stringify({ prompt, analysis_id: analysisId||'' })
    });
    if (res.ok) { const d = await res.json(); return d.text; }
  } catch {}
  return null;
}

/* ── Import via backend ───────────────────────────────── */
async function importExcelRemote(file) {
  if (!isLoggedIn()) return null;
  const fd = new FormData(); fd.append('file', file);
  try {
    const res = await apiFetch('/api/import/excel', { method:'POST', headers:{}, body: fd });
    if (res.ok) return (await res.json()).result;
  } catch {}
  return null;
}

async function importXmlRemote(file) {
  if (!isLoggedIn()) return null;
  const fd = new FormData(); fd.append('file', file);
  try {
    const res = await apiFetch('/api/import/xml', { method:'POST', headers:{}, body: fd });
    if (res.ok) return (await res.json()).result;
  } catch {}
  return null;
}
