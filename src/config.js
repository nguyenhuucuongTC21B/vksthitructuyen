/**
 * config.js — Nạp biến môi trường và cấu hình tập trung.
 * Hỗ trợ đọc file .env (chạy local) mà không cần dependency ngoài.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/** Đọc file .env nếu tồn tại và gán vào process.env (không ghi đè giá trị đã có). */
function loadDotEnv(file = '.env') {
  try {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) return;
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (err) {
    console.warn('[config] Khong doc duoc file .env:', err.message);
  }
}

loadDotEnv();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  /** Khoa ky token HMAC. Neu khong set -> tu sinh ngau nhien (token mat sau khi restart). */
  sessionSecret:
    process.env.SESSION_SECRET ||
    require('crypto').randomBytes(48).toString('hex'),

  /** Danh sach CCCD duoc cap quyen Admin khi dang ky. */
  adminCccds: (process.env.ADMIN_CCCDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /** Thu muc cache cuc bo (mirror cua Google Drive, dung khi offline/dev). */
  localDataDir: path.join(process.cwd(), 'data'),
};

if (!process.env.SESSION_SECRET) {
  console.warn(
    '[config] CANH BAO: SESSION_SECRET chua duoc cau hinh. ' +
      'Token dang nhap se het hieu moi khi server restart. ' +
      'Hay dat bien nay trong production!'
  );
}

module.exports = config;
