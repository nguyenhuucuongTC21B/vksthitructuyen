/**
 * mutex.js — Cơ chế khóa luồng (Mutex) dựa trên chuỗi Promise.
 *
 * Node.js chạy đơn luồng nên thao tác trên RAM là nguyên tố (atomic),
 * NHƯNG các thao tác bất đồng bộ (ghi file JSON lên Google Drive) có thể
 * giao nhau: nếu hai promise ghi cùng một file chạy song song, bản ghi
 * cũ hơn có thể hoàn thành sau và GHI ĐÈ mất dữ liệu mới.
 *
 * Mutex ở đây đảm bảo: cùng một thời điểm chỉ MỘT luồng ghi được phép
 * thao tác trên một tài nguyên (mỗi file JSON một khóa riêng), các luồng
 * khác tự động xếp hàng chờ theo đúng thứ tự gọi.
 */
'use strict';

class Mutex {
  constructor() {
    /** Map<key, Promise> — đuôi chuỗi chờ của từng tài nguyên. */
    this._chains = new Map();
  }

  /**
   * Lấy khóa cho tài nguyên `key`.
   * Trả về hàm `release()` — BẮT BUỘC gọi trong `finally` sau khi xong việc.
   */
  acquire(key) {
    const prev = this._chains.get(key) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    // Gắn cổng của phiên hiện tại vào cuối chuỗi chờ của tài nguyên.
    this._chains.set(
      key,
      prev.then(() => gate)
    );
    return release;
  }

  /**
   * Chạy hàm `fn` trong vùng khóa của `key`, tự động nhả khóa kể cả khi lỗi.
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async runExclusive(key, fn) {
    const release = this.acquire(key);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/** Mutex toàn cục dùng chung cho toàn bộ ứng dụng (khóa theo tên tài nguyên). */
const globalMutex = new Mutex();

module.exports = { Mutex, globalMutex };
