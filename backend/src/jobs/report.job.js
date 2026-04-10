const cron         = require('node-cron');
const scheduleRepo = require('../repositories/schedule.repository');
const emailService = require('../services/email.service');

function startReportJob() {
  // Chạy mỗi ngày lúc 8:00 sáng
  cron.schedule('0 8 * * *', async () => {
    const today = new Date().getDate();
    console.log(`[CRON] Checking report schedules for day ${today}...`);

    const { rows } = await scheduleRepo.findActiveByDay(today);
    for (const schedule of rows) {
      try {
        await emailService.sendMonthlyReport(schedule);
      } catch (e) {
        console.error(`Failed report for hkd_id=${schedule.hkd_id}:`, e.message);
      }
    }
  });
}

module.exports = { startReportJob };
