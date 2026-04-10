require('dotenv').config();

const app  = require('./src/app');
const { startReportJob } = require('./src/jobs/report.job');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🟢 HKD Financial API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Mode:   ${process.env.NODE_ENV || 'development'}\n`);
  startReportJob();
});
