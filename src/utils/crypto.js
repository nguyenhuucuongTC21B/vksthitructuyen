/**
 * crypto.js — Mã hóa mật khẩu và ký/kiểm tra token phiên đăng nhập.
 * Toàn bộ dùng module `crypto` chuẩn của Node.js, KHÔNG thêm dependency.
 */
'use strict';

const crypto = require('crypto');
const config = require('../config');

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // Phiên đăng nhập sống 12 giờ.

/* ------------------------- MẬT KHẨU (scrypt + salt) ------------------------- */

/**
 * Băm mật khẩu bằng scrypt với salt ngẫu nhiên.
 * Định dạng lưu trữ: "scrypt:<salt-hex>:<hash-hex>"
 */
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/** So sánh mật khẩu người dùng nhập với bản băm đã lưu (constant-time). */
function verifyPassword(plain, stored) {
  try {
    const [algo, salt, hash] = String(stored).split(':');
    if (algo !== 'scrypt' || !salt || !hash) return false;
    const candidate = crypto.scryptSync(String(plain), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    if (candidate.length !== expected.length) return false;
    return crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/* ------------------------- TOKEN PHIÊN (HMAC-SHA256) ------------------------- */

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/**
 * Ký token dạng "<payload-b64url>.<chữ ký>" (tinh thần JWT nhưng siêu nhẹ).
 * Payload: { cccd, role, exp } — không chứa thông tin nhạy cảm khác.
 */
function signToken(payload) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const encoded = b64url(JSON.stringify(body));
  const sig = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

/** Kiểm tra token; hợp lệ trả về payload, sai/hết hạn trả về null. */
function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expected = crypto
      .createHmac('sha256', config.sessionSecret)
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Sinh id ngắn gọn, đủ độc nhất cho các bản ghi (exam_*, res_*). */
function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, newId, TOKEN_TTL_SECONDS };
