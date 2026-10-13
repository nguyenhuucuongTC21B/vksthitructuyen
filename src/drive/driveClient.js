/**
 * driveClient.js — Lớp kết nối Google Drive API v3 bằng Service Account.
 *
 * Nhiệm vụ:
 *  1. Đọc thông tin Service Account từ biến môi trường (Base64 / JSON thô / đường dẫn file).
 *  2. Cung cấp các hàm: tìm file theo tên, tạo file, tải file JSON, ghi đè file JSON.
 *  3. Tự động retry với backoff khi gặp lỗi tạm thời của Google (429/5xx/mạng).
 *  4. runDiagnostic(): kiểm tra sống 5 mức ngay trên server — admin dashboard dùng
 *     để tự chẩn đoán khi đồng bộ lỗi (không cần chạy tool trên máy local).
 *
 * Toàn bộ hàm đều bất đồng bộ (Promise) — việc ghi file lên Drive KHÔNG BAO GIỜ
 * chặn luồng xử lý request của người dùng (chi tiết xem store/dataStore.js).
 */
'use strict';

const { Readable } = require('stream');
const { google } = require('googleapis');
const { adviceForError, isQuotaError } = require('../utils/driveAdvice');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const TEST_FILE_NAME = '__drive_check__.json';

let drive = null;          // Đối tượng drive API (null khi chạy chế độ cục bộ).
let folderId = null;       // ID thư mục lưu trữ 3 file JSON.
let mode = 'local';        // 'drive' | 'local'

/* ------------------------------ CẤU HÌNH ------------------------------ */

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

/**
 * Xây dựng một drive client RIÊNG LẬP từ biến môi trường hiện tại.
 * Không đụng vào trạng thái toàn cục — runDiagnostic dùng hàm này để kiểm tra
 * mà không phá vỡ kết nối đang chạy.
 */
function buildDriveClient() {
  const fid = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const keyFile = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();

  if (!raw && !keyFile) {
    const e = new Error('Chưa khai báo GOOGLE_SERVICE_ACCOUNT_JSON (chuỗi Base64 của file key Service Account).');
    e.advice = 'Lấy key theo README mục 3 (Bước 1–7), sau đó khai báo biến trên Render: Dashboard → Service → Environment → Add Environment Variable → Save Changes → Manual Deploy.';
    return { error: e };
  }
  if (!fid) {
    const e = new Error('Chưa khai báo GOOGLE_DRIVE_FOLDER_ID (ID thư mục Drive chứa 3 file JSON).');
    e.advice = 'Mở thư mục trên drive.google.com, copy ĐOẠN SAU /folders/ trên thanh địa chỉ, khai báo biến trên Render rồi Manual Deploy.';
    return { error: e };
  }
  if (fid.includes('/folders/')) {
    const e = new Error('GOOGLE_DRIVE_FOLDER_ID đang chứa cả URL thay vì chỉ ID.');
    e.advice = `Bạn đã dán nguyên URL. Chỉ giữ lại đoạn sau /folders/ (hiện tại: "${fid}"). Sửa biến trên Render rồi Manual Deploy.`;
    return { error: e };
  }

  try {
    let auth;
    let clientEmail = '(không đọc được email)';
    if (raw) {
      const creds = parseServiceAccount(raw);
      clientEmail = creds.client_email;
      auth = new google.auth.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: [DRIVE_SCOPE],
      });
    } else {
      auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: [DRIVE_SCOPE],
      });
    }
    return {
      drive: google.drive({ version: 'v3', auth }),
      folderId: fid,
      clientEmail,
    };
  } catch (err) {
    err.advice = err.advice || adviceForError(err) ||
      'Key không đọc được — kiểm tra chuỗi Base64 (đứt dòng, thiếu ký tự) theo README mục 3 Bước 7.';
    return { error: err };
  }
}

