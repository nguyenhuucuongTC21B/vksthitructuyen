/**
 * auth.js — Xử lý form Đăng nhập / Đăng ký (kiểm tra dữ liệu trước khi gửi API).
 * Sau khi thành công: lưu token & redirect theo quyền (Admin → dashboard).
 */
'use strict';

/* ------------------------------- Chuyển tab ------------------------------- */
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('form-register').classList.toggle('hidden', isLogin);
  document.getElementById('tab-login').className = `flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
    isLogin ? 'bg-white text-flag-700 shadow' : 'text-slate-500'
  }`;
  document.getElementById('tab-register').className = `flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
    isLogin ? 'text-slate-500' : 'bg-white text-flag-700 shadow'
  }`;
  const errLogin = document.getElementById('li-error');
  const errReg = document.getElementById('rg-error');
  errLogin.classList.add('hidden');
  errReg.classList.add('hidden');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setBusy(btnId, busy, busyText, normalText) {
  const btn = document.getElementById(btnId);
  btn.disabled = busy;
  btn.textContent = busy ? busyText : normalText;
}

/** Điều hướng sau khi đăng nhập thành công. */
function goAfterAuth(user) {
  location.href = user.role === 'admin' ? '/admin.html' : '/quiz.html';
}

/* --------------------------------- Đăng nhập --------------------------------- */
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cccd = document.getElementById('li-cccd').value.trim();
  const password = document.getElementById('li-password').value;

  if (!/^\d{12}$/.test(cccd)) return showError('li-error', 'Số CCCD phải gồm đúng 12 chữ số.');
  if (!password) return showError('li-error', 'Vui lòng nhập mật khẩu.');

  setBusy('li-submit', true, 'Đang xác thực...', '★ Đăng nhập');
  try {
    const data = await api('/auth/login', { method: 'POST', body: { cccd, password }, auth: false });
    Auth.save(data.token, data.user);
    toast(data.message, 'success');
    goAfterAuth(data.user);
  } catch (err) {
    showError('li-error', err.message);
    setBusy('li-submit', false, '', '★ Đăng nhập');
  }
});

/* ---------------------------------- Đăng ký ---------------------------------- */
document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    cccd: document.getElementById('rg-cccd').value.trim(),
    phone: document.getElementById('rg-phone').value.trim(),
    email: document.getElementById('rg-email').value.trim(),
    position: document.getElementById('rg-position').value.trim(),
    unit: document.getElementById('rg-unit').value.trim(),
    password: document.getElementById('rg-password').value,
  };
  const confirm = document.getElementById('rg-confirm').value;
  const agree = document.getElementById('rg-agree').checked;

  // Kiểm tra bắt buộc nhập đủ toàn bộ trường thông tin.
  const requiredFields = [
    ['rg-cccd', 'Số CCCD'], ['rg-phone', 'Số điện thoại'], ['rg-email', 'Email'],
    ['rg-position', 'Chức vụ'], ['rg-unit', 'Đơn vị công tác'], ['rg-password', 'Mật khẩu'],
  ];
  for (const [id, label] of requiredFields) {
    if (!document.getElementById(id).value.trim()) {
      return showError('rg-error', `Vui lòng nhập đủ thông tin bắt buộc: ${label}.`);
    }
  }
  if (!/^\d{12}$/.test(payload.cccd)) return showError('rg-error', 'Số CCCD phải gồm đúng 12 chữ số.');
  if (!/^0\d{9}$/.test(payload.phone)) return showError('rg-error', 'Số điện thoại gồm 10 số và bắt đầu bằng 0 (VD: 0912345678).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) return showError('rg-error', 'Địa chỉ email không hợp lệ.');
  if (payload.password.length < 6) return showError('rg-error', 'Mật khẩu phải có ít nhất 6 ký tự.');
  if (payload.password !== confirm) return showError('rg-error', 'Mật khẩu nhập lại không khớp.');
  if (!agree) return showError('rg-error', 'Vui lòng cam kết tuân theo thể lệ trước khi đăng ký.');

  setBusy('rg-submit', true, 'Đang tạo tài khoản...', '★ Đăng ký tham gia');
  try {
    const data = await api('/auth/register', { method: 'POST', body: payload, auth: false });
    Auth.save(data.token, data.user);
    toast(data.message, 'success');
    goAfterAuth(data.user);
  } catch (err) {
    showError('rg-error', err.message);
    setBusy('rg-submit', false, '', '★ Đăng ký tham gia');
  }
});

/* Nếu đã đăng nhập rồi thì đưa thẳng vào hệ thống. */
if (Auth.token() && Auth.user()) goAfterAuth(Auth.user());
