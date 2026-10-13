/**
 * dataStore.js — Bộ nhớ đệm RAM + cơ chế đồng bộ 2 chiều với Google Drive.
 *
 * Kiến trúc dữ liệu:
 *
 *   Google Drive (users/exams/results.json)          RAM cache (this file)
 *   ┌──────────────────────────────┐   init() tải    ┌──────────────────┐
 *   │   Lưu trữ vĩnh viễn (SSD)    │ ───────────────▶│  Route đọc trực  │
 *   └──────────────────────────────┘   về RAM 1 lần  │  tiếp từ RAM ⚡  │
 *              ▲                                     └────────┬─────────┘
 *              │  save()/saveNow() đưa file vào hàng đợi,      │ thay đổi
 *              │  Mutex chặn ghi đè chéo, upload BẤT ĐỒNG BỘ   ▼
 *              └──────────────────────────────────────────── trong request
 *
 * Nguyên tắc an toàn dữ liệu:
 *  - MỌI thay đổi dữ liệu trong RAM phải gọi save(key) (đợi 1.2s gộp nhiều
 *    thay đổi liên tiếp) hoặc saveNow(key) (đồng bộ ngay — dùng cho thao tác
 *    quan trọng như nộp bài).
 *  - Mutex theo từng file đảm bảo cùng một thời điểm chỉ một upload được chạy,
 *    tránh "bản ghi cũ hoàn thành sau ghi đè mất bản ghi mới".
 *  - Coalescing: nếu trong lúc upload vẫn còn thay đổi mới (pending), vòng lặp
 *    sẽ upload tiếp lần nữa với dữ liệu MỚI NHẤT — không bao giờ mất dữ liệu.
 *  - Mỗi lần lưu thành công đều mirror xuống ./data (cache cục bộ) để phục vụ
 *    khởi động nhanh / khôi phục khi Drive tạm thời không truy cập được.
 */
'use strict';

const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const driveClient = require('../drive/driveClient');
const { adviceForError, isQuotaError } = require('../utils/driveAdvice');
const { globalMutex } = require('../utils/mutex');

const FILES = ['users', 'exams', 'results'];
const DEBOUNCE_MS = 1200; // Gộp các thay đổi dồn dập trong 1.2s thành 1 lần upload.

/** RAM cache: { users: { data, fileId }, exams: {...}, results: {...} } */
const store = {};
/** Tập các file đang chờ upload lên Drive. */
const pendingSaves = new Set();
/** Tập các file đang trong vòng lặp upload (đang saving). */
const savingNow = new Set();
/** Thời điểm đồng bộ thành công lần cuối theo từng file. */
const lastSyncedAt = {};
/** Lỗi đồng bộ gần nhất theo từng file (hiển thị ngay trên dashboard admin). */
const lastSyncError = {};
/** Đánh dấu file mà lúc khởi động KHÔNG đọc được từ Drive (đang dùng dữ liệu rỗng/mirror). */
const bootLoadFailed = {};

let safetyTimer = null;   // Vòng rà an toàn 30s.
let debounceTimer = null; // Bộ hẹn gộp thay đổi 1.2s.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ KHỞI TẠO ------------------------------ */

/** Nạp dữ liệu từ Google Drive về RAM khi hệ thống khởi động. */
async function init() {
  for (const key of FILES) {
    store[key] = { data: [], fileId: null };
    lastSyncedAt[key] = null;
    lastSyncError[key] = null;
    bootLoadFailed[key] = false;
    await initOne(key);
  }
  // Vòng lặp an toàn: mỗi 30s rà lại các file còn "dirty" chưa upload được.
  safetyTimer = setInterval(() => flushAll(), 30_000);
  if (safetyTimer.unref) safetyTimer.unref();
  console.log(
    `[store] Khoi tao xong: users=${store.users.data.length}, exams=${store.exams.data.length}, results=${store.results.data.length}`
  );
}

