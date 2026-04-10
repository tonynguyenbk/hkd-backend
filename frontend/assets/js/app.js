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

const PERIOD_NOTES = {
  thang:'Nhập doanh thu & chi phí 1 tháng. Hệ thống tự nhân 12 để so sánh ngưỡng thuế.',
  quy:  'Nhập doanh thu & chi phí 1 quý. Hệ thống tự nhân 4 để so sánh ngưỡng thuế.',
  nam:  'Nhập tất cả số liệu doanh thu & chi phí theo năm. Tài sản/nợ nhập tại thời điểm hiện tại.'
};
const PERIOD_MULT = { thang:12, quy:4, nam:1 };
const PERIOD_LABEL = { thang:'tháng', quy:'quý', nam:'năm' };

function setPeriod(p, btn) {
  period = p;
  document.querySelectorAll('.period-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('period-note').textContent = PERIOD_NOTES[p];
  renderCurrentStep();
}

function annualize(v) { return (v||0) * PERIOD_MULT[period]; }

/* ══════════════════════════════════════════════════════
   TEST CASES — FIX #3
══════════════════════════════════════════════════════ */
const TEST_CASES = [
  {
    id:'tapHoa', icon:'🛒', name:'Tạp hóa Thành Phát',
    sub:'Bán lẻ · Bình Thạnh, HCM · 8 năm', expected:'warn',
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
    sub:'F&B · Hoàng Mai, HN · 3 năm', expected:'safe',
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
    sub:'Dịch vụ · Củ Chi, HCM · 12 năm', expected:'safe',
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
    sub:'Sản xuất · Đồng Nai · 5 năm', expected:'danger',
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
    sub:'Lưu trú · Thủ Đức, HCM · 10 năm', expected:'safe',
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
    sub:'Làm đẹp · Quận 3, HCM · 2 năm', expected:'danger',
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
    sub:'TMĐT · Hà Đông, HN · 4 năm', expected:'safe',
    note:'DT 1.2 tỷ/năm — kê khai tháng, hóa đơn điện tử bắt buộc (NĐ70/2025)',
    data:{
      info:{name:'HKD Thảo Cosmetic',industry:'thuong_mai',size:'nho',duration:'3_5',province:'Hà Nội',region:'hn_hcm'},
      revenue:{tongDoanhThu:1200,giaVon:720,thuNhapKhac:0},
      expenses:{thueMatBang:24,nhanCong:84,chiPhiKhac:120,thueNopTrongKy:42},
      assets:{tienMat:90,hangTonKho:150,phaiThu:20,taiSanCoDinh:20,noNganHan:60,noDaiHan:0,vonChuSoHuu:200}
    }
  }
];

const BADGE_LABEL = {safe:'Tài chính ổn định',warn:'Cần theo dõi',danger:'Có rủi ro tài chính'};

function renderTestCasePanel() {
  const tc = loadedCase ? TEST_CASES.find(t=>t.id===loadedCase) : null;
  return `
  <div class="tc-bar" id="tc-bar">
    <div class="tc-header" onclick="document.getElementById('tc-bar').classList.toggle('open')">
      <span class="tc-header-icon">📋</span>
      <span class="tc-header-title">Ví dụ minh họa</span>
      <span class="tc-header-sub">${tc ? '✓ Đã nạp: '+tc.name : '7 tình huống thực tế — chọn để xem kết quả mẫu'}</span>
      <span class="tc-chevron">▼</span>
    </div>
    <div class="tc-body">
      <div style="font-size:11px;color:var(--muted);line-height:1.6;margin-bottom:6px;">
        Chọn một tình huống bên dưới để xem mẫu điền và kết quả phân tích tương ứng.
        Số liệu sẽ tự điền vào form theo kỳ <strong style="color:var(--gold)">${PERIOD_LABEL[period]}</strong> bạn đang chọn — bạn có thể chỉnh sửa thêm trước khi phân tích.
      </div>
      <div class="tc-grid">
        ${TEST_CASES.map(t=>`
        <div class="tc-chip ${loadedCase===t.id?'selected':''}" onclick="loadTestCase('${t.id}')">
          <div class="tc-chip-icon">${t.icon}</div>
          <div>
            <div class="tc-chip-name">${t.name}</div>
            <div class="tc-chip-sub">${t.sub}</div>
            <span class="tc-chip-badge b-${t.expected}">${BADGE_LABEL[t.expected]}</span>
          </div>
        </div>`).join('')}
      </div>
      ${tc ? `<div class="tc-loaded">✓ Đang xem ví dụ: <strong>${tc.name}</strong> — ${tc.note}</div>` : ''}
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

const INDUSTRIES = {
  thuong_mai:{label:'Thương mại / Bán lẻ',gtgt:1,  tncn:0.5,marginBench:20},
  dich_vu:   {label:'Dịch vụ',            gtgt:5,  tncn:2.0,marginBench:30},
  san_xuat:  {label:'Sản xuất',           gtgt:3,  tncn:1.5,marginBench:25},
  xay_dung:  {label:'Xây dựng',           gtgt:3,  tncn:1.5,marginBench:22},
  khac:      {label:'Hoạt động khác',     gtgt:1,  tncn:1.0,marginBench:20}
};

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
  const ngưỡngChịuThuế = 500; // 2026: trên 500tr phải nộp
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
  {key:'tanhoan_htl',   label:'Thanh khoản hiện thời', format:v=>v>=99?'N/A':v.toFixed(2)+' lần', thresholds:[1.0,1.5],inverse:false,radarMax:3,   bench:'≥ 1.5: An toàn | 1.0–1.5: Cần cải thiện | < 1.0: Nguy cơ cao',info:'TSNH / Nợ ngắn hạn',improve:'Tăng tiền mặt dự trữ, đàm phán gia hạn nợ nhà cung cấp.'},
  {key:'tanhoan_nhanh', label:'Thanh khoản nhanh',     format:v=>v>=99?'N/A':v.toFixed(2)+' lần', thresholds:[0.5,1.0],inverse:false,radarMax:2,   bench:'≥ 1.0: An toàn | 0.5–1.0: Cần cải thiện | < 0.5: Nguy cơ cao',info:'(Tiền + Phải thu) / Nợ NH',improve:'Đẩy nhanh thu hồi công nợ khách hàng, lập quỹ tiền mặt dự phòng.'},
  {key:'bien_ln_gop',   label:'Biên LN gộp',           format:v=>v.toFixed(1)+'%',                 thresholds:[15,25],  inverse:false,radarMax:60,  bench:'≥ 25%: An toàn | 15–25%: Cần cải thiện | < 15%: Nguy cơ cao',info:'LN gộp / Doanh thu × 100',improve:'Tối ưu giá vốn, đàm phán nhà cung cấp, cải thiện mix sản phẩm.'},
  {key:'bien_ln_rong',  label:'Biên LN ròng',           format:v=>v.toFixed(1)+'%',                 thresholds:[5,10],   inverse:false,radarMax:30,  bench:'≥ 10%: An toàn | 5–10%: Cần cải thiện | < 5%: Nguy cơ cao',info:'LN ròng / Doanh thu × 100',improve:'Kiểm soát chặt chi phí vận hành, cắt giảm khoản không hiệu quả.'},
  {key:'no_von',        label:'Hệ số Nợ/Vốn (D/E)',    format:v=>v>=99?'N/A':v.toFixed(2),         thresholds:[1.0,2.0],inverse:true, radarMax:4,   bench:'≤ 1.0: An toàn | 1.0–2.0: Cần cải thiện | > 2.0: Nguy cơ cao',info:'Tổng nợ / Vốn chủ sở hữu',improve:'Ưu tiên trả nợ, hạn chế vay mới, tăng vốn từ lợi nhuận giữ lại.'},
  {key:'vq_htk',        label:'Vòng quay HTK',          format:v=>v>=99?'N/A':v.toFixed(1)+' lần', thresholds:[4,8],    inverse:false,radarMax:16,  bench:'≥ 8 lần: An toàn | 4–8 lần: Cần cải thiện | < 4 lần: Nguy cơ cao',info:'Doanh thu / Hàng tồn kho',improve:'Áp dụng JIT, thanh lý hàng chậm bán, tối ưu đặt hàng.'},
  {key:'cp_dt',         label:'Chi phí HĐ / DT',        format:v=>v.toFixed(1)+'%',                 thresholds:[20,30],  inverse:true, radarMax:60,  bench:'≤ 20%: An toàn | 20–30%: Cần cải thiện | > 30%: Nguy cơ cao',info:'Chi phí hoạt động / Doanh thu × 100',improve:'Cắt giảm chi phí cố định, thuê mặt bằng rẻ hơn, tối ưu nhân sự.'},
  {key:'tu_tai_tro',    label:'Hệ số tự tài trợ',      format:v=>(v*100).toFixed(1)+'%',           thresholds:[0.3,0.5],inverse:false,radarMax:1,   bench:'≥ 50%: An toàn | 30–50%: Cần cải thiện | < 30%: Nguy cơ cao',info:'Vốn CSH / Tổng tài sản × 100',improve:'Tăng vốn tự có, giảm phụ thuộc vào nợ vay.'},
  {key:'tuan_thu_thue', label:'Tuân thủ thuế',          format:v=>Math.min(v*100,100).toFixed(0)+'%', thresholds:[0.7,0.9],inverse:false,radarMax:1.2,bench:'≥ 90%: An toàn | 70–90%: Cần cải thiện | < 70%: Nguy cơ cao',info:'Thuế đã nộp / Thuế dự kiến (năm)',improve:'Trích lập quỹ thuế hàng tháng theo tỷ lệ doanh thu.'},
  {key:'mb_dt',         label:'Thuê MB / Doanh thu',    format:v=>v.toFixed(1)+'%',                 thresholds:[10,15],  inverse:true, radarMax:40,  bench:'≤ 10%: An toàn | 10–15%: Cần cải thiện | > 15%: Nguy cơ cao',info:'Thuê mặt bằng / Doanh thu × 100',improve:'Đàm phán giảm tiền thuê hoặc dời địa điểm.'}
];

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
  <div class="section-head"><h2><span class="icon">🏪</span>Thông tin hộ kinh doanh</h2><p>Thông tin xác định mức thuế suất theo TT 40/2021 & Luật Thuế GTGT sửa đổi 2024</p></div>
  <div class="card">
    <div class="card-title">Hồ sơ cơ bản</div>
    <div class="field-grid">
      <div class="field" style="grid-column:1/-1">
        <label>Tên hộ kinh doanh <span class="req">*</span></label>
        <input type="text" id="f-name" placeholder="VD: HKD Minh Phát" value="${data.info.name}" oninput="data.info.name=this.value" class="${loadedCase?'loaded-val':''}">
      </div>
      <div class="field">
        <label>Ngành nghề <span class="req">*</span></label>
        <select onchange="data.info.industry=this.value;renderIndustrySummary()">
          ${Object.entries(INDUSTRIES).map(([k,v])=>`<option value="${k}" ${data.info.industry===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Quy mô lao động</label>
        <select onchange="data.info.size=this.value">
          <option value="sieu_nho" ${data.info.size==='sieu_nho'?'selected':''}>Siêu nhỏ (< 3 người)</option>
          <option value="nho"      ${data.info.size==='nho'?'selected':''}>Nhỏ (3–10 người)</option>
        </select>
      </div>
      <div class="field">
        <label>Thời gian hoạt động</label>
        <select onchange="data.info.duration=this.value">
          <option value="">Chọn...</option>
          <option value="duoi_1" ${data.info.duration==='duoi_1'?'selected':''}>&lt; 1 năm</option>
          <option value="1_3"    ${data.info.duration==='1_3'?'selected':''}>1–3 năm</option>
          <option value="3_5"    ${data.info.duration==='3_5'?'selected':''}>3–5 năm</option>
          <option value="tren_5" ${data.info.duration==='tren_5'?'selected':''}>Trên 5 năm</option>
        </select>
      </div>
      <div class="field">
        <label>Tỉnh / Thành phố</label>
        <input type="text" placeholder="VD: Hà Nội, TP.HCM" value="${data.info.province}" oninput="data.info.province=this.value" class="${loadedCase?'loaded-val':''}">
      </div>
      <div class="field">
        <label>Vùng kinh tế <span style="font-size:9px;color:var(--hint);font-weight:400;text-transform:none">(ảnh hưởng ngưỡng benchmark)</span></label>
        <select onchange="data.info.region=this.value">
          <option value="hn_hcm"   ${data.info.region==='hn_hcm'  ?'selected':''}>Hà Nội / TP.HCM</option>
          <option value="tinh_lon" ${(data.info.region||'tinh_lon')==='tinh_lon'?'selected':''}>Tỉnh lớn (Đà Nẵng, Cần Thơ, Hải Phòng...)</option>
          <option value="tinh_nho" ${data.info.region==='tinh_nho'?'selected':''}>Tỉnh nhỏ / Nông thôn</option>
        </select>
        <div class="field-hint" id="region-note">
          ${(REGION_BENCHMARKS[data.info.region||'tinh_lon']||{note:''}).note}
        </div>
      </div>
    </div>
  </div>
  <div class="card" id="industry-summary">
    <div class="card-title">Thuế suất áp dụng</div>
    <table class="tax-table"><thead><tr><th>Loại thuế</th><th>Tỷ lệ</th><th>Lưu ý 2026</th></tr></thead>
    <tbody id="tax-tbody"></tbody></table>
    <div class="legal-box"><strong>⚖️ 2026:</strong> Ngưỡng chịu thuế GTGT/TNCN là <strong>500 triệu đồng/năm</strong>. Dưới ngưỡng: miễn thuế nhưng vẫn phải kê khai doanh thu. Theo Nghị quyết 198/2025/QH15 & TT 18/2026/TT-BTC.</div>
  </div>
  <div class="btn-row"><button class="btn btn-primary" onclick="nextStep()">Tiếp theo →</button></div>
</div>`;
}

/* ══════════════════════════════════════════════════════
   RENDER STEP 1 — REVENUE
══════════════════════════════════════════════════════ */
function renderStep1() {
  const ind=INDUSTRIES[data.info.industry];
  const pUnit=PERIOD_LABEL[period];
  const lc=loadedCase?'loaded-val':'';
  return `<div class="fade-in">
  ${renderTestCasePanel()}
  ${renderImportPanel()}
  <div class="section-head"><h2><span class="icon">📈</span>Doanh thu & Thu nhập</h2>
    <p>Nhập số liệu theo <strong style="color:var(--gold)">${pUnit}</strong>. Tất cả ô dưới đây cùng kỳ với nhau.</p></div>

  <div class="concept-banner">
    <span class="ci">📌</span>
    <span><strong>Giá vốn hàng bán (COGS)</strong> = chi phí mua hàng / nguyên vật liệu TRỰC TIẾP tạo ra sản phẩm/dịch vụ.
    Không bao gồm tiền thuê, lương nhân viên, điện nước (những khoản đó nhập ở Bước 3).<br>
    <em>Ví dụ quán bún: giá vốn = tiền thịt + bún + rau. Ví dụ tạp hóa: giá vốn = tiền nhập hàng.</em></span>
  </div>

  <div class="card">
    <div class="card-title">Kết quả kinh doanh (kỳ: ${pUnit})</div>
    <div class="field-grid">
      <div class="field">
        <label>Tổng doanh thu <span class="req">*</span></label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.revenue.tongDoanhThu||''}"
            oninput="data.revenue.tongDoanhThu=+this.value;updateRevCalc()" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">Toàn bộ tiền thu từ bán hàng / dịch vụ trong ${pUnit}</div>
        <div class="field-example">Ví dụ kỳ năm: tạp hóa bình thường = 30–60 tr/tháng → 360–720 tr/năm</div>
      </div>
      <div class="field">
        <label>Giá vốn hàng bán <span class="req">*</span></label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.revenue.giaVon||''}"
            oninput="data.revenue.giaVon=+this.value;updateRevCalc()" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">Chi phí hàng hóa / nguyên liệu trực tiếp trong ${pUnit}</div>
        <div class="field-example">Dịch vụ thuần (sửa xe, tóc, trọ): có thể để 0 hoặc rất nhỏ</div>
      </div>
      <div class="field">
        <label>Thu nhập khác</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.revenue.thuNhapKhac||''}"
            oninput="data.revenue.thuNhapKhac=+this.value;updateRevCalc()" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">Thanh lý tài sản, thu nhập phụ không liên quan hoạt động chính</div>
      </div>
      <div class="field">
        <label>Lợi nhuận gộp (tính tự động)</label>
        <div class="computed" id="calc-ln-gop">—</div>
        <div class="field-hint">= Doanh thu − Giá vốn. Mức kỳ vọng ngành <strong>${ind.label}: ${ind.marginBench}–${ind.marginBench+10}%</strong></div>
      </div>
    </div>
  </div>
  <div class="btn-row">
    <button class="btn btn-secondary" onclick="prevStep()">← Quay lại</button>
    <button class="btn btn-primary" onclick="nextStep()">Tiếp theo →</button>
  </div></div>`;
}

/* ══════════════════════════════════════════════════════
   RENDER STEP 2 — EXPENSES (chi phí hoạt động, không có nợ)
   FIX #2: Nợ chuyển sang Step 3 (Bảng cân đối)
══════════════════════════════════════════════════════ */
function renderStep2() {
  const pUnit=PERIOD_LABEL[period];
  const lc=loadedCase?'loaded-val':'';
  return `<div class="fade-in">
  ${renderTestCasePanel()}
  <div class="section-head"><h2><span class="icon">💸</span>Chi phí hoạt động</h2>
    <p>Nhập theo kỳ <strong style="color:var(--gold)">${pUnit}</strong> — cùng kỳ với doanh thu bước trước. Nợ vay nhập ở Bước 4.</p></div>

  <div class="concept-banner">
    <span class="ci">📌</span>
    <span><strong>Chi phí hoạt động</strong> là các khoản <em>phát sinh trong kỳ</em> (income statement). Khác với <strong>nợ vay</strong> là <em>số dư còn lại tại thời điểm</em> (balance sheet) — sẽ nhập riêng ở Bước 4.<br>
    Thuế nhập ở đây là <em>tổng thuế đã nộp/trích lập trong ${pUnit} này</em> (không phải từng lần).</span>
  </div>

  <div class="card">
    <div class="card-title">Chi phí hoạt động trong ${pUnit}</div>
    <div class="field-grid">
      <div class="field">
        <label>Thuê mặt bằng / Địa điểm</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.expenses.thueMatBang||''}"
            oninput="data.expenses.thueMatBang=+this.value" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">Tiền thuê mặt bằng thực tế thanh toán trong ${pUnit}. Nhà riêng = 0.</div>
        <div class="field-example">VD năm: 3 triệu/tháng → nhập 36 tr/năm</div>
      </div>
      <div class="field">
        <label>Chi phí nhân công / Lương</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.expenses.nhanCong||''}"
            oninput="data.expenses.nhanCong=+this.value" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">Tổng lương thực trả cho nhân viên (không bao gồm thu nhập chủ hộ)</div>
        <div class="field-example">Lương tối thiểu Vùng I 2025: 4.96 tr/tháng (NĐ 74/2024)</div>
      </div>
      <div class="field">
        <label>Chi phí khác (điện, nước, tiếp thị...)</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.expenses.chiPhiKhac||''}"
            oninput="data.expenses.chiPhiKhac=+this.value" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">Điện nước, bao bì, ship, quảng cáo, bảo trì, khấu hao...</div>
      </div>
      <div class="field">
        <label>Thuế GTGT + TNCN đã nộp/trích lập</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.expenses.thueNopTrongKy||''}"
            oninput="data.expenses.thueNopTrongKy=+this.value" class="${lc}">
          <span class="period-unit">${pUnit}</span>
        </div>
        <div class="field-hint">Tổng thuế kê khai trong <strong>${pUnit}</strong> này (GTGT + TNCN). DT &lt; 500tr/năm → nhập 0.</div>
        <div class="field-example">Hệ thống tự so sánh với <em>dự kiến cả năm</em> để tính chỉ số #9</div>
      </div>
    </div>
  </div>
  <div class="btn-row">
    <button class="btn btn-secondary" onclick="prevStep()">← Quay lại</button>
    <button class="btn btn-primary" onclick="nextStep()">Tiếp theo →</button>
  </div></div>`;
}

/* ══════════════════════════════════════════════════════
   RENDER STEP 3 — ASSETS + NỢ (bảng cân đối) — FIX #2
══════════════════════════════════════════════════════ */
function renderStep3() {
  const lc=loadedCase?'loaded-val':'';
  return `<div class="fade-in">
  ${renderTestCasePanel()}
  <div class="section-head"><h2><span class="icon">🏦</span>Tài sản & Nợ (Bảng cân đối)</h2>
    <p>Nhập <strong style="color:var(--gold)">số dư tại thời điểm hiện tại</strong> — không phụ thuộc kỳ doanh thu bạn chọn.</p></div>

  <div class="concept-banner">
    <span class="ci">📌</span>
    <span><strong>Bảng cân đối</strong> phản ánh <em>trạng thái tại một thời điểm</em>, khác với báo cáo thu chi phản ánh <em>dòng tiền trong kỳ</em>.<br>
    <strong>Nợ ngắn hạn</strong> = tổng DƯ NỢ còn lại phải trả trong 12 tháng tới (không phải tiền trả nợ tháng này).<br>
    Ví dụ: vay 100tr trả dần, đã trả 30tr → nợ ngắn hạn = 70tr.</span>
  </div>

  <div class="card">
    <div class="card-title">Tài sản ngắn hạn</div>
    <div class="field-grid c3">
      <div class="field">
        <label>Tiền mặt & Tiền gửi NH</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.tienMat||''}"
            oninput="data.assets.tienMat=+this.value" class="${lc}">
          <span class="input-suffix">triệu</span>
        </div>
        <div class="field-hint">Tiền trong két + tài khoản ngân hàng hiện tại</div>
      </div>
      <div class="field">
        <label>Hàng tồn kho</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.hangTonKho||''}"
            oninput="data.assets.hangTonKho=+this.value" class="${lc}">
          <span class="input-suffix">triệu</span>
        </div>
        <div class="field-hint">Giá trị hàng hóa, nguyên liệu tồn kho hiện tại. Dịch vụ = 0.</div>
      </div>
      <div class="field">
        <label>Phải thu khách hàng</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.phaiThu||''}"
            oninput="data.assets.phaiThu=+this.value" class="${lc}">
          <span class="input-suffix">triệu</span>
        </div>
        <div class="field-hint">Tiền khách hàng còn nợ chưa thanh toán. Tiền mặt trực tiếp = 0.</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Tài sản dài hạn & Vốn</div>
    <div class="field-grid">
      <div class="field">
        <label>Tài sản cố định (TSCD)</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.taiSanCoDinh||''}"
            oninput="data.assets.taiSanCoDinh=+this.value" class="${lc}">
          <span class="input-suffix">triệu</span>
        </div>
        <div class="field-hint">Máy móc, xe, thiết bị — giá trị còn lại sau khấu hao (TT 45/2013)</div>
      </div>
      <div class="field">
        <label>Vốn chủ sở hữu <span class="req">*</span></label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.vonChuSoHuu||''}"
            oninput="data.assets.vonChuSoHuu=+this.value" class="${lc}">
          <span class="input-suffix">triệu</span>
        </div>
        <div class="field-hint">Vốn bỏ ra ban đầu + lợi nhuận tích lũy − lỗ lũy kế</div>
      </div>
    </div>
  </div>

  <!-- FIX #2: Nợ trong bảng cân đối -->
  <div class="card">
    <div class="card-title">Nợ phải trả (số dư hiện tại)</div>
    <div class="concept-banner" style="margin-bottom:1rem">
      <span class="ci">⚠️</span>
      <span>Nhập <strong>tổng dư nợ còn lại</strong> — không phải tiền trả nợ trong ${PERIOD_LABEL[period]}. Đây là dữ liệu bảng cân đối, không phụ thuộc kỳ phân tích.</span>
    </div>
    <div class="field-grid">
      <div class="field">
        <label>Nợ ngắn hạn (dưới 12 tháng)</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.noNganHan||''}"
            oninput="data.assets.noNganHan=+this.value" class="${lc}">
          <span class="input-suffix">triệu</span>
        </div>
        <div class="field-hint">Tổng dư nợ vay NH + nợ nhà cung cấp chưa trả phải tất toán trong 12 tháng</div>
        <div class="field-example">VD: vay 100tr còn 70tr dư nợ → nhập 70</div>
      </div>
      <div class="field">
        <label>Nợ dài hạn (trên 12 tháng)</label>
        <div class="input-wrap has-prefix">
          <span class="input-prefix">₫</span>
          <input type="number" min="0" value="${data.assets.noDaiHan||''}"
            oninput="data.assets.noDaiHan=+this.value" class="${lc}">
          <span class="input-suffix">triệu</span>
        </div>
        <div class="field-hint">Dư nợ vay trung dài hạn ngân hàng / đối tác còn lại trên 12 tháng</div>
      </div>
    </div>
  </div>

  <div class="btn-row">
    <button class="btn btn-secondary" onclick="prevStep()">← Quay lại</button>
    <button class="btn btn-primary" onclick="runAnalysis()">🔍 Phân tích ngay</button>
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
  const bTxt=cls==='safe'?'✓ Sức khỏe AN TOÀN':cls==='warn'?'⚠ CẦN CẢI THIỆN':'✗ NGUY CƠ CAO';
  const ind=summary.ind;
  const dangerM=METRICS_DEF.filter(m=>classify(ratios[m.key],m.thresholds,m.inverse)==='danger');
  const warnM  =METRICS_DEF.filter(m=>classify(ratios[m.key],m.thresholds,m.inverse)==='warn');

  const tcNote = '';  /* pass/fail badge ẩn — chỉ dùng nội bộ */

  return `<div class="fade-in">
  <div class="section-head"><h2><span class="icon">📊</span>Kết quả phân tích — ${data.info.name||'Hộ kinh doanh'}</h2>
    <p>Kỳ phân tích: <strong>${PERIOD_LABEL[period]}</strong> | Doanh thu năm (quy đổi): ₫${fmt(summary.dtNam)} triệu | Khung pháp lý 2026</p></div>

  ${tcNote}

  <div class="card" style="text-align:center">
    <div class="score-ring-wrap">
      <div class="score-ring">
        <svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="60" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="11"/>
        <circle cx="75" cy="75" r="60" fill="none" stroke="${sc}" stroke-width="11" stroke-dasharray="${s/100*376.99} 376.99" stroke-linecap="round"/></svg>
        <div class="score-ring-inner"><div class="score-number" style="color:${sc}">${s}</div><div class="score-label">/ 100 điểm</div></div>
      </div>
      <div class="classification-badge ${bCls}">${bTxt}</div>
    </div>
    <div class="summary-row">
      <div class="summary-tile"><div class="summary-tile-val">₫${fmt(summary.dtNam)}</div><div class="summary-tile-label">Doanh thu/năm</div></div>
      <div class="summary-tile"><div class="summary-tile-val" style="color:${summary.lnRong>=0?'var(--safe)':'var(--danger)'}">₫${fmt(summary.lnRong)}</div><div class="summary-tile-label">LN ròng/năm</div></div>
      <div class="summary-tile"><div class="summary-tile-val">₫${fmt(summary.tongTS)}</div><div class="summary-tile-label">Tổng tài sản</div></div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('t-met',this)">Chỉ số</button>
    <button class="tab" onclick="switchTab('t-chart',this)">Biểu đồ</button>
    <button class="tab" onclick="switchTab('t-hist',this)">Lịch sử</button>
    <button class="tab" onclick="switchTab('t-tax',this)">Thuế & Pháp lý</button>
    <button class="tab" onclick="switchTab('t-road',this)">Lộ trình</button>
    <button class="tab" onclick="switchTab('t-ai',this)">Tư vấn AI</button>
  </div>

  <div id="t-met" class="tab-content active">
    <div class="metrics-grid">
      ${(()=>{
        const prev = getPrevSnapshot();
        return METRICS_DEF.map(m=>{
          const v=ratios[m.key];const st=classify(v,m.thresholds,m.inverse);
          const sl=st==='safe'?'AN TOÀN':st==='warn'?'CẦN CẢI THIỆN':'NGUY CƠ CAO';
          const delta = prev ? renderDelta(v, prev, m.key, m.format, m.inverse) : '';
          return `<div class="metric-card ${st}"><div class="metric-name">${m.label}</div><div class="metric-value">${m.format(v)}</div>
          ${delta ? '<div style="margin-top:2px">'+delta+'</div>' : ''}
          <div class="metric-bench" style="margin-top:4px">${m.info}</div><div class="metric-bench" style="margin-top:3px;font-size:9px">${m.bench}</div>
          <div class="metric-status">${sl}</div></div>`;
        }).join('');
      })()}
    </div>
  </div>

  <div id="t-chart" class="tab-content">
    <div class="card"><div class="card-title">Radar — Tổng quan sức khỏe</div><div class="chart-wrap"><canvas id="radar-chart"></canvas></div></div>
    <div class="card" style="margin-top:10px"><div class="card-title">Điểm số từng chỉ tiêu</div><div class="chart-wrap" style="height:320px"><canvas id="bar-chart"></canvas></div></div>
  </div>

  <div id="t-hist" class="tab-content">
    \${renderHistoryTab()}
  </div>

  <div id="t-tax" class="tab-content">
    <div class="card">
      <div class="card-title">Ước tính thuế khoán năm (quy đổi toàn năm)</div>
      <table class="tax-table"><thead><tr><th>Loại thuế</th><th>Tỷ suất</th><th>Ước tính năm</th></tr></thead>
      <tbody>
        <tr><td>Thuế GTGT</td><td class="tax-highlight">${ind.gtgt}%</td>
          <td class="tax-highlight">${summary.dtNam>500?'₫'+fmt(summary.dtNam*ind.gtgt/100)+' triệu':'Miễn (DT năm ≤ 500tr)'}</td></tr>
        <tr><td>Thuế TNCN</td><td class="tax-highlight">${ind.tncn}%</td>
          <td class="tax-highlight">${summary.dtNam>500?'₫'+fmt(summary.dtNam*ind.tncn/100)+' triệu':'Miễn (DT năm ≤ 500tr)'}</td></tr>
        <tr style="border-top:1px solid var(--border)"><td><strong>Tổng thuế dự kiến/năm</strong></td>
          <td class="tax-highlight">${(ind.gtgt+ind.tncn).toFixed(1)}%</td>
          <td class="tax-highlight" style="color:var(--gold)"><strong>₫${fmt(summary.tongThue_expect)} triệu</strong></td></tr>
        <tr><td>Đã nộp/trích lập (quy đổi năm)</td><td></td>
          <td style="color:${summary.thueNam>=summary.tongThue_expect?'var(--safe)':'var(--danger)'}">
            ₫${fmt(summary.thueNam)} triệu ${summary.thueNam>=summary.tongThue_expect?'✓':summary.tongThue_expect>0?'✗ Còn thiếu ₫'+fmt(summary.tongThue_expect-summary.thueNam)+' triệu':''}</td></tr>
      </tbody></table>
      <div class="legal-box" style="margin-top:10px">Kỳ ${PERIOD_LABEL[period]} của bạn → quy đổi × ${PERIOD_MULT[period]} để so ngưỡng thuế năm 500tr. Thuế đã nộp cũng được nhân tương ứng.</div>
    </div>
    <div class="card"><div class="card-title">Văn bản pháp lý áp dụng</div>
      <div style="font-size:11px;color:var(--muted);line-height:2">
        <div>📌 <strong style="color:var(--text)">Nghị quyết 198/2025/QH15</strong> — Bỏ thuế khoán từ 1/1/2026, tự kê khai</div>
        <div>📌 <strong style="color:var(--text)">TT 18/2026/TT-BTC</strong> — Hồ sơ, thủ tục kê khai thuế HKD 2026</div>
        <div>📌 <strong style="color:var(--text)">TT 152/2025/TT-BTC</strong> — Chế độ kế toán HKD từ 1/1/2026 (3 nhóm)</div>
        <div>📌 <strong style="color:var(--text)">Luật Thuế GTGT sửa đổi 2024</strong> — Ngưỡng 500tr/năm (Luật TNCN 2025)</div>
        <div>📌 <strong style="color:var(--text)">Nghị định 68/2026/NĐ-CP</strong> — Thông báo tài khoản NH/ví điện tử, hạn 20/4/2026</div>
        <div>📌 <strong style="color:var(--text)">Nghị định 74/2024/NĐ-CP</strong> — Lương tối thiểu vùng 2025</div>
      </div>
    </div>
  </div>

  <div id="t-road" class="tab-content">
    <div class="card"><div class="card-title">Lộ trình cải thiện ưu tiên</div>
      ${buildRoadmap(dangerM,warnM,ratios)}
    </div>
  </div>

  <div id="t-ai" class="tab-content">
    <div class="ai-box">
      <div class="ai-header">
        <div class="ai-pulse"></div>
        Phân tích & Khuyến nghị AI Chuyên gia
        <span style="margin-left:auto;font-size:10px;font-weight:400;color:var(--gold);background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.25);border-radius:4px;padding:2px 8px;">Sắp ra mắt</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:4px;">
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">🔍</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px;">Nhận xét tổng quan tự động</div>
            <div style="font-size:12px;color:var(--muted);line-height:1.6;">AI phân tích toàn bộ 10 chỉ số, so sánh với chuẩn ngành và đưa ra đánh giá sức khỏe tài chính tổng thể trong 2–3 đoạn văn súc tích.</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">💪</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px;">3 điểm mạnh cần phát huy</div>
            <div style="font-size:12px;color:var(--muted);line-height:1.6;">Xác định và giải thích các chỉ số đang tốt hơn mức chuẩn ngành, giúp chủ hộ biết mình đang làm đúng ở đâu.</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">⚠️</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px;">3 rủi ro cần xử lý ngay</div>
            <div style="font-size:12px;color:var(--muted);line-height:1.6;">Phân tích chi tiết các chỉ số ở mức nguy cơ cao, lý giải nguyên nhân gốc rễ và đề xuất hành động cụ thể trong vòng 30 ngày.</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(74,158,224,0.1);border:1px solid rgba(74,158,224,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">🗺️</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px;">Chiến lược phù hợp quy mô HKD</div>
            <div style="font-size:12px;color:var(--muted);line-height:1.6;">Khuyến nghị chiến lược thực tế cho hộ kinh doanh nhỏ tại Việt Nam — phù hợp nguồn lực, bối cảnh pháp lý 2026 và đặc thù ngành.</div>
          </div>
        </div>
        <div style="margin-top:6px;padding:12px 14px;background:rgba(10,21,32,0.5);border:1px solid rgba(212,168,67,0.15);border-radius:8px;display:flex;align-items:center;gap:10px;">
          <div style="font-size:18px;">🔒</div>
          <div style="font-size:11px;color:var(--muted);line-height:1.6;">
            Tính năng này sử dụng <strong style="color:var(--gold-light)">Claude AI (Anthropic)</strong> để tạo phân tích cá nhân hóa cho từng hộ kinh doanh.
            Dữ liệu được xử lý riêng tư, không lưu trữ. Phân tích AI bổ sung cho — không thay thế — tư vấn kế toán chuyên nghiệp.
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="btn-row">
    <button class="btn btn-secondary" onclick="prevStep()">← Quay lại</button>
    <button class="btn btn-secondary" onclick="resetForm()">🔄 Nhập mới</button>
    <button class="btn btn-primary" onclick="window.print()">🖨 In báo cáo</button>
  </div>
  <div class="disclaimer">Kết quả mang tính tham khảo, không thay thế tư vấn kế toán/tài chính chuyên nghiệp.<br>Dữ liệu không được lưu trữ. Chỉ số theo chuẩn mực Việt Nam 2025–2026.</div>
</div>`;
}

