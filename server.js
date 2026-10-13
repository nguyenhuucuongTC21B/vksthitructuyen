/**
 * server.js — Điểm khởi động hệ thống.
 *
 * Trình tự:
 *  1. Nạp cấu hình (src/config.js tự chạy khi require).
 *  2. Kết nối Google Drive (Service Account).
 *  3. Tải users/exams/results.json từ Drive về RAM cache.
 *  4. Mở cổng HTTP phục vụ giao diện + API.
 *  5. Lắng nghe SIGTERM/SIGINT để flush dữ liệu trước khi tắt (Render gửi SIGTERM).
 */
'use strict';

require('./src/config');

const driveClient = require('./src/drive/driveClient');
const dataStore = require('./src/store/dataStore');
const { createApp } = require('./src/app');

async function main() {
  console.log('==============================================');
  console.log('   HE THONG THI TRUC TUYEN SIEU NHE (v1.0)    ');
  console.log('   Du lieu JSON vinh vien tren Google Drive   ');
  console.log('==============================================');

  driveClient.init();
  await dataStore.init();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] He thong dang chay tai cong ${config.port} — mo http://localhost:${config.port}`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[server] Nhan tin hieu ${signal} — dang dong he thong an toan...`);
    server.close();
    await Promise.race([dataStore.flushOnShutdown(), new Promise((r) => setTimeout(r, 5000))]);
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => console.error('[fatal] unhandledRejection:', err));
}

const config = require('./src/config');

main().catch((err) => {
  console.error('[fatal] Khong the khoi dong he thong:', err);
  process.exit(1);
});
