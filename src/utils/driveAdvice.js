/**
 * driveAdvice.js — Bản đồ lỗi Google Drive -> gợi ý sửa lỗi tiếng Việt.
 *
 * Dùng chung cho:
 *  - API tự chẩn đoán POST /api/admin/drive-check (admin dashboard).
 *  - Tool dòng lệnh tools/check-drive.js (kiểm tra khi chạy local).
 *
 * Nguyên tắc: mỗi lỗi phổ biến của Google phải trả về lời khuyên CỤ THỂ,
 * cho biết đúng nút bấm / đúng biến cần sửa — không câu chữ chung chung.
 */
'use strict';

/**
 * Nhận diện lỗi "Service Account không có dung lượng riêng" — KHÔNG tự tạo
 * được file MỚI trên Drive (giới hạn của Google), nhưng vẫn CẬP NHẬT được
 * file có sẵn (mô hình vận hành của hệ thống: 3 file users/exams/results.json
 * được tạo sẵn trong thư mục).
 */
function isQuotaError(err) {
  const reason = (err && err.errors && err.errors[0] && err.errors[0].reason) || '';
  const msg = `${(err && err.message) || ''} ${reason}`.toLowerCase();
  return (
    msg.includes('storagequotaexceeded') ||
    msg.includes('do not have storage quota') ||
    msg.includes('storage quota') ||
    msg.includes('disk quota')
  );
}

/**
 * Phân tích lỗi Google API và trả về chuỗi gợi ý sửa lỗi tiếng Việt.
 * @param {Error} err Lỗi bắt được từ googleapis.
 * @returns {string|null} Gợi ý sửa lỗi, hoặc null nếu chưa nhận diện được.
 */
function adviceForError(err) {
  const reason = (err && err.errors && err.errors[0] && err.errors[0].reason) || '';
  const detail = (err && err.errors && err.errors[0] && err.errors[0].message) || '';
  const msg = `${(err && err.message) || ''} ${reason} ${detail}`.toLowerCase();

  if (
    msg.includes('service_disabled') ||
    msg.includes('has not been used') ||
    msg.includes('is disabled')
  ) {
    return 'Google Drive API CHƯA ĐƯỢC BẬT cho project chứa Service Account. ' +
      'Sửa: Google Cloud Console → APIs & Services → Library → tìm "Google Drive API" → nút Enable. ' +
      'Chờ 1–2 phút rồi bấm "Kiểm tra Drive ngay" lần nữa.';
  }
  if (Number(err && err.code) === 404 || msg.includes('file not found') || msg.includes('notfound')) {
    return 'KHÔNG TÌM THẤY THƯ MỤC trên Drive. GOOGLE_DRIVE_FOLDER_ID sai (copy dư URL, dư khoảng trắng, ' +
      'hoặc thư mục đã bị xóa). Mở thư mục trên drive.google.com, copy ĐOẠN SAU /folders/ trên thanh địa chỉ ' +
      '(ví dụ URL .../folders/1AbC-xYz thì Folder ID là 1AbC-xYz), sửa biến trên Render rồi Manual Deploy.';
  }
  if (Number(err && err.code) === 403 && (msg.includes('permission') || msg.includes('insufficient'))) {
    return 'BỊ TỪ CHỐI QUYỀN — thư mục chưa được Share cho Service Account (hoặc chỉ share quyền Viewer). ' +
      'Sửa: mở thư mục trên Drive → nút Share → dán đúng email Service Account (client_email) → ' +
      'đổi quyền thành EDITOR → Send. Nếu dùng tài khoản tổ chức bị chặn chia sẻ, hãy tạo thư mục bằng @gmail.com cá nhân.';
  }
  if (isQuotaError(err)) {
    return 'LỖI DUNG LƯỢNG: Service Account KHÔNG có dung lượng riêng nên không tự tạo được file MỚI (giới hạn của Google). ' +
      'Hệ thống vẫn chạy tốt nếu trong thư mục Drive đã có sẵn 3 file THUẦN đúng tên: users.json, exams.json, results.json ' +
      '(tạo bằng cách UPLOAD file .json từ máy tính — KHÔNG dùng "Google Docs"; nội dung mỗi file chỉ cần []). ' +
      'Nếu đã tạo rồi: kiểm tra đúng chính tả tên file (chữ thường, có đuôi .json) rồi bấm "Kiểm tra lại" — mức 4 sẽ tự chuyển sang kiểm tra cập nhật file có sẵn.';
  }
  if (msg.includes('err_ossl') || msg.includes('decoder routines') || msg.includes('pem_read') || msg.includes('no start line') || msg.includes('bad decrypt')) {
    return 'PRIVATE_KEY KHÔNG ĐỌC ĐƯỢC: chuỗi key bị hỏng khi copy/encode Base64 (thiếu đầu/cuối, đứt dòng, dán thiếu). ' +
      'Tạo lại cấu hình: node tools/check-drive.js "đường-dẫn-file-key.json" rồi copy TRỌN VẸN giá trị GOOGLE_SERVICE_ACCOUNT_JSON mới vào Render (| Set-Clipboard trên Windows, | pbcopy trên macOS).';
  }
  if (msg.includes('invalid_grant') || msg.includes('invalid_client') || msg.includes('jwt') || msg.includes('malformed')) {
    return 'KEY SERVICE ACCOUNT KHÔNG HỢP LỆ / BỊ LỖI COPY. Chuỗi Base64 có thể bị thiếu, đứt dòng hoặc dán nhầm. ' +
      'Tạo lại key (README mục 3, Bước 4–7) rồi chạy: node tools/check-drive.js "đường-dẫn-file-key.json" ' +
      'để sinh lại GOOGLE_SERVICE_ACCOUNT_JSON, cập nhật biến trên Render và Manual Deploy.';
  }
  if (Number(err && err.code) === 401) {
    return 'LỖI 401 XÁC THỰC: GOOGLE_SERVICE_ACCOUNT_JSON không khớp với project đã bật Drive API. ' +
      'Kiểm tra lại chuỗi Base64 / file key có đúng project không, rồi cập nhật lại biến môi trường.';
  }
  if (msg.includes('enotfound') || msg.includes('etimedout') || msg.includes('econnrefused') || msg.includes('fetch failed')) {
    return 'LỖI MẠNG: server không kết nối được tới Google. Nếu lỗi lặp lại liên tục, kiểm tra network của dịch vụ Render (thường tự hồi phục sau ít phút).';
  }
  return null;
}

/** Ghép lỗi + gợi ý thành 1 chuỗi thông điệp hoàn chỉnh cho UI. */
function describeError(err) {
  const base = (err && err.message) || 'Lỗi không xác định';
  const tip = adviceForError(err);
  return tip ? `${base} → ${tip}` : base;
}

module.exports = { adviceForError, describeError, isQuotaError };
