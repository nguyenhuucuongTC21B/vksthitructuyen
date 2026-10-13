/**
 * admin.routes.js — Toàn bộ API của Admin Dashboard.
 * Đều yêu cầu: đã đăng nhập (requireAuth) + quyền Admin (requireAdmin).
 *
 * Chức năng:
 *  - Quản lý người dùng: xem, sửa thông tin, xóa, cấp quyền, đặt lại mật khẩu.
 *  - Ra đề thi mới, xóa đề.
 *  - Xem toàn bộ kết quả (theo từng hạng mục), can thiệp chỉnh sửa / xóa kết quả.
 */
'use strict';

const express = require('express');
const dataStore = require('../store/dataStore');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { hashPassword, verifyPassword, newId } = require('../utils/crypto');
const { validateExamPayload, RE_CCCD, RE_PHONE, RE_EMAIL } = require('../utils/validate');

const router = express.Router();
router.use(requireAuth, requireAdmin);

/* ============================== QUẢN LÝ NGƯỜI DÙNG ============================== */

/** Danh sách người dùng (ẩn mật khẩu đã băm). */
router.get('/users', (req, res) => {
  const users = dataStore.get('users').map(({ passwordHash, ...rest }) => rest);
  res.json({ users });
});

/** Cập nhật thông tin một người dùng (theo CCCD). */
router.put('/users/:cccd', async (req, res, next) => {
  try {
    const user = dataStore.get('users').find((u) => u.cccd === req.params.cccd);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });

    const b = req.body || {};
    const errors = [];

    if (b.phone !== undefined) {
      const phone = String(b.phone).trim();
      if (!RE_PHONE.test(phone)) errors.push('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).');
      else user.phone = phone;
    }
    if (b.email !== undefined) {
      const email = String(b.email).trim().toLowerCase();
      if (!RE_EMAIL.test(email)) errors.push('Email không hợp lệ.');
      else if (dataStore.get('users').some((u) => u.email === email && u.cccd !== user.cccd))
        errors.push('Email đã được tài khoản khác sử dụng.');
      else user.email = email;
    }
    if (b.position !== undefined) {
      const pos = String(b.position).trim();
      if (pos.length < 2) errors.push('Chức vụ không hợp lệ.');
      else user.position = pos;
    }
    if (b.unit !== undefined) {
      const unit = String(b.unit).trim();
      if (unit.length < 2) errors.push('Đơn vị công tác không hợp lệ.');
      else user.unit = unit;
    }
    if (b.role !== undefined) {
      const role = String(b.role);
      if (!['user', 'admin'].includes(role)) errors.push('Quyền không hợp lệ (user/admin).');
      else if (role !== 'admin' && user.cccd === req.user.cccd)
        errors.push('Không thể tự hạ quyền của chính tài khoản đang đăng nhập.');
      else user.role = role;
    }
    if (b.password) {
      const pw = String(b.password);
      if (pw.length < 6) errors.push('Mật khẩu mới phải có ít nhất 6 ký tự.');
      else user.passwordHash = hashPassword(pw);
    }

    if (errors.length) return res.status(400).json({ message: errors.join(' ') });

    await dataStore.saveNow('users');
    const { passwordHash, ...safe } = user;
    res.json({ message: 'Đã cập nhật thông tin người dùng.', user: safe });
  } catch (err) {
    next(err);
  }
});

/** Xóa người dùng (không tự xóa chính mình). Kết quả thi cũ được giữ lại làm hồ sơ. */
router.delete('/users/:cccd', async (req, res, next) => {
  try {
    if (req.params.cccd === req.user.cccd) {
      return res.status(400).json({ message: 'Không thể tự xóa tài khoản đang đăng nhập.' });
    }
    const users = dataStore.get('users');
    const idx = users.findIndex((u) => u.cccd === req.params.cccd);
    if (idx === -1) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    users.splice(idx, 1);
    await dataStore.saveNow('users');
    res.json({ message: 'Đã xóa người dùng khỏi hệ thống.' });
  } catch (err) {
    next(err);
  }
});

/* ============================== RA ĐỀ THI MỚI ============================== */

router.post('/exams', async (req, res, next) => {
  try {
    const check = validateExamPayload(req.body);
    if (!check.ok) return res.status(400).json({ message: check.message });

    const exam = {
      id: newId('exam'),
      ...check.data,
      createdBy: req.user.cccd,
      createdAt: new Date().toISOString(),
    };
    dataStore.get('exams').push(exam);
    await dataStore.saveNow('exams');
    res.status(201).json({
      message: `Đã tạo đề thi "${exam.title}" với ${exam.questions.length} câu hỏi.`,
      exam: { id: exam.id, title: exam.title },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/exams/:id', async (req, res, next) => {
  try {
    const exams = dataStore.get('exams');
    const idx = exams.findIndex((e) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Không tìm thấy đề thi.' });
    const [removed] = exams.splice(idx, 1);
    await dataStore.saveNow('exams');
    res.json({ message: `Đã xóa đề thi "${removed.title}".` });
  } catch (err) {
    next(err);
  }
});

/* ============================== KẾT QUẢ BÀI THI ============================== */

/** Toàn bộ kết quả (bảng điểm chi tiết của từng hạng mục — lọc ở client). */
router.get('/results', (req, res) => {
  const results = [...dataStore.get('results')].sort(
    (a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)
  );
  res.json({ results });
});

/** Can thiệp chỉnh sửa kết quả: điểm số / số câu đúng. */
router.put('/results/:id', async (req, res, next) => {
  try {
    const result = dataStore.get('results').find((r) => r.id === req.params.id);
    if (!result) return res.status(404).json({ message: 'Không tìm thấy kết quả bài làm.' });

    const b = req.body || {};
    let touched = false;

    if (b.correct !== undefined) {
      const correct = parseInt(b.correct, 10);
      if (!Number.isInteger(correct) || correct < 0 || correct > result.total) {
        return res.status(400).json({ message: `Số câu đúng phải trong khoảng 0–${result.total}.` });
      }
      result.correct = correct;
      result.score = Math.round((correct / result.total) * 10 * 100) / 100;
      touched = true;
    }
    if (b.score !== undefined) {
      const score = Number(b.score);
      if (!Number.isFinite(score) || score < 0 || score > 10) {
        return res.status(400).json({ message: 'Điểm số phải trong khoảng 0–10.' });
      }
      result.score = Math.round(score * 100) / 100;
      touched = true;
    }
    if (b.note !== undefined) {
      result.note = String(b.note).slice(0, 300);
      touched = true;
    }

    if (!touched) return res.status(400).json({ message: 'Không có trường nào cần thay đổi.' });

    result.editedAt = new Date().toISOString();
    result.editedBy = req.user.cccd;
    await dataStore.saveNow('results');
    res.json({ message: 'Đã cập nhật kết quả bài làm.', result });
  } catch (err) {
    next(err);
  }
});

router.delete('/results/:id', async (req, res, next) => {
  try {
    const results = dataStore.get('results');
    const idx = results.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Không tìm thấy kết quả bài làm.' });
    results.splice(idx, 1);
    await dataStore.saveNow('results');
    res.json({ message: 'Đã xóa kết quả bài làm.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
