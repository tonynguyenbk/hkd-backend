const XLSX = require('xlsx');

function normalized(s) {
  return s.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, '').trim();
}

function parseExcel(buffer) {
  const wb   = XLSX.read(buffer, { type: 'buffer' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const map = {};
  rows.forEach((row) => {
    if (!row[0]) return;
    const key = normalized(String(row[0]));
    const val = parseFloat(String(row[1] || '').replace(/[^0-9.-]/g, '')) || 0;
    map[key] = val;
  });

  const get = (...keys) => {
    for (const k of keys) if (map[k]) return map[k];
    return 0;
  };

  const result = {
    revenue:  {
      tongDoanhThu: get('tong doanh thu', 'doanh thu', 'dt'),
      giaVon:       get('gia von hang ban', 'gia von'),
      thuNhapKhac:  get('thu nhap khac'),
    },
    expenses: {
      thueMatBang:   get('thue mat bang', 'mat bang'),
      nhanCong:      get('nhan cong', 'tien luong', 'luong'),
      chiPhiKhac:    get('chi phi khac'),
      thueNopTrongKy: get('thue da nop', 'thue'),
    },
    assets: {
      tienMat:       get('tien mat', 'cash'),
      hangTonKho:    get('hang ton kho', 'htk'),
      phaiThu:       get('phai thu'),
      taiSanCoDinh:  get('tai san co dinh', 'tscd'),
      noNganHan:     get('no ngan han'),
      noDaiHan:      get('no dai han'),
      vonChuSoHuu:   get('von chu so huu'),
    },
  };

  const filled = Object.values(result).flatMap(Object.values).filter((v) => v > 0).length;
  return { result, filled, rows: rows.length };
}

function parseXml(buffer) {
  const xml    = buffer.toString('utf-8');
  const getTag = (tag) => {
    const m = xml.match(new RegExp('<' + tag + '[^>]*>([^<]*)<\/' + tag + '>', 'i'));
    return m ? m[1].trim() : '';
  };
  const getNum = (tag) => parseFloat(getTag(tag).replace(/[^0-9.-]/g, '')) || 0;
  const toMil  = (v)   => (v >= 100000 ? +(v / 1000000).toFixed(2) : v);

  const result = {
    tenHKD:   getTag('TenNguoiNopThue') || getTag('TenHKD'),
    mst:      getTag('MST') || getTag('MaSoThue'),
    kyKhai:   getTag('KyTinh') || getTag('KyKhaiThue'),
    doanhThu: toMil(getNum('DoanhThu') || getNum('TongDoanhThu')),
    thueGTGT: toMil(getNum('ThuGTGT') || getNum('ThueGTGT')),
    thueTNCN: toMil(getNum('ThueTNCN') || getNum('ThuTNCN')),
    tongThue: toMil(getNum('TongThuPhaiNop')),
  };

  if (!result.tongThue && result.thueGTGT) {
    result.tongThue = +(result.thueGTGT + result.thueTNCN).toFixed(2);
  }

  return { result };
}

module.exports = { parseExcel, parseXml };
