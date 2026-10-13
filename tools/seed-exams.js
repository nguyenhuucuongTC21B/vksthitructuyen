/**
 * tools/seed-exams.js — Nạp BỘ ĐỀ MẪU (2 đề × 50 câu An toàn thông tin) thủ công.
 *
 * Thường thì KHÔNG cần chạy lệnh này: server TỰ nạp bộ đề mẫu lần đầu khởi
 * động khi exams.json còn trống. Lệnh này hữu ích khi:
 *   - Admin đã xóa hết đề mẫu muốn nạp lại từ máy local.
 *   - Muốn xem trước dữ liệu trước khi triển khai lên Render.
 *
 * Cách chạy (trong thư mục dự án):
 *   node tools/seed-exams.js
 *
 * Quy tắc: chỉ thêm những đề CHƯA tồn tại (so theo tên đề) — không nhân đôi,
 * không đè lên đề thi thật của Ban Tổ chức.
 */
'use strict';

require('../src/config');
const driveClient = require('../src/drive/driveClient');
const dataStore = require('../src/store/dataStore');
const { buildSampleExams, missingSampleExams } = require('../src/data/sampleExams');

async function main() {
  console.log('== NẠP BỘ ĐỀ MẪU (2 đề × 50 câu An toàn thông tin) ==');
  console.log('Chế độ lưu trữ: khởi tạo dataStore...');

  driveClient.init();
  await dataStore.init();

  const exams = dataStore.get('exams');
  const missing = missingSampleExams(exams);

  if (missing.length === 0) {
    console.log('✓ Cả 2 bộ đề mẫu đã có sẵn trong hệ thống — không cần nạp thêm.');
    return;
  }

  const now = new Date().toISOString();
  for (const s of missing) {
    exams.push({ ...s, createdBy: '(tool)', createdAt: now });
    console.log(`+ Đã thêm: ${s.title} (${s.questions.length} câu)`);
  }
  await dataStore.saveNow('exams');

  const info = dataStore.getSyncInfo().find((i) => i.file === 'exams.json');
  console.log(`✓ Hoàn tất. Hiện có ${exams.length} đề thi trong hệ thống.`);
  console.log(
    info && info.pending
      ? '⚠ exams.json CHƯA đồng bộ lên Google Drive — xem "Lỗi gần nhất" trong Admin Dashboard hoặc chạy: node tools/check-drive.js'
      : '✓ exams.json đã đồng bộ lên Google Drive (hoặc đang chạy chế độ cục bộ ./data).'
  );
}

main()
  .then(() => {
    // Cho vòng sync nền 1.2s kịp chạy xong rồi mới thoát.
    setTimeout(() => process.exit(0), 2000);
  })
  .catch((err) => {
    console.error('✗ LỖI:', err.message);
    process.exit(1);
  });
