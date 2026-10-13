/**
 * admin.js — Logic Admin Dashboard:
 *  - Tổng quan: thống kê + biểu đồ cột điểm TB + bài thi mới nhất.
 *  - Người dùng: tìm kiếm, sửa (modal), xóa (xác nhận).
 *  - Đề thi: danh sách + form ra đề mới (thêm/xóa câu hỏi động).
 *  - Bảng điểm: lọc theo hạng mục, xếp hạng, can thiệp sửa / xóa kết quả.
 */
'use strict';

Auth.guard({ admin: true });

const currentUser = Auth.user();
document.getElementById('admin-chip').textContent = `Admin: ${maskCccd(currentUser.cccd)}`;

/* Dữ liệu đệm client-side. */
const cache = { users: [], exams: [], results: [] };
let rankByScore = false;
let editingUserCccd = null;
let editingResultId = null;
let deleteAction = null; // { label, run() }

/* ------------------------------ Điều hướng section ------------------------------ */
function switchSection(name) {
  for (const el of document.querySelectorAll('.admin-section')) el.classList.add('hidden');
  document.getElementById(`section-${name}`).classList.remove('hidden');
  for (const btn of document.querySelectorAll('.nav-btn')) {
    const active = btn.dataset.section === name;
    btn.className = `nav-btn flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
      active ? 'bg-flag-600 text-white shadow' : 'text-slate-600 hover:bg-flag-50 hover:text-flag-700'
    }`;
  }
  if (name === 'overview') renderOverview();
  if (name === 'users') renderUsers();
  if (name === 'exams') renderExams();
  if (name === 'results') renderResults();
}
for (const btn of document.querySelectorAll('.nav-btn')) {
  btn.addEventListener('click', () => switchSection(btn.dataset.section));
}

/* ------------------------------ Nạp dữ liệu ------------------------------ */
async function refreshAll() {
  try {
    const [u, e, r] = await Promise.all([api('/admin/users'), api('/exams'), api('/admin/results')]);
    cache.users = u.users;
    cache.exams = e.exams;
    cache.results = r.results;
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ================================ TỔNG QUAN ================================ */
function renderOverview() {
  document.getElementById('ov-users').textContent = cache.users.length.toLocaleString('vi-VN');
  document.getElementById('ov-exams').textContent = cache.exams.length.toLocaleString('vi-VN');
  document.getElementById('ov-results').textContent = cache.results.length.toLocaleString('vi-VN');
  const avg = cache.results.length
    ? Math.round((cache.results.reduce((s, r) => s + (Number(r.score) || 0), 0) / cache.results.length) * 100) / 100
    : 0;
  document.getElementById('ov-avg').textContent = avg.toFixed(2);

  // Cột điểm trung bình theo đề thi.
  const byExam = {};
  for (const r of cache.results) {
    (byExam[r.examTitle] = byExam[r.examTitle] || { sum: 0, n: 0 });
    byExam[r.examTitle].sum += Number(r.score) || 0;
    byExam[r.examTitle].n += 1;
  }
  const barsHost = document.getElementById('ov-bars');
  const entries = Object.entries(byExam);
  if (entries.length === 0) {
    barsHost.innerHTML = '<p class="text-slate-400">Chưa có dữ liệu.</p>';
  } else {
    const max = Math.max(...entries.map(([, v]) => v.sum / v.n), 1);
    barsHost.innerHTML = entries.map(([title, v]) => {
      const a = Math.round((v.sum / v.n) * 100) / 100;
      const pct = Math.round((a / max) * 100);
      return `
        <div>
          <div class="flex justify-between text-xs mb-1"><span class="font-semibold text-slate-700 truncate mr-2">${esc(title)}</span><span class="text-flag-600 font-bold">${a.toFixed(2)} đ</span></div>
          <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-flag-500 rounded-full" style="width:${pct}%"></div></div>
          <p class="text-[11px] text-slate-400 mt-0.5">${v.n} lượt thi</p>
        </div>`;
    }).join('');
  }

  const recentHost = document.getElementById('ov-recent');
  const recent = [...cache.results].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)).slice(0, 6);
  recentHost.innerHTML = recent.length === 0
    ? '<p class="text-slate-400">Chưa có dữ liệu.</p>'
    : recent.map((r) => `
        <div class="flex items-center justify-between gap-3 border-b border-slate-50 pb-2 last:border-0">
          <div class="min-w-0">
            <p class="font-semibold text-slate-700 text-xs">${esc(maskCccd(r.cccd))}</p>
            <p class="text-[11px] text-slate-400 truncate">${esc(r.examTitle)} · ${fmtDateTime(r.submittedAt)}</p>
          </div>
          <span class="shrink-0 font-extrabold ${Number(r.score) >= 5 ? 'text-emerald-600' : 'text-red-500'}">${Number(r.score).toFixed(2)}</span>
        </div>`).join('');
}