/**
 * Khởi tạo kết nối toàn cục. Ưu tiên:
 *  1) GOOGLE_SERVICE_ACCOUNT_JSON  (Base64 hoặc chuỗi JSON thô)
 *  2) GOOGLE_APPLICATION_CREDENTIALS (đường dẫn file key — tiện khi chạy local)
 * LỖI KHÔNG LÀM SẬP SERVER: chỉ ghi log + rơi về chế độ cục bộ (dashboard sẽ
 * hiện banner cảnh báo và admin dùng "Kiểm tra Drive ngay" để xem chi tiết).
 */
function init() {
  const built = buildDriveClient();
  if (built.error) {
    drive = null;
    folderId = null;
    mode = 'local';
    console.warn(
      `[drive] KHONG THE ket noi Google Drive: ${built.error.message}` +
        (built.error.advice ? ` | ${built.error.advice}` : '')
    );
    console.warn('[drive] He thong chay o CHE DO CUC BO ./data (KHONG ben vinh tren Render).');
    return mode;
  }
  drive = built.drive;
  folderId = built.folderId;
  mode = 'drive';
  console.log(`[drive] Da ket noi Google Drive (service account: ${built.clientEmail})`);
  return mode;
}

function isDriveMode() {
  return mode === 'drive';
}

function getMode() {
  return mode;
}

