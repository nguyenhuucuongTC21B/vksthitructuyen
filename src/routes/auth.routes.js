/**
 * auth.routes.js — Đăng ký / Đăng nhập bằng CCCD + Mật khẩu.
 * Có giới hạn tốc độ đăng nhập (chống dò mật khẩu) cực nhẹ, lưu trong RAM.
 */
'use strict';

const express = require('express');
const dataStore = require('../store/dataStore');
const { requireAuth } = require('../middleware/auth');
const { hashPassword, verifyPassword, signToken } = require('../utils/crypto');
const { validateRegister } = require('../utils/validate');
const config = require('../config');

const router = express.Router();

/* ---------------- Giới hạn tốc độ đăng nhập: 6 lần / 15 phút / mỗi CCCD+IP ---------------- */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

function loginRateLimit(req, res, next) {
  const key = `${String(req.body && req.body.cccd || '').trim()}|${req.ip}`;
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  rec.count += 1;
  if (rec.count > MAX_ATTEMPTS) {
    const waitSec = Math.ceil((rec.resetAt - now) / 1000);
    return res.status(429).json({
      message: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${waitSec} giây.`,
    });
  }
  next();
}

/* Chuẩn hóa thông tin user trả ra ngoài (không bao giờ lộ mật khẩu đã băm). */
function publicUser(u) {
  return {
    cccd: u.cccd,
    phone: u.phone,
    email: u.email,
    position: u.position,
    unit: u.unit,
    role: u.role,
    createdAt: u.createdAt,
  };
}

/* --------------------------------- ĐĂNG KÝ --------------------------------- */
router.post('/register', async (req, res, next) => {
  try {
    const check = validateRegister(req.body);
    if (!check.ok) return res.status(400).json({ message: check.message });
    const data = check.data;

    const users = dataStore.get('users');
    if (users.some((u) => u.cccd === data.cccd)) {
      return res.status(409).json({ message: 'Số CCCD này đã được đăng ký tài khoản.' });
    }
    if (users.some((u) => u.email === data.email)) {
      return res.status(409).json({ message: 'Email này đã được sử dụng bởi tài khoản khác.' });
    }

    // Quyền: CCCD trong danh sách ADMIN_CCCDS → admin; người dùng ĐẦU TIÊN khi
    // hệ thống trống → admin (để khởi động hệ thống); còn lại → thí sinh.
    const role =
      config.adminCccds.includes(data.cccd) || users.length === 0 ? 'admin' : 'user';

    const user = {
      ...data,
      password: undefined, // không lưu mật khẩu thô
      passwordHash: hashPassword(data.password),
      role,
      createdAt: new Date().toISOString(),
    };
    delete user.password;
    users.push(user);

    // Ghi vĩnh viễn lên Drive NGAY (thao tác quan trọng). Nếu Drive tạm lỗi /
    // cấu hình sai: KHÔNG làm đăng ký thất bại — dữ liệu được giữ trong RAM +
    // mirror cục bộ, hệ thống tự thử lại mỗi 30s; kèm cảnh báo trong phản hồi.
    const sync = await dataStore.saveNow('users');

    res.status(201).json({
      message: sync.synced
        ? 'Đăng ký tài khoản thành công!'
        : 'Đăng ký thành công! NHƯNG dữ liệu chưa đồng bộ được lên Google Drive — kiểm tra cấu hình Drive (README mục 3) rồi thử lại; hệ thống vẫn tự đồng bộ khi Drive hoạt động trở lại.',
      token: signToken({ cccd: user.cccd, role: user.role }),
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- ĐĂNG NHẬP --------------------------------- */
router.post('/login', loginRateLimit, (req, res) => {
  const cccd = String(req.body.cccd || '').trim();
  const password = String(req.body.password || '');

  if (!cccd || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập số CCCD và mật khẩu.' });
  }

  const user = dataStore.get('users').find((u) => u.cccd === cccd);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Số CCCD hoặc mật khẩu không đúng.' });
  }

  res.json({
    message: 'Đăng nhập thành công!',
    token: signToken({ cccd: user.cccd, role: user.role }),
    user: publicUser(user),
  });
});

/* --------------------------- THÔNG TIN TÀI KHOẢN HIỆN TẠI --------------------------- */
router.get('/me', requireAuth, (req, res) => {
  const user = dataStore.get('users').find((u) => u.cccd === req.user.cccd);
  if (!user) return res.status(404).json({ message: 'Tài khoản không còn tồn tại.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