/* ================================ NGƯỜI DÙNG ================================ */
function roleBadge(role) {
  return role === 'admin'
    ? '<span class="bg-flag-50 text-flag-700 font-bold text-[11px] px-2 py-0.5 rounded-full">Admin</span>'
    : '<span class="bg-slate-100 text-slate-600 font-semibold text-[11px] px-2 py-0.5 rounded-full">Thí sinh</span>';
}

function renderUsers() {
  const keyword = document.getElementById('user-search').value.trim().toLowerCase();
  const list = cache.users.filter((u) =>
    !keyword || [u.cccd, u.email, u.unit, u.position].some((v) => String(v || '').toLowerCase().includes(keyword))
  );
  const tbody = document.getElementById('users-tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-400 py-10">Không tìm thấy người dùng nào.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((u) => `
    <tr class="hover:bg-slate-50/70">
      <td class="px-5 py-3.5 font-mono font-semibold text-slate-800">${esc(u.cccd)}<div class="text-[11px] text-slate-400 font-sans">Tạo: ${fmtDate(u.createdAt)}</div></td>
      <td class="px-5 py-3.5">
        <div class="text-slate-700 font-medium">${esc(u.phone)}</div>
        <div class="text-xs text-slate-400">${esc(u.email)}</div>
      </td>
      <td class="px-5 py-3.5">
        <div class="text-slate-700">${esc(u.position)}</div>
        <div class="text-xs text-slate-400">${esc(u.unit)}</div>
      </td>
      <td class="px-5 py-3.5">${roleBadge(u.role)}</td>
      <td class="px-5 py-3.5 text-right whitespace-nowrap">
        <button onclick="openUserModal('${esc(u.cccd)}')" class="text-flag-600 hover:text-flag-800 font-semibold text-xs px-2 py-1.5">Sửa</button>
        <button onclick="askDeleteUser('${esc(u.cccd)}')" class="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1.5">Xóa</button>
      </td>
    </tr>`).join('');
}
document.getElementById('user-search').addEventListener('input', renderUsers);

function openUserModal(cccd) {
  const u = cache.users.find((x) => x.cccd === cccd);
  if (!u) return;
  editingUserCccd = cccd;
  document.getElementById('mu-cccd').value = u.cccd;
  document.getElementById('mu-phone').value = u.phone || '';
  document.getElementById('mu-email').value = u.email || '';
  document.getElementById('mu-position').value = u.position || '';
  document.getElementById('mu-unit').value = u.unit || '';
  document.getElementById('mu-role').value = u.role || 'user';
  document.getElementById('mu-password').value = '';
  document.getElementById('mu-error').classList.add('hidden');
  openModal('modal-user');
}

document.getElementById('form-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    phone: document.getElementById('mu-phone').value.trim(),
    email: document.getElementById('mu-email').value.trim(),
    position: document.getElementById('mu-position').value.trim(),
    unit: document.getElementById('mu-unit').value.trim(),
    role: document.getElementById('mu-role').value,
  };
  const newPassword = document.getElementById('mu-password').value;
  if (newPassword) body.password = newPassword;
  try {
    const data = await api(`/admin/users/${editingUserCccd}`, { method: 'PUT', body });
    toast(data.message, 'success');
    closeModal('modal-user');
    await refreshAll();
    renderUsers();
    renderOverview();
  } catch (err) {
    const el = document.getElementById('mu-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  }
});

function askDeleteUser(cccd) {
  askDelete(`Xóa vĩnh viễn tài khoản ${maskCccd(cccd)} khỏi hệ thống? Hành động này không thể hoàn tác.`, async () => {
    const data = await api(`/admin/users/${cccd}`, { method: 'DELETE' });
    toast(data.message, 'success');
    await refreshAll();
    renderUsers();
    renderOverview();
  });
}

/* ================================ ĐỀ THI ================================ */
function renderExams() {
  const host = document.getElementById('exams-list');
  if (cache.exams.length === 0) {
    host.innerHTML = `
      <div class="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <div class="text-4xl">📝</div>
        <p class="font-bold text-slate-700 mt-3">Chưa có đề thi nào</p>
        <p class="text-sm text-slate-400 mt-1">Nhấn “Ra đề thi mới” để tạo đề thi đầu tiên cho cuộc thi.</p>
      </div>`;
    return;
  }
  host.innerHTML = cache.exams.map((e) => `
    <article class="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
      <div class="flex items-start justify-between gap-2">
        <span class="bg-flag-50 text-flag-700 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded">${esc(e.category)}</span>
        <span class="text-[11px] text-slate-400">${fmtDate(e.createdAt)}</span>
      </div>
      <h3 class="font-bold text-slate-900 mt-3 leading-snug">${esc(e.title)}</h3>
      <p class="text-xs text-slate-500 mt-1.5 leading-relaxed flex-1">${esc(e.description || '—')}</p>
      <div class="mt-3 flex items-center gap-3 text-xs text-slate-400">
        <span>📝 ${e.questionCount} câu</span><span>⏱ ${e.durationMinutes} phút</span>
      </div>
      <button onclick="askDeleteExam('${esc(e.id)}', '${esc(e.title)}')" class="mt-4 text-xs font-semibold text-red-500 hover:text-red-700 text-left">Xóa đề thi</button>
    </article>`).join('');
}

/* ---------- Form ra đề mới: builder câu hỏi động ---------- */
let questionSeq = 0;

function questionRowHtml(n) {
  return `
    <div class="question-row border border-slate-200 rounded-2xl p-4 bg-slate-50/60" data-idx="${n}">
      <div class="flex items-center justify-between">
        <span class="text-xs font-extrabold uppercase tracking-wider text-flag-700 q-label">Câu hỏi ${n + 1}</span>
        <button type="button" onclick="removeQuestionRow(this)" class="text-xs font-semibold text-red-500 hover:text-red-700">Xóa câu</button>
      </div>
      <textarea class="field mt-2" rows="2" placeholder="Nội dung câu hỏi..." data-q="text"></textarea>
      <div class="mt-3 space-y-2" data-q="options">
        ${[0, 1, 2, 3].map((i) => `
          <div class="flex items-center gap-2">
            <input type="radio" name="correct-${n}" data-q="radio" value="${i}" title="Đánh dấu là đáp án đúng" class="accent-red-700 shrink-0" ${i === 0 ? '' : ''} />
            <input class="field !py-2" type="text" placeholder="Phương án ${String.fromCharCode(65 + i)}" data-q="opt" />
          </div>`).join('')}
      </div>
      <p class="text-[11px] text-slate-400 mt-2">Chọn nút tròn trước phương án <b>đúng</b>.</p>
    </div>`;
}

function addQuestionRow() {
  const host = document.getElementById('questions-builder');
  host.insertAdjacentHTML('beforeend', questionRowHtml(questionSeq));
  questionSeq += 1;
  renumberQuestions();
}

function removeQuestionRow(btn) {
  btn.closest('.question-row').remove();
  renumberQuestions();
}

function renumberQuestions() {
  document.querySelectorAll('.question-row .q-label').forEach((el, i) => {
    el.textContent = `Câu hỏi ${i + 1}`;
  });
}

function openExamForm() {
  document.getElementById('form-exam').reset();
  document.getElementById('questions-builder').innerHTML = '';
  questionSeq = 0;
  document.getElementById('me-error').classList.add('hidden');
  addQuestionRow();
  addQuestionRow();
  openModal('modal-exam');
}

document.getElementById('form-exam').addEventListener('submit', async (e) => {
  e.preventDefault();
  const rows = [...document.querySelectorAll('#questions-builder .question-row')];
  const questions = [];
  let firstError = null;
  rows.forEach((row, idx) => {
    const text = row.querySelector('[data-q="text"]').value.trim();
    const optInputs = [...row.querySelectorAll('[data-q="opt"]')];
    const radio = row.querySelector('[data-q="radio"]:checked');
    const options = optInputs.map((i) => i.value.trim());
    if (firstError) return;
    if (!text) { firstError = `Câu hỏi số ${idx + 1}: chưa nhập nội dung câu hỏi.`; return; }
    if (options.some((o) => !o)) { firstError = `Câu hỏi số ${idx + 1}: chưa nhập đủ 4 phương án trả lời.`; return; }
    if (!radio) { firstError = `Câu hỏi số ${idx + 1}: chưa đánh dấu phương án đúng.`; return; }
    questions.push({ text, options, correctIndex: parseInt(radio.value, 10) });
  });
  if (firstError || questions.length === 0) {
    const el = document.getElementById('me-error');
    el.textContent = firstError || 'Đề thi phải có ít nhất 1 câu hỏi hợp lệ.';
    el.classList.remove('hidden');
    return;
  }

  const body = {
    title: document.getElementById('me-title').value.trim(),
    category: document.getElementById('me-category').value.trim(),
    durationMinutes: parseInt(document.getElementById('me-duration').value, 10),
    description: document.getElementById('me-desc').value.trim(),
    questions,
  };
  try {
    const data = await api('/admin/exams', { method: 'POST', body });
    toast(data.message, 'success');
    closeModal('modal-exam');
    await refreshAll();
    renderExams();
    renderOverview();
    fillResultFilter();
  } catch (err) {
    const el = document.getElementById('me-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  }
});

function askDeleteExam(id, title) {
  askDelete(`Xóa đề thi "${title}"? Các kết quả thi của đề này vẫn được giữ trong bảng điểm.`, async () => {
    const data = await api(`/admin/exams/${id}`, { method: 'DELETE' });
    toast(data.message, 'success');
    await refreshAll();
    renderExams();
    renderOverview();
    fillResultFilter();
  });
}

/* ================================ BẢNG ĐIỂM ================================ */
function fillResultFilter() {
  const sel = document.getElementById('result-filter');
  const current = sel.value;
  const categories = [...new Set(cache.results.map((r) => r.category || r.examTitle))];
  sel.innerHTML = '<option value="">Tất cả hạng mục</option>' +
    categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (categories.includes(current)) sel.value = current;
}

function renderResults() {
  fillResultFilter();
  const filter = document.getElementById('result-filter').value;
  let list = cache.results.filter((r) => !filter || r.category === filter || r.examTitle === filter);

  const summary = document.getElementById('result-summary');
  if (list.length) {
    const avg = Math.round((list.reduce((s, r) => s + (Number(r.score) || 0), 0) / list.length) * 100) / 100;
    const max = Math.max(...list.map((r) => Number(r.score) || 0));
    summary.innerHTML = `Tổng số bài: <b>${list.length}</b> · Điểm trung bình: <b class="text-flag-600">${avg.toFixed(2)}</b> · Điểm cao nhất: <b class="text-emerald-600">${max.toFixed(2)}</b>`;
  } else {
    summary.textContent = '';
  }

  if (rankByScore) list = [...list].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

  const tbody = document.getElementById('results-tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-400 py-10">Chưa có bài thi nào trong hạng mục này.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((r, i) => {
    const user = cache.users.find((u) => u.cccd === r.cccd);
    const edited = r.editedAt ? `<span title="Đã chỉnh sửa bởi admin" class="ml-1">✎</span>` : '';
    return `
      <tr class="hover:bg-slate-50/70">
        <td class="px-5 py-3.5 text-slate-400 font-bold">${rankByScore ? (i + 1) : i + 1}</td>
        <td class="px-5 py-3.5 font-mono font-semibold text-slate-800">${esc(r.cccd)}${edited}
          <div class="text-[11px] text-slate-400 font-sans">${esc(user ? `${user.position} · ${user.unit}` : 'Tài khoản đã xóa')}</div>
        </td>
        <td class="px-5 py-3.5">
          <div class="text-slate-700 font-medium">${esc(r.category)}</div>
          <div class="text-xs text-slate-400">${esc(r.examTitle)}</div>
        </td>
        <td class="px-5 py-3.5">
          <span class="font-extrabold ${Number(r.score) >= 5 ? 'text-emerald-600' : 'text-red-500'} text-base">${Number(r.score).toFixed(2)}</span>
          <div class="text-[11px] text-slate-400">${r.correct}/${r.total} câu · ${fmtDuration(r.durationSeconds)}</div>
          ${r.note ? `<div class="text-[11px] text-amber-600 mt-0.5">Ghi chú: ${esc(r.note)}</div>` : ''}
        </td>
        <td class="px-5 py-3.5 text-xs text-slate-500">
          <div>Nộp: ${fmtDateTime(r.submittedAt)}</div>
          ${r.editedAt ? `<div class="text-amber-600">Sửa: ${fmtDateTime(r.editedAt)}</div>` : ''}
        </td>
        <td class="px-5 py-3.5 text-right whitespace-nowrap">
          <button onclick="openResultModal('${esc(r.id)}')" class="text-flag-600 hover:text-flag-800 font-semibold text-xs px-2 py-1.5">Sửa</button>
          <button onclick="askDeleteResult('${esc(r.id)}')" class="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1.5">Xóa</button>
        </td>
      </tr>`;
  }).join('');
}

document.getElementById('result-filter').addEventListener('change', renderResults);
document.getElementById('btn-rank').addEventListener('click', () => {
  rankByScore = !rankByScore;
  document.getElementById('btn-rank').textContent = rankByScore ? 'Xếp theo thời gian ↓' : 'Xếp theo điểm ↓';
  renderResults();
});

function openResultModal(id) {
  const r = cache.results.find((x) => x.id === id);
  if (!r) return;
  editingResultId = id;
  document.getElementById('mr-info').innerHTML =
    `Thí sinh: <b>${esc(r.cccd)}</b><br />Bài thi: <b>${esc(r.examTitle)}</b> (${esc(r.category)})<br />` +
    `Nộp lúc: ${fmtDateTime(r.submittedAt)} · Thời lượng: ${fmtDuration(r.durationSeconds)}`;
  document.getElementById('mr-total').textContent = r.total;
  document.getElementById('mr-correct').value = r.correct;
  document.getElementById('mr-score').value = r.score;
  document.getElementById('mr-note').value = r.note || '';
  document.getElementById('mr-error').classList.add('hidden');
  openModal('modal-result');
}

document.getElementById('form-result').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    correct: parseInt(document.getElementById('mr-correct').value, 10),
    score: parseFloat(document.getElementById('mr-score').value),
    note: document.getElementById('mr-note').value.trim(),
  };
  try {
    const data = await api(`/admin/results/${editingResultId}`, { method: 'PUT', body });
    toast(data.message, 'success');
    closeModal('modal-result');
    await refreshAll();
    renderResults();
    renderOverview();
  } catch (err) {
    const el = document.getElementById('mr-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  }
});

function askDeleteResult(id) {
  askDelete('Xóa vĩnh viễn kết quả bài làm này khỏi hệ thống?', async () => {
    const data = await api(`/admin/results/${id}`, { method: 'DELETE' });
    toast(data.message, 'success');
    await refreshAll();
    renderResults();
    renderOverview();
  });
}

/* ================================ XÓA CHUNG ================================ */
function askDelete(detail, run) {
  deleteAction = run;
  document.getElementById('delete-detail').textContent = detail;
  openModal('modal-delete');
}
document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
  if (!deleteAction) return;
  try {
    await deleteAction();
  } catch (err) {
    toast(err.message, 'error');
  }
  deleteAction = null;
  closeModal('modal-delete');
});

/* ================================ KHỞI ĐỘNG ================================ */
(async function main() {
  await refreshAll();
  fillResultFilter();
  switchSection('overview');
})();