/** Email service account đang dùng (để admin đối chiếu khi share thư mục). */
function getServiceAccountEmail() {
  try {
    const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
    if (!raw) return null;
    return parseServiceAccount(raw).client_email || null;
  } catch {
    return null;
  }
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

/** Lấy siêu dữ liệu file (id, name, mimeType) — dùng phân biệt file JSON thuần vs Google Docs. */
async function getFileMeta(fileId) {
  if (!isDriveMode()) return null;
  const res = await withRetry(
    () => drive.files.get({ fileId, fields: 'id, name, mimeType' }),
    2,
    `meta ${fileId}`
  );
  return res.data;
}

/* ------------------------------ CHẨN ĐOÁN TRỰC TIẾP ------------------------------ */

/**
 * Kiểm tra "mô hình 3 file tạo sẵn": Service Account không có dung lượng riêng
 * nên không tự tạo được file mới — nhưng có CẬP NHẬT được file có sẵn hay không?
 * Duyệt users.json → exams.json → results.json, lấy file đầu tiên tìm thấy:
 *  - Tải nội dung HIỆN TẠI về, ghi lại ĐÚNG nội dung đó (không đổi gì) — an toàn tuyệt đối.
 *  - File là Google Docs (không phải JSON thuần) → báo lỗi cụ thể để user upload lại.
 * Trả về { ok, detail }.
 */
async function checkUpdateExistingFile(dapi, fid) {
  const NAMES = ['users.json', 'exams.json', 'results.json'];
  for (const name of NAMES) {
    let fileId = null;
    try {
      const res = await dapi.files.list({
        q: `name = '${name}' and '${fid}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 1,
      });
      const f = res.data && res.data.files && res.data.files[0];
      if (!f) continue;
      fileId = f.id;
      if (f.mimeType && f.mimeType !== 'application/json') {
        return {
          ok: false,
          detail: `file ${name} đang là "${f.mimeType}" (không phải file JSON thuần — có thể bạn tạo bằng Google Docs). Hãy XÓA file đó trong thư mục rồi UPLOAD lại file .json từ máy tính (nội dung []).`,
        };
      }
      const dl = await dapi.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
      const content = Buffer.from(dl.data).toString('utf8');
      await dapi.files.update({ fileId, media: { mimeType: 'application/json', body: Readable.from([content]) } });
      return { ok: true, detail: `${name}` };
    } catch (e) {
      if (fileId) return { ok: false, detail: `không cập nhật được file ${name}: ${e.message}` };
      continue; // Không thấy file này — thử file tiếp theo.
    }
  }
  return {
    ok: false,
    detail: 'không tìm thấy file nào trong thư mục — cần tạo sẵn users.json, exams.json, results.json (upload file .json từ máy, nội dung mỗi file chỉ cần []).',
  };
}

/**
 * Kiểm tra sống 5 mức NGAY TRÊN SERVER (admin bấm nút là chạy):
 *   1. Biến môi trường đủ chưa
 *   2. Key Service Account đọc được không
 *   3. ĐỌC thư mục (files.list) — kiểm tra Folder ID + quyền đọc
 *   4. TẠO file test — kiểm tra quyền GHI (thư mục đã Share Editor chưa)
 *   5. XÓA file test — dọn dẹp + xác nhận quyền xóa
 *
 * Trả về: { ok, mode, clientEmail, folderId, steps: [{ name, ok, detail, advice }], checkedAt }
 * Nếu mọi mức PASS mà server đang chạy chế độ local (do init lúc boot lỗi) →
 * tự re-init để "tự lành" không cần restart.
 */
async function runDiagnostic() {
  const steps = [];
  const checkedAt = new Date().toISOString();
  let built = null; // Đặt đầy đủ kết nối (null nếu fail ở mức trước đó).

  // --- Mức 1: biến môi trường ---
  const envOk = Boolean(
    ((process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim() ||
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()) &&
      (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim()
  );
  steps.push({
    name: '1. Biến môi trường (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_FOLDER_ID)',
    ok: envOk,
    detail: envOk ? 'Đã khai báo.' : 'Thiếu biến môi trường.',
    advice: envOk
      ? null
      : 'Khai báo 2 biến trên Render Dashboard → Environment, rồi bấm Manual Deploy. Xem README mục 3 Bước 7–8.',
  });
  if (!envOk) return finishDiagnostic(false);

  // --- Mức 2: đọc key ---
  built = buildDriveClient();
  steps.push({
    name: '2. Đọc key Service Account',
    ok: !built.error,
    detail: built.error
      ? built.error.message
      : `Hợp lệ — service account: ${built.clientEmail}`,
    advice: built.error
      ? built.error.advice || adviceForError(built.error)
      : null,
  });
  if (built.error) return finishDiagnostic(false);

  const dapi = built.drive;
  const fid = built.folderId;

  // --- Mức 3: đọc thư mục ---
  try {
    await dapi.files.list({
      q: `name = '${TEST_FILE_NAME}' and '${fid}' in parents and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 1,
    });
    steps.push({
      name: '3. ĐỌC thư mục Drive (quyền xem + Folder ID đúng)',
      ok: true,
      detail: 'Google xác nhận thư mục tồn tại và service account đọc được.',
      advice: null,
    });
  } catch (err) {
    err.code = err.code || (err.errors && err.errors[0] && err.errors[0].code);
    steps.push({
      name: '3. ĐỌC thư mục Drive (quyền xem + Folder ID đúng)',
      ok: false,
      detail: err.message,
      advice: adviceForError(err),
    });
    return finishDiagnostic(false);
  }

  // --- Mức 4: tạo file test (quyền GHI) ---
  let testFileId = null;
  let quotaFallback = false; // Lỗi quota → chuyển sang kiểm tra CẬP NHẬT file có sẵn.
  try {
    testFileId = await dapi.files.create({
      requestBody: { name: TEST_FILE_NAME, parents: [fid] },
      media: { mimeType: 'application/json', body: Readable.from(['[]']) },
      fields: 'id',
    });
    steps.push({
      name: '4. GHI file test lên thư mục (quyền Editor)',
      ok: true,
      detail: 'Đã tạo được file __drive_check__.json — thư mục ĐÃ share đúng quyền Editor.',
      advice: null,
    });
  } catch (err) {
    err.code = err.code || (err.errors && err.errors[0] && err.errors[0].code);

    // ---- TRƯỜNG HỢP ĐẶC BIỆT: Service Account không có dung lượng riêng ----
    // Google CHẶN Service Account TỰ TẠO file mới (quota = 0), nhưng vẫn cho
    // CẬP NHẬT file có sẵn. Hệ thống dùng đúng mô hình này (3 file tạo tay):
    // nên nếu CẬP NHẬT được file có sẵn thì coi như PASS hoàn toàn.
    if (isQuotaError(err)) {
      quotaFallback = true;
      const upd = await checkUpdateExistingFile(dapi, fid);
      if (upd.ok) {
        steps.push({
          name: '4. GHI file test lên thư mục (quyền Editor)',
          ok: true,
          detail:
            'Service Account KHÔNG tự tạo được file MỚI (không có dung lượng riêng — giới hạn của Google, không phải lỗi cấu hình). ' +
            `Tuy nhiên đã xác nhận: CẬP NHẬT ĐƯỢC file có sẵn trong thư mục (đã ghi thử lại file ${upd.detail} mà không mất dữ liệu) ` +
            '— đây chính là mô hình hệ thống sử dụng với 3 file users/exams/results.json tạo sẵn. HỆ THỐNG HOẠT ĐỘNG BÌNH THƯỜNG.',
          advice: null,
        });
      } else {
        steps.push({
          name: '4. GHI file test lên thư mục (quyền Editor)',
          ok: false,
          detail: `${err.message}. Kiểm tra cập nhật file có sẵn: ${upd.detail}`,
          advice: adviceForError(err),
        });
        return finishDiagnostic(false);
      }
    } else {
      steps.push({
        name: '4. GHI file test lên thư mục (quyền Editor)',
        ok: false,
        detail: err.message,
        advice: adviceForError(err),
      });
      return finishDiagnostic(false);
    }
  }

  // --- Mức 5: xóa file test ---
  if (quotaFallback) {
    steps.push({
      name: '5. Dọn dẹp file test',
      ok: true,
      detail: 'Bỏ qua (kiểm tra bằng file có sẵn — không tạo rác trong thư mục của bạn).',
      advice: null,
    });
  } else {
    try {
      await dapi.files.delete({ fileId: testFileId });
      steps.push({
        name: '5. Dọn dẹp file test',
        ok: true,
        detail: 'Đã xóa file test — kết nối Drive HOÀN TOÀN SẠCH SẼ.',
        advice: null,
      });
    } catch (err) {
      // Không coi là lỗi nghiêm trọng — file test chỉ rác nhỏ.
      steps.push({
        name: '5. Dọn dẹp file test',
        ok: true,
        detail: `Không xóa được file test (${err.message}) — không sao, có thể xóa tay trong Drive.`,
        advice: null,
      });
    }
  }

  return finishDiagnostic(true);

  /** Tổng hợp kết quả + tự lành nếu server đang kẹt ở chế độ local. */
  function finishDiagnostic(allOk) {
    let healed = false;
    if (allOk && mode !== 'drive') {
      init(); // Kết nối thật đang tốt — bật lại chế độ Drive không cần restart.
      healed = mode === 'drive';
      if (healed) {
        // Báo dataStore nạp lại dữ liệu từ Drive (tránh đè mất dữ liệu cũ).
        try {
          require('../store/dataStore').reloadFromDrive();
        } catch { /* bỏ qua — store sẽ tự nạp ở vòng rà sau. */ }
      }
    }
    return {
      ok: allOk,
      mode,
      healed,
      clientEmail: (built && built.clientEmail) || getServiceAccountEmail(),
      folderId: (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim(),
      steps,
      checkedAt,
      message: allOk
        ? 'Kết nối Google Drive HOẠT ĐỘNG ĐÚNG — hãy bấm "Đồng bộ ngay" để đẩy dữ liệu đang chờ lên Drive.'
        : 'Phát hiện lỗi — làm theo gợi ý của mức FAIL đầu tiên, sau đó bấm "Kiểm tra Drive ngay" lần nữa.',
    };
  }
}

module.exports = {
  init,
  getMode,
  isDriveMode,
  getServiceAccountEmail,
  findFileByName,
  createFile,
  downloadFile,
  updateFile,
  getFileMeta,
  runDiagnostic,
};
