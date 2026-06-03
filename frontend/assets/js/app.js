/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let currentStep = 0;
let period = 'nam'; // thang | quy | nam
let radarChart = null, barChart = null;
let loadedCase = null;

const data = {
  info:    { name:'', industry:'thuong_mai', size:'sieu_nho', duration:'', province:'', region:'tinh_lon' },
  revenue: { tongDoanhThu:0, giaVon:0, thuNhapKhac:0 },
  expenses:{ thueMatBang:0, nhanCong:0, chiPhiKhac:0, thueNopTrongKy:0 },
  assets:  { tienMat:0, hangTonKho:0, phaiThu:0, taiSanCoDinh:0,
             noNganHan:0, noDaiHan:0, vonChuSoHuu:0 }  // FIX #2: nợ chuyển vào assets (bảng cân đối)
};

/* ══════════════════════════════════════════════════════
   PERIOD HELPERS — FIX #1
══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   BACKEND API CONFIG
   Đổi API_BASE sang URL server thật khi deploy
══════════════════════════════════════════════════════ */

const PERIOD_MULT  = { thang:12, quy:4, nam:1 };
const PERIOD_KEY   = { thang:'month', quy:'quarter', nam:'year' };
const PERIOD_NOTES = () => ({
  thang: t('period.note.month'),
  quy:   t('period.note.quarter'),
  nam:   t('period.note.year'),
});
const PERIOD_LABEL = () => ({
  thang: t('period.unit.month'),
  quy:   t('period.unit.quarter'),
  nam:   t('period.unit.year'),
});
const pLabel = () => PERIOD_LABEL()[period];

