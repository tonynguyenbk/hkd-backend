function showAuthModal(defaultTab='login') {
  if (document.getElementById('auth-modal')) return;
  const m = document.createElement('div');
  m.id = 'auth-modal';
  m.className = 'modal-bg';
  m.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">Đăng nhập / Đăng ký</div>
      <div class="auth-tabs">
        <button class="auth-tab ${defaultTab==='login'?'active':''}" onclick="switchAuthTab('login',this)">Đăng nhập</button>
        <button class="auth-tab ${defaultTab==='register'?'active':''}" onclick="switchAuthTab('register',this)">Đăng ký</button>
      </div>
      <div id="auth-login" style="display:${defaultTab==='login'?'block':'none'}">
        <div class="auth-form">
          <input type="email" id="al-email" placeholder="Email" autocomplete="email">
          <input type="password" id="al-pass" placeholder="Mật khẩu" autocomplete="current-password">
          <div id="al-msg"></div>
          <button class="btn btn-primary" onclick="doLogin()">Đăng nhập</button>
        </div>
      </div>
      <div id="auth-register" style="display:${defaultTab==='register'?'block':'none'}">
        <div class="auth-form">
          <input type="text" id="ar-name" placeholder="Họ tên">
          <input type="email" id="ar-email" placeholder="Email" autocomplete="email">
          <input type="password" id="ar-pass" placeholder="Mật khẩu (tối thiểu 6 ký tự)" autocomplete="new-password">
          <div id="ar-msg"></div>
          <button class="btn btn-primary" onclick="doRegister()">Tạo tài khoản</button>
        </div>
      </div>
      <div style="margin-top:14px;text-align:center;font-size:11px;color:var(--hint)">
        Hoặc <button onclick="continueOffline()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;text-decoration:underline;font-family:inherit">tiếp tục không đăng nhập</button> (lưu local)
      </div>
    </div>`;
  document.body.appendChild(m);
}

function closeAuthModal() { const m=document.getElementById('auth-modal'); if(m) m.remove(); }

function switchAuthTab(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('auth-login').style.display = tab==='login'?'block':'none';
  document.getElementById('auth-register').style.display = tab==='register'?'block':'none';
}

function continueOffline() { closeAuthModal(); }

async function doLogin() {
  const email = document.getElementById('al-email').value.trim();
  const pass  = document.getElementById('al-pass').value;
  const msg   = document.getElementById('al-msg');
  msg.innerHTML = '<span style="color:var(--muted)">Đang đăng nhập...</span>';
  try {
    const res = await fetch(API_BASE+'/api/auth/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email, password:pass})
    });
    const data = await res.json();
    if (!res.ok) { msg.innerHTML = `<div class="auth-err">${data.error}</div>`; return; }
    saveAuth(data.user, data.accessToken, data.refreshToken);
    closeAuthModal();
    updateHeaderUserChip();
    await loadHkdProfiles();
  } catch(e) {
    msg.innerHTML = `<div class="auth-err">Lỗi kết nối server. Thử lại sau.</div>`;
  }
}

async function doRegister() {
  const name  = document.getElementById('ar-name').value.trim();
  const email = document.getElementById('ar-email').value.trim();
  const pass  = document.getElementById('ar-pass').value;
  const msg   = document.getElementById('ar-msg');
  msg.innerHTML = '<span style="color:var(--muted)">Đang tạo tài khoản...</span>';
  try {
    const res = await fetch(API_BASE+'/api/auth/register', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email, password:pass, full_name:name})
    });
    const data = await res.json();
    if (!res.ok) { msg.innerHTML = `<div class="auth-err">${data.error}</div>`; return; }
    saveAuth(data.user, data.accessToken, data.refreshToken);
    closeAuthModal();
    updateHeaderUserChip();
  } catch(e) {
    msg.innerHTML = `<div class="auth-err">Lỗi kết nối server. Thử lại sau.</div>`;
  }
}

async function doLogout() {
  try {
    await apiFetch('/api/auth/logout', {method:'POST', body:JSON.stringify({refreshToken:authState.refreshToken})});
  } catch {}
  clearAuth();
  updateHeaderUserChip();
  renderCurrentStep();
}

function updateHeaderUserChip() {
  const existing = document.getElementById('header-user');
  if (!existing) return;
  if (isLoggedIn()) {
    existing.innerHTML = `<div class="user-chip" onclick="doLogout()" title="Bấm để đăng xuất">
      👤 ${authState.user.full_name||authState.user.email.split('@')[0]}
      <span style="font-size:10px;opacity:.7">Đăng xuất</span>
    </div>`;
  } else {
    existing.innerHTML = `<button class="btn btn-secondary" onclick="showAuthModal()" style="font-size:12px;padding:5px 14px">Đăng nhập</button>`;
  }
}