function buildRoadmap(dangerM,warnM,ratios){
  let items=[],i=1;
  for(const m of dangerM) items.push(`<div class="roadmap-item"><div class="roadmap-num">${i++}</div><div>
    <div class="roadmap-title">[Ưu tiên cao] ${m.label}: ${m.format(ratios[m.key])}</div>
    <div class="roadmap-desc">${m.improve}</div><span class="roadmap-tag tag-urgent">Xử lý ngay 1–4 tuần</span></div></div>`);
  for(const m of warnM) items.push(`<div class="roadmap-item"><div class="roadmap-num">${i++}</div><div>
    <div class="roadmap-title">[Cần cải thiện] ${m.label}: ${m.format(ratios[m.key])}</div>
    <div class="roadmap-desc">${m.improve}</div><span class="roadmap-tag tag-medium">1–3 tháng</span></div></div>`);
  items.push(`<div class="roadmap-item"><div class="roadmap-num">${i++}</div><div>
    <div class="roadmap-title">Lập sổ kế toán theo TT 152/2025/TT-BTC</div>
    <div class="roadmap-desc">Từ 1/1/2026, hộ kê khai phải ghi sổ doanh thu, tồn kho, dòng tiền. Dùng phần mềm kế toán đơn giản hoặc thuê kế toán dịch vụ.</div>
    <span class="roadmap-tag tag-long">Chiến lược dài hạn</span></div></div>`);
  if(items.length===1) items=[`<div style="text-align:center;padding:2rem;color:var(--safe)">✓ Chúc mừng! Tài chính đang rất tốt. Duy trì và tiếp tục phát triển!</div>`,...items];
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
    <tr><td>Thuế GTGT</td><td class="tax-highlight">${ind.gtgt}%</td><td>DT năm > 500tr (Luật Thuế GTGT 2024)</td></tr>
    <tr><td>Thuế TNCN</td><td class="tax-highlight">${ind.tncn}%</td><td>DT năm > 500tr (Luật TNCN 2025)</td></tr>
    <tr><td>Biên LN ngành kỳ vọng</td><td class="tax-highlight">${ind.marginBench}%+</td><td>Tham chiếu thị trường VN 2025</td></tr>`;
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
    periodLabel: PERIOD_LABEL[period],
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
  return `<span style="color:${color};font-size:10px;font-weight:600">${sign}${fmt(delta)} so kỳ trước</span>`;
}

/* Render history tab */
function renderHistoryTab() {
  const hist = loadHistory();
  if(hist.length < 2) return `
    <div style="text-align:center;padding:3rem 1rem;">
      <div style="font-size:32px;margin-bottom:1rem;">📈</div>
      <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:8px;">Chưa có dữ liệu lịch sử</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.7;">
        Mỗi lần bạn phân tích, kết quả được lưu tự động vào trình duyệt này.<br>
        Sau kỳ thứ 2 trở đi, biểu đồ so sánh sẽ hiện ra đây.
      </div>
    </div>`;

  const labels = hist.slice(0,6).reverse().map(h=>`${h.periodLabel} ${h.savedAt}`);
  const scores = hist.slice(0,6).reverse().map(h=>h.score);
  const dtData = hist.slice(0,6).reverse().map(h=>+(h.summary.dtNam||0).toFixed(1));
  const lnData = hist.slice(0,6).reverse().map(h=>+(h.summary.lnRong||0).toFixed(1));

  const rows = hist.slice(0,12).map((h,i)=>{
    const prev = hist[i+1];
    const dScore = prev ? h.score - prev.score : null;
    const dColor = dScore===null?'var(--hint)':dScore>0?'var(--safe)':dScore<0?'var(--danger)':'var(--muted)';
    return `<tr>
      <td style="padding:8px 10px;font-size:12px;color:var(--muted)">${h.savedAt}</td>
      <td style="padding:8px 10px;font-size:12px">${h.periodLabel}</td>
      <td style="padding:8px 10px;font-size:13px;font-weight:700;color:${h.score>=70?'var(--safe)':h.score>=40?'var(--warn)':'var(--danger)'}">${h.score}</td>
      <td style="padding:8px 10px;font-size:11px;color:${dColor}">${dScore===null?'—':dScore>0?'+'+dScore:dScore}</td>
      <td style="padding:8px 10px;font-size:12px;color:var(--muted)">₫${+(h.summary.dtNam||0).toFixed(0)} tr</td>
      <td style="padding:8px 10px;font-size:12px;color:${(h.summary.lnRong||0)>=0?'var(--safe)':'var(--danger)'}">₫${+(h.summary.lnRong||0).toFixed(0)} tr</td>
      <td style="padding:8px 10px">
        <button onclick="reloadSnapshot(${i})" style="font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-family:inherit">Xem lại</button>
      </td>
    </tr>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-title">Xu hướng điểm sức khỏe</div>
      <div style="position:relative;height:200px"><canvas id="hist-score-chart"></canvas></div>
    </div>
    <div class="card" style="margin-top:10px">
      <div class="card-title">Doanh thu & Lợi nhuận ròng</div>
      <div style="position:relative;height:180px"><canvas id="hist-dt-chart"></canvas></div>
    </div>
    <div class="card" style="margin-top:10px">
      <div class="card-title">Lịch sử ${hist.length} kỳ phân tích</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--gold-dim)">
            <th style="padding:7px 10px;font-size:11px;color:var(--gold);text-align:left">Ngày lưu</th>
            <th style="padding:7px 10px;font-size:11px;color:var(--gold);text-align:left">Kỳ</th>
            <th style="padding:7px 10px;font-size:11px;color:var(--gold);text-align:left">Điểm</th>
            <th style="padding:7px 10px;font-size:11px;color:var(--gold);text-align:left">Δ</th>
            <th style="padding:7px 10px;font-size:11px;color:var(--gold);text-align:left">Doanh thu</th>
            <th style="padding:7px 10px;font-size:11px;color:var(--gold);text-align:left">LN ròng</th>
            <th style="padding:7px 10px;font-size:11px;color:var(--gold)"></th>
          </tr></thead>
          <tbody style="font-size:12px">${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:10px;text-align:right">
        <button onclick="if(confirm('Xóa toàn bộ lịch sử?')){clearHistory();renderCurrentStep()}" 
          style="font-size:11px;padding:5px 12px;border-radius:5px;border:1px solid rgba(239,68,68,0.3);background:transparent;color:var(--danger);cursor:pointer;font-family:inherit">
          Xóa lịch sử
        </button>
      </div>
    </div>
    <script>
    (function(){
      const labels=${JSON.stringify(labels)};
      const scores=${JSON.stringify(scores)};
      const dtData=${JSON.stringify(dtData)};
      const lnData=${JSON.stringify(lnData)};
      setTimeout(()=>{
        const sc=document.getElementById('hist-score-chart');
        if(sc) new Chart(sc,{type:'line',data:{labels,datasets:[{label:'Điểm',data:scores,borderColor:'#D4A843',backgroundColor:'rgba(212,168,67,0.1)',tension:0.3,fill:true,pointRadius:4,pointBackgroundColor:scores.map(s=>s>=70?'#22C55E':s>=40?'#F59E0B':'#EF4444')}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{min:0,max:100,ticks:{color:'#64748B',font:{size:9}},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#94A3B8',font:{size:9}},grid:{display:false}}},plugins:{legend:{display:false}}}});
        const dt=document.getElementById('hist-dt-chart');
        if(dt) new Chart(dt,{type:'bar',data:{labels,datasets:[{label:'Doanh thu',data:dtData,backgroundColor:'rgba(212,168,67,0.4)',borderColor:'#D4A843',borderWidth:1,borderRadius:3},{label:'LN ròng',data:lnData,backgroundColor:lnData.map(v=>v>=0?'rgba(34,197,94,0.4)':'rgba(239,68,68,0.4)'),borderColor:lnData.map(v=>v>=0?'#22C55E':'#EF4444'),borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{ticks:{color:'#64748B',font:{size:9}},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#94A3B8',font:{size:9}},grid:{display:false}}},plugins:{legend:{display:false}}}});
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
      📥 Nhập liệu tự động (Excel · CSV · HTKK XML)
      <span style="margin-left:auto;font-size:10px;color:var(--muted);font-weight:400">Bấm để mở / đóng</span>
    </div>
    <div id="import-body" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        
        <!-- Excel import -->
        <div style="background:var(--card3);border-radius:9px;padding:14px">
          <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">📊 Excel / CSV từ Misa, Fast</div>
          <div style="font-size:11px;color:var(--muted);line-height:1.6;margin-bottom:10px">
            Upload file Excel hoặc CSV xuất từ phần mềm kế toán.
            Hệ thống tự nhận diện cột theo tên tiếng Việt.
          </div>
          <input type="file" id="excel-file" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleExcelUpload(this)">
          <button onclick="document.getElementById('excel-file').click()" 
            style="width:100%;padding:8px;border-radius:6px;border:1px dashed rgba(212,168,67,0.4);background:transparent;color:var(--gold);font-size:12px;cursor:pointer;font-family:inherit">
            Chọn file Excel / CSV
          </button>
          <div id="excel-result" style="margin-top:8px;font-size:11px;color:var(--muted)"></div>
          <div style="margin-top:10px;padding:8px;background:rgba(10,21,32,0.5);border-radius:6px;font-size:10px;color:var(--hint);line-height:1.6">
            <strong style="color:var(--muted)">Template Excel:</strong><br>
            Cột A: tên chỉ tiêu | Cột B: giá trị (triệu đồng)<br>
            Ví dụ: "Tổng doanh thu" | 480
          </div>
        </div>

        <!-- HTKK XML import -->
        <div style="background:var(--card3);border-radius:9px;padding:14px">
          <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">🏛 File XML từ HTKK</div>
          <div style="font-size:11px;color:var(--muted);line-height:1.6;margin-bottom:10px">
            Upload file XML xuất từ phần mềm HTKK (tờ khai 01/CNKD).
            Tự động điền doanh thu và số thuế.
          </div>
          <input type="file" id="xml-file" accept=".xml" style="display:none" onchange="handleXmlUpload(this)">
          <button onclick="document.getElementById('xml-file').click()"
            style="width:100%;padding:8px;border-radius:6px;border:1px dashed rgba(45,212,191,0.4);background:transparent;color:#2DD4BF;font-size:12px;cursor:pointer;font-family:inherit">
            Chọn file XML (HTKK)
          </button>
          <div id="xml-result" style="margin-top:8px;font-size:11px;color:var(--muted)"></div>
          <div style="margin-top:10px;padding:8px;background:rgba(10,21,32,0.5);border-radius:6px;font-size:10px;color:var(--hint);line-height:1.6">
            <strong style="color:var(--muted)">Cách xuất file XML:</strong><br>
            HTKK → Kê khai → 01/CNKD → Kết xuất XML
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function handleExcelUpload(input) {
  if(!input.files[0]) return;
  const resultEl = document.getElementById('excel-result');
  resultEl.innerHTML = '<span style="color:var(--warn)">⏳ Đang đọc file...</span>';

  /* Thử backend trước nếu đã đăng nhập */
  if(isLoggedIn()) {
    importExcelRemote(input.files[0]).then(mapped => {
      if(mapped) {
        let filled=0;
        Object.entries(mapped.revenue||{}).forEach(([k,v])=>{if(v){data.revenue[k]=v;filled++;}});
        Object.entries(mapped.expenses||{}).forEach(([k,v])=>{if(v){data.expenses[k]=v;filled++;}});
        Object.entries(mapped.assets||{}).forEach(([k,v])=>{if(v){data.assets[k]=v;filled++;}});
        if(filled>0){
          resultEl.innerHTML='<span style="color:var(--safe)">✓ Server đã đọc '+filled+' trường từ Excel.</span>';
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
    if(err) { resultEl.innerHTML = '<span style="color:var(--danger)">❌ Lỗi: '+err+'</span>'; return; }
    const mapped = mapExcelToData(rows);
    let filled = 0;

    Object.entries(mapped.revenue).forEach(([k,v])=>{ if(v){ data.revenue[k]=v; filled++; }});
    Object.entries(mapped.expenses).forEach(([k,v])=>{ if(v){ data.expenses[k]=v; filled++; }});
    Object.entries(mapped.assets).forEach(([k,v])=>{ if(v){ data.assets[k]=v; filled++; }});

    if(filled === 0) {
      resultEl.innerHTML = '<span style="color:var(--warn)">⚠️ Không nhận diện được cột. Kiểm tra tên cột tiếng Việt.</span>';
      return;
    }
    resultEl.innerHTML = '<span style="color:var(--safe)">✓ Đã điền '+filled+' trường từ file Excel.</span>';
    renderCurrentStep();
    setTimeout(()=>{ const el=document.getElementById('import-body'); if(el) el.style.display='none'; }, 1500);
  });
}

function handleXmlUpload(input) {
  if(!input.files[0]) return;
  const resultEl = document.getElementById('xml-result');
  resultEl.innerHTML = '<span style="color:var(--warn)">⏳ Đang phân tích XML...</span>';
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = parseHTKKXml(e.target.result);
      let msg = [];

      if(parsed.doanhThu > 0) {
        data.revenue.tongDoanhThu = parsed.doanhThu;
        msg.push('Doanh thu: ₫'+parsed.doanhThu+' triệu');
      }
      if(parsed.tongThue > 0) {
        data.expenses.thueNopTrongKy = parsed.tongThue;
        msg.push('Thuế: ₫'+parsed.tongThue+' triệu');
      }
      if(parsed.tenHKD) {
        data.info.name = parsed.tenHKD;
        msg.push('Tên HKD: '+parsed.tenHKD);
      }

      if(msg.length === 0) {
        resultEl.innerHTML = '<span style="color:var(--warn)">⚠️ Không đọc được dữ liệu. Đảm bảo file là XML xuất từ HTKK mẫu 01/CNKD.</span>';
        return;
      }
      resultEl.innerHTML = '<span style="color:var(--safe)">✓ Đã đọc: '+msg.join(' · ')+'</span>';
      renderCurrentStep();
      setTimeout(()=>{ const el=document.getElementById('import-body'); if(el) el.style.display='none'; }, 2000);
    } catch(err) {
      resultEl.innerHTML = '<span style="color:var(--danger)">❌ File XML không hợp lệ: '+err.message+'</span>';
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
  return '⚠️ Tính năng AI cần đăng nhập hoặc cấu hình API key. Xem tab "Chỉ số" để xem kết quả phân tích chi tiết.';
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
