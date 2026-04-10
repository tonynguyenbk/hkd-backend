const importService = require('../services/import.service');
const { ok, fail }  = require('../utils/response');

exports.excel = (req, res) => {
  if (!req.file) return fail(res, 'Không có file');
  try {
    ok(res, importService.parseExcel(req.file.buffer));
  } catch (e) {
    fail(res, 'Lỗi đọc file: ' + e.message);
  }
};

exports.xml = (req, res) => {
  if (!req.file) return fail(res, 'Không có file');
  try {
    ok(res, importService.parseXml(req.file.buffer));
  } catch (e) {
    fail(res, 'Lỗi đọc XML: ' + e.message);
  }
};
