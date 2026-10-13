/**
 * examWindow.js — "Giờ thi quy định" cho từng đề thi.
 *
 * Mỗi đề có thể khai báo 2 mốc giờ (ISO 8601, lưu UTC):
 *   openAt  — mở cửa thi từ thời điểm này thí sinh mới được VÀO BÀI.
 *   closeAt — đến thời điểm này thì ĐÓNG CỬA, không nhận thí sinh mới.
 *
 * Trạng thái cửa thi (tính tại thời điểm gọi):
 *   unscheduled — không đặt giờ → mở cửa vĩnh viễn (thi mọi lúc).
 *   scheduled   — chưa tới giờ mở cửa (thí sinh bấm "Vào thi" sẽ bị từ chối).
 *   open        — đang trong khung giờ thi (bình thường).
 *   closed      — đã quá giờ đóng cửa (không nhận thí sinh mới).
 *
 * Quy ước khi đề chỉ đặt MỘT trong hai mốc:
 *   chỉ có openAt  → trước openAt là "scheduled", sau đó là "open" mãi.
 *   chỉ có closeAt → trước closeAt là "open", sau đó là "closed".
 *
 * Lưu ý múi giờ: server (Render) chạy UTC nên toàn bộ so sánh dùng Date UTC.
 * Hiển thị cho người dùng luôn quy đổi về Giờ Việt Nam (GMT+7).
 */
'use strict';

const VN_TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Chuỗi ngày-giờ người dùng nhập ("2026-10-15T14:00" hoặc ISO đầy đủ) → ISO UTC hoặc null. */
function toIsoOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  let s = String(value).trim();
  if (!s) return null;
  // datetime-local không kèm múi giờ → hiểu là GIỜ VIỆT NAM (GMT+7).
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + ':00+07:00';
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + '+07:00';
  }
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return undefined; // undefined = chuỗi sai định dạng.
  return new Date(ms).toISOString();
}

/**
 * Tính trạng thái cửa thi của một đề tại thời điểm `nowMs`.
 * Trả về { status, openAt, closeAt, minutesUntilOpen, minutesUntilClose }.
 */
function statusOf(exam, nowMs = Date.now()) {
  const openAt = exam && exam.openAt ? exam.openAt : null;
  const closeAt = exam && exam.closeAt ? exam.closeAt : null;
  const openMs = openAt ? Date.parse(openAt) : null;
  const closeMs = closeAt ? Date.parse(closeAt) : null;

  if (!openAt && !closeAt) {
    return { status: 'unscheduled', openAt: null, closeAt: null, minutesUntilOpen: null, minutesUntilClose: null };
  }

  let status = 'open';
  if (openMs !== null && nowMs < openMs) status = 'scheduled';
  if (closeMs !== null && nowMs >= closeMs) status = 'closed';

  return {
    status,
    openAt,
    closeAt,
    minutesUntilOpen:
      openMs !== null && nowMs < openMs ? Math.ceil((openMs - nowMs) / 60000) : null,
    minutesUntilClose:
      closeMs !== null && nowMs < closeMs ? Math.ceil((closeMs - nowMs) / 60000) : null,
  };
}

/** Thông báo từ chối khi thí sinh vào bài ngoài giờ (kèm giờ VN cụ thể). */
function gateMessage(win, examTitle = '') {
  const prefix = examTitle ? `Đề thi "${examTitle}": ` : '';
  if (win.status === 'scheduled') {
    return (
      `${prefix}Cuộc thi CHƯA mở cửa. Giờ thi được quy định từ ${fmtVn(win.openAt)} (giờ VN). ` +
      `Vui lòng quay lại đúng giờ (còn khoảng ${win.minutesUntilOpen} phút nữa).`
    );
  }
  if (win.status === 'closed') {
    return (
      `${prefix}Cuộc thi ĐÃ ĐÓNG CỬA từ ${fmtVn(win.closeAt)} (giờ VN). ` +
      'Hệ thống không nhận thêm thí sinh vào bài. Vui lòng liên hệ Ban Tổ chức nếu bạn cho rằng đây là nhầm lẫn.'
    );
  }
  return null;
}

/**
 * Định dạng một mốc giờ ISO theo Giờ Việt Nam: "14:00 ngày 15/10/2026".
 * Dùng chung cho thông báo server + hiển thị client (client cũng có bản riêng
 * trong common.js để không phải gọi API).
 */
function fmtVn(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: VN_TZ,
  }).format(d);
  const date = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: VN_TZ,
  }).format(d);
  return `${time} ngày ${date}`;
}

/** ISO UTC → giá trị cho <input type="datetime-local"> theo giờ Việt Nam. */
function isoToVnInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: VN_TZ,
  }).formatToParts(d);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

module.exports = { VN_TZ, VN_OFFSET_MS, toIsoOrNull, statusOf, gateMessage, fmtVn, isoToVnInput };