async function initOne(key) {
  const fileName = `${key}.json`;
  // 1) Chế độ Drive: thử tải từ Drive về RAM.
  if (driveClient.isDriveMode()) {
    try {
      const fileId = await driveClient.findFileByName(fileName);
      if (fileId) {
        const data = await driveClient.downloadFile(fileId);
        store[key] = { data: Array.isArray(data) ? data : [], fileId };
      } else {
        // Lần chạy đầu tiên: tạo sẵn file rỗng trên Drive.
        const newId = await driveClient.createFile(fileName, '[]');
        store[key] = { data: [], fileId: newId };
      }
      bootLoadFailed[key] = false; // Đã nạp đúng từ Drive — không cần đối chiếu nữa.
      await mirrorLocal(key); // Mirror cache cục bộ.
      console.log(`[store] Tai ${fileName} tu Google Drive vao RAM: OK`);
      return;
    } catch (err) {
      // NGHIÊM TRỌNG: RAM có thể rỗng trong khi Drive còn dữ liệu cũ. Cấm upload
      // đè lên Drive cho tới khi reconcile thành công (xem flushKey).
      bootLoadFailed[key] = true;
      const tip = adviceForError(err);
      lastSyncError[key] = `Lúc khởi động không đọc được file từ Drive: ${err.message}${tip ? ` → ${tip}` : ''}`;
      console.error(`[store] Khong tai duoc ${fileName} tu Drive (${err.message}). Thu doc cache cuc bo...`);
    }
  }
  // 2) Fallback: đọc mirror cục bộ (chế độ local hoặc Drive tạm lỗi).
  try {
    const text = await fs.readFile(path.join(config.localDataDir, fileName), 'utf8');
    store[key].data = JSON.parse(text);
    if (!Array.isArray(store[key].data)) store[key].data = [];
    console.log(`[store] Tai ${fileName} tu cache cuc bo: ${store[key].data.length} ban ghi`);
  } catch {
    store[key].data = [];
  }
}

/* ------------------------------ TRUY CẤP RAM ------------------------------ */

/** Mượn tham chiếu mảng dữ liệu trong RAM (đọc/ghi trực tiếp, tốc độ tối đa). */
function get(key) {
  assertKey(key);
  return store[key].data;
}

/** Đếm nhanh số bản ghi. */
function count(key) {
  return store[key] ? store[key].data.length : 0;
}

function assertKey(key) {
  if (!store[key]) throw new Error(`Khoa du lieu khong hop le: ${key}`);
}

/* ------------------------------ ĐỒNG BỘ NGƯỢC LÊN DRIVE ------------------------------ */

/**
 * Đánh dấu file cần đồng bộ (gộp đợt: sau 1.2s mới thực upload).
 * Hàm trả về NGAY LẬP TỨC — không bao giờ chặn request người dùng.
 */
function save(key) {
  assertKey(key);
  pendingSaves.add(key);
  if (!debounceTimer) {
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      flushAll();
    }, DEBOUNCE_MS);
  }
}

/**
 * Đánh dấu + đồng bộ NGAY (await được nếu cần chắc chắn).
 * Dùng cho các thao tác trọng yếu: nộp bài thi, đăng ký tài khoản...
 *
 * KHÔNG BAO GIỜ ném lỗi khi Google Drive tạm lỗi / cấu hình sai: dữ liệu vẫn
 * được GIỮ an toàn trong RAM + mirror cục bộ ./data, cờ pending giữ lại để
 * vòng rà 30s tự thử lại. Hàm trả về { synced } để caller biết lần này có
 * ghi lên Drive thành công hay không (hiện cảnh báo cho người dùng khi cần).
 */
async function saveNow(key) {
  assertKey(key);
  pendingSaves.add(key);
  // Nếu một vòng upload khác đang chạy: đợi nó xong rồi tự chạy vòng của mình.
  while (savingNow.has(key)) await sleep(50);
  await flushKey(key);
  return { synced: !pendingSaves.has(key) };
}

function flushAll() {
  // Fire-and-forget: các vòng upload chạy nền, không chặn event loop.
  for (const key of new Set(pendingSaves)) {
    flushKey(key).catch((err) =>
      console.error(`[store] Dong bo ${key} that bai: ${err.message}`)
    );
  }
}

/**
 * Vòng lặp upload một file (có Mutex — tuần tự theo file):
 *  - Ghi mirror cục bộ TRƯỚC (dữ liệu an toàn trên đĩa ngay cả khi Drive lỗi).
 *  - Chỉ xóa cờ pending khi upload Drive THÀNH CÔNG; thất bại → giữ pending,
 *    vòng rà 30s tự thử lại, log lỗi rõ nguyên nhân — KHÔNG ném lỗi ra route.
 *  - Nếu trong lúc upload lại có thay đổi mới → lặp lại lần nữa (coalescing)
 *    với dữ liệu MỚI NHẤT — không bao giờ mất dữ liệu.
 */