function setPeriod(p, btn) {
  period = p;
  document.querySelectorAll('.period-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('period-note').textContent = PERIOD_NOTES()[p];
  renderCurrentStep();
}

function annualize(v) { return (v||0) * PERIOD_MULT[period]; }

/* ══════════════════════════════════════════════════════
   TEST CASES — FIX #3
══════════════════════════════════════════════════════ */
const TEST_CASES = [
  {
    id:'tapHoa', icon:'🛒', name:'Tạp hóa Thành Phát',
    sub:'Bán lẻ · Bình Thạnh, HCM · 8 năm', sub_en:'Retail · Binh Thanh, HCM · 8 yrs', expected:'warn',
    note:'DT năm = 480tr, nợ ngân hàng Tết 95tr, chưa nộp thuế (DT<500tr, chỉ cần khai)',
    data:{
      info:{name:'HKD Thành Phát',industry:'thuong_mai',size:'sieu_nho',duration:'tren_5',province:'TP.HCM',region:'hn_hcm'},
      revenue:{tongDoanhThu:480,giaVon:384,thuNhapKhac:0},
      expenses:{thueMatBang:18,nhanCong:15,chiPhiKhac:12,thueNopTrongKy:0},
      assets:{tienMat:20,hangTonKho:65,phaiThu:5,taiSanCoDinh:30,noNganHan:95,noDaiHan:40,vonChuSoHuu:80}
    }
  },
  {
    id:'bunBo', icon:'🍜', name:'Quán bún bò Mệ Tám',
    sub:'F&B · Hoàng Mai, HN · 3 năm', sub_en:'F&B · Hoang Mai, HN · 3 yrs', expected:'safe',
    note:'DT năm = 720tr, thuê MB 144tr/năm=20%DT — điểm yếu chính',
    data:{
      info:{name:'HKD Mệ Tám',industry:'dich_vu',size:'nho',duration:'1_3',province:'Hà Nội',region:'hn_hcm'},
      revenue:{tongDoanhThu:720,giaVon:360,thuNhapKhac:0},
      expenses:{thueMatBang:144,nhanCong:120,chiPhiKhac:48,thueNopTrongKy:25},
      assets:{tienMat:55,hangTonKho:8,phaiThu:0,taiSanCoDinh:40,noNganHan:30,noDaiHan:0,vonChuSoHuu:120}
    }
  },
  {
    id:'suaXe', icon:'🔧', name:'Sửa xe Hùng Moto',
    sub:'Dịch vụ · Củ Chi, HCM · 12 năm', sub_en:'Services · Cu Chi, HCM · 12 yrs', expected:'safe',
    note:'Nhà riêng, không thuê MB, D/E=0.11, mô hình rủi ro thấp nhất',
    data:{
      info:{name:'HKD Hùng Moto',industry:'dich_vu',size:'sieu_nho',duration:'tren_5',province:'TP.HCM',region:'tinh_nho'},
      revenue:{tongDoanhThu:380,giaVon:150,thuNhapKhac:40},
      expenses:{thueMatBang:0,nhanCong:36,chiPhiKhac:24,thueNopTrongKy:0},
      assets:{tienMat:45,hangTonKho:30,phaiThu:5,taiSanCoDinh:25,noNganHan:10,noDaiHan:0,vonChuSoHuu:90}
    }
  },
  {
    id:'may', icon:'🧵', name:'Xưởng may Thanh Loan',
    sub:'Sản xuất · Đồng Nai · 5 năm', sub_en:'Manufacturing · Dong Nai · 5 yrs', expected:'danger',
    note:'D/E=3.58, thanh khoản 0.81, phải thu 90tr chậm 60–90 ngày, nợ thuế 17tr',
    data:{
      info:{name:'HKD Thanh Loan',industry:'san_xuat',size:'nho',duration:'3_5',province:'Đồng Nai',region:'tinh_lon'},
      revenue:{tongDoanhThu:840,giaVon:588,thuNhapKhac:0},
      expenses:{thueMatBang:60,nhanCong:168,chiPhiKhac:48,thueNopTrongKy:8},
      assets:{tienMat:15,hangTonKho:40,phaiThu:90,taiSanCoDinh:180,noNganHan:180,noDaiHan:160,vonChuSoHuu:95}
    }
  },
  {
    id:'nhaTro', icon:'🏠', name:'Nhà trọ Bác Năm',
    sub:'Lưu trú · Thủ Đức, HCM · 10 năm', sub_en:'Lodging · Thu Duc, HCM · 10 yrs', expected:'safe',
    note:'Đất nhà riêng, không thuê MB, thu tiền mặt hàng tháng, dòng tiền ổn định',
    data:{
      info:{name:'Nhà trọ Bác Năm',industry:'dich_vu',size:'sieu_nho',duration:'tren_5',province:'TP.HCM',region:'hn_hcm'},
      revenue:{tongDoanhThu:450,giaVon:0,thuNhapKhac:12},
      expenses:{thueMatBang:0,nhanCong:0,chiPhiKhac:72,thueNopTrongKy:18},
      assets:{tienMat:80,hangTonKho:0,phaiThu:0,taiSanCoDinh:600,noNganHan:0,noDaiHan:80,vonChuSoHuu:550}
    }
  },
  {
    id:'barber', icon:'✂️', name:'Barber Minh Tuấn',
    sub:'Làm đẹp · Quận 3, HCM · 2 năm', sub_en:'Beauty · District 3, HCM · 2 yrs', expected:'danger',
    note:'Thuê MB 300tr/năm = 55.6% DT — đang lỗ 90tr/năm, cần xử lý ngay',
    data:{
      info:{name:'Barber Minh Tuấn',industry:'dich_vu',size:'sieu_nho',duration:'1_3',province:'TP.HCM',region:'hn_hcm'},
      revenue:{tongDoanhThu:540,giaVon:54,thuNhapKhac:30},
      expenses:{thueMatBang:300,nhanCong:96,chiPhiKhac:60,thueNopTrongKy:15},
      assets:{tienMat:25,hangTonKho:15,phaiThu:0,taiSanCoDinh:65,noNganHan:30,noDaiHan:50,vonChuSoHuu:55}
    }
  },
  {
    id:'tmdt', icon:'📦', name:'Thảo Cosmetic (Online)',
    sub:'TMĐT · Hà Đông, HN · 4 năm', sub_en:'E-commerce · Ha Dong, HN · 4 yrs', expected:'safe',
    note:'DT 1.2 tỷ/năm — kê khai tháng, hóa đơn điện tử bắt buộc (NĐ70/2025)',
    data:{
      info:{name:'HKD Thảo Cosmetic',industry:'thuong_mai',size:'nho',duration:'3_5',province:'Hà Nội',region:'hn_hcm'},
      revenue:{tongDoanhThu:1200,giaVon:720,thuNhapKhac:0},
      expenses:{thueMatBang:24,nhanCong:84,chiPhiKhac:120,thueNopTrongKy:42},
      assets:{tienMat:90,hangTonKho:150,phaiThu:20,taiSanCoDinh:20,noNganHan:60,noDaiHan:0,vonChuSoHuu:200}
    }
  }
];

const BADGE_LABEL = () => ({
  safe:   t('test_cases.badge.safe'),
  warn:   t('test_cases.badge.warn'),
  danger: t('test_cases.badge.danger'),
});

function renderTestCasePanel() {
  const tc = loadedCase ? TEST_CASES.find(c=>c.id===loadedCase) : null;
  const badges = BADGE_LABEL();
  return `
  <div class="tc-bar" id="tc-bar">
    <div class="tc-header" onclick="document.getElementById('tc-bar').classList.toggle('open')">
      <span class="tc-header-icon">📋</span>
      <span class="tc-header-title">${t('test_cases.panel_title')}</span>
      <span class="tc-header-sub">${tc ? t('test_cases.loaded_prefix')+tc.name : t('test_cases.panel_sub')}</span>
      <span class="tc-chevron">▼</span>
    </div>
    <div class="tc-body">
      <div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:6px;">
        ${t('test_cases.desc', {period: pLabel()})}
      </div>
      <div class="tc-grid">
        ${TEST_CASES.map(c=>`
        <div class="tc-chip ${loadedCase===c.id?'selected':''}" onclick="loadTestCase('${c.id}')">
          <div class="tc-chip-icon">${c.icon}</div>
          <div>
            <div class="tc-chip-name">${c.name}</div>
            <div class="tc-chip-sub">${i18n.lang==='en'&&c.sub_en?c.sub_en:c.sub}</div>
            <span class="tc-chip-badge b-${c.expected}">${badges[c.expected]}</span>
          </div>
        </div>`).join('')}
      </div>
      ${tc ? `<div class="tc-loaded">${t('test_cases.loaded_note', {name: tc.name, note: tc.note})}</div>` : ''}
    </div>
  </div>`;
}

function loadTestCase(id) {
  const tc = TEST_CASES.find(t=>t.id===id);
  if (!tc) return;
  const mult = 1 / PERIOD_MULT[period]; // convert annual→period
  loadedCase = id;

  // Deep copy + scale revenue/expenses by period
  data.info = {...tc.data.info};
  data.revenue = {
    tongDoanhThu: +(tc.data.revenue.tongDoanhThu * mult).toFixed(2),
    giaVon:       +(tc.data.revenue.giaVon       * mult).toFixed(2),
    thuNhapKhac:  +(tc.data.revenue.thuNhapKhac  * mult).toFixed(2)
  };
  data.expenses = {
    thueMatBang:    +(tc.data.expenses.thueMatBang    * mult).toFixed(2),
    nhanCong:       +(tc.data.expenses.nhanCong       * mult).toFixed(2),
    chiPhiKhac:     +(tc.data.expenses.chiPhiKhac     * mult).toFixed(2),
    thueNopTrongKy: +(tc.data.expenses.thueNopTrongKy * mult).toFixed(2)
  };
  // Assets are point-in-time — do NOT scale
  data.assets = {...tc.data.assets};

  renderCurrentStep();
  // Auto-open TC panel
  setTimeout(()=>{
    const bar = document.getElementById('tc-bar');
    if (bar) bar.classList.add('open');
  }, 50);
}

/* ══════════════════════════════════════════════════════
   INDUSTRIES
══════════════════════════════════════════════════════ */
/* ── REGIONAL BENCHMARK DATA ─────────────────────────────────────
   Nguồn tham chiếu: Tổng điều tra kinh tế 2021, VCCI 2024-2025,
   Khảo sát thị trường BĐS bán lẻ Việt Nam 2024 (CBRE, Savills)
─────────────────────────────────────────────────────────────── */
const REGION_BENCHMARKS = {
  hn_hcm: {
    label: 'Hà Nội / TP.HCM',
    mb_dt_safe: 10, mb_dt_warn: 18,
    cp_dt_safe: 22, cp_dt_warn: 32,
    note: 'Mặt bằng đắt — ngưỡng thuê MB cao hơn tỉnh'
  },
  tinh_lon: {
    label: 'Tỉnh lớn (Đà Nẵng, Cần Thơ, Hải Phòng...)',
    mb_dt_safe: 8,  mb_dt_warn: 14,
    cp_dt_safe: 20, cp_dt_warn: 28,
    note: 'Ngưỡng chuẩn trung bình'
  },
  tinh_nho: {
    label: 'Tỉnh nhỏ / Nông thôn',
    mb_dt_safe: 5,  mb_dt_warn: 10,
    cp_dt_safe: 18, cp_dt_warn: 25,
    note: 'Chi phí thấp hơn, biên LN thường cao hơn'
  }
};

const INDUSTRY_MARGIN = {
  thuong_mai: { hn_hcm:20, tinh_lon:22, tinh_nho:25 },
  dich_vu:    { hn_hcm:32, tinh_lon:35, tinh_nho:38 },
  san_xuat:   { hn_hcm:22, tinh_lon:25, tinh_nho:28 },
  xay_dung:   { hn_hcm:20, tinh_lon:22, tinh_nho:24 },
  khac:       { hn_hcm:20, tinh_lon:22, tinh_nho:24 }
};

const INDUSTRIES_DATA = {
  thuong_mai:{gtgt:1,  tncn:0.5,marginBench:20},
  dich_vu:   {gtgt:5,  tncn:2.0,marginBench:30},
  san_xuat:  {gtgt:3,  tncn:1.5,marginBench:25},
  xay_dung:  {gtgt:3,  tncn:1.5,marginBench:22},
  khac:      {gtgt:1,  tncn:1.0,marginBench:20}
};
const INDUSTRIES = new Proxy(INDUSTRIES_DATA, {
  get(target, key) {
    if (!target[key]) return undefined;
    return { ...target[key], label: t('industry.'+key) || key };
  }
});

/* ══════════════════════════════════════════════════════
   CALCULATION — FIX #1 #2
══════════════════════════════════════════════════════ */
function calculate() {
  const r=data.revenue, e=data.expenses, a=data.assets;
  const ind=INDUSTRIES[data.info.industry];
  const mult=PERIOD_MULT[period];

  // Convert period→annual for tax threshold
  const dtNam   = annualize(r.tongDoanhThu);
  const gvNam   = annualize(r.giaVon);
  const thuNam  = annualize(r.thuNhapKhac);
  const mbNam   = annualize(e.thueMatBang);
  const lcNam   = annualize(e.nhanCong);
  const cpkNam  = annualize(e.chiPhiKhac);
  const thueNam = annualize(e.thueNopTrongKy);

  const lnGop  = dtNam - gvNam;
  const cpHD   = mbNam + lcNam + cpkNam;
  const lnRong = lnGop - cpHD + thuNam;

  // FIX #2: nợ từ assets section (bảng cân đối)
  const noNH   = +a.noNganHan||0;
  const noDH   = +a.noDaiHan||0;
  const tongNo = noNH + noDH;
  const vonCSH = +a.vonChuSoHuu||1;
  const tienMat= +a.tienMat||0;
  const htk    = +a.hangTonKho||0;
  const pt     = +a.phaiThu||0;
  const tscd   = +a.taiSanCoDinh||0;
  const tsNH   = tienMat+htk+pt;
  const tongTS = tsNH+tscd;

  // FIX #1: tax threshold uses annualized DT
  const ngưỡngChịuThuế = 1000; // NĐ 141/2026/NĐ-CP: trên 1 tỷ/năm phải nộp
  const thueGTGT_expect = dtNam>ngưỡngChịuThuế ? dtNam*ind.gtgt/100 : 0;
  const thueTNCN_expect = dtNam>ngưỡngChịuThuế ? dtNam*ind.tncn/100 : 0;
  const tongThue_expect = thueGTGT_expect+thueTNCN_expect;

  const reg = REGION_BENCHMARKS[data.info.region||'tinh_lon'];
  const margBench = INDUSTRY_MARGIN[data.info.industry]?.[data.info.region||'tinh_lon'] || ind.marginBench;

  const ratios = {
    tanhoan_htl:   noNH>0 ? tsNH/noNH : 99,
    tanhoan_nhanh: noNH>0 ? (tienMat+pt)/noNH : 99,
    bien_ln_gop:   dtNam>0 ? lnGop/dtNam*100 : 0,
    bien_ln_rong:  dtNam>0 ? lnRong/dtNam*100 : 0,
    no_von:        vonCSH>0 ? tongNo/vonCSH : 0,
    vq_htk:        htk>0 ? dtNam/htk : 99,
    cp_dt:         dtNam>0 ? cpHD/dtNam*100 : 0,
    tu_tai_tro:    tongTS>0 ? vonCSH/tongTS : 0,
    tuan_thu_thue: tongThue_expect>0 ? thueNam/tongThue_expect : (thueNam>0?1:0),
    mb_dt:         dtNam>0 ? mbNam/dtNam*100 : 0
  };

  /* Ghi đè ngưỡng theo vùng cho 2 chỉ số địa lý */
  ratios._reg = reg;
  ratios._margBench = margBench;

  return {ratios, summary:{dtNam,lnGop,lnRong,cpHD,tongNo,tongTS,vonCSH,
    tongThue_expect,thueNam,tsNH,noNH,ind,mbNam,reg,margBench}};
}

/* ══════════════════════════════════════════════════════
   METRICS DEF
══════════════════════════════════════════════════════ */
const METRICS_DEF = [
  {key:'tanhoan_htl',   format:v=>v>=99?'N/A':v.toFixed(2)+' x', thresholds:[1.0,1.5],inverse:false,radarMax:3   },
  {key:'tanhoan_nhanh', format:v=>v>=99?'N/A':v.toFixed(2)+' x', thresholds:[0.5,1.0],inverse:false,radarMax:2   },
  {key:'bien_ln_gop',   format:v=>v.toFixed(1)+'%',               thresholds:[15,25],  inverse:false,radarMax:60  },
  {key:'bien_ln_rong',  format:v=>v.toFixed(1)+'%',               thresholds:[5,10],   inverse:false,radarMax:30  },
  {key:'no_von',        format:v=>v>=99?'N/A':v.toFixed(2),       thresholds:[1.0,2.0],inverse:true, radarMax:4   },
  {key:'vq_htk',        format:v=>v>=99?'N/A':v.toFixed(1)+' x', thresholds:[4,8],    inverse:false,radarMax:16  },
  {key:'cp_dt',         format:v=>v.toFixed(1)+'%',               thresholds:[20,30],  inverse:true, radarMax:60  },
  {key:'tu_tai_tro',    format:v=>(v*100).toFixed(1)+'%',         thresholds:[0.3,0.5],inverse:false,radarMax:1   },
  {key:'tuan_thu_thue', format:v=>Math.min(v*100,100).toFixed(0)+'%', thresholds:[0.7,0.9],inverse:false,radarMax:1.2},
  {key:'mb_dt',         format:v=>v.toFixed(1)+'%',               thresholds:[10,15],  inverse:true, radarMax:40  },
];
/* Return metrics with translated labels/bench/info/improve */
function getMetricsDef() {
  return METRICS_DEF.map(m => ({
    ...m,
    label:   t('metrics.'+m.key+'.label'),
    bench:   t('metrics.'+m.key+'.bench'),
    info:    t('metrics.'+m.key+'.info'),
    improve: t('metrics.'+m.key+'.improve'),
  }));
}

function classify(v,th,inv){
  if(inv){if(v<=th[0])return'safe';if(v<=th[1])return'warn';return'danger';}
  else   {if(v>=th[1])return'safe';if(v>=th[0])return'warn';return'danger';}
}
function scoreAll(ratios){
  let t=0,c=0;
  METRICS_DEF.forEach(m=>{const st=classify(ratios[m.key],m.thresholds,m.inverse);t+=(st==='safe'?100:st==='warn'?55:15);c++;});

  return c>0?Math.round(t/c):0;
}
function overallClass(s){return s>=70?'safe':s>=40?'warn':'danger';}

/* ══════════════════════════════════════════════════════
   RENDER STEP 0 — INFO
══════════════════════════════════════════════════════ */
function renderStep0() {
  return `<div class="fade-in">
  ${renderTestCasePanel()}
  <div class="section-head"><h2><span class="icon">🏪</span>${t('step0.head')}</h2><p>${t('step0.sub')}</p></div>
  <div class="card">
    <div class="card-title">${t('step0.card_title')}</div>
    <div class="field-grid">
      <div class="field" style="grid-column:1/-1">
        <label>${t('step0.lbl_name')} <span class="req">*</span></label>
        <input type="text" id="f-name" placeholder="${t('step0.ph_name')}" value="${data.info.name}" oninput="data.info.name=this.value" class="${loadedCase?'loaded-val':''}">
      </div>
      <div class="field">
        <label>${t('step0.lbl_industry')} <span class="req">*</span></label>
        <select onchange="data.info.industry=this.value;renderIndustrySummary()">
          ${Object.keys(INDUSTRIES_DATA).map(k=>`<option value="${k}" ${data.info.industry===k?'selected':''}>${t('industry.'+k)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>${t('step0.lbl_size')}</label>
        <select onchange="data.info.size=this.value">
          <option value="sieu_nho" ${data.info.size==='sieu_nho'?'selected':''}>${t('size.sieu_nho')}</option>
          <option value="nho"      ${data.info.size==='nho'?'selected':''}>${t('size.nho')}</option>
        </select>
      </div>
      <div class="field">
        <label>${t('step0.lbl_duration')}</label>
        <select onchange="data.info.duration=this.value">
          <option value="">${t('duration.choose')}</option>
          <option value="duoi_1" ${data.info.duration==='duoi_1'?'selected':''}>${t('duration.duoi_1')}</option>
          <option value="1_3"    ${data.info.duration==='1_3'?'selected':''}>${t('duration.one_3')}</option>
          <option value="3_5"    ${data.info.duration==='3_5'?'selected':''}>${t('duration.three_5')}</option>
          <option value="tren_5" ${data.info.duration==='tren_5'?'selected':''}>${t('duration.tren_5')}</option>
        </select>
      </div>
      <div class="field">
        <label>${t('step0.lbl_province')}</label>
        <input type="text" placeholder="${t('step0.ph_province')}" value="${data.info.province}" oninput="data.info.province=this.value" class="${loadedCase?'loaded-val':''}">
      </div>
      <div class="field">
        <label>${t('step0.lbl_region')} <span style="font-size:11px;color:var(--hint);font-weight:400;text-transform:none">${t('step0.region_note')}</span></label>
        <select onchange="data.info.region=this.value">
          <option value="hn_hcm"   ${data.info.region==='hn_hcm'  ?'selected':''}>${t('region.hn_hcm')}</option>
          <option value="tinh_lon" ${(data.info.region||'tinh_lon')==='tinh_lon'?'selected':''}>${t('region.tinh_lon')}</option>
          <option value="tinh_nho" ${data.info.region==='tinh_nho'?'selected':''}>${t('region.tinh_nho')}</option>
        </select>
        <div class="field-hint" id="region-note">
          ${(REGION_BENCHMARKS[data.info.region||'tinh_lon']||{note:''}).note}
        </div>
      </div>
    </div>
  </div>
  <div class="card" id="industry-summary">
    <div class="card-title">${t('step0.tax_title')}</div>
    <table class="tax-table"><thead><tr><th>${t('step0.tax_th_type')}</th><th>${t('step0.tax_th_rate')}</th><th>${t('step0.tax_th_note')}</th></tr></thead>
    <tbody id="tax-tbody"></tbody></table>
    <div class="legal-box">${t('step0.legal_box')}</div>
  </div>
  <div class="btn-row"><button class="btn btn-primary" onclick="nextStep()">${t('btn.next')}</button></div>
</div>`;
}

/* ══════════════════════════════════════════════════════
   RENDER STEP 1 — REVENUE
══════════════════════════════════════════════════════ */
function renderStep1() {
  const ind=INDUSTRIES[data.info.industry];
  const pUnit=pLabel();
  const lc=loadedCase?'loaded-val':'';
  return `<div class="fade-in">
  ${renderTestCasePanel()}
  ${renderImportPanel()}
  <div class="section-head"><h2><span class="icon">📈</span>${t('step1.head')}</h2>
    <p>${t('step1.sub',{period:pUnit})}</p></div>

  <div class="concept-banner">
    <span class="ci">📌</span>
    <span>${t('step1.cogs_banner')}</span>
  </div>

  <div class="card">
    <div class="card-title">${t('step1.card_title',{period:pUnit})}</div>
    <div class="field-grid">
      <div class="field">
        <label>${t('step1.lbl_revenue')} <span class="req">*</span></label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.revenue.tongDoanhThu||''}"
            oninput="data.revenue.tongDoanhThu=+this.value;updateRevCalc()" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">${t('step1.hint_revenue',{period:pUnit})}</div>
        <div class="field-example">${t('step1.eg_revenue')}</div>
      </div>
      <div class="field">
        <label>${t('step1.lbl_cogs')} <span class="req">*</span></label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.revenue.giaVon||''}"
            oninput="data.revenue.giaVon=+this.value;updateRevCalc()" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">${t('step1.hint_cogs',{period:pUnit})}</div>
        <div class="field-example">${t('step1.eg_cogs')}</div>
      </div>
      <div class="field">
        <label>${t('step1.lbl_other')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.revenue.thuNhapKhac||''}"
            oninput="data.revenue.thuNhapKhac=+this.value;updateRevCalc()" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">${t('step1.hint_other')}</div>
      </div>
      <div class="field">
        <label>${t('step1.lbl_gross')}</label>
        <div class="computed" id="calc-ln-gop">—</div>
        <div class="field-hint">${t('step1.hint_gross',{industry:ind.label,bench:ind.marginBench+'–'+(ind.marginBench+10)})}</div>
      </div>
    </div>
  </div>
  <div class="btn-row">
    <button class="btn btn-secondary" onclick="prevStep()">${t('btn.back')}</button>
    <button class="btn btn-primary" onclick="nextStep()">${t('btn.next')}</button>
  </div></div>`;
}

/* ══════════════════════════════════════════════════════
   RENDER STEP 2 — EXPENSES (chi phí hoạt động, không có nợ)
   FIX #2: Nợ chuyển sang Step 3 (Bảng cân đối)
══════════════════════════════════════════════════════ */
function renderStep2() {
  const pUnit=pLabel();
  const lc=loadedCase?'loaded-val':'';
  return `<div class="fade-in">
  ${renderTestCasePanel()}
  <div class="section-head"><h2><span class="icon">💸</span>${t('step2.head')}</h2>
    <p>${t('step2.sub',{period:pUnit})}</p></div>

  <div class="concept-banner">
    <span class="ci">📌</span>
    <span>${t('step2.banner',{period:pUnit})}</span>
  </div>

  <div class="card">
    <div class="card-title">${t('step2.card_title',{period:pUnit})}</div>
    <div class="field-grid">
      <div class="field">
        <label>${t('step2.lbl_rent')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.expenses.thueMatBang||''}"
            oninput="data.expenses.thueMatBang=+this.value" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">${t('step2.hint_rent',{period:pUnit})}</div>
        <div class="field-example">${t('step2.eg_rent')}</div>
      </div>
      <div class="field">
        <label>${t('step2.lbl_labor')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.expenses.nhanCong||''}"
            oninput="data.expenses.nhanCong=+this.value" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">${t('step2.hint_labor')}</div>
        <div class="field-example">${t('step2.eg_labor')}</div>
      </div>
      <div class="field">
        <label>${t('step2.lbl_other')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.expenses.chiPhiKhac||''}"
            oninput="data.expenses.chiPhiKhac=+this.value" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">${t('step2.hint_other')}</div>
      </div>
      <div class="field">
        <label>${t('step2.lbl_tax')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.expenses.thueNopTrongKy||''}"
            oninput="data.expenses.thueNopTrongKy=+this.value" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">${t('step2.hint_tax',{period:pUnit})}</div>
        <div class="field-example">${t('step2.eg_tax')}</div>
      </div>
    </div>
  </div>
  <div class="btn-row">
    <button class="btn btn-secondary" onclick="prevStep()">${t('btn.back')}</button>
    <button class="btn btn-primary" onclick="nextStep()">${t('btn.next')}</button>
  </div></div>`;
}

/* ══════════════════════════════════════════════════════
   RENDER STEP 3 — ASSETS + NỢ (bảng cân đối) — FIX #2
══════════════════════════════════════════════════════ */
function renderStep3() {
  const lc=loadedCase?'loaded-val':'';
  return `<div class="fade-in">
  ${renderTestCasePanel()}
  <div class="section-head"><h2><span class="icon">🏦</span>${t('step3.head')}</h2>
    <p>${t('step3.sub')}</p></div>

  <div class="concept-banner">
    <span class="ci">📌</span>
    <span>${t('step3.banner')}</span>
  </div>

  <div class="card">
    <div class="card-title">${t('step3.card_current')}</div>
    <div class="field-grid c3">
      <div class="field">
        <label>${t('step3.lbl_cash')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.tienMat||''}"
            oninput="data.assets.tienMat=+this.value" class="${lc}">
          <span class="input-suffix">${t('step3.unit')}</span>
        </div>
        <div class="field-hint">${t('step3.hint_cash')}</div>
      </div>
      <div class="field">
        <label>${t('step3.lbl_inv')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.hangTonKho||''}"
            oninput="data.assets.hangTonKho=+this.value" class="${lc}">
          <span class="input-suffix">${t('step3.unit')}</span>
        </div>
        <div class="field-hint">${t('step3.hint_inv')}</div>
      </div>
      <div class="field">
        <label>${t('step3.lbl_recv')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.phaiThu||''}"
            oninput="data.assets.phaiThu=+this.value" class="${lc}">
          <span class="input-suffix">${t('step3.unit')}</span>
        </div>
        <div class="field-hint">${t('step3.hint_recv')}</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">${t('step3.card_fixed')}</div>
    <div class="field-grid">
      <div class="field">
        <label>${t('step3.lbl_fa')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.taiSanCoDinh||''}"
            oninput="data.assets.taiSanCoDinh=+this.value" class="${lc}">
          <span class="input-suffix">${t('step3.unit')}</span>
        </div>
        <div class="field-hint">${t('step3.hint_fa')}</div>
      </div>
      <div class="field">
        <label>${t('step3.lbl_equity')} <span class="req">*</span></label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.vonChuSoHuu||''}"
            oninput="data.assets.vonChuSoHuu=+this.value" class="${lc}">
          <span class="input-suffix">${t('step3.unit')}</span>
        </div>
        <div class="field-hint">${t('step3.hint_equity')}</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">${t('step3.card_debt')}</div>
    <div class="concept-banner" style="margin-bottom:1rem">
      <span class="ci">⚠️</span>
      <span>${t('step3.debt_banner',{period:pLabel()})}</span>
    </div>
    <div class="field-grid">
      <div class="field">
        <label>${t('step3.lbl_st_debt')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.noNganHan||''}"
            oninput="data.assets.noNganHan=+this.value" class="${lc}">
          <span class="input-suffix">${t('step3.unit')}</span>
        </div>
        <div class="field-hint">${t('step3.hint_st_debt')}</div>
        <div class="field-example">${t('step3.eg_st_debt')}</div>
      </div>
      <div class="field">
        <label>${t('step3.lbl_lt_debt')}</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.noDaiHan||''}"
            oninput="data.assets.noDaiHan=+this.value" class="${lc}">
          <span class="input-suffix">${t('step3.unit')}</span>
        </div>
        <div class="field-hint">${t('step3.hint_lt_debt')}</div>
      </div>
    </div>
  </div>

  <div class="btn-row">
    <button class="btn btn-secondary" onclick="prevStep()">${t('btn.back')}</button>
    <button class="btn btn-primary" onclick="runAnalysis()">${t('btn.analyze')}</button>
  </div></div>`;
}

/* ══════════════════════════════════════════════════════
   RENDER STEP 4 — RESULTS
══════════════════════════════════════════════════════ */
function renderStep4(res) {
  const {ratios,summary}=res;
  const s=scoreAll(ratios), cls=overallClass(s);
  const sc=cls==='safe'?'#22C55E':cls==='warn'?'#F59E0B':'#EF4444';
  const bCls='badge-'+cls;
  const bTxt=t('result.badge_'+cls);
  const ind=summary.ind;
  const mDef=getMetricsDef();
  const dangerM=mDef.filter(m=>classify(ratios[m.key],m.thresholds,m.inverse)==='danger');
  const warnM  =mDef.filter(m=>classify(ratios[m.key],m.thresholds,m.inverse)==='warn');

  const tcNote = '';  /* pass/fail badge ẩn — chỉ dùng nội bộ */

  return `<div class="fade-in">
  <div class="section-head"><h2><span class="icon">📊</span>${t('result.head',{name:data.info.name||t('industry.khac')})}</h2>
    <p>${t('result.sub',{period:pLabel(),dt:fmt(summary.dtNam)})}</p></div>

  ${tcNote}

  <div class="card" style="text-align:center">
    <div class="score-ring-wrap">
      <div class="score-ring">
        <svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="60" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="11"/>
        <circle cx="75" cy="75" r="60" fill="none" stroke="${sc}" stroke-width="11" stroke-dasharray="${s/100*376.99} 376.99" stroke-linecap="round"/></svg>
        <div class="score-ring-inner"><div class="score-number" style="color:${sc}">${s}</div><div class="score-label">${t('result.score_label')}</div></div>
      </div>
      <div class="classification-badge ${bCls}">${bTxt}</div>
    </div>
    <div class="summary-row">
      <div class="summary-tile"><div class="summary-tile-val">₫${fmt(summary.dtNam)}</div><div class="summary-tile-label">${t('result.tile_revenue')}</div></div>
      <div class="summary-tile"><div class="summary-tile-val" style="color:${summary.lnRong>=0?'var(--safe)':'var(--danger)'}">₫${fmt(summary.lnRong)}</div><div class="summary-tile-label">${t('result.tile_profit')}</div></div>
      <div class="summary-tile"><div class="summary-tile-val">₫${fmt(summary.tongTS)}</div><div class="summary-tile-label">${t('result.tile_assets')}</div></div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('t-met',this)">${t('result.tab_metrics')}</button>
    <button class="tab" onclick="switchTab('t-chart',this)">${t('result.tab_chart')}</button>
    <button class="tab" onclick="switchTab('t-hist',this)">${t('result.tab_history')}</button>
    <button class="tab" onclick="switchTab('t-tax',this)">${t('result.tab_tax')}</button>
    <button class="tab" onclick="switchTab('t-road',this)">${t('result.tab_roadmap')}</button>
    <button class="tab" onclick="switchTab('t-ai',this)">${t('result.tab_ai')}</button>
  </div>

  <div id="t-met" class="tab-content active">
    <div class="metrics-grid">
      ${(()=>{
        const prev = getPrevSnapshot();
        return getMetricsDef().map(m=>{
          const v=ratios[m.key];const st=classify(v,m.thresholds,m.inverse);
          const sl=t('status.'+st);
          const delta = prev ? renderDelta(v, prev, m.key, m.format, m.inverse) : '';
          return `<div class="metric-card ${st}"><div class="metric-name">${m.label}</div><div class="metric-value">${m.format(v)}</div>
          ${delta ? '<div style="margin-top:2px">'+delta+'</div>' : ''}
          <div class="metric-bench" style="margin-top:4px">${m.info}</div><div class="metric-bench" style="margin-top:3px;font-size:11px">${m.bench}</div>
          <div class="metric-status">${sl}</div></div>`;
        }).join('');
      })()}
    </div>
  </div>

  <div id="t-chart" class="tab-content">
    <div class="card"><div class="card-title">${t('result.radar_title')}</div><div class="chart-wrap"><canvas id="radar-chart"></canvas></div></div>
    <div class="card" style="margin-top:10px"><div class="card-title">${t('result.bar_title')}</div><div class="chart-wrap" style="height:320px"><canvas id="bar-chart"></canvas></div></div>
  </div>

  <div id="t-hist" class="tab-content">
    ${renderHistoryTab()}
  </div>

  <div id="t-tax" class="tab-content">
    <div class="card">
      <div class="card-title">${t('tax.card_title')}</div>
      <table class="tax-table"><thead><tr><th>${t('tax.th_type')}</th><th>${t('tax.th_rate')}</th><th>${t('tax.th_estimate')}</th></tr></thead>
      <tbody>
        <tr><td>${t('tax.gtgt')}</td><td class="tax-highlight">${ind.gtgt}%</td>
          <td class="tax-highlight">${summary.dtNam>1000?'₫'+fmt(summary.dtNam*ind.gtgt/100)+'M':t('tax.exempt')}</td></tr>
        <tr><td>${t('tax.tncn')}</td><td class="tax-highlight">${ind.tncn}%</td>
          <td class="tax-highlight">${summary.dtNam>1000?'₫'+fmt(summary.dtNam*ind.tncn/100)+'M':t('tax.exempt')}</td></tr>
        <tr style="border-top:1px solid var(--border)"><td><strong>${t('tax.total')}</strong></td>
          <td class="tax-highlight">${(ind.gtgt+ind.tncn).toFixed(1)}%</td>
          <td class="tax-highlight" style="color:var(--gold)"><strong>₫${fmt(summary.tongThue_expect)}M</strong></td></tr>
        <tr><td>${t('tax.paid')}</td><td></td>
          <td style="color:${summary.thueNam>=summary.tongThue_expect?'var(--safe)':'var(--danger)'}">
            ₫${fmt(summary.thueNam)}M ${summary.thueNam>=summary.tongThue_expect?'✓':summary.tongThue_expect>0?t('tax.shortage',{amount:fmt(summary.tongThue_expect-summary.thueNam)}):''}</td></tr>
      </tbody></table>
      <div class="legal-box" style="margin-top:10px">${t('tax.period_note',{period:pLabel(),mult:PERIOD_MULT[period]})}</div>
    </div>
    <div class="card"><div class="card-title">${t('tax.legal_title')}</div>
      <div style="font-size:13px;color:var(--muted);line-height:2">
        ${(t('tax.legal_items')||[]).map?.(item=>`<div>${item}</div>`).join('')||''}
      </div>
    </div>
  </div>

  <div id="t-road" class="tab-content">
    <div class="card"><div class="card-title">${t('roadmap.card_title')}</div>
      ${buildRoadmap(dangerM,warnM,ratios)}
    </div>
  </div>

  <div id="t-ai" class="tab-content">
    <div class="ai-box">
      <div class="ai-header">
        <div class="ai-pulse"></div>
        ${t('ai.header')}
        <span style="margin-left:auto;font-size:12px;font-weight:400;color:var(--gold);background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.25);border-radius:4px;padding:2px 8px;">${t('ai.coming_soon')}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:4px;">
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">🔍</div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:3px;">${t('ai.overview_title')}</div>
            <div style="font-size:13px;color:var(--muted);line-height:1.6;">${t('ai.overview_desc')}</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">💪</div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:3px;">${t('ai.strengths_title')}</div>
            <div style="font-size:13px;color:var(--muted);line-height:1.6;">${t('ai.strengths_desc')}</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">⚠️</div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:3px;">${t('ai.risks_title')}</div>
            <div style="font-size:13px;color:var(--muted);line-height:1.6;">${t('ai.risks_desc')}</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(74,158,224,0.1);border:1px solid rgba(74,158,224,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">🗺️</div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:3px;">${t('ai.strategy_title')}</div>
            <div style="font-size:13px;color:var(--muted);line-height:1.6;">${t('ai.strategy_desc')}</div>
          </div>
        </div>
        <div style="margin-top:6px;padding:12px 14px;background:rgba(10,21,32,0.5);border:1px solid rgba(212,168,67,0.15);border-radius:8px;display:flex;align-items:center;gap:10px;">
          <div style="font-size:18px;">🔒</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.6;">${t('ai.privacy')}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="btn-row">
    <button class="btn btn-secondary" onclick="prevStep()">${t('btn.back')}</button>
    <button class="btn btn-secondary" onclick="resetForm()">${t('btn.reset')}</button>
    <button class="btn btn-primary" onclick="window.print()">${t('btn.print')}</button>
  </div>
  <div class="disclaimer">${t('result.disclaimer').replace('\n','<br>')}</div>
</div>`;
}

function buildRoadmap(dangerM,warnM,ratios){
  let items=[],i=1;
  for(const m of dangerM) items.push(`<div class="roadmap-item"><div class="roadmap-num">${i++}</div><div>
    <div class="roadmap-title">${t('roadmap.high',{label:m.label,value:m.format(ratios[m.key])})}</div>
    <div class="roadmap-desc">${m.improve}</div><span class="roadmap-tag tag-urgent">${t('roadmap.tag_urgent')}</span></div></div>`);
  for(const m of warnM) items.push(`<div class="roadmap-item"><div class="roadmap-num">${i++}</div><div>
    <div class="roadmap-title">${t('roadmap.medium',{label:m.label,value:m.format(ratios[m.key])})}</div>
    <div class="roadmap-desc">${m.improve}</div><span class="roadmap-tag tag-medium">${t('roadmap.tag_medium')}</span></div></div>`);
  items.push(`<div class="roadmap-item"><div class="roadmap-num">${i++}</div><div>
    <div class="roadmap-title">${t('roadmap.accounting')}</div>
    <div class="roadmap-desc">${t('roadmap.accounting_desc')}</div>
    <span class="roadmap-tag tag-long">${t('roadmap.tag_long')}</span></div></div>`);
  if(items.length===1) items=[`<div style="text-align:center;padding:2rem;color:var(--safe)">${t('roadmap.congrats')}</div>`,...items];
  return items.join('');
}

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
function fmt(v){return (Math.round((v||0)*10)/10).toFixed(1);}

function switchTab(id,btn){
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if(id==='t-chart') renderCharts();
}

function renderIndustrySummary(){
  const ind=INDUSTRIES[data.info.industry];
  const tbody=document.getElementById('tax-tbody');
  if(!tbody)return;
  tbody.innerHTML=`
    <tr><td>${t('step0.tax_gtgt')}</td><td class="tax-highlight">${ind.gtgt}%</td><td>${t('step0.tax_gtgt_note')}</td></tr>
    <tr><td>${t('step0.tax_tncn')}</td><td class="tax-highlight">${ind.tncn}%</td><td>${t('step0.tax_tncn_note')}</td></tr>
    <tr><td>${t('step0.tax_margin')}</td><td class="tax-highlight">${ind.marginBench}%+</td><td>${t('step0.tax_margin_note')}</td></tr>`;
}

function updateRevCalc(){
  const el=document.getElementById('calc-ln-gop');
  if(!el)return;
  const ln=annualize(data.revenue.tongDoanhThu)-annualize(data.revenue.giaVon);
  const dtNam=annualize(data.revenue.tongDoanhThu);
  const pct=dtNam>0?(ln/dtNam*100).toFixed(1):0;
  el.textContent=`₫${fmt(ln)} triệu/năm (${pct}%)`;
  el.style.color=ln>=0?'var(--gold-light)':'var(--danger)';
}


/* ── API KEY CONFIG ──────────────────────────────────────
   Khi chạy trên Claude.ai  : key được inject tự động, không cần điền.
   Khi chạy local / server  : điền key của bạn vào dòng dưới.
   Lấy key tại: https://console.anthropic.com/settings/keys
   CẢNH BÁO: Không commit/share file nếu đã điền key thật.
─────────────────────────────────────────────────────── */
const LOCAL_API_KEY = '';   // ← điền key ở đây nếu chạy local, VD: 'sk-ant-...'

async function fetchAI(res){
  const {ratios,summary}=res;
  const ind=INDUSTRIES[data.info.industry];
  const dList=METRICS_DEF.filter(m=>classify(ratios[m.key],m.thresholds,m.inverse)==='danger').map(m=>`${m.label}: ${m.format(ratios[m.key])}`).join(', ')||'Không có';
  const wList=METRICS_DEF.filter(m=>classify(ratios[m.key],m.thresholds,m.inverse)==='warn').map(m=>`${m.label}: ${m.format(ratios[m.key])}`).join(', ')||'Không có';
  const prompt=`Bạn là chuyên gia tư vấn tài chính cho hộ kinh doanh Việt Nam. Phân tích ngắn gọn, thực tế.
HKD: ${data.info.name||'Không cung cấp'} | Ngành: ${ind.label}
DT năm: ${fmt(summary.dtNam)} triệu | LN ròng: ${fmt(summary.lnRong)} triệu | Tổng nợ: ${fmt(summary.tongNo)} triệu
Chỉ số nguy cơ cao: ${dList}
Chỉ số cần cải thiện: ${wList}
Điểm sức khỏe: ${scoreAll(ratios)}/100
Viết phân tích 250–350 từ bằng tiếng Việt: (1) Nhận xét tổng quan, (2) 3 điểm mạnh, (3) 3 rủi ro cần xử lý ngay, (4) Khuyến nghị chiến lược cụ thể cho quy mô HKD nhỏ tại Việt Nam 2026.`;

  /* Phát hiện môi trường */
  const isClaudeAI = window.location.hostname.includes('claude.ai') ||
                     window.location.protocol === 'blob:' ||
                     window.location.href.includes('claude');
  const key = LOCAL_API_KEY.trim();

  /* Nếu không có key và không phải Claude.ai → hiện hướng dẫn thay vì lỗi */
  if(!key && !isClaudeAI){
    return [
      '⚠️ Tính năng Tư vấn AI không hoạt động khi chạy file local vì cần API key.',
      '',
      'Cách kích hoạt:',
      '1. Lấy API key miễn phí tại https://console.anthropic.com/settings/keys',
      '2. Mở file HTML bằng text editor',
      '3. Tìm dòng: const LOCAL_API_KEY = (trống)',
      '4. Điền key vào: const LOCAL_API_KEY = \'sk-ant-xxxxx\'',
      '5. Lưu và mở lại file trong trình duyệt',
      '',
      'Hoặc deploy lên server và gọi API từ backend để bảo mật key hơn.',
      '',
      '📊 Các chức năng phân tích còn lại (10 chỉ số, biểu đồ, lộ trình) hoạt động bình thường không cần API key.'
    ].join('\n');
  }

  try{
    const headers = {'Content-Type':'application/json'};
    if(key) headers['x-api-key'] = key;
    const resp=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers,
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})
    });
    if(!resp.ok){
      const err=await resp.json().catch(()=>({}));
      const msg=err?.error?.message||resp.statusText;
      if(resp.status===401) return '❌ API key không hợp lệ. Kiểm tra lại key tại console.anthropic.com';
      if(resp.status===429) return '⏳ Vượt giới hạn request. Thử lại sau vài giây.';
      return `❌ Lỗi API (${resp.status}): ${msg}`;
    }
    const json=await resp.json();
    return json.content?.[0]?.text||'Không thể lấy kết quả từ AI.';
  }catch(e){
    if(e.message&&e.message.includes('CORS')){
      return '❌ CORS error: Trình duyệt chặn request từ file local. Xem hướng dẫn điền API key bên dưới.\n\n→ Mở file HTML, tìm LOCAL_API_KEY và điền key của bạn vào.';
    }
    return `❌ Lỗi kết nối: ${e.message||'Không xác định'}. Kiểm tra internet và thử lại.`;
  }
}

function resetForm(){
  Object.assign(data,{
    info:{name:'',industry:'thuong_mai',size:'sieu_nho',duration:'',province:'',region:'tinh_lon'},
    revenue:{tongDoanhThu:0,giaVon:0,thuNhapKhac:0},
    expenses:{thueMatBang:0,nhanCong:0,chiPhiKhac:0,thueNopTrongKy:0},
    assets:{tienMat:0,hangTonKho:0,phaiThu:0,taiSanCoDinh:0,noNganHan:0,noDaiHan:0,vonChuSoHuu:0}
  });
  loadedCase=null; currentStep=0; renderCurrentStep();
}


/* ══════════════════════════════════════════════════════
   PERIOD HISTORY — localStorage
   Key: hkd_history_{name} → array of snapshots
   Snapshot: { period, date, data, ratios, score, summary }
══════════════════════════════════════════════════════ */
const HISTORY_KEY = () => 'hkd_v1_' + (data.info.name||'default').replace(/\s+/g,'_').toLowerCase();

function saveSnapshot(res) {
  if(!data.info.name) return;
  const snap = {
    id: Date.now(),
    savedAt: new Date().toLocaleDateString('vi-VN'),
    period,
    periodLabel: pLabel(),
    score: scoreAll(res.ratios),
    name: data.info.name,
    industry: data.info.industry,
    region: data.info.region||'tinh_lon',
    data: JSON.parse(JSON.stringify(data)),
    summary: {
      dtNam: res.summary.dtNam,
      lnGop: res.summary.lnGop,
      lnRong: res.summary.lnRong,
      tongNo: res.summary.tongNo,
      tongTS: res.summary.tongTS
    },
    ratios: Object.fromEntries(Object.entries(res.ratios).filter(([k])=>!k.startsWith('_')))
  };
  try {
    const key = HISTORY_KEY();
    const existing = JSON.parse(localStorage.getItem(key)||'[]');
    existing.unshift(snap);
    const trimmed = existing.slice(0,24); // giữ tối đa 24 kỳ
    localStorage.setItem(key, JSON.stringify(trimmed));
    return snap;
  } catch(e) { console.warn('localStorage save failed:', e); return null; }
}

function loadHistory() {
  try {
    const key = HISTORY_KEY();
    return JSON.parse(localStorage.getItem(key)||'[]');
  } catch(e) { return []; }
}

function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY()); } catch(e){}
}

function getPrevSnapshot() {
  const h = loadHistory();
  return h.length > 1 ? h[1] : null;
}

function renderDelta(curr, prev, key, fmt, inverse=false) {
  if(!prev||prev.ratios[key]===undefined) return '<span style="color:var(--hint);font-size:10px">—</span>';
  const delta = curr - prev.ratios[key];
  if(Math.abs(delta) < 0.01) return '<span style="color:var(--hint);font-size:10px">= Không đổi</span>';
  const better = inverse ? delta < 0 : delta > 0;
  const color = better ? 'var(--safe)' : 'var(--danger)';
  const sign = delta > 0 ? '+' : '';
  return `<span style="color:${color};font-size:12px;font-weight:600">${sign}${fmt(delta)} ${t('result.compared_prev')}</span>`;
}

/* Render history tab */
function renderHistoryTab() {
  const hist = loadHistory();

  /* ── Empty state ─────────────────────── */
  if(hist.length < 1) return `
    <div style="text-align:center;padding:4rem 1rem;">
      <div style="font-size:40px;margin-bottom:1rem;">📊</div>
      <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:10px;">${t('history.empty_title')}</div>
      <div style="font-size:15px;color:var(--muted);line-height:1.7;max-width:380px;margin:0 auto;">${t('history.empty_desc').replace('\n','<br>')}</div>
    </div>`;

  /* ── Data prep ───────────────────────── */
  const latest  = hist[0];
  const prev    = hist[1] || null;
  const best    = hist.reduce((a,b)=>b.score>a.score?b:a, hist[0]);
  const dScore  = prev ? latest.score - prev.score : null;
  const dColor  = dScore===null?'var(--hint)':dScore>0?'var(--safe)':dScore<0?'var(--danger)':'var(--muted)';
  const dArrow  = dScore===null?'':dScore>0?'↑':dScore<0?'↓':'→';
  const scoreColor = s => s>=70?'var(--safe)':s>=40?'var(--warn)':'var(--danger)';

  const chartHist = hist.slice(0,8).reverse();
  const labels  = chartHist.map(h=>`${h.periodLabel} ${h.savedAt}`);
  const scores  = chartHist.map(h=>h.score);
  const dtData  = chartHist.map(h=>+(h.summary.dtNam||0).toFixed(1));
  const lnData  = chartHist.map(h=>+(h.summary.lnRong||0).toFixed(1));
  const margins = chartHist.map(h=>h.summary.dtNam>0?(+(h.summary.lnRong||0)/h.summary.dtNam*100).toFixed(1):0);

  /* ── Period cards (max 12) ───────────── */
  const cards = hist.slice(0,12).map((h,i)=>{
    const p = hist[i+1];
    const ds = p ? h.score - p.score : null;
    const dsLabel = ds===null ? '' : (ds>0?`<span style="color:var(--safe);font-size:12px">↑+${ds}</span>`
                                      :ds<0?`<span style="color:var(--danger);font-size:12px">↓${ds}</span>`
                                      :`<span style="color:var(--muted);font-size:12px">→0</span>`);
    const sc = scoreColor(h.score);
    const margin = h.summary.dtNam>0 ? (h.summary.lnRong/h.summary.dtNam*100).toFixed(1) : '—';
    return `
    <div class="hist-card" onclick="reloadSnapshot(${i})" title="${t('btn.view_again')}">
      <div class="hist-card-top">
        <div>
          <div class="hist-date">${h.savedAt}</div>
          <div class="hist-period">${h.periodLabel}</div>
        </div>
        <div class="hist-score-badge" style="color:${sc};border-color:${sc}">
          ${h.score}
          <div style="font-size:10px;color:var(--hint)">/ 100</div>
        </div>
      </div>
      <div class="hist-card-mid">
        <div class="hist-metric">
          <div class="hist-metric-v">₫${fmt(h.summary.dtNam)}</div>
          <div class="hist-metric-l">${t('result.tile_revenue')}</div>
        </div>
        <div class="hist-metric">
          <div class="hist-metric-v" style="color:${(h.summary.lnRong||0)>=0?'var(--safe)':'var(--danger)'}">₫${fmt(h.summary.lnRong)}</div>
          <div class="hist-metric-l">${t('result.tile_profit')}</div>
        </div>
        <div class="hist-metric">
          <div class="hist-metric-v">${margin}%</div>
          <div class="hist-metric-l">${t('history.margin')}</div>
        </div>
      </div>
      <div class="hist-card-bot">
        ${dsLabel}
        <span class="hist-reload">${t('btn.view_again')} →</span>
      </div>
    </div>`;
  }).join('');

  return `
  <!-- ── Summary stats ─────────────────── -->
  <div class="hist-stats">
    <div class="hist-stat">
      <div class="hist-stat-v">${hist.length}</div>
      <div class="hist-stat-l">${t('history.total_periods')}</div>
    </div>
    <div class="hist-stat">
      <div class="hist-stat-v" style="color:${scoreColor(latest.score)}">${latest.score}</div>
      <div class="hist-stat-l">${t('history.latest_score')}</div>
    </div>
    <div class="hist-stat">
      <div class="hist-stat-v" style="color:${dColor}">${dArrow}${dScore===null?'—':Math.abs(dScore)}</div>
      <div class="hist-stat-l">${t('history.vs_prev')}</div>
    </div>
    <div class="hist-stat">
      <div class="hist-stat-v" style="color:${scoreColor(best.score)}">${best.score}</div>
      <div class="hist-stat-l">${t('history.best_score')}</div>
    </div>
  </div>

  <!-- ── Trend chart ───────────────────── -->
  <div class="card">
    <div class="card-title">${t('history.card_score')}</div>
    <div style="position:relative;height:200px"><canvas id="hist-score-chart"></canvas></div>
  </div>

  <!-- ── Period cards grid ─────────────── -->
  <div class="card">
    <div class="card-title">${t('history.card_title',{count:hist.length})}
      <button onclick="if(confirm(t('btn.confirm_delete'))){clearHistory();renderCurrentStep()}"
        style="margin-left:auto;font-size:12px;padding:4px 12px;border-radius:5px;border:1px solid rgba(239,68,68,.3);background:transparent;color:var(--danger);cursor:pointer;font-family:inherit;font-weight:600">
        ${t('btn.delete_history')}
      </button>
    </div>
    <div class="hist-grid">${cards}</div>
  </div>

  <!-- ── Revenue & margin chart ────────── -->
  <div class="card">
    <div class="card-title">${t('history.card_revenue')}</div>
    <div style="position:relative;height:200px"><canvas id="hist-dt-chart"></canvas></div>
  </div>

  <script>
  (function(){
    const labels=${JSON.stringify(labels)};
    const scores=${JSON.stringify(scores)};
    const dtData=${JSON.stringify(dtData)};
    const lnData=${JSON.stringify(lnData)};
    setTimeout(()=>{
      const sc=document.getElementById('hist-score-chart');
      if(sc) new Chart(sc,{type:'line',data:{labels,datasets:[{data:scores,borderColor:'#D4A843',backgroundColor:'rgba(212,168,67,0.08)',tension:0.35,fill:true,pointRadius:5,pointBackgroundColor:scores.map(s=>s>=70?'#22C55E':s>=40?'#F59E0B':'#EF4444'),pointBorderColor:'#0D1B2A',pointBorderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{min:0,max:100,ticks:{color:'#64748B',font:{size:11}},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#94A3B8',font:{size:10}},grid:{display:false}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' Điểm: '+ctx.raw}}}}});
      const dt=document.getElementById('hist-dt-chart');
      if(dt) new Chart(dt,{type:'bar',data:{labels,datasets:[{label:t('history.chart_dt'),data:dtData,backgroundColor:'rgba(212,168,67,0.35)',borderColor:'#D4A843',borderWidth:1,borderRadius:4},{label:t('history.chart_ln'),data:lnData,backgroundColor:lnData.map(v=>v>=0?'rgba(34,197,94,0.35)':'rgba(239,68,68,0.35)'),borderColor:lnData.map(v=>v>=0?'#22C55E':'#EF4444'),borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{ticks:{color:'#64748B',font:{size:11}},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#94A3B8',font:{size:10}},grid:{display:false}}},plugins:{legend:{labels:{color:'#94A3B8',font:{size:11}}}}}});
    },100);
  })();
  <\/script>`;
}

function reloadSnapshot(idx) {
  const hist = loadHistory();
  if(!hist[idx]) return;
  const snap = hist[idx];
  Object.assign(data.info,    snap.data.info);
  Object.assign(data.revenue, snap.data.revenue);
  Object.assign(data.expenses,snap.data.expenses);
  Object.assign(data.assets,  snap.data.assets);
  period = snap.period||'nam';
  document.querySelectorAll('.period-pill').forEach(b=>b.classList.remove('active'));
  const periodMap={'thang':0,'quy':1,'nam':2};
  const pills=document.querySelectorAll('.period-pill');
  if(pills[periodMap[period]]) pills[periodMap[period]].classList.add('active');
  loadedCase = null;
  currentStep = 4;
  renderCurrentStep();
}


/* ══════════════════════════════════════════════════════
   IMPORT MODULE — Excel / CSV / HTKK XML
══════════════════════════════════════════════════════ */

/* ── Excel / CSV parser (dùng SheetJS nếu có, fallback CSV) ── */
function parseExcelFile(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      if(typeof XLSX !== 'undefined') {
        const wb = XLSX.read(e.target.result, {type:'binary'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        callback(null, rows);
      } else {
        /* Fallback: read as text CSV */
        const text = new TextDecoder('utf-8').decode(new Uint8Array(e.target.result));
        const rows = text.split('\n').map(r=>r.split(',').map(v=>v.trim().replace(/^"|"$/g,'')));
        callback(null, rows);
      }
    } catch(err) { callback(err.message, null); }
  };
  reader.readAsBinaryString(file);
}

/* ── Map Excel rows to data fields ── */
function mapExcelToData(rows) {
  /* 
    Định dạng template:
    Hàng 1: header (bỏ qua)
    Tìm theo nhãn ở cột A, giá trị ở cột B
    Hỗ trợ export từ Misa SME, Fast, và template tự tạo
  */
  const map = {};
  rows.forEach(row => {
    if(!row[0]) return;
    const key = String(row[0]).toLowerCase().trim()
      .replace(/[àáạảã]/g,'a').replace(/[èéẹẻẽ]/g,'e')
      .replace(/[ìíịỉĩ]/g,'i').replace(/[òóọỏõôốồổỗộơờớởỡợ]/g,'o')
      .replace(/[ùúụủũưứừửữự]/g,'u').replace(/[ỳýỵỷỹ]/g,'y')
      .replace(/đ/g,'d').replace(/[^a-z0-9\s]/g,'').trim();
    const val = parseFloat(String(row[1]||'').replace(/[^0-9.-]/g,'')) || 0;
    map[key] = val;
  });

  const get = (...keys) => {
    for(const k of keys) { if(map[k]!==undefined && map[k]!==0) return map[k]; }
    return 0;
  };

  return {
    revenue: {
      tongDoanhThu: get('tong doanh thu','doanh thu','revenue','dt'),
      giaVon:       get('gia von','chi phi truc tiep','cogs','gia von hang ban'),
      thuNhapKhac:  get('thu nhap khac','other income','thu khac')
    },
    expenses: {
      thueMatBang:    get('thue mat bang','tien thue','mat bang','rent'),
      nhanCong:       get('nhan cong','tien luong','luong','salary','wages'),
      chiPhiKhac:     get('chi phi khac','other expense','cp khac','van hanh'),
      thueNopTrongKy: get('thue da nop','thue gtgt tncn','tax paid','thue')
    },
    assets: {
      tienMat:      get('tien mat','cash','tien','tien gui'),
      hangTonKho:   get('hang ton kho','inventory','ton kho','htk'),
      phaiThu:      get('phai thu','receivable','cong no phai thu'),
      taiSanCoDinh: get('tai san co dinh','fixed asset','tscd','may moc'),
      noNganHan:    get('no ngan han','current liab','vay ngan han','no nh'),
      noDaiHan:     get('no dai han','long term','vay dai han','no dh'),
      vonChuSoHuu:  get('von chu so huu','equity','von csh','von tu co')
    }
  };
}

/* ── HTKK XML parser ── */
function parseHTKKXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const get = (tag) => {
    const el = doc.querySelector(tag) || doc.querySelector('[ten="'+tag+'"]');
    return el ? parseFloat(el.textContent.replace(/[^0-9.-]/g,''))||0 : 0;
  };
  const getText = (tag) => {
    const el = doc.querySelector(tag);
    return el ? el.textContent.trim() : '';
  };

  /* Mẫu 01/CNKD — Tờ khai thuế GTGT và TNCN hộ kinh doanh */
  /* Các trường theo phụ lục TT18/2026/TT-BTC */
  const doanhThu = get('DoanhThu') || get('TongDoanhThu') || get('dt') || get('DTTB');
  const thueGTGT  = get('ThuGTGT')  || get('ThueGTGT')   || get('t_gtgt');
  const thueTNCN  = get('ThueTNCN') || get('ThuTNCN')    || get('t_tncn');
  const tongThue  = (thueGTGT + thueTNCN) || get('TongThuPhaiNop');
  const tenHKD    = getText('TenNguoiNopThue') || getText('TenHKD') || getText('ten_nnt') || '';
  const mst       = getText('MST') || getText('MaSoThue') || '';
  const kyKhai    = getText('KyTinh') || getText('KyKhaiThue') || '';

  /* Đơn vị trong HTKK: đồng → triệu */
  const toMil = v => v >= 1000 ? +(v/1000000).toFixed(2) : v;

  return {
    tenHKD, mst, kyKhai,
    doanhThu: toMil(doanhThu),
    thueGTGT: toMil(thueGTGT),
    thueTNCN: toMil(thueTNCN),
    tongThue:  toMil(tongThue),
    raw: { doanhThu, thueGTGT, thueTNCN, tongThue }
  };
}

/* ── Render import panel HTML ── */
function renderImportPanel() {
  return `
  <div class="card" style="margin-bottom:1rem" id="import-panel">
    <div class="card-title" style="cursor:pointer" onclick="document.getElementById('import-body').style.display=document.getElementById('import-body').style.display==='none'?'block':'none'">
      ${t('import.title')}
      <span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:400">${t('import.toggle')}</span>
    </div>
    <div id="import-body" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        
        <!-- Excel import -->
        <div style="background:var(--card3);border-radius:9px;padding:14px">
          <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">${t('import.excel_title')}</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:10px">${t('import.excel_desc')}</div>
          <input type="file" id="excel-file" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleExcelUpload(this)">
          <button onclick="document.getElementById('excel-file').click()"
            style="width:100%;padding:8px;border-radius:6px;border:1px dashed rgba(212,168,67,0.4);background:transparent;color:var(--gold);font-size:13px;cursor:pointer;font-family:inherit">
            ${t('import.excel_btn')}
          </button>
          <div id="excel-result" style="margin-top:8px;font-size:12px;color:var(--muted)"></div>
          <div style="margin-top:10px;padding:8px;background:rgba(10,21,32,0.5);border-radius:6px;font-size:12px;color:var(--hint);line-height:1.6">
            ${t('import.excel_template')}
          </div>
        </div>

        <!-- HTKK XML import -->
        <div style="background:var(--card3);border-radius:9px;padding:14px">
          <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">${t('import.xml_title')}</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:10px">${t('import.xml_desc')}</div>
          <input type="file" id="xml-file" accept=".xml" style="display:none" onchange="handleXmlUpload(this)">
          <button onclick="document.getElementById('xml-file').click()"
            style="width:100%;padding:8px;border-radius:6px;border:1px dashed rgba(45,212,191,0.4);background:transparent;color:#2DD4BF;font-size:13px;cursor:pointer;font-family:inherit">
            ${t('import.xml_btn')}
          </button>
          <div id="xml-result" style="margin-top:8px;font-size:12px;color:var(--muted)"></div>
          <div style="margin-top:10px;padding:8px;background:rgba(10,21,32,0.5);border-radius:6px;font-size:12px;color:var(--hint);line-height:1.6">
            ${t('import.xml_guide')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function handleExcelUpload(input) {
  if(!input.files[0]) return;
  const resultEl = document.getElementById('excel-result');
  resultEl.innerHTML = `<span style="color:var(--warn)">${t('import.loading')}</span>`;

  /* Thử backend trước nếu đã đăng nhập */
  if(isLoggedIn()) {
    importExcelRemote(input.files[0]).then(mapped => {
      if(mapped) {
        let filled=0;
        Object.entries(mapped.revenue||{}).forEach(([k,v])=>{if(v){data.revenue[k]=v;filled++;}});
        Object.entries(mapped.expenses||{}).forEach(([k,v])=>{if(v){data.expenses[k]=v;filled++;}});
        Object.entries(mapped.assets||{}).forEach(([k,v])=>{if(v){data.assets[k]=v;filled++;}});
        if(filled>0){
          resultEl.innerHTML=`<span style="color:var(--safe)">${t('import.ok_server',{count:filled})}</span>`;
          renderCurrentStep();
          return;
        }
      }
      /* Fallback to client-side parse */
      runClientExcelParse(input.files[0], resultEl);
    }).catch(()=>runClientExcelParse(input.files[0], resultEl));
    return;
  }
  runClientExcelParse(input.files[0], resultEl);
}
function runClientExcelParse(file, resultEl) {
  parseExcelFile(file, (err, rows) => {
    if(err) { resultEl.innerHTML = `<span style="color:var(--danger)">${t('import.err_generic',{msg:err})}</span>`; return; }
    const mapped = mapExcelToData(rows);
    let filled = 0;

    Object.entries(mapped.revenue).forEach(([k,v])=>{ if(v){ data.revenue[k]=v; filled++; }});
    Object.entries(mapped.expenses).forEach(([k,v])=>{ if(v){ data.expenses[k]=v; filled++; }});
    Object.entries(mapped.assets).forEach(([k,v])=>{ if(v){ data.assets[k]=v; filled++; }});

    if(filled === 0) {
      resultEl.innerHTML = `<span style="color:var(--warn)">${t('import.err_col')}</span>`;
      return;
    }
    resultEl.innerHTML = `<span style="color:var(--safe)">${t('import.ok_client',{count:filled})}</span>`;
    renderCurrentStep();
    setTimeout(()=>{ const el=document.getElementById('import-body'); if(el) el.style.display='none'; }, 1500);
  });
}

function handleXmlUpload(input) {
  if(!input.files[0]) return;
  const resultEl = document.getElementById('xml-result');
  resultEl.innerHTML = `<span style="color:var(--warn)">${t('import.loading_xml')}</span>`;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = parseHTKKXml(e.target.result);
      let msg = [];

      if(parsed.doanhThu > 0) {
        data.revenue.tongDoanhThu = parsed.doanhThu;
        msg.push(t('import.xml_revenue',{v:parsed.doanhThu}));
      }
      if(parsed.tongThue > 0) {
        data.expenses.thueNopTrongKy = parsed.tongThue;
        msg.push(t('import.xml_tax',{v:parsed.tongThue}));
      }
      if(parsed.tenHKD) {
        data.info.name = parsed.tenHKD;
        msg.push(t('import.xml_name',{v:parsed.tenHKD}));
      }

      if(msg.length === 0) {
        resultEl.innerHTML = `<span style="color:var(--warn)">${t('import.err_xml')}</span>`;
        return;
      }
      resultEl.innerHTML = `<span style="color:var(--safe)">${t('import.ok_xml',{items:msg.join(' · ')})}</span>`;
      renderCurrentStep();
      setTimeout(()=>{ const el=document.getElementById('import-body'); if(el) el.style.display='none'; }, 2000);
    } catch(err) {
      resultEl.innerHTML = `<span style="color:var(--danger)">${t('import.err_xml_inv',{msg:err.message})}</span>`;
    }
  };
  reader.readAsText(input.files[0], 'utf-8');
}


function buildAIPrompt(res) {
  const {ratios,summary}=res;
  const ind=INDUSTRIES[data.info.industry];
  const dList=METRICS_DEF.filter(m=>classify(ratios[m.key],m.thresholds,m.inverse)==='danger').map(m=>`${m.label}: ${m.format(ratios[m.key])}`).join(', ')||'Không có';
  const wList=METRICS_DEF.filter(m=>classify(ratios[m.key],m.thresholds,m.inverse)==='warn').map(m=>`${m.label}: ${m.format(ratios[m.key])}`).join(', ')||'Không có';
  return `Bạn là chuyên gia tư vấn tài chính cho hộ kinh doanh Việt Nam. Phân tích ngắn gọn, thực tế.
HKD: ${data.info.name||'Không cung cấp'} | Ngành: ${ind.label}
DT năm: ${fmt(summary.dtNam)} triệu | LN ròng: ${fmt(summary.lnRong)} triệu | Tổng nợ: ${fmt(summary.tongNo)} triệu
Chỉ số nguy cơ cao: ${dList}
Chỉ số cần cải thiện: ${wList}
Điểm sức khỏe: ${scoreAll(ratios)}/100
Viết phân tích 250–350 từ bằng tiếng Việt: (1) Nhận xét tổng quan, (2) 3 điểm mạnh, (3) 3 rủi ro cần xử lý ngay, (4) Khuyến nghị chiến lược cụ thể cho quy mô HKD nhỏ tại Việt Nam 2026.`;
}

async function fetchAIWithFallback(prompt, analysisId) {
  /* Thử backend trước (an toàn hơn, key không lộ) */
  if (isLoggedIn()) {
    const result = await fetchAIRemote(prompt, analysisId);
    if (result) return result;
  }
  /* Fallback: gọi trực tiếp nếu có LOCAL_API_KEY */
  if (typeof LOCAL_API_KEY !== 'undefined' && LOCAL_API_KEY.trim()) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':LOCAL_API_KEY.trim()},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})
      });
      if (resp.ok) { const d=await resp.json(); return d.content?.[0]?.text||''; }
    } catch {}
  }
  return t('ai.no_login');
}

/* ══════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════ */
function updateStepper(step){
  for(let i=0;i<5;i++){
    const d=document.getElementById('step-dot-'+i);
    if(!d)continue;
    d.classList.remove('active','done');
    if(i<step)d.classList.add('done');
    else if(i===step)d.classList.add('active');
  }
}

function renderCurrentStep(){
  const el=document.getElementById('main-content');
  /* Refresh period note and pill labels on every render (handles language switch) */
  const pnEl = document.getElementById('period-note');
  if(pnEl) pnEl.textContent = PERIOD_NOTES()[period];
  updateStepper(currentStep);
  if(currentStep===0)      el.innerHTML=renderStep0();
  else if(currentStep===1) el.innerHTML=renderStep1();
  else if(currentStep===2) el.innerHTML=renderStep2();
  else if(currentStep===3) el.innerHTML=renderStep3();
  else if(currentStep===4){
    const res=calculate();
    const snap=saveSnapshot(res);
    el.innerHTML=renderStep4(res);
    /* Save to server if logged in */
    if(snap && isLoggedIn()) {
      (async () => {
        /* Tự tạo HKD profile nếu chưa có */
        if (!authState.activeHkdId && data.info.name) {
          try {
            const cr = await apiFetch('/api/hkd', {
              method: 'POST',
              body: JSON.stringify({
                name:     data.info.name,
                industry: data.info.industry || 'thuong_mai',
                size:     data.info.size     || 'sieu_nho',
                region:   data.info.region   || 'tinh_lon',
                province: data.info.province || '',
                duration: data.info.duration || ''
              })
            });
            if (cr.ok) {
              const { profile } = await cr.json();
              authState.activeHkdId = profile.id;
              localStorage.setItem('hkd_active_id', profile.id);
              authState.hkdProfiles.push(profile);
            }
          } catch(e) { console.warn('Tạo HKD profile thất bại:', e); }
        }
        if (authState.activeHkdId) {
          const id = await saveSnapshotRemote(snap, authState.activeHkdId);
          if(id) snap._serverId = id;
        }
      })();
    }
    /* AI tư vấn: dùng backend proxy khi đã đăng nhập */
    const hist = loadHistory();
    const lastSnap = hist[0];
    const serverId = lastSnap?._serverId || '';
    const aiPrompt = buildAIPrompt(res);
    fetchAIWithFallback(aiPrompt, serverId).then(txt=>{
      const aiEl=document.getElementById('ai-content');
      const pulse=document.getElementById('ai-pulse');
      if(aiEl) aiEl.textContent = txt || '';
      if(pulse) pulse.style.animationPlayState='paused';
    });
    // fetchAI(res).then(txt=>{ ... });
  }
  window.scrollTo({top:0,behavior:'smooth'});
  if(currentStep===0)renderIndustrySummary();
  if(currentStep===1)updateRevCalc();
}

function nextStep(){if(currentStep<4){currentStep++;renderCurrentStep();}}
function prevStep(){if(currentStep>0){currentStep--;renderCurrentStep();}}
function goToStep(s){if(s<=currentStep||currentStep>=4){currentStep=s;renderCurrentStep();}}
function runAnalysis(){currentStep=4;renderCurrentStep();}

// Init
renderCurrentStep();
/* Render user chip after DOM ready */
setTimeout(()=>{
  updateHeaderUserChip();
  if(isLoggedIn()) loadHkdProfiles();
}, 50);
