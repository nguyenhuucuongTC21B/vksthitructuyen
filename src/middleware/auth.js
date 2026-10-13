/**
 * auth.js — Middleware bảo vệ API: xác thực token, phân quyền Admin.
 */
'use strict';

const { verifyToken } = require('../utils/crypto');

/** Tách token từ header "Authorization: Bearer <token>". */
function extractToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Bắt buộc đã đăng nhập: gắn req.user = { cccd, role } nếu token hợp lệ. */
function requireAuth(req, res, next) {
  const payload = verifyToken(extractToken(req));
  if (!payload) {
    return res.status(401).json({ message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
  }
  req.user = { cccd: payload.cccd, role: payload.role };
  next();
}

/** Bắt buộc quyền Admin (dùng sau requireAuth). */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Chỉ quản trị viên mới được thực hiện hành động này.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, extractToken };
