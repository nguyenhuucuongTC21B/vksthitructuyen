/**
 * common.js — Tiện ích dùng chung 4 trang: gọi API, quản lý phiên đăng nhập,
 * thông báo toast, định dạng dữ liệu, escape HTML.
 */
'use strict';

const TOKEN_KEY = 'exam_token';
const USER_KEY = 'exam_user';

/* ------------------------------- PHIÊN ĐĂNG NHẬP ------------------------------- */
const Auth = {
  token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isAdmin() { return this.user() && this.user().role === 'admin'; },
  /** Chặn truy cập trang khi chưa đăng nhập (hoặc không đủ quyền admin). */
  guard({ admin = false } = {}) {
    if (!this.token() || !this.user()) {
      location.href = '/login.html';
      return false;
    }
    if (admin && !this.isAdmin()) {
      alert('Chỉ quản trị viên mới được truy cập trang này.');
      location.href = '/';
      return false;
    }
    return true;
  },
};

/* ---------------------------------- GỌI API ---------------------------------- */
async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = Auth.token();
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Không kết nối được máy chủ. Vui lòng kiểm tra mạng.');
  }

  let data = null;
  try { data = await res.json(); } catch { /* phản hồi rỗng */ }

  if (!res.ok) {
    // Hết phiên → dọn localStorage và quay về trang đăng nhập.
    if (res.status === 401 && auth && !location.pathname.includes('login.html')) {
      Auth.logout();
      location.href = '/login.html';
    }
    const err = new Error((data && data.message) || `Lỗi máy chủ (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* --------------------------------- TIỆN VĂN BẢN --------------------------------- */

/** Escape HTML chống XSS khi nội nhúng dữ liệu người dùng vào template string. */
function esc(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** Che bớt CCCD hiển thị: 012345678901 → 0123•••••901 */
function maskCccd(cccd) {
  const s = String(cccd || '');
  return s.length >= 8 ? s.slice(0, 4) + '••••••' + s.slice(-3) : s;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Giây → "12 phút 05 giây" */
function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  return `${m} phút ${String(s % 60).padStart(2, '0')} giây`;
}

/** mm:ss cho đồng hồ đếm ngược */
function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ------------------------- GIỜ THI QUY ĐỊNH (giờ VN) ------------------------- */
const VN_TZ = 'Asia/Ho_Chi_Minh';

/** ISO → "14:00 ngày 15/10/2026" theo Giờ Việt Nam (hiển thị cho mọi thí sinh). */
function fmtVn(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: VN_TZ });
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: VN_TZ });
  return `${time} ngày ${date}`;
}

/** ISO → giá trị cho <input type="datetime-local"> theo Giờ Việt Nam ("2026-10-15T14:00"). */
function isoToVnLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: VN_TZ,
  }).formatToParts(d);
  const get = (t) => (p.find((x) => x.type === t) || {}).value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Giá trị datetime-local ("2026-10-15T14:00") → ISO UTC.
 * Quy ước: ô nhập KHÔNG kèm múi giờ nên hiểu là Giờ Việt Nam GMT+7 —
 * Ban Tổ chức ở bất kỳ đâu đặt "14:00" thì thí sinh Việt Nam cũng thi đúng 14:00.
 */
function vnLocalToIso(value) {
  if (!value) return null;
  let v = String(value).trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v += ':00';
  const ms = Date.parse(v.endsWith('Z') ? v : v + '+07:00');
  return isNaN(ms) ? undefined : new Date(ms).toISOString();
}

/* ------------------------------------ TOAST ------------------------------------ */
function toast(message, type = 'success') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'fixed bottom-5 right-5 z-[100] flex flex-col gap-2';
    document.body.appendChild(host);
  }
  const palette = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-slate-800',
  }[type] || 'bg-slate-800';
  const el = document.createElement('div');
  el.className = `${palette} text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-xs opacity-0 translate-y-2 transition-all duration-300`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.remove('opacity-0', 'translate-y-2'));
  setTimeout(() => {
    el.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => el.remove(), 320);
  }, 3400);
}

/* ------------------------------------ MODAL ------------------------------------ */
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('hidden'); document.body.style.overflow = ''; }
}

/** Đăng xuất về trang chủ. */
function doLogout() {
  Auth.logout();
  location.href = '/';
}
