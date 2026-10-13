/**
 * admin.routes.js — Toàn bộ API của Admin Dashboard.
 * Đều yêu cầu: đã đăng nhập (requireAuth) + quyền Admin (requireAdmin).
 *
 * Chức năng:
 *  - Quản lý người dùng: xem, sửa thông tin, xóa, cấp quyền, đặt lại mật khẩu.
 *  - Ra đề thi mới, XEM CHI TIẾT đề (kèm đáp án), CHỈNH SỬA đề, xóa đề.
 *  - Xem toàn bộ kết quả (theo từng hạng mục), can thiệp chỉnh sửa / xóa kết quả.
 *  - Đồng bộ dữ liệu lên Google Drive NGAY (POST /sync) khi cần chắc chắn.
 */
'use strict';

const express = require('express');
const dataStore = require('../store/dataStore');
const driveClient = require('../drive/driveClient');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { hashPassword, verifyPassword, newId } = require('../utils/crypto');
const { validateExamPayload, RE_CCCD, RE_PHONE, RE_EMAIL } = require('../utils/validate');
const { missingSampleExams } = require('../data/sampleExams');

const router = express.Router();
router.use(requireAuth, requireAdmin);

/**
 * Hậu tố cảnh báo thêm vào message khi dữ liệu CHƯA ghi được lên Drive.
 * (sync = kết quả trả về của dataStore.saveNow — { synced: boolean })
 */
function syncSuffix(sync) {
  return sync && sync.synced
    ? ''
    : ' ⚠ Dữ liệu CHƯA đồng bộ lên Google Drive — hệ thống sẽ tự thử lại mỗi 30 giây.';
}

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

    const sync = await dataStore.saveNow('users');
    const { passwordHash, ...safe } = user;
    res.json({ message: `Đã cập nhật thông tin người dùng.${syncSuffix(sync)}`, synced: sync.synced, user: safe });
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
    const sync = await dataStore.saveNow('users');
    res.json({ message: `Đã xóa người dùng khỏi hệ thống.${syncSuffix(sync)}`, synced: sync.synced });
  } catch (err) {
    next(err);
  }
});

/* ============================== RA ĐỀ & QUẢN LÝ ĐỀ THI ============================== */

/** Tạo đề thi mới. Có cơ chế chống tạo trùng do bấm nút Lưu nhiều lần. */
router.post('/exams', async (req, res, next) => {
  try {
    const check = validateExamPayload(req.body);
    if (!check.ok) return res.status(400).json({ message: check.message });

    // ---- Chống tạo trùng: cùng tên + hạng mục tạo trong 2 phút gần nhất ----
    // (Người dùng thường bấm "Lưu" nhiều lần khi Render khởi động lạnh chậm.)
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    const dup = dataStore
      .get('exams')
      .find(
        (e) =>
          e.title === check.data.title &&
          e.category === check.data.category &&
          new Date(e.createdAt).getTime() > twoMinutesAgo
      );
    if (dup) {
      return res.status(409).json({
        message:
          `Đề thi "${dup.title}" vừa được tạo lúc ${new Date(dup.createdAt).toLocaleTimeString('vi-VN')}. ` +
          'Không tạo lại đề trùng tên trong vòng 2 phút (có thể bạn đã bấm nút Lưu nhiều lần).',
        exam: { id: dup.id, title: dup.title },
      });
    }

    const exam = {
      id: newId('exam'),
      ...check.data,
      createdBy: req.user.cccd,
      createdAt: new Date().toISOString(),
    };
    dataStore.get('exams').push(exam);
    const sync = await dataStore.saveNow('exams');
    res.status(201).json({
      message: `Đã tạo đề thi "${exam.title}" với ${exam.questions.length} câu hỏi.${syncSuffix(sync)}`,
      synced: sync.synced,
      exam: { id: exam.id, title: exam.title },
    });
  } catch (err) {
    next(err);
  }
});

/** Chi tiết đầy đủ một đề thi (kèm đáp án đúng — CHỈ admin được xem). */
router.get('/exams/:id', (req, res) => {
  const exam = dataStore.get('exams').find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi.' });
  res.json({ exam });
});

