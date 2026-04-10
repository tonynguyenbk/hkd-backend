const router = require('express').Router();

const BENCHMARKS = {
  regions: {
    hn_hcm:   { label: 'Hà Nội / TP.HCM',     mb_warn: 18, cp_warn: 32 },
    tinh_lon: { label: 'Tỉnh lớn',             mb_warn: 14, cp_warn: 28 },
    tinh_nho: { label: 'Tỉnh nhỏ / Nông thôn', mb_warn: 10, cp_warn: 25 },
  },
  margins: {
    thuong_mai: { hn_hcm: 20, tinh_lon: 22, tinh_nho: 25 },
    dich_vu:    { hn_hcm: 32, tinh_lon: 35, tinh_nho: 38 },
    san_xuat:   { hn_hcm: 22, tinh_lon: 25, tinh_nho: 28 },
    xay_dung:   { hn_hcm: 20, tinh_lon: 22, tinh_nho: 24 },
    khac:       { hn_hcm: 20, tinh_lon: 22, tinh_nho: 24 },
  },
};

router.get('/', (req, res) => res.json({ ok: true, benchmarks: BENCHMARKS }));

module.exports = router;
