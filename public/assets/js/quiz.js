/**
 * quiz.js — Luồng làm bài thi trực tuyến:
 *   Danh sách đề → bắt đầu (server cấp thời gian) → làm bài + đếm ngược
 *   → nộp bài (thủ công hoặc tự động khi hết giờ) → chấm điểm server → kết quả.
 *
 * An toàn dữ liệu:
 *  - Đề tải về không chứa đáp án đúng; chấm điểm 100% trên máy chủ.
 *  - Câu trả lời tạm lưu localStorage theo cccd+examId → refresh không mất bài.
 *  - Thời gian còn lại do máy chủ cấp (POST /start idempotent).
 */
'use strict';

Auth.guard();

const state = {
  examId: new URLSearchParams(location.search).get('id'),
  exam: null,
  remaining: 0,          // giây
  totalSeconds: 0,
  current: 0,            // index câu đang xem
  answers: {},           // { qid: choiceIndex }
  timerId: null,
  submitting: false,
};

/* ------------------------------ Tiện ích view ------------------------------ */
function showView(name) {
  for (const v of ['view-list', 'view-quiz', 'view-result']) {
    document.getElementById(v).classList.toggle('hidden', v !== name);
  }
  window.scrollTo({ top: 0 });
}

function answerKey() {
  return `quiz_answers_${Auth.user().cccd}_${state.examId}`;
}
function saveAnswersLocal() {
  localStorage.setItem(answerKey(), JSON.stringify(state.answers));
}
function loadAnswersLocal() {
  try { return JSON.parse(localStorage.getItem(answerKey()) || '{}'); }
  catch { return {}; }
}
function clearAnswersLocal() {
  localStorage.removeItem(answerKey());
}

