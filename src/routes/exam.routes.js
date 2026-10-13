/**
 * exam.routes.js — API cho thí sinh: xem danh sách đề, tải đề, bắt đầu làm bài,
 * nộp bài (server chấm điểm) và đồng bộ kết quả lên Google Drive.
 *
 * Lưu ý an toàn:
 *  - Đề gửi cho client KHÔNG BAO GIỜ chứa đáp án đúng (correctIndex).
 *  - Điểm được chấm hoàn toàn trên server từ dữ liệu đề trong RAM.
 *  - Thời gian làm bài được giám sát server-side qua bản ghi "attempt" trong RAM
 *    (POST /start). Nếu server restart giữa chừng, fallback về thời lượng client
 *    báo (được kẹp trần bằng thời lượng đề).
 */
'use strict';

const express = require('express');
const dataStore = require('../store/dataStore');
const { requireAuth } = require('../middleware/auth');
const { newId } = require('../utils/crypto');
const { statusOf, gateMessage } = require('../utils/examWindow');

const router = express.Router();
router.use(requireAuth);

/** Bản ghi bắt đầu làm bài: key = "<cccd>|<examId>" → { startedAt: ms } */
const attempts = new Map();
const DURATION_GRACE_SECONDS = 15; // Dung sai mạng/khoe UI khi nộp sát giờ.

/* ---------------------------- DANH SÁCH ĐỀ THI ---------------------------- */
router.get('/exams', (req, res) => {
  const exams = dataStore
    .get('exams')
    .map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      category: e.category,
      durationMinutes: e.durationMinutes,
      questionCount: (e.questions || []).length,
      createdAt: e.createdAt,
      // Giờ thi quy định: client dùng để khóa nút "Vào thi" + đếm ngược mở cửa.
      openAt: e.openAt || null,
      closeAt: e.closeAt || null,
      windowStatus: statusOf(e).status,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ exams });
});

/* ------------------------------ CHI TIẾT ĐỀ THI ------------------------------ */
router.get('/exams/:id', (req, res) => {
  const exam = dataStore.get('exams').find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi.' });

  // Che đáp án đúng trước khi trả về client.
  res.json({
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      category: exam.category,
      durationMinutes: exam.durationMinutes,
      questions: (exam.questions || []).map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
      })),
    },
  });
});

/* ------------------------- BẮT ĐẦU LÀM BÀI (giám thị server) ------------------------- */
router.post('/exams/:id/start', (req, res) => {
  const exam = dataStore.get('exams').find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi.' });

  const key = `${req.user.cccd}|${exam.id}`;
  const totalSeconds = exam.durationMinutes * 60;
  let startedAt = attempts.get(key);

  // ---- CỬA THI (giờ thi quy định) ----
  // Thí sinh đã có lượt đang làm (startedAt tồn tại) thì luôn cho vào lại để
  // nộp bài/kế tục — chỉ chặn thí sinh MỚI bấm vào ngoài khung giờ quy định.
  if (!startedAt) {
    const win = statusOf(exam);
    const blocked = gateMessage(win, exam.title);
    if (blocked) return res.status(423).json({ message: blocked });
  }

  if (!startedAt) {
    startedAt = Date.now();
    attempts.set(key, startedAt);
  }

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const remaining = Math.max(totalSeconds - elapsed, 0);
  res.json({
    startedAt: new Date(startedAt).toISOString(),
    durationMinutes: exam.durationMinutes,
    remainingSeconds: remaining,
    totalQuestions: (exam.questions || []).length,
  });
});

/* ------------------------------- NỘP BÀI & CHẤM ĐIỂM ------------------------------- */
router.post('/exams/:id/submit', async (req, res, next) => {
  try {
    const exam = dataStore.get('exams').find((e) => e.id === req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi.' });

    const questions = exam.questions || [];
    if (questions.length === 0) {
      return res.status(400).json({ message: 'Đề thi chưa có câu hỏi hợp lệ.' });
    }

    // ---- Cửa thi: đề đã đóng cửa + thí sinh CHƯA từng bắt đầu → từ chối nộp ----
    // (Ai đã bắt đầu trong khung giờ thì vẫn được nộp bình thường, kể cả nộp muộn.)
    const key0 = `${req.user.cccd}|${exam.id}`;
    if (!attempts.has(key0)) {
      const win = statusOf(exam);
      const blocked = gateMessage(win, exam.title);
      if (blocked) return res.status(423).json({ message: blocked });
    }

    // ---- Xác định thời lượng làm bài (ưu tiên dữ liệu server-side) ----
    const key = `${req.user.cccd}|${exam.id}`;
    const totalSeconds = exam.durationMinutes * 60;
    const serverStart = attempts.get(key);
    let durationSeconds;
    let startedAtIso;

    if (serverStart) {
      durationSeconds = Math.floor((Date.now() - serverStart) / 1000);
      startedAtIso = new Date(serverStart).toISOString();
    } else {
      // Server từng restart → tin duration client báo, kẹp trần theo đề.
      const clientDur = parseInt(req.body.durationSeconds, 10);
      durationSeconds = Number.isFinite(clientDur) && clientDur > 0 ? clientDur : totalSeconds;
      durationSeconds = Math.min(durationSeconds, totalSeconds);
      startedAtIso = new Date(Date.now() - durationSeconds * 1000).toISOString();
    }
    durationSeconds = Math.min(durationSeconds + DURATION_GRACE_SECONDS, totalSeconds);

    // ---- Chấm điểm trên server ----
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const answerMap = new Map(
      answers.map((a) => [String(a && a.qid), parseInt(a && a.choice, 10)])
    );
    let correct = 0;
    for (const q of questions) {
      const choice = answerMap.get(q.id);
      if (Number.isInteger(choice) && choice === q.correctIndex) correct += 1;
    }
    // Thang điểm 10, làm tròn 2 chữ số thập phân.
    const score = Math.round((correct / questions.length) * 10 * 100) / 100;

    const result = {
      id: newId('res'),
      examId: exam.id,
      examTitle: exam.title,
      category: exam.category,
      cccd: req.user.cccd,
      score,
      correct,
      total: questions.length,
      startedAt: startedAtIso,
      durationSeconds,
      submittedAt: new Date().toISOString(),
    };

    dataStore.get('results').push(result);
    attempts.delete(key);

    // Đồng bộ vĩnh viễn kết quả lên Google Drive NGAY khi nộp bài.
    // Nếu Drive tạm lỗi: kết quả vẫn giữ trong RAM + mirror cục bộ, tự thử lại
    // mỗi 30s — thí sinh không bị mất bài, chỉ nhận cảnh báo nhẹ.
    const sync = await dataStore.saveNow('results');

    res.status(201).json({
      message: sync.synced
        ? 'Đã nộp bài thành công!'
        : 'Đã nộp bài thành công! (Dữ liệu chưa sync lên Drive — hệ thống sẽ tự thử lại, bạn không cần làm gì thêm.)',
      result: {
        id: result.id,
        score: result.score,
        correct: result.correct,
        total: result.total,
        durationSeconds: result.durationSeconds,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
