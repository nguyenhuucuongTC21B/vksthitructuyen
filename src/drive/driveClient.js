/**
 * driveClient.js — Lớp kết nối Google Drive API v3 bằng Service Account.
 *
 * Nhiệm vụ:
 *  1. Đọc thông tin Service Account từ biến môi trường (Base64 / JSON thô / đường dẫn file).
 *  2. Cung cấp các hàm: tìm file theo tên, tạo file, tải file JSON, ghi đè file JSON.
 *  3. Tự động retry với backoff khi gặp lỗi tạm thời của Google (429/5xx/mạng).
 *
 * Toàn bộ hàm đều bất đồng bộ (Promise) — việc ghi file lên Drive KHÔNG BAO GIỜ
 * chặn luồng xử lý request của người dùng (chi tiết xem store/dataStore.js).
 */
'use strict';

const { Readable } = require('stream');
const { google } = require('googleapis');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

let drive = null;          // Đối tượng drive API (null khi chạy chế độ cục bộ).
let folderId = null;       // ID thư mục lưu trữ 3 file JSON.
let mode = 'local';        // 'drive' | 'local'

/* ------------------------------ CẤU HÌNH ------------------------------ */

/**
 * Khởi tạo kết nối. Ưu tiên:
 *  1) GOOGLE_SERVICE_ACCOUNT_JSON  (Base64 hoặc chuỗi JSON thô)
 *  2) GOOGLE_APPLICATION_CREDENTIALS (đường dẫn file key — tiện khi chạy local)
 */
function init() {
  folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();

  if (raw && folderId) {
    const creds = parseServiceAccount(raw);
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: [DRIVE_SCOPE],
    });
    drive = google.drive({ version: 'v3', auth });
    mode = 'drive';
    console.log(`[drive] Da ket noi Google Drive (service account: ${creds.client_email})`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && folderId) {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: [DRIVE_SCOPE],
    });
    drive = google.drive({ version: 'v3', auth });
    mode = 'drive';
    console.log('[drive] Da ket noi Google Drive (keyfile)');
  } else {
    mode = 'local';
    console.warn(
      '[drive] CHUA cau hinh Google Drive (thieu GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_DRIVE_FOLDER_ID).' +
        ' He thong chay o CHE DO CUC BO: du lieu ghi vao thu muc ./data (tien cho dev, KHONG ben vinh nhu Drive).'
    );
  }
  return mode;
}

/** Chấp nhận Base64 hoặc chuỗi JSON nguyên văn; tự sửa private_key bị mất ký tự \n. */
function parseServiceAccount(raw) {
  let text = raw;
  if (!raw.startsWith('{')) {
    text = Buffer.from(raw, 'base64').toString('utf8');
  }
  const creds = JSON.parse(text);
  if (!creds.client_email || !creds.private_key) {
    throw new Error('File Service Account thiếu client_email / private_key');
  }
  creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  return creds;
}

function isDriveMode() {
  return mode === 'drive';
}

function getMode() {
  return mode;
}

/* ------------------------------ RETRY HELPER ------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Thử lại thao tác khi gặp lỗi tạm thời (quota, 5xx, mạng). Tối đa `tries` lần. */
async function withRetry(fn, tries = 3, label = 'drive-op') {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err && (err.code || (err.errors && err.errors[0] && err.errors[0].code));
      const retryable = !status || [429, 500, 502, 503, 504].includes(Number(status));
      if (!retryable || i === tries - 1) break;
      const delay = 1000 * Math.pow(2, i); // 1s → 2s → 4s
      console.warn(`[drive] ${label} that bai (lan ${i + 1}), thu lai sau ${delay}ms: ${err.message}`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/* ------------------------------ API CƠ BẢN ------------------------------ */

/** Tìm fileId của file JSON trong thư mục theo tên. Không thấy → trả về null. */
async function findFileByName(name) {
  if (!isDriveMode()) return null;
  const res = await withRetry(
    () =>
      drive.files.list({
        q: `name = '${name}' and '${folderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1,
      }),
    3,
    `find ${name}`
  );
  const file = res.data && res.data.files && res.data.files[0];
  return file ? file.id : null;
}

/** Tạo file JSON mới trong thư mục, trả về fileId. */
async function createFile(name, contentString) {
  const res = await withRetry(
    () =>
      drive.files.create({
        requestBody: { name, parents: [folderId] },
        media: { mimeType: 'application/json', body: Readable.from([contentString]) },
        fields: 'id',
      }),
    3,
    `create ${name}`
  );
  return res.data.id;
}

/** Tải nội dung file JSON về dạng object. */
async function downloadFile(fileId) {
  const res = await withRetry(
    () => drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' }),
    3,
    `download ${fileId}`
  );
  const text = Buffer.from(res.data).toString('utf8');
  return JSON.parse(text);
}

/** Ghi đè toàn bộ nội dung file JSON (update media). */
async function updateFile(fileId, contentString) {
  await withRetry(
    () =>
      drive.files.update({
        fileId,
        media: { mimeType: 'application/json', body: Readable.from([contentString]) },
      }),
    3,
    `update ${fileId}`
  );
}

module.exports = {
  init,
  getMode,
  isDriveMode,
  findFileByName,
  createFile,
  downloadFile,
  updateFile,
};