async function flushKey(key) {
  if (savingNow.has(key)) return; // Vòng upload trước đang chạy — nó sẽ nhặt pending còn lại.
  savingNow.add(key);
  const release = await globalMutex.acquire(`persist:${key}`);
  try {
    while (pendingSaves.has(key)) {
      const snapshot = JSON.stringify(store[key].data, null, 2);
      await mirrorLocal(key); // An toàn cục bộ trước — rẻ và đáng tin cậy.

      if (!driveClient.isDriveMode()) {
        pendingSaves.delete(key); // Chế độ local: mirror là đủ.
        continue;
      }

      try {
        // ---- CHỐNG ĐÈ MẤT DỮ LIỆU ----
        // Nếu lúc boot không đọc được Drive (bootLoadFailed), RAM có thể thiếu
        // dữ liệu cũ. Bắt buộc đối chiếu với Drive TRƯỚC khi upload: nếu tải
        // được file cũ thì GỘP (bản ghi trên Drive giữ nguyên, bản ghi mới trong
        // RAM được thêm/ghi đè theo id); nếu vẫn tải không được thì CẤM upload.
        if (bootLoadFailed[key]) {
          const merged = await reconcileWithDrive(key);
          if (!merged) {
            throw Object.assign(
              new Error('Chưa đối chiếu được dữ liệu cũ trên Drive — tạm hoãn upload để tránh mất dữ liệu.'),
              { code: 'RECONCILE_PENDING' }
            );
          }
          if (JSON.stringify(store[key].data) !== snapshot) {
            // Sau gộp dữ liệu thay đổi — chụp lại snapshot mới nhất rồi mới upload.
            await mirrorLocal(key);
          }
        }

        if (store[key].fileId) {
          await driveClient.updateFile(store[key].fileId, JSON.stringify(store[key].data, null, 2));
        } else {
          // File chưa có trên Drive (lần đầu) → tạo mới rồi nhớ fileId.
          store[key].fileId = await driveClient.createFile(`${key}.json`, JSON.stringify(store[key].data, null, 2));
        }
        pendingSaves.delete(key); // Chỉ xóa khi upload THÀNH CÔNG.
        lastSyncedAt[key] = new Date().toISOString();
        lastSyncError[key] = null;
        console.log(`[store] Da dong bo ${key}.json len Google Drive (${store[key].data.length} ban ghi)`);
      } catch (err) {
        // ---- TỰ CHỮA LỖI QUOTA ----
        // Service Account không tự tạo được file mới (không có dung lượng riêng).
        // Nếu file đã được tạo tay trong thư mục (sau khi server khởi động) thì
        // buộc vòng lặp sau chạy lại quy trình ĐỐI CHIẾU đầy đủ: tải file vừa
        // tìm thấy về, GỘP dữ liệu cũ với dữ liệu trong RAM, rồi mới ghi —
        // an toàn tuyệt đối, không cần restart.
        if (!store[key].fileId && isQuotaError(err)) {
          try {
            const found = await driveClient.findFileByName(`${key}.json`);
            if (found) {
              bootLoadFailed[key] = true; // Ép chạy lại reconcile ở vòng sau.
              store[key].fileId = null;
              console.log(`[store] Loi quota khi tao ${key}.json — DA TIM THAY file co san trong thu muc, chay lai doi chieu roi ghi vao file nay.`);
              continue;
            }
          } catch { /* bỏ qua — rơi xuống xử lý lỗi chung bên dưới */ }
        }

        // Giữ pending — vòng rà 30s sẽ tự thử lại. Lưu lỗi + gợi ý để dashboard hiển thị.
        // Lưu ý: với RECONCILE_PENDING, reconcileWithDrive ĐÃ đặt lastSyncError cụ thể
        // (vd: file Google Docs / không tải được) — không ghi đè bằng thông báo chung.
        if (err.code !== 'RECONCILE_PENDING') {
          const tip = adviceForError(err);
          lastSyncError[key] = `${err.message}${tip ? ` → ${tip}` : ''}`;
          if (tip) console.error(`[store] CACH SUA: ${tip}`);
        }
        console.error('!'.repeat(70));
        console.error(`[store] KHONG dong bo duoc ${key}.json len Google Drive: ${err.message}`);
        console.error('[store] Du lieu van AN TOAN trong RAM + mirror cuc bo ./data — he thong se TU THU LAI moi 30 giay.');
        console.error('[store] Nguyen nhan chi tiet xem ngay trong Admin Dashboard (banner "Trang thai dong bo")');
        console.error('[store] hoac bam nut "Kiem tra Drive ngay" — khong can chay tool tren may local.');
        console.error('!'.repeat(70));
        break; // Thoát vòng while — pending được giữ lại để thử lại sau.
      }
    }
  } finally {
    savingNow.delete(key);
    release();
  }
}

/**
 * Đối chiếu dữ liệu RAM với file cũ trên Drive sau khi boot đọc Drive lỗi.
 * - File CHƯA tồn tại trên Drive → an toàn, trả về true (sẽ tạo file mới).
 * - Tải được file cũ → GỘP theo id: bản ghi Drive giữ nguyên thứ tự; bản ghi
 *   trong RAM ghi đè cùng id hoặc nối thêm cuối. Gán fileId. Trả về true.
 * - Tải KHÔNG được (Drive vẫn lỗi) → trả về false, KHÔNG upload đè.
 */
