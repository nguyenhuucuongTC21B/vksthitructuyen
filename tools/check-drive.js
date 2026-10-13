#!/usr/bin/env node
/**
 * check-drive.js — Công cụ kiểm tra & sinh cấu hình Google Drive cho hệ thống thi.
 *
 * CÁCH DÙNG:
 *
 *   1) Sinh cấu hình từ file key Service Account vừa tải về (Bước 4 của README):
 *
 *        node tools/check-drive.js "C:\Users\Ten\Downloads\he-thong-...-abc123.json"   (Windows)
 *        node tools/check-drive.js ~/Downloads/he-thong-...-abc123.json                (macOS/Linux)
 *
 *      Script sẽ:
 *        - In ra EMAIL SERVICE ACCOUNT (dùng để Share thư mục Drive ở Bước 6);
 *        - Mã hóa Base64 file key -> ghi vào file key.base64.txt (mở là có sẵn chuỗi);
 *        - Tạo file .env hoàn chỉnh (tự sinh SESSION_SECRET) nếu chưa có.
 *
 *   2) Kiểm tra kết nối THẬT tới Google Drive (sau khi đã điền GOOGLE_DRIVE_FOLDER_ID):
 *
 *        node tools/check-drive.js
 *
 *      Script sẽ test lần lượt: đọc key -> nạp googleapis -> xem được thư mục ->
 *      tạo file test -> ghi đè -> xóa. Kèm gợi ý sửa lỗi đúng theo thông báo nhận được.
 *
 * Script KHÔNG cần cài thêm gì (dùng googleapis có sẵn trong dự án), chạy lại nhiều lần an toàn.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const FILES = ['users.json', 'exams.json', 'results.json'];

/* ---------------------------- Tiện ích in màu ---------------------------- */

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,   // xanh
  err: (s) => `\x1b[31m${s}\x1b[0m`,  // đỏ
  warn: (s) => `\x1b[33m${s}\x1b[0m`, // vàng
  info: (s) => `\x1b[36m${s}\x1b[0m`, // xanh lam
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const LINE = '─'.repeat(66);
function banner(title) {
  console.log(`\n${c.info(LINE)}\n${c.bold(title)}\n${c.info(LINE)}`);
}

/* ------------------------- Nạp file .env (tự viết) ------------------------ */

function loadDotEnv(file = '.env') {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) return false;
  for (const raw of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

/* ------------------------------ Đọc key SA ------------------------------- */

/** Đọc file key JSON thô, trả về object. Báo lỗi tiếng Việt rõ ràng. */
function readKeyFile(keyPath) {
  const abs = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `Không tìm thấy file key tại: ${abs}\n` +
      '       Hãy kéo-thả file key vào sau lệnh, ví dụ:\n' +
      '       node tools/check-drive.js "C:\\Users\\Ten\\Downloads\\abc-xyz.json"'
    );
  }
  let creds;
  try {
    creds = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    throw new Error(`File key không phải JSON hợp lệ (${e.message}). Có thể tải nhầm file — tải lại ở Bước 4 của README.`);
  }
  if (creds.type !== 'service_account' || !creds.client_email || !creds.private_key) {
    throw new Error('File key thiếu client_email / private_key — đây không phải key Service Account dạng JSON.');
  }
  return creds;
}

/** Chấp nhận Base64 hoặc chuỗi JSON nguyên văn (giữ logic giống src/drive/driveClient.js). */
function parseCredsFromEnv(raw) {
  let text = raw.trim();
  if (!text.startsWith('{')) text = Buffer.from(text, 'base64').toString('utf8');
  const creds = JSON.parse(text);
  if (!creds.client_email || !creds.private_key) {
    throw new Error('Biến GOOGLE_SERVICE_ACCOUNT_JSON thiếu client_email / private_key');
  }
  creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  return creds;
}

/* --------------------------- Chế độ 1: SINH CẤU HÌNH --------------------- */

