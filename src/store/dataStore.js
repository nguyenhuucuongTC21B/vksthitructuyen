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

let safetyTimer = null;   // Vòng rà an toàn 30s.
let debounceTimer = null; // Bộ hẹn gộp thay đổi 1.2s.

/* ------------------------------ KHỞI TẠO ------------------------------ */

/** Nạp dữ liệu từ Google Drive về RAM khi hệ thống khởi động. */
async function init() {
  for (const key of FILES) {
    store[key] = { data: [], fileId: null };
    lastSyncedAt[key] = null;
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
      await mirrorLocal(key); // Mirror cache cục bộ.
      console.log(`[store] Tai ${fileName} tu Google Drive vao RAM: OK`);
      return;
    } catch (err) {
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
  if (!flushTimer) flushTimer = setTimeout(() => flushAll(), DEBOUNCE_MS);
}

/**
 * Đánh dấu + đồng bộ NGAY (await được nếu cần chắc chắn).
 * Dùng cho các thao tác trọng yếu: nộp bài thi, đăng ký tài khoản...
 */
async function saveNow(key) {
  assertKey(key);
  pendingSaves.add(key);
  await flushKey(key);
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
 *  - Chụp ảnh nhanh dữ liệu MỚI NHẤT tại thời điểm upload.
 *  - Nếu trong lúc upload lại có thay đổi mới → lặp lại lần nữa (coalescing).
 *  - Lỗi tạm thời → giữ pending, vòng rà 30s sẽ tự thử lại.
 */
async function flushKey(key) {
  if (savingNow.has(key)) return; // Vòng upload trước đang chạy — nó sẽ nhặt pending còn lại.
  savingNow.add(key);
  const release = await globalMutex.acquire(`persist:${key}`);
  try {
    while (pendingSaves.has(key)) {
      pendingSaves.delete(key);
      const snapshot = JSON.stringify(store[key].data, null, 2);

      if (driveClient.isDriveMode()) {
        if (store[key].fileId) {
          await driveClient.updateFile(store[key].fileId, snapshot);
        } else {
          // File chưa có trên Drive (hiếm) → tạo mới rồi nhớ fileId.
          store[key].fileId = await driveClient.createFile(`${key}.json`, snapshot);
        }
        lastSyncedAt[key] = new Date().toISOString();
        console.log(`[store] Da dong bo ${key}.json len Google Drive (${store[key].data.length} ban ghi)`);
      }
      await mirrorLocal(key);
    }
  } finally {
    savingNow.delete(key);
    release();
  }
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
  }));
}

module.exports = {
  init,
  get,
  count,
  save,
  saveNow,
  flushOnShutdown,
  getSyncInfo,
  FILES,
};