/* ============================ VIEW 1: DANH SÁCH ĐỀ ============================ */
async function renderExamList() {
  showView('view-list');
  const user = Auth.user();
  document.getElementById('user-chip').textContent =
    `Thí sinh: ${maskCccd(user.cccd)} · ${user.unit || ''}`;
  const grid = document.getElementById('exam-grid');
  try {
    const { exams } = await api('/exams');
    if (exams.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <div class="text-4xl">📋</div>
          <p class="font-bold text-slate-700 mt-3">Chưa có đề thi nào được mở</p>
          <p class="text-sm text-slate-400 mt-1">Ban Tổ chức sẽ công bố đề thi trong thời gian sớm nhất. Vui lòng quay lại sau.</p>
        </div>`;
      return;
    }
    grid.innerHTML = exams.map((e) => `
      <article class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col hover:shadow-soft transition">
        <span class="self-start bg-flag-50 text-flag-700 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded">${esc(e.category)}</span>
        <h2 class="font-serif font-bold text-lg text-slate-900 mt-3 leading-snug">${esc(e.title)}</h2>
        <p class="text-sm text-slate-500 mt-2 leading-relaxed flex-1">${esc(e.description || 'Đề thi trắc nghiệm kiến thức pháp luật.')}</p>
        <div class="mt-4 flex items-center gap-4 text-xs text-slate-400">
          <span>📝 ${e.questionCount} câu</span>
          <span>⏱ ${e.durationMinutes} phút</span>
        </div>
        <button onclick="startExam('${esc(e.id)}')" class="mt-5 w-full bg-flag-600 hover:bg-flag-700 text-white font-bold py-3 rounded-xl transition">Vào thi</button>
      </article>`).join('');
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full text-center text-red-500 py-10">${esc(err.message)}</div>`;
  }
}

/* ============================ VÀO THI ============================ */
async function startExam(examId) {
  try {
    state.examId = examId;
    // Server cấp/xác nhận thời gian bắt đầu (chống reset đồng hồ khi refresh).
    const start = await api(`/exams/${examId}/start`, { method: 'POST' });
    const { exam } = await api(`/exams/${examId}`);

    state.exam = exam;
    state.totalSeconds = start.durationMinutes * 60;
    state.remaining = start.remainingSeconds;
    state.answers = loadAnswersLocal();
    state.current = 0;

    // Về lại danh sách nếu hết giờ ngay khi vào.
    if (state.remaining <= 0) {
      toast('Lượt thi này đã hết giờ, hệ thống sẽ nộp bài tự động.', 'info');
    }

    document.getElementById('q-category').textContent = exam.category;
    document.getElementById('q-title').textContent = exam.title;
    document.getElementById('total-count').textContent = exam.questions.length;
    renderPalette();
    renderQuestion();
    startTimer();
    showView('view-quiz');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ============================ LÀM BÀI ============================ */
function renderPalette() {
  const palette = document.getElementById('palette');
  palette.innerHTML = state.exam.questions
    .map((q, i) => {
      const answered = state.answers[q.id] !== undefined;
      const active = i === state.current;
      return `<button onclick="gotoQuestion(${i})" data-palette="${i}"
        class="h-9 rounded-lg text-xs font-bold transition ${
          active ? 'bg-flag-600 text-white shadow'
          : answered ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }">${i + 1}</button>`;
    })
    .join('');
  updateAnsweredCount();
}

function updateAnsweredCount() {
  const n = Object.keys(state.answers).length;
  document.getElementById('answered-count').textContent = n;
}

function gotoQuestion(i) {
  state.current = i;
  renderQuestion();
  renderPalette();
}

function renderQuestion() {
  const q = state.exam.questions[state.current];
  document.getElementById('q-counter').textContent = `Câu ${state.current + 1}/${state.exam.questions.length}`;
  document.getElementById('q-text').textContent = q.text;
  document.getElementById('progress-bar').style.width =
    `${((state.current + 1) / state.exam.questions.length) * 100}%`;

  const chosen = state.answers[q.id];
  document.getElementById('q-options').innerHTML = q.options
    .map((opt, i) => `
      <label class="flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition ${
        chosen === i ? 'border-flag-500 bg-flag-50 ring-1 ring-flag-500' : 'border-slate-200 hover:border-flag-200 hover:bg-flag-50/40'
      }" onclick="chooseOption(${i})">
        <span class="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
          chosen === i ? 'bg-flag-600 border-flag-600 text-white' : 'border-slate-300 text-slate-500'
        }">${String.fromCharCode(65 + i)}</span>
        <span class="text-[15px] text-slate-700 leading-relaxed">${esc(opt)}</span>
      </label>`)
    .join('');

  document.getElementById('btn-prev').disabled = state.current === 0;
  const isLast = state.current === state.exam.questions.length - 1;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.textContent = isLast ? 'Đã đến câu cuối' : 'Câu sau →';
  nextBtn.disabled = isLast;
}

function chooseOption(i) {
  const q = state.exam.questions[state.current];
  state.answers[q.id] = i;
  saveAnswersLocal();
  renderQuestion();
  renderPalette();
}

document.getElementById('btn-prev').addEventListener('click', () => gotoQuestion(Math.max(state.current - 1, 0)));
document.getElementById('btn-next').addEventListener('click', () => gotoQuestion(Math.min(state.current + 1, state.exam.questions.length - 1)));

/* ============================ ĐẾM NGƯỢC ============================ */
function startTimer() {
  stopTimer();
  updateTimerUI();
  state.timerId = setInterval(() => {
    state.remaining -= 1;
    updateTimerUI();
    if (state.remaining <= 0) {
      stopTimer();
      autoSubmit();
    }
  }, 1000);
}
function stopTimer() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
}
function updateTimerUI() {
  const box = document.getElementById('timer');
  document.getElementById('timer-text').textContent = fmtClock(state.remaining);
  const danger = state.remaining <= 60;
  box.classList.toggle('bg-red-600', danger);
  box.classList.toggle('timer-danger', danger);
  box.classList.toggle('bg-flag-600', !danger);
}

/* ============================ NỘP BÀI ============================ */
function askSubmit() {
  if (state.submitting) return;
  const answered = Object.keys(state.answers).length;
  const total = state.exam.questions.length;
  const unanswered = total - answered;
  document.getElementById('modal-submit-detail').innerHTML =
    `Bạn đã trả lời <b>${answered}/${total}</b> câu` +
    (unanswered > 0 ? `, còn <b class="text-red-600">${unanswered} câu bỏ trống</b>. Câu bỏ trống sẽ không được tính điểm.` : '.') +
    ` Thời gian còn lại: <b>${fmtClock(state.remaining)}</b>.`;
  openModal('modal-submit');
}

async function doSubmit() {
  if (state.submitting) return;
  state.submitting = true;
  stopTimer();
  setBusyUI(true);
  const payload = {
    answers: Object.entries(state.answers).map(([qid, choice]) => ({ qid, choice })),
    durationSeconds: state.totalSeconds - Math.max(state.remaining, 0),
  };
  try {
    const data = await api(`/exams/${state.examId}/submit`, { method: 'POST', body: payload });
    clearAnswersLocal();
    renderResult(data.result);
  } catch (err) {
    toast(err.message, 'error');
    state.submitting = false;
    setBusyUI(false);
    // Nếu máy chủ vẫn yêu cầu đăng nhập hợp lệ mà phiên hết hạn, api() đã redirect.
    if (state.remaining > 0) startTimer();
  }
}

function autoSubmit() {
  if (state.submitting) return;
  toast('Hết giờ làm bài! Hệ thống tự động nộp bài của bạn.', 'info');
  doSubmit();
}

function setBusyUI(busy) {
  for (const id of ['btn-submit-top', 'btn-submit-side', 'btn-confirm-submit']) {
    const b = document.getElementById(id);
    if (b) { b.disabled = busy; b.classList.toggle('opacity-60', busy); }
  }
  closeModal('modal-submit');
}

function renderResult(r) {
  showView('view-result');
  animateScore(r.score);
  document.getElementById('r-correct').textContent = `${r.correct} câu`;
  document.getElementById('r-total').textContent = `${r.total} câu`;
  document.getElementById('r-duration').textContent = fmtDuration(r.durationSeconds);
  const ring = document.getElementById('score-ring');
  setTimeout(() => { ring.style.setProperty('--pct', Math.round((r.score / 10) * 100)); }, 120);
}

function animateScore(target) {
  const el = document.getElementById('r-score');
  const t0 = performance.now();
  const dur = 1100;
  function frame(t) {
    const p = Math.min((t - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (Math.round(target * eased * 100) / 100).toFixed(2);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.getElementById('btn-submit-top').addEventListener('click', askSubmit);
document.getElementById('btn-submit-side').addEventListener('click', askSubmit);
document.getElementById('btn-confirm-submit').addEventListener('click', doSubmit);

/* Cảnh báo khi rời trang giữa lượt thi. */
window.addEventListener('beforeunload', (e) => {
  if (state.exam && !state.submitting && document.getElementById('view-quiz').classList.contains('hidden') === false) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ============================ ĐIỀU HƯỚNG CHÍNH ============================ */
(function main() {
  const user = Auth.user();
  document.getElementById('header-user').innerHTML = `
    <span class="hidden sm:inline text-slate-400">${esc(maskCccd(user.cccd))}</span>
    ${user.role === 'admin' ? `<a href="/admin.html" class="text-flag-700 bg-flag-50 hover:bg-flag-100 font-semibold px-3 py-2 rounded-lg transition">Quản trị</a>` : ''}
    <button onclick="doLogout()" class="text-slate-500 hover:text-red-600 font-semibold px-3 py-2 transition">Đăng xuất</button>`;

  if (state.examId) startExam(state.examId);
  else renderExamList();
})();