function generateConfig(keyPath) {
  banner('BƯỚC A — Đọc file key Service Account');
  const abs = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
  const creds = readKeyFile(keyPath);

  console.log(`${c.ok('✓')} Đọc file key thành công!`);
  console.log(`  Project     : ${creds.project_id || '(không rõ)'}`);

  console.log(`\n${c.bold('EMAIL SERVICE ACCOUNT — dùng để Share thư mục Drive (Bước 6c README):')}`);
  console.log(`   ${c.warn(creds.client_email)}`);
  console.log(`   → Copy email này. Vào Google Drive → mở thư mục → nút ${c.bold('Share')} →`);
  console.log(`     dán email trên → đổi quyền từ Viewer sang ${c.bold('Editor')} → Send.`);

  // Base64
  const b64 = fs.readFileSync(abs).toString('base64');
  const b64Path = path.join(ROOT, 'key.base64.txt');
  fs.writeFileSync(b64Path, b64, 'utf8');
  console.log(`\n${c.ok('✓')} Đã mã hóa Base64 và lưu vào file: ${path.relative(ROOT, b64Path)}`);
  console.log('  (Chuỗi này dùng dán vào biến GOOGLE_SERVICE_ACCOUNT_JSON trên Render — mở file, copy toàn bộ.)');

  // Sinh / cập nhật .env
  const envPath = path.join(ROOT, '.env');
  const block = [
    `# Sinh tự động bởi tools/check-drive.js lúc ${new Date().toLocaleString('vi-VN')}`,
    `# Khi deploy Render: dán GIÁ TRỊ 3 biến dưới đây vào Environment của Web Service.`,
    `PORT=3000`,
    `SESSION_SECRET=${crypto.randomBytes(48).toString('hex')}`,
    `GOOGLE_SERVICE_ACCOUNT_JSON=${b64}`,
    `GOOGLE_DRIVE_FOLDER_ID=`,
    `# ADMIN_CCCDS=012345678901,987654321098`,
  ].join('\n');

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, block + '\n', 'utf8');
    console.log(`\n${c.ok('✓')} Đã tạo file ${c.bold('.env')} (có sẵn SESSION_SECRET ngẫu nhiên).`);
  } else {
    // Cập nhật đúng biến GOOGLE_SERVICE_ACCOUNT_JSON, giữ nguyên phần còn lại
    let text = fs.readFileSync(envPath, 'utf8');
    if (/^GOOGLE_SERVICE_ACCOUNT_JSON=/m.test(text)) {
      text = text.replace(/^GOOGLE_SERVICE_ACCOUNT_JSON=.*$/m, `GOOGLE_SERVICE_ACCOUNT_JSON=${b64}`);
    } else {
      text += `\nGOOGLE_SERVICE_ACCOUNT_JSON=${b64}\n`;
    }
    fs.writeFileSync(envPath, text, 'utf8');
    console.log(`\n${c.ok('✓')} Đã cập nhật GOOGLE_SERVICE_ACCOUNT_JSON trong file .env có sẵn (giữ nguyên các biến khác).`);
  }

  console.log(`
${c.bold('TIẾP THEO — 2 việc còn lại:')}
  1. Share thư mục Drive cho email đã in ở trên (Bước 6c README), quyền ${c.bold('Editor')}.
  2. Lấy Folder ID (đoạn sau /folders/ trên thanh địa chỉ trình duyệt), mở ${c.bold('.env')} điền vào dòng:
       GOOGLE_DRIVE_FOLDER_ID=<dán Folder ID vào đây>
     Sau đó chạy lại:  ${c.info('node tools/check-drive.js')}  để test kết nối thật.
`);
}

/* -------------------------- Chế độ 2: KIỂM TRA THẬT ---------------------- */