/** Chỉnh sửa đề thi: tên, hạng mục, thời lượng, mô tả, toàn bộ câu hỏi. */
router.put('/exams/:id', async (req, res, next) => {
  try {
    const exam = dataStore.get('exams').find((e) => e.id === req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi.' });

    const check = validateExamPayload(req.body);
    if (!check.ok) return res.status(400).json({ message: check.message });

    // Giữ nguyên định danh + dấu vết tạo; ghi rõ người sửa để đối chiếu sau.
    exam.title = check.data.title;
    exam.description = check.data.description;
    exam.category = check.data.category;
    exam.durationMinutes = check.data.durationMinutes;
    exam.openAt = check.data.openAt || null;   // Giờ thi quy định (null = mở mọi lúc).
    exam.closeAt = check.data.closeAt || null;
    exam.questions = check.data.questions;
    exam.updatedAt = new Date().toISOString();
    exam.updatedBy = req.user.cccd;

    const sync = await dataStore.saveNow('exams');
    const schedTxt = exam.openAt
      ? ` Mở cửa từ ${new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(Date.parse(exam.openAt))} (giờ VN).`
      : ' (Không quy định giờ thi — thí sinh thi được mọi lúc.)';
    res.json({
      message: `Đã cập nhật đề thi "${exam.title}" (${exam.questions.length} câu hỏi).${schedTxt}${syncSuffix(sync)}`,
      synced: sync.synced,
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
    const sync = await dataStore.saveNow('exams');
    res.json({
      message: `Đã xóa đề thi "${removed.title}".${syncSuffix(sync)}`,
      synced: sync.synced,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * NẠP BỘ ĐỀ MẪU (2 đề × 50 câu An toàn thông tin) do Ban Tổ chức chuẩn bị sẵn.
 * Chỉ thêm những đề CHƯA có trong hệ thống (so theo tên đề) — không nhân đôi.
 * Dùng khi admin đã xóa bộ đề mẫu muốn nạp lại, hoặc hệ thống từng khởi động
 * trước khi có tính năng này.
 */
router.post('/seed-sample-exams', async (req, res, next) => {
  try {
    const missing = missingSampleExams(dataStore.get('exams'));
    if (missing.length === 0) {
      return res.json({
        message: 'Cả 2 bộ đề mẫu đã có sẵn trong hệ thống — không cần nạp lại.',
        added: 0,
      });
    }
    const now = new Date().toISOString();
    for (const s of missing) {
      dataStore.get('exams').push({ ...s, createdBy: req.user.cccd, createdAt: now });
    }
    const sync = await dataStore.saveNow('exams');
    const names = missing.map((s) => s.title).join('; ');
    res.status(201).json({
      message: `Đã nạp ${missing.length} bộ đề mẫu: ${names}.${syncSuffix(sync)}`,
      synced: sync.synced,
      added: missing.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Đồng bộ NGAY toàn bộ dữ liệu đang chờ lên Google Drive.
 * Dùng khi admin muốn chắc chắn dữ liệu đã an toàn trước khi server nghỉ
 * (Render free tier tắt service sau 15 phút không có request).
 */
router.post('/sync', async (req, res, next) => {
  try {
    for (const key of dataStore.FILES) await dataStore.saveNow(key);
    const sync = dataStore.getSyncInfo();
    const pending = sync.filter((s) => s.pending);
    if (pending.length === 0) {
      return res.json({
        message: 'Mọi dữ liệu đã được đồng bộ an toàn lên Google Drive.',
        synced: true,
        sync,
      });
    }
    // Còn pending: kèm nguyên nhân cụ thể của file đầu tiên để admin biết ngay
    // lỗi gì mà không phải đoán (khuyến nghị chạy chẩn đoán 5 mức).
    const firstError = pending.find((s) => s.lastError);
    const errText = firstError ? ` Nguyên nhân gần nhất: ${firstError.lastError}` : '';
    res.json({
      message:
        `Vẫn còn ${pending.length} file CHƯA đồng bộ được lên Google Drive.${errText} ` +
        'Bấm "Kiểm tra Drive ngay" để chẩn đoán chính xác nguyên nhân và cách sửa.',
      synced: false,
      sync,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * CHẨN ĐOÁN GOOGLE DRIVE TRỰC TIẾP TRÊN SERVER (5 mức):
 *   env → key → đọc thư mục → ghi file test → xóa file test.
 * Admin bấm nút "Kiểm tra Drive ngay" — không cần chạy tool trên máy local.
 * Mỗi mức FAIL đều kèm gợi ý sửa cụ thể (nguồn: src/utils/driveAdvice.js).
 */
router.post('/drive-check', async (req, res, next) => {
  try {
    const result = await driveClient.runDiagnostic();
    res.json(result);
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
    const sync = await dataStore.saveNow('results');
    res.json({ message: `Đã cập nhật kết quả bài làm.${syncSuffix(sync)}`, synced: sync.synced, result });
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
    const sync = await dataStore.saveNow('results');
    res.json({ message: `Đã xóa kết quả bài làm.${syncSuffix(sync)}`, synced: sync.synced });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