async function reconcileWithDrive(key) {
  const fileName = `${key}.json`;
  console.log(`[store] Doi chieu ${fileName} voi Drive truoc khi upload (boot truoc do doc loi)...`);
  const fileId = await driveClient.findFileByName(fileName);
  if (!fileId) {
    bootLoadFailed[key] = false;
    console.log(`[store] ${fileName} chua co tren Drive — cho phep tao moi.`);
    return true;
  }
  let remote;
  try {
    remote = await driveClient.downloadFile(fileId);
  } catch (err) {
    // Phân biệt nguyên nhân: file không phải JSON thuần (vd: tạo nhầm Google Docs)
    // hay lỗi mạng/quyền — mỗi trường hợp một cách sửa khác nhau.
    let meta = null;
    try { meta = await driveClient.getFileMeta(fileId); } catch { /* bỏ qua */ }
    if (meta && meta.mimeType && meta.mimeType !== 'application/json') {
      lastSyncError[key] =
        `File ${fileName} trên Drive đang là "${meta.mimeType}" (không phải file JSON thuần — có thể đã tạo bằng Google Docs). ` +
        'Hãy XÓA file đó trong thư mục Drive rồi UPLOAD lại file .json từ máy tính (nội dung []).';
      console.error(`[store] ${fileName} khong phai file JSON thuan (${meta.mimeType}) — hoan upload, can doi sang file thuần.`);
    } else {
      lastSyncError[key] = `Không tải được dữ liệu cũ từ Drive: ${err.message}`;
      console.error(`[store] Khong doi chieu duoc ${fileName} (${err.message}) — HOAN upload de bao toan du lieu cu.`);
    }
    return false;
  }
  const remoteArr = Array.isArray(remote) ? remote : [];
  const byId = new Map(remoteArr.map((r) => [r && r.id, r]));
  for (const item of store[key].data) {
    if (item && item.id && byId.has(item.id)) {
      byId.set(item.id, item); // Bản ghi trong RAM là bản mới hơn — ghi đè theo id.
    } else {
      byId.set(item && item.id, item);
      remoteArr.push(item); // Bản ghi RAM mới hoàn toàn — nối cuối.
    }
  }
  store[key] = { data: remoteArr, fileId };
  bootLoadFailed[key] = false;
  console.log(
    `[store] Da gop ${fileName}: Drive ${remoteArr.length} ban ghi (giu nguyen du lieu cu + them moi tu RAM).`
  );
  return true;
}

/** Ghi mirror xuống ./data/<key>.json — phục vụ cache khởi động & chế độ local. */
async function mirrorLocal(key) {
  try {
    await fs.mkdir(config.localDataDir, { recursive: true });
    await fs.writeFile(
      path.join(config.localDataDir, `${key}.json`),
      JSON.stringify(store[key].data, null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn(`[store] Khong ghi duoc mirror cuc bo cho ${key}: ${err.message}`);
  }
}

/** Đồng bộ bằng mọi giá trước khi tắt server (SIGTERM trên Render...). */
async function flushOnShutdown() {
  try {
    for (const key of FILES) {
      if (pendingSaves.has(key)) await saveNow(key);
    }
    console.log('[store] Da flush du lieu truoc khi tat server.');
  } catch (err) {
    console.error('[store] Flush khi tat server gap loi:', err.message);
  }
}

function getSyncInfo() {
  return FILES.map((key) => ({
    file: `${key}.json`,
    records: store[key] ? store[key].data.length : 0,
    lastSyncedAt: lastSyncedAt[key],
    pending: pendingSaves.has(key),
    lastError: lastSyncError[key] || null,
  }));
}

/**
 * Nạp LẠI toàn bộ dữ liệu từ Drive về RAM (dùng khi chẩn đoán "tự lành" mà
 * không cần restart). Chỉ nạp các file mà RAM đang trống để không giẫm đạp
 * dữ liệu đang thao tác dở; các file có dữ liệu sẽ đối chiếu ở lần sync sau.
 */
async function reloadFromDrive() {
  if (!driveClient.isDriveMode()) return;
  for (const key of FILES) {
    if (store[key].data.length > 0) continue; // RAM đã có dữ liệu — để reconcile lo.
    try {
      await initOne(key);
    } catch (err) {
      console.warn(`[store] reloadFromDrive(${key}) lỗi: ${err.message}`);
    }
  }
}

module.exports = {
  init,
  get,
  count,
  save,
  saveNow,
  flushOnShutdown,
  getSyncInfo,
  reloadFromDrive,
  FILES,
};