/** Ghi chú giải nghĩa lỗi -> hành động sửa. Trả về chuỗi gợi ý hoặc null. */
function adviceForError(err) {
  const reason = (err && err.errors && err.errors[0] && err.errors[0].reason) || '';
  const detail = (err && err.errors && err.errors[0] && err.errors[0].message) || '';
  const msg = `${err && err.message || ''} ${reason} ${detail}`.toLowerCase();

  if (msg.includes('service_disabled') || msg.includes('has not been used') || msg.includes('is disabled')) {
    return 'Google Drive API CHƯA ĐƯỢC BẬT. Quay lại README Bước 2: APIs & Services → Library → tìm "Google Drive API" → Enable. Chờ 1–2 phút rồi chạy lại script.';
  }
  if (Number(err && err.code) === 404 || msg.includes('file not found')) {
    return 'KHÔNG TÌM THẤY THƯ MỤC. GOOGLE_DRIVE_FOLDER_ID sai (có thể bạn copy cả URL, dư khoảng trắng, hoặc thư mục đã bị xóa/đổi). Mở thư mục trên Drive, lấy ĐOẠN SAU /folders/ trên thanh địa chỉ.';
  }
  if (Number(err && err.code) === 403 && (msg.includes('permission') || msg.includes('insufficient'))) {
    return 'BỊ TỪ CHỐI QUYỀN. Thư mục chưa được Share cho email Service Account (hoặc chỉ share quyền Viewer). Làm lại README Bước 6c: nút Share → dán client_email → quyền EDITOR → Send. Nếu bạn dùng tài khoản tổ chức (công ty/trường), admin có thể chặn chia sẻ ra ngoài — hãy tạo thư mục bằng tài khoản @gmail.com cá nhân.';
  }
  if (msg.includes('storagequotaexceeded') || msg.includes('disk quota')) {
    return 'LỖI DUNG LƯỢNG (hiếm gặp). Service Account không có dung lượng riêng. Tự tạo sẵn 3 file rỗng trong thư mục Drive: users.json / exams.json / results.json (mỗi file chỉ cần chữ []) rồi chạy lại — server sẽ dùng đúng các file đó, không tự tạo nữa.';
  }
  if (msg.includes('err_ossl') || msg.includes('decoder routines') || msg.includes('pem_read') || msg.includes('no start line') || msg.includes('bad decrypt')) {
    return 'PRIVATE_KEY KHÔNG ĐỌC ĐƯỢC. Chuỗi key bị hỏng khi copy/encode Base64 (thiếu đầu/cuối, đứt dòng, dán thiếu). Tạo lại: node tools/check-drive.js "đường-dẫn-file-key" rồi copy TRỌN VẸN GOOGLE_SERVICE_ACCOUNT_JSON mới (| Set-Clipboard trên Windows, | pbcopy trên macOS).';
  }
  if (msg.includes('invalid_grant') || msg.includes('invalid_client') || msg.includes('jwt')) {
    return 'KEY KHÔNG HỢP LỆ / ĐÃ THU HỒI. Chuỗi Base64 có thể bị copy thiếu hoặc dư dòng trống. Tạo lại key (README Bước 4) rồi chạy: node tools/check-drive.js "đường-dẫn-file-key" để sinh lại cấu hình. Lưu ý copy Base64 trọn vẹn bằng | Set-Clipboard (Windows) hoặc | pbcopy (macOS).';
  }
  if (Number(err && err.code) === 401) {
    return 'LỖI 401 XÁC THỰC. GOOGLE_SERVICE_ACCOUNT_JSON không khớp project đã bật Drive API — kiểm tra lại file key / chuỗi Base64.';
  }
  return null;
}

