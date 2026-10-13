/**
 * validate.js — Kiểm tra dữ liệu đầu vào (thí sinh / đề thi).
 * Mọi thông báo lỗi đều là tiếng Việt để hiển thị trực tiếp lên UI.
 */
'use strict';

const RE_CCCD = /^\d{12}$/;                // Số CCCD: đúng 12 chữ số.
const RE_PHONE = /^0\d{9}$/;               // SĐT Việt Nam: 10 số, bắt đầu bằng 0.
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Gom nhanh các cặp [điều kiện, thông báo lỗi]. */
function firstError(pairs) {
  for (const [bad, msg] of pairs) if (bad) return msg;
  return null;
}

/**
 * Kiểm tra dữ liệu đăng ký. Trả về { ok, message, data }.
 * Bắt buộc nhập ĐỦ toàn bộ trường thông tin theo yêu cầu đặc tả.
 */
function validateRegister(body = {}) {
  const data = {
    cccd: String(body.cccd || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    position: String(body.position || '').trim(),
    unit: String(body.unit || '').trim(),
    password: String(body.password || ''),
  };

  const required = [
    ['cccd', 'Số CCCD'],
    ['phone', 'Số điện thoại'],
    ['email', 'Email'],
    ['position', 'Chức vụ'],
    ['unit', 'Đơn vị công tác'],
    ['password', 'Mật khẩu'],
  ];
  for (const [field, label] of required) {
    if (!data[field]) {
      return { ok: false, message: `Vui lòng nhập đủ thông tin: ${label} là bắt buộc.` };
    }
  }

  const message = firstError([
    [!RE_CCCD.test(data.cccd), 'Số CCCD phải gồm đúng 12 chữ số.'],
    [!RE_PHONE.test(data.phone), 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0, ví dụ 0912345678).'],
    [!RE_EMAIL.test(data.email), 'Địa chỉ email không hợp lệ.'],
    [data.position.length < 2, 'Vui lòng nhập chức vụ.'],
    [data.unit.length < 2, 'Vui lòng nhập đơn vị công tác.'],
    [data.password.length < 6, 'Mật khẩu phải có ít nhất 6 ký tự.'],
  ]);
  if (message) return { ok: false, message };

  return { ok: true, data };
}

/** Chuẩn hóa & kiểm tra bộ câu hỏi khi Admin ra đề. */
function validateExamPayload(body = {}) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const category = String(body.category || '').trim();
  const durationMinutes = parseInt(body.durationMinutes, 10);
  const questions = Array.isArray(body.questions) ? body.questions : [];

  const base = firstError([
    [title.length < 3, 'Tên đề thi phải có ít nhất 3 ký tự.'],
    [!category, 'Vui lòng nhập hạng mục của đề thi.'],
    [!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 240,
      'Thời lượng làm bài phải từ 1 đến 240 phút.'],
    [questions.length === 0, 'Đề thi phải có ít nhất 1 câu hỏi.'],
    [questions.length > 200, 'Đề thi tối đa 200 câu hỏi.'],
  ]);
  if (base) return { ok: false, message: base };

  const normalized = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i] || {};
    const text = String(q.text || '').trim();
    const options = (Array.isArray(q.options) ? q.options : [])
      .map((o) => String(o || '').trim())
      .filter(Boolean);
    const correctIndex = parseInt(q.correctIndex, 10);

    const qErr = firstError([
      [text.length < 3, `Câu hỏi số ${i + 1}: nội dung câu hỏi quá ngắn.`],
      [options.length < 2, `Câu hỏi số ${i + 1}: phải có ít nhất 2 phương án trả lời.`],
      [options.length > 6, `Câu hỏi số ${i + 1}: tối đa 6 phương án trả lời.`],
      [!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length,
        `Câu hỏi số ${i + 1}: chưa chọn đúng phương án đúng.`],
    ]);
    if (qErr) return { ok: false, message: qErr };

    normalized.push({
      id: q.id || `q${i + 1}_${Math.random().toString(36).slice(2, 8)}`,
      text,
      options,
      correctIndex,
    });
  }

  return {
    ok: true,
    data: { title, description, category, durationMinutes, questions: normalized },
  };
}

module.exports = { validateRegister, validateExamPayload, RE_CCCD, RE_PHONE, RE_EMAIL };