async function liveCheck() {
  banner('BƯỚC B — Kiểm tra kết nối thật tới Google Drive');

  const folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  const rawKey = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const keyFile = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();

  if (!rawKey && !keyFile) {
    console.log(`${c.err('✗')} Chưa có GOOGLE_SERVICE_ACCOUNT_JSON trong .env.`);
    console.log('  Chạy: ' + c.info('node tools/check-drive.js "đường-dẫn-file-key.json"') + ' để sinh cấu hình trước.');
    process.exitCode = 1;
    return;
  }
  if (!folderId) {
    console.log(`${c.err('✗')} Chưa có GOOGLE_DRIVE_FOLDER_ID trong .env.`);
    console.log('  Mở thư mục Drive trên web, copy ĐOẠN SAU /folders/ trên thanh địa chỉ, điền vào .env rồi chạy lại.');
    process.exitCode = 1;
    return;
  }

  // 1/5 — Đọc key
  let creds;
  try {
    creds = rawKey ? parseCredsFromEnv(rawKey) : readKeyFile(keyFile);
    console.log(`${c.ok('✓')} 1/5  Đọc được key Service Account: ${creds.client_email}`);
  } catch (e) {
    console.log(`${c.err('✗')} 1/5  Key không hợp lệ: ${e.message}`);
    const tip = adviceForError(e);
    if (tip) console.log(`\n${c.warn('CÁCH SỬA:')}\n  ${tip}`);
    process.exitCode = 1;
    return;
  }

  // 2/5 — Nạp googleapis
  let drive;
  try {
    const { google } = require('googleapis');
    const auth = new google.auth.JWT({ email: creds.client_email, key: creds.private_key, scopes: [DRIVE_SCOPE] });
    drive = google.drive({ version: 'v3', auth });
  } catch (e) {
    console.log(`${c.err('✗')} 2/5  Không nạp được thư viện googleapis (${e.message}). Chạy "npm install" trong thư mục dự án trước.`);
    process.exitCode = 1;
    return;
  }
  console.log(`${c.ok('✓')} 2/5  Thư viện googleapis sẵn sàng`);

  // 3/5 — Liệt kê nội dung thư mục (kiểm tra quyền XEM + Folder ID đúng)
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 10,
    });
    const items = res.data.files || [];
    console.log(
      `${c.ok('✓')} 3/5  Xem được thư mục Drive (${items.length} file: ` +
      `${items.map((f) => f.name).join(', ') || 'trống — server sẽ tự tạo 3 file JSON khi khởi động'})`
    );
  } catch (err) {
    console.log(`${c.err('✗')} 3/5  Không xem được thư mục [${err.code || '—'}]: ${err.message}`);
    const tip = adviceForError(err);
    console.log(`\n${c.warn('CÁCH SỬA:')}\n  ${tip || 'Kiểm tra lại Folder ID và quyền chia sẻ.'}`);
    process.exitCode = 1;
    return;
  }

  // 4/5 — Tạo + ghi đè file test (kiểm tra quyền EDITOR)
  const testName = `__test_ket_noi_${Date.now()}.json`;
  let testId = null;
  try {
    const created = await drive.files.create({
      requestBody: { name: testName, parents: [folderId] },
      media: { mimeType: 'application/json', body: require('stream').Readable.from(['{"ok":true}']) },
      fields: 'id',
    });
    testId = created.data.id;
    await drive.files.update({
      fileId: testId,
      media: { mimeType: 'application/json', body: require('stream').Readable.from(['{"ok":true,"updated":true}']) },
    });
    console.log(`${c.ok('✓')} 4/5  Tạo + ghi đè file test thành công (quyền Editor hoạt động)`);
  } catch (err) {
    console.log(`${c.err('✗')} 4/5  Không ghi được file vào thư mục [${err.code || '—'}]: ${err.message}`);
    const tip = adviceForError(err);
    console.log(`\n${c.warn('CÁCH SỬA:')}\n  ${tip || 'Quyền Share đang là Viewer — đổi lại thành Editor (Bước 6c).'}`);
    process.exitCode = 1;
    return;
  }

  // 5/5 — Dọn file test
  try {
    await drive.files.delete({ fileId: testId });
    console.log(`${c.ok('✓')} 5/5  Đã dọn file test. ` + c.bold('CẤU HÌNH HOÀN CHỈNH — sẵn sàng deploy!'));
  } catch (err) {
    console.log(`${c.warn('!')} 5/5  Không xóa được file test (${err.message}) — không sao, vào Drive xóa tay file ${testName} là được.`);
  }

  console.log(`
${c.bold('TÓM TẮT — Cấu hình đúng hết, sẵn sàng deploy lên Render:')}
  Copy 3 biến trong .env sang mục Environment của Render Web Service:
    ${c.info('SESSION_SECRET  /  GOOGLE_SERVICE_ACCOUNT_JSON  /  GOOGLE_DRIVE_FOLDER_ID')}
  (SESSION_SECRET đã được sinh sẵn trong .env nếu bạn dùng chế độ sinh cấu hình.)
`);
}

/* --------------------------------- MAIN ---------------------------------- */

(async function main() {
  const arg = process.argv[2];
  loadDotEnv();

  if (arg) {
    try {
      generateConfig(arg);
    } catch (e) {
      console.log(`${c.err('✗')} ${e.message}`);
      process.exitCode = 1;
      return;
    }
    // Nếu .env (sau khi cập nhật) đã có Folder ID -> chạy luôn kiểm tra thật cho tiện
    if ((process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim()) {
      await liveCheck();
    } else {
      console.log(c.warn('→ Chưa có GOOGLE_DRIVE_FOLDER_ID nên mới kiểm tra cấu hình (chưa test kết nối thật).'));
    }
    return;
  }

  await liveCheck();
})();
