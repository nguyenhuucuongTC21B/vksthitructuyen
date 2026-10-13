/**
 * sampleExams.js — BỘ ĐỀ MẪU do Ban Tổ chức chuẩn bị sẵn.
 *
 * Nguồn: file "Bộ đề thi số 1 / số 2 — Đánh giá năng lực An toàn thông tin"
 * (mỗi đề 50 câu trắc nghiệm, 35 phút, cấu trúc 17 Nhận biết | 23 Thông hiểu
 * & Áp dụng | 10 Vận dụng nâng cao) và "Bộ đề thi số 3 — Chuyển đổi số &
 * Kỹ năng số" (81 câu: 75 trắc nghiệm + 6 tự luận ngắn, 60 phút). Đáp án
 * đúng đã được đối chiếu NGHIÊM NGẪT với chính mã nguồn hệ thống (TTL token
 * 12 giờ, debounce 1.2s, scrypt + salt, user đầu tiên nhận quyền Admin,
 * rate-limit 6 lần/15 phút...). Vị trí phương án đúng đã được CÂN BẰNG TỰ ĐỘNG
 * (A/B/C/D đều nhau) — nội dung phương án đúng được giữ nguyên, chỉ xoay vị trí.
 *
 * Cách dùng:
 *  - dataStore.init(): exams rỗng hoàn toàn → tự nạp cả 3 đề (lần chạy đầu).
 *  - POST /admin/seed-sample-exams: nạp lại những đề còn THIẾU (so theo tên).
 *  - tools/seed-exams.js: nạp thủ công từ máy local.
 *
 * Múi giờ lịch thi: đề số 2 được đặt lịch minh họa "giờ thi quy định" — mở
 * cửa 08:00 giờ VN ngày mai, đóng cửa 23:59 giờ VN sau 7 ngày.
 */
'use strict';

const { toIsoOrNull } = require('../utils/examWindow');

/** Tiện ích khai báo câu hỏi gọn: q(nội dung, [4 phương án], chỉ số đáp án đúng). */
const q = (text, options, correctIndex) => ({ text, options, correctIndex });

const SET1_TITLE = 'Bộ đề thi số 1: Đánh giá năng lực An toàn thông tin';
const SET2_TITLE = 'Bộ đề thi số 2: Đánh giá năng lực An toàn thông tin';
const SET3_TITLE = 'Bộ đề thi số 3: Chuyển đổi số & Kỹ năng số';
const CATEGORY = 'An toàn thông tin';
const SET3_CATEGORY = 'Chuyển đổi số';
const DURATION = 35;
const DURATION3 = 60; // Đề 3 có 81 câu (gồm 6 tự luận) → 60 phút là hợp lý.
const SET_DESC =
  '50 câu trắc nghiệm ATTT: 17 câu Nhận biết (ATTT cơ bản & phòng chống lừa đảo), ' +
  '23 câu Thông hiểu & Áp dụng (công cụ & giám sát), 10 câu Vận dụng nâng cao ' +
  '(phân tích lỗ hổng website & Natas). Thời gian làm bài: 35 phút.';
const SET3_DESC =
  '81 câu (75 trắc nghiệm + 6 câu tự luận ngắn): 17 câu Nhận biết (Chuyển đổi số ' +
  'cơ bản), 52 câu Thông hiểu & Áp dụng (kỹ năng số thiết yếu — VNeID, thanh toán ' +
  'số, phòng chống lừa đảo, gồm 3 câu tự luận), 12 câu Vận dụng (tình huống thực tế ' +
  'và phân tích lỗ hổng website, gồm 3 câu tự luận). Thời gian làm bài: 60 phút.';

/* ==================== BỘ ĐỀ SỐ 1 — 50 CÂU ==================== */
const SET1_QUESTIONS = [
  // ---- MỤC A: NHẬN BIẾT — ATTT CƠ BẢN & PHÒNG CHỐNG LỪA ĐẢO (Câu 1–17) ----
  q('Quy tắc sao lưu dữ liệu "3-2-1" yêu cầu điều kiện nào sau đây?', [
    '3 bản sao, 2 người quản lý, 1 mật khẩu.',
    '3 thiết bị giống nhau, 2 tuần cập nhật 1 lần, 1 bản lưu Cloud.',
    '3 file nén, 2 ổ cứng di động, 1 mã khóa AES.',
    'Ít nhất 3 bản sao, lưu trên 2 loại phương tiện khác nhau, 1 bản lưu ở vị trí độc lập bên ngoài.',
  ], 3),
  q('Hình thức lừa đảo gửi email/tin nhắn giả mạo cơ quan chức năng để lừa người dùng cung cấp số Căn cước công dân (CCCD) và mã OTP được gọi là gì?', [
    'Phishing (Tấn công giả mạo).',
    'Malware.',
    'DDoS.',
    'Brute Force.',
  ], 0),
  q('Thành phần nào sau đây của mật khẩu quyết định độ an toàn cao nhất chống lại các cuộc tấn công dò quét tự động?', [
    'Chỉ chứa thông tin ngày sinh và tên viết tắt.',
    'Độ dài tối thiểu từ 8-12 ký tự, kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt.',
    'Chứa toàn bộ là các ký tự số viết liền nhau.',
    'Là một từ tiếng Anh có ý nghĩa rõ ràng trong từ điển.',
  ], 1),
  q('Khi truy cập mạng WiFi công cộng không có mật khẩu bảo vệ, hành vi nào sau đây được khuyến cáo để bảo vệ dữ liệu?', [
    'Tải và cài đặt các phần mềm bẻ khóa (Crack).',
    'Thực hiện giao dịch chuyển tiền ngân hàng trực tuyến.',
    'Bật tính năng tự động chia sẻ thư mục lưu trữ.',
    'Sử dụng mạng riêng ảo (VPN) bảo mật để mã hóa lưu lượng mạng.',
  ], 3),
  q('Giao thức nào đảm bảo lưu lượng truy cập giữa bạn và website được mã hóa an toàn, nhận biết bằng ký hiệu ổ khóa 🔒 trên thanh địa chỉ?', [
    'HTTP.',
    'FTP.',
    'HTTPS.',
    'SMTP.',
  ], 2),
  q('Mã độc giả mạo phần mềm mã nguồn mở "OpenClaw" được phát tán nhằm mục đích nguy hiểm nào?', [
    'Hỗ trợ dọn rác hệ thống máy tính.',
    'Đánh cắp thông tin ví tiền điện tử và trình quản lý mật khẩu người dùng.',
    'Quét các lỗi cấu hình bảo mật ứng dụng web.',
    'Tăng tốc độ đường truyền internet nội bộ.',
  ], 1),
  q('Để bảo vệ tài khoản mạng xã hội không bị chiếm đoạt khi lộ mật khẩu, giải pháp tốt nhất là gì?', [
    'Đổi ảnh đại diện định kỳ.',
    'Ẩn số điện thoại hiển thị công khai.',
    'Sử dụng tính năng lưu mật khẩu tự động của trình duyệt.',
    'Bật xác thực 2 lớp / 2 thành tố (2FA / MFA).',
  ], 3),
  q('Dấu hiệu nào cảnh báo máy tính của bạn đã bị nhiễm mã độc hoặc bị hacker điều khiển từ xa?', [
    'Quạt tản nhiệt của máy tính chạy hơi ồn khi xử lý đồ họa.',
    'Thời gian khởi động của hệ điều hành tăng thêm 3 giây.',
    'Độ sáng màn hình tự động giảm khi rút dây sạc pin.',
    'Chuột tự di chuyển tự động bấm nút, các cửa sổ lệnh tự bật/tắt liên tục, tài khoản tự gửi link rác.',
  ], 3),
  q('Khi đăng ký tài khoản trên các trang web, việc sử dụng cùng một mật khẩu cho tất cả các dịch vụ (Email, Facebook, Ngân hàng, Portal công việc) dẫn đến rủi ro gì?', [
    'Làm giảm tốc độ đường truyền mạng khi truy cập.',
    'Tài khoản sẽ bị hệ thống tự động khóa do vi phạm chính sách.',
    'Hiệu ứng domino: nếu lộ mật khẩu ở 1 trang web yếu, hacker sẽ chiếm toàn bộ các tài khoản còn lại.',
    'Không thể kích hoạt được tính năng xác thực 2 lớp.',
  ], 2),
  q('Mã độc mã hóa tống tiền (Ransomware) thực hiện hành vi phá hoại nào nguy hiểm nhất trên thiết bị nạn nhân?', [
    'Tự động gửi email rác đến toàn bộ danh bạ.',
    'Làm hỏng phần cứng ổ cứng của máy tính vĩnh viễn.',
    'Mã hóa toàn bộ các file tài liệu quan trọng và đòi tiền chuộc để giải mã.',
    'Thay đổi hình nền màn hình máy tính của bạn.',
  ], 2),
  q('Trong các loại thông tin sau, thông tin nào tuyệt đối KHÔNG được chia sẻ công khai lên mạng xã hội để tránh bị tội phạm lợi dụng làm giả danh tính?', [
    'Hình ảnh phong cảnh nơi bạn đi du lịch.',
    'Ảnh chụp rõ nét hai mặt của Căn cước công dân (CCCD) hoặc Hộ chiếu.',
    'Tiêu đề một bài báo khoa học bạn vừa đọc.',
    'Lịch thi đấu thể thao của cơ quan.',
  ], 1),
  q('Khi lướt web, làm thế nào để nhận biết một website có nguy cơ cao là giả mạo (Phishing page)?', [
    'Giao diện trang web có màu sắc khác với bình thường.',
    'Tên miền (Domain) trên thanh địa chỉ bị viết sai chính tả, sai đuôi mở rộng (ví dụ: vksnddanang.com đổi thành vksdanang-fake.net).',
    'Trang web hiển thị quá nhiều hình ảnh quảng cáo động.',
    'Trang web không có thanh tìm kiếm thông tin bài viết.',
  ], 1),
  q('Chức năng chính của phần mềm quản lý mật khẩu (Password Manager) là gì?', [
    'Lưu trữ mã hóa an toàn và tự động đồng bộ tất cả mật khẩu phức tạp của bạn.',
    'Tự động chia sẻ mật khẩu của bạn cho đồng nghiệp khi cần.',
    'Tự động bẻ khóa mật khẩu WiFi của các khu vực xung quanh.',
    'Quét và loại bỏ mã độc nằm trong các file đính kèm email.',
  ], 0),
  q('Khi bạn nhận được cuộc gọi từ số lạ tự xưng là cán bộ Công an hoặc Viện kiểm sát báo bạn đang liên quan đến vụ án mạng và yêu cầu chuyển tiền vào tài khoản để điều tra, bạn nên làm gì?', [
    'Làm theo hướng dẫn, ra ngân hàng rút tiền chuyển ngay để chứng minh vô tội.',
    'Tuyệt đối không chuyển tiền, không cung cấp thông tin cá nhân, tắt máy và báo ngay cho cơ quan Công an nơi gần nhất.',
    'Chia sẻ thông tin tài khoản ngân hàng của mình cho người gọi để họ tự kiểm tra.',
    'Rủ thêm bạn bè cùng chuyển tiền để cùng xác minh dữ liệu.',
  ], 1),
  q('Việc cập nhật hệ điều hành (Windows/macOS) và phần mềm thường xuyên có ý nghĩa gì trong an toàn thông tin?', [
    'Vá các lỗ hổng bảo mật cố hữu mà hacker có thể lợi dụng để xâm nhập máy tính.',
    'Chỉ để làm thay đổi giao diện sử dụng cho đẹp hơn.',
    'Làm tăng dung lượng lưu trữ trống của ổ đĩa cứng.',
    'Xóa bỏ toàn bộ các file tài liệu cũ mà bạn không dùng đến.',
  ], 0),
  q('Tấn công "Social Engineering" (Thao túng tâm lý con người) nhắm vào yếu tố nào trong hệ thống an ninh mạng?', [
    'Lỗ hổng trong mã nguồn của hệ quản trị cơ sở dữ liệu.',
    'Lỗi cấu hình các thiết bị phần cứng tường lửa.',
    'Điểm yếu trong nhận thức, sự lơ là hoặc lòng tin của con người.',
    'Sự thiếu sót của các chứng chỉ bảo mật SSL/TLS.',
  ], 2),
  q('Thuật ngữ "Chế độ cục bộ" (Local mode) của ứng dụng thi trực tuyến khi không cấu hình biến Google được hiểu là gì?', [
    'Ứng dụng sẽ bị lỗi và không thể khởi động được.',
    'Ứng dụng chỉ cho phép các máy tính trong cùng phòng truy cập.',
    'Hệ thống tự động chuyển sang giao diện quản trị Admin.',
    'Dữ liệu được lưu tạm thời vào các file JSON trong thư mục ./data/ trên ổ cứng của server thay vì đồng bộ lên Google Drive.',
  ], 3),
  // ---- MỤC B: THÔNG HIỂU & ÁP DỤNG — CÔNG CỤ & GIÁM SÁT (Câu 18–40) ----
  q('Khi phân tích nhật ký truy cập tại BlueTeam Dashboard, bạn thấy một IP liên tục gửi yêu cầu đăng nhập sai 6 lần trong vòng 15 phút với nhiều mật khẩu khác nhau. Cơ chế nào của mã nguồn hệ thống sẽ tự động kích hoạt để ngăn chặn?', [
    'Cơ chế Rate-limit (Giới hạn tần suất yêu cầu) để chống dò mật khẩu.',
    'Cơ chế mã hóa file dữ liệu phẳng bằng thuật toán AES.',
    'Cơ chế khóa luồng dữ liệu bằng vòng lặp hằng số.',
    'Tự động xóa tài khoản người dùng đang bị dò quét.',
  ], 0),
  q('Vai trò chủ đạo của Đội Tấn công (Red Team) trong các buổi diễn tập An toàn thông tin là gì?', [
    'Xây dựng hệ thống tường lửa để bảo vệ dữ liệu.',
    'Cài đặt hệ điều hành và cấu hình mạng nội bộ cho cơ quan.',
    'Giám sát các log ghi nhận hành vi đăng nhập trái phép của người dùng.',
    'Đóng vai kẻ tấn công, sử dụng các công cụ và kỹ thuật bẻ khóa để tìm ra các lỗ hổng bảo mật của hệ thống.',
  ], 3),
  q('Khi sử dụng lệnh nmap -p 80,443 vksdanang.22web.org, kỹ sư mạng đang thực hiện hành vi gì?', [
    'Tải toàn bộ mã nguồn của trang web về máy tính cá nhân.',
    'Kiểm tra xem các cổng mạng dịch vụ web (80 cho HTTP, 443 cho HTTPS) của máy chủ có đang mở không.',
    'Tấn công từ chối dịch vụ làm sập máy chủ web.',
    'Dò tìm mật khẩu tài khoản quản trị Admin của hệ thống.',
  ], 1),
  q('Ứng dụng bảo mật Burp Suite được định nghĩa chính xác là công cụ thuộc loại nào?', [
    'Trình quét virus và mã độc tự động trên hệ điều hành Windows.',
    'Hệ quản trị cơ sở dữ liệu phẳng dùng cho các file JSON.',
    'Hệ điều hành chuyên dụng dành cho hacker mũ trắng.',
    'Proxy chặn bắt (Interception Proxy) dùng để xem và sửa đổi dữ liệu HTTP/HTTPS truyền giữa trình duyệt và server.',
  ], 3),
  q('Để tính tỷ lệ tấn công thành công hiển thị trên bảng thống kê hệ thống (Thống kê hệ thống portal), công thức nào sau đây được áp dụng?', [
    'Tỷ lệ = Tổng lượt tấn công / Lượt thành công',
    'Tỷ lệ = (Thành công / Tổng lượt tấn công) x 100%',
    'Tỷ lệ = Lượt thất bại - Lượt thành công',
    'Tỷ lệ = (Lượt thất bại / Tổng lượt tấn công) x 100%',
  ], 1),
  q('Thuật toán mã hóa AES thuộc loại mã hóa nào và thường dùng để làm gì trên ứng dụng bảo mật trực tuyến?', [
    'Mã hóa đối xứng, dùng để bảo mật mã hóa và giải mã nội dung tệp tin an toàn.',
    'Mã hóa bất đối xứng, dùng để băm mật khẩu người dùng sang chuỗi cố định.',
    'Thuật toán mã hóa dòng lệnh dùng để chống tấn công SQL Injection.',
    'Phương pháp chuyển đổi định dạng tệp tin sang chuỗi Base64 một dòng.',
  ], 0),
  q('Trong tệp cấu hình môi trường ứng dụng .env, biến môi trường SESSION_SECRET đóng vai trò gì?', [
    'Làm khóa bí mật dùng để ký và xác thực tính toàn vẹn của token phiên làm việc (HMAC-SHA256 tokens).',
    'Lưu trữ địa chỉ email kết nối với bot Google Drive.',
    'Lưu số Căn cước công dân của những người dùng hệ thống.',
    'Quy định cổng kết nối mạng mặc định của máy chủ Express.',
  ], 0),
  q('Điểm khác biệt lớn nhất giữa chức năng của công cụ Nmap và công cụ Nikto khi trinh sát hệ thống là gì?', [
    'Nmap tập trung quét cổng và dịch vụ mạng; Nikto tập trung quét máy chủ web để tìm các file nguy hiểm và lỗi cấu hình cụ thể.',
    'Nmap chỉ dùng trên Windows, Nikto chỉ dùng trên Linux.',
    'Nmap dùng để tấn công SQL Injection, Nikto dùng để bẻ khóa mật khẩu tài khoản.',
    'Nmap tạo ra file dữ liệu JSON, Nikto giải mã các chuỗi dữ liệu dạng Base64.',
  ], 0),
  q('Khi server Node.js nhận được tín hiệu ngắt hệ thống SIGTERM từ nền tảng hosting (như Render), hệ thống xử lý dữ liệu phẳng sẽ thực hiện hành động gì trước khi tắt hẳn?', [
    'Xóa toàn bộ tài khoản người dùng có trên hệ thống để bảo mật.',
    'Kích hoạt hàm flush để đảm bảo toàn bộ dữ liệu đang lưu trên RAM cache được sync hết lên Google Drive vĩnh viễn.',
    'Tự động gửi email thông báo lỗi hệ thống cho quản trị viên.',
    'Chuyển toàn bộ giao diện người dùng sang chế độ bảo trì.',
  ], 1),
  q('Tại sao khi hệ thống thi trực tuyến trên Render (bản Free Tier) ở trạng thái "ngủ" (sau 15 phút không có người truy cập), lượt truy cập đầu tiên lại bị chậm từ 20–40 giây?', [
    'Do hệ thống mạng internet tại Việt Nam bị nghẽn băng thông.',
    'Do mã độc tự động chạy ngầm để quét kiểm tra lỗ hổng bảo mật.',
    'Do trình duyệt web của người dùng tự động xóa cookies phiên cũ.',
    'Do server phải trải qua quá trình khởi động nguội (Cold start) và thực hiện tải toàn bộ dữ liệu 3 file JSON từ Google Drive về RAM cache.',
  ], 3),
  q('Phương pháp băm mật khẩu nào được sử dụng trong hệ thống để đảm bảo an toàn cao nhất chống lại tấn công vét cạn (Brute force), có sử dụng thêm chuỗi muối ngẫu nhiên (salt)?', [
    'scrypt + salt.',
    'MD5 thô.',
    'Base64 Encoding.',
    'SHA-1 không salt.',
  ], 0),
  q('Để kiểm tra tự động xem cấu hình kết nối giữa server ứng dụng và Google Drive đã hoạt động chính xác 100% hay chưa (gồm cả quyền đọc và quyền ghi), lập trình viên nên chạy lệnh nào trong thư mục dự án?', [
    'npm start',
    'node server.js',
    'node tools/check-drive.js',
    'npm install googleapis',
  ], 2),
  q('Khi cấu hình phân quyền cho tài khoản Service Account của Google trên thư mục dữ liệu Drive, nếu bạn chỉ đặt quyền là Viewer (Người xem) thì điều gì sẽ xảy ra với ứng dụng?', [
    'Server chỉ đọc được dữ liệu lúc khởi động, nhưng KHÔNG THỂ đồng bộ ghi dữ liệu (như đăng ký mới, nộp bài) lên Drive, gây lỗi hệ thống.',
    'Ứng dụng không thể đọc được danh sách đề thi.',
    'Hệ thống tự động chuyển sang lưu trữ bằng cơ sở dữ liệu SQL.',
    'Tài khoản Admin bị tước quyền điều khiển dashboard.',
  ], 0),
  q('Tiêu đề HTTP nào được trình duyệt tự động gửi kèm để định danh hệ điều hành, trình duyệt và phiên bản phần mềm mà người dùng đang sử dụng để truy cập website?', [
    'Cookie.',
    'Referer.',
    'Content-Type.',
    'User-Agent.',
  ], 3),
  q('Cơ chế Mutex hoạt động trên hàng đợi ghi dữ liệu phẳng (dataStore) của hệ thống thi trực tuyến có vai trò gì quan trọng nhất?', [
    'Mã hóa chuỗi dữ liệu sang dạng không thể đọc được.',
    'Khóa luồng ghi, ngăn ngừa tình trạng nhiều thí sinh nộp bài cùng một lúc ghi đè làm mất mát dữ liệu của nhau.',
    'Tự động chấm điểm các câu hỏi trắc nghiệm của thí sinh.',
    'Tách biệt file mã nguồn PHP ra khỏi giao diện HTML5.',
  ], 1),
  q('Khi sử dụng lệnh curl -u natas0:natas0 https://22web.org, tham số -u có ý nghĩa là gì?', [
    'Chỉ định đường dẫn tệp tin cần tải về máy.',
    'Ép buộc curl sử dụng giao thức bảo mật mã hóa nâng cao.',
    'Cung cấp thông tin tên đăng nhập và mật khẩu (Username:Password) để xác thực HTTP Basic Authentication.',
    'Chuyển đổi toàn bộ kết quả phản hồi sang định dạng Base64.',
  ], 2),
  q('Hệ thống lưu trữ dữ liệu phẳng gộp các thay đổi dồn dập diễn ra trong vòng bao nhiêu giây thành một lần upload nền duy nhất lên Google Drive để tiết kiệm tài nguyên và quota API?', [
    '0.5 giây.',
    '5.0 giây.',
    '1.2 giây.',
    '10.0 giây.',
  ], 2),
  q('Tại sao việc chấm điểm bài thi trắc nghiệm bắt buộc phải được thực hiện 100% ở phía Server (Server-side) thay vì thực hiện ở trình duyệt của thí sinh (Client-side)?', [
    'Để làm giảm dung lượng bộ nhớ RAM của máy tính thí sinh.',
    'Vì trình duyệt không hỗ trợ các phép toán cộng trừ điểm số.',
    'Để đảm bảo tính công bằng, ngăn chặn việc thí sinh dùng F12 sửa code JavaScript đổi điểm hoặc xem trước đáp án đúng.',
    'Để hệ thống Render tự động đồng bộ dữ liệu nhanh hơn.',
  ], 2),
  q('Giới hạn thời gian hiệu lực mặc định của một mã mã hóa Token phiên làm việc (HMAC-SHA256 token) trong hệ thống thi được cấu hình là bao lâu?', [
    '30 phút.',
    '12 giờ.',
    '1 giờ.',
    '7 ngày.',
  ], 1),
  q('Khi một người dùng mới đăng ký vào hệ thống thi trực tuyến khi dữ liệu đang hoàn toàn trống rỗng (users.json rỗng), tài khoản này sẽ nhận được đặc quyền gì?', [
    'Tự động được cấp quyền hạn cao nhất là Quản trị viên (Admin).',
    'Bị hệ thống tự động khóa tài khoản để kiểm tra an toàn.',
    'Được quyền tự động cộng thêm 2 điểm vào mọi bài thi.',
    'Hệ thống tự động xóa file kết quả lưu trữ cục bộ.',
  ], 0),
  q('Hằng số DEADLINE quy định hạn cuối nộp bài thi của cuộc thi trực tuyến được cấu hình trực tiếp ở file nào trong mã nguồn hệ thống?', [
    'public/assets/js/home.js',
    'src/drive/driveClient.js',
    'src/config.js',
    'package.json',
  ], 0),
  q('Giới hạn hạn ngạch (Quota) tải lên dữ liệu của một tài khoản Google Drive Service Account thông thường theo quy định của Google là bao nhiêu trong một ngày?', [
    '750 GB/ngày.',
    '10 GB/ngày.',
    '100 GB/ngày.',
    'Không giới hạn dung lượng.',
  ], 0),
  q('Trong mô hình kiến trúc tổng quan của hệ thống, thành phần nào đóng vai trò trung gian nhận request, xử lý logic kiểm tra đăng nhập/đăng ký rate-limit và chấm điểm bài thi?', [
    'Thư mục public/ chứa file tĩnh HTML.',
    'Ổ cứng lưu trữ mạng của dịch vụ Google Drive.',
    'Các file định tuyến trong thư mục src/routes/ (auth, exam, admin routes).',
    'Công cụ kiểm tra kết nối dòng lệnh check-drive.js.',
  ], 2),
  // ---- MỤC C: VẬN DỤNG CAO — PHÂN TÍCH LỖ HỔNG WEBSITE & NATAS (Câu 41–50) ----
  q('Một trang web lưu mật khẩu của cấp độ tiếp theo ngay trong một đoạn text ẩn của thuộc tính HTML có cấu trúc dạng <div id="pass" data-password="SECRET_KEY">. Để lấy được chuỗi mật khẩu này bằng lệnh dòng lệnh curl kết hợp biểu thức chính quy (Regex), lệnh nào sau đây là chính xác?', [
    'curl -u user:pass URL | grep secret',
    'curl URL > secret.txt',
    'curl -s -u user:pass URL | grep -oP \'data-password="\\K[^"]+\'',
    'curl -X POST -d "password" URL',
  ], 2),
  q('Khi ứng dụng Web sử dụng cơ chế mã hóa Cookie bằng thuật toán phép toán logic XOR (Mô phỏng Natas Level 11). Kẻ tấn công có thể thao túng dữ liệu bên trong Cookie (ví dụ đổi quyền từ user thành admin) bằng cách tận dụng đặc điểm nào của phép toán XOR?', [
    'XOR không bao giờ có thể bị giải mã nếu không có khóa RSA 2048-bit.',
    'Nếu biết trước nội dung gốc (Plaintext) và chuỗi kết quả đã mã hóa (Ciphertext), kẻ tấn công hoàn toàn có thể tính toán ngược lại để tìm ra Khóa bí mật (XOR Key).',
    'Phép toán XOR tự động thay đổi độ dài chuỗi theo thời gian thực hệ thống.',
    'XOR luôn tạo ra các ký tự đặc biệt nằm trong comment HTML.',
  ], 1),
  q('Hệ thống web cho phép người dùng xem tài liệu thông qua tham số đường dẫn có dạng https://gt.tc. Nếu lập trình viên không lọc sạch dữ liệu đầu vào, kẻ tấn công nhập vào chuỗi dữ liệu ?page=../../../../etc/natas_webpass/natas8. Lỗ hổng nguy hiểm này gọi là gì?', [
    'SQL Injection.',
    'Command Injection.',
    'Cross-Site Request Forgery (CSRF).',
    'Path Traversal (Duyệt qua đường dẫn tệp tin trái phép).',
  ], 3),
  q('Khi chạy mã nguồn, hệ thống trả về mã lỗi hiển thị trên màn hình console log là 403 SERVICE_DISABLED kèm dòng trạng thái "Google Drive API has not been used...". Lỗi này do nguyên nhân cấu hình sai ở bước nào?', [
    'Điền sai mã ID thư mục lưu trữ của Google Drive.',
    'File key JSON của tài khoản Service Account bị xóa hoàn toàn.',
    'Thiết bị máy chủ Render bị hết dung lượng bộ nhớ RAM cache.',
    'Chưa bấm nút Kích hoạt (Enable) dịch vụ Google Drive API trong trang quản trị thư viện Google Cloud Console.',
  ], 3),
  q('Một trang web có tính năng thực hiện lệnh tìm kiếm văn bản bằng cách gọi lệnh hệ thống grep chạy ngầm ở Backend. Kẻ tấn công nhập chuỗi ký tự ; cat /etc/natas_webpass/natas10 vào ô tìm kiếm nhằm ép máy chủ thực thi thêm lệnh đọc file hệ thống. Kỹ thuật tấn công này có tên là gì?', [
    'SQL Injection.',
    'Command Injection (Chèn mã lệnh hệ điều hành).',
    'Path Traversal.',
    'Brute Force Attack.',
  ], 1),
  q("Đoạn code Backend xử lý đăng nhập chứa câu lệnh SQL nối chuỗi trực tiếp: SELECT * FROM users WHERE username = ' + req.body.username + ' AND password = ' + req.body.password + '. Kẻ tấn công nhập chuỗi giá trị nào vào ô username để đăng nhập thành công quyền Admin mà không cần mật khẩu?", [
    'admin123',
    "<script>location.href='hacker.com'</script>",
    '../../config/database.json',
    "admin' OR '1'='1' -- hoặc ' OR 1=1 #",
  ], 3),
  q('Để kiểm tra tính toàn vẹn của một chuỗi dữ liệu Base64 dùng làm biến môi trường GOOGLE_SERVICE_ACCOUNT_JSON trên môi trường Production, nếu chuỗi bị thiếu ký tự hoặc chèn sai dòng trống, server sẽ ném ra ngoại lệ (lỗi) gì khi khởi chạy ứng dụng?', [
    '404 File Not Found',
    '403 Unauthorized',
    'SyntaxError: Unexpected token / JSON.parse error',
    '502 Bad Gateway',
  ], 2),
  q('Kỹ thuật phòng thủ nào sau đây của Blue Team giúp ngăn chặn triệt để lỗ hổng Command Injection khi viết code gọi ứng dụng hệ thống?', [
    'Không dùng các hàm thực thi chuỗi lệnh trực tiếp (như eval() hay exec()), sử dụng hàm truyền đối số tách biệt dưới dạng mảng (Array arguments).',
    'Chặn người dùng nhập các từ khóa như "SELECT", "UNION", "WHERE".',
    'Chuyển toàn bộ ứng dụng sang chạy giao thức HTTPS bảo mật ổ khóa.',
    'Mã hóa chuỗi đầu vào của người dùng bằng thuật toán đối xứng AES-256.',
  ], 0),
  q('Khi cấu hình file cấu hình hạ tầng render.yaml (Blueprint 1-click deploy), thuộc tính nào định nghĩa đường dẫn dùng để Render tự động kiểm tra xem ứng dụng Web đang hoạt động ổn định hay đã chết (Health Check)?', [
    'build_command',
    'start_command',
    'health_check_path (được cấu hình dẫn tới /api/health).',
    'env_vars_sync',
  ], 2),
  q('Trong thử thách vượt qua lỗ hổng tải file (File Upload), ứng dụng Backend kiểm tra định dạng file bằng cách đọc các ký tự đặc trưng ở đầu file. Kẻ tấn công đã chèn chuỗi ký tự nào sau đây vào đầu file PHP để đánh lừa hệ thống rằng đây là một file ảnh GIF hợp lệ?', [
    'PNG89a',
    '<?php',
    'GIF8; hoặc GIF89a (Kỹ thuật bypass qua Magic Bytes).',
    'Content-Type: image/gif',
  ], 2),
];

/* ==================== BỘ ĐỀ SỐ 2 — 50 CÂU ==================== */
const SET2_QUESTIONS = [
  // ---- MỤC A: NHẬN BIẾT — ATTT CƠ BẢN & PHÒNG CHỐNG LỪA ĐẢO (Câu 1–17) ----
  q('Trong quy tắc sao lưu dữ liệu "3-2-1", con số "2" có ý nghĩa cốt lõi là gì?', [
    'Thực hiện cập nhật sao lưu dữ liệu tối thiểu 2 lần một tuần.',
    'Yêu cầu có ít nhất 2 người quản lý cấp cao giữ mật khẩu giải mã.',
    'Lưu trữ các bản sao dữ liệu trên ít nhất 2 loại phương tiện vật lý khác nhau (ví dụ: ổ cứng máy tính và ổ cứng di động).',
    'Chia file tài liệu thành 2 phần mã hóa độc lập.',
  ], 2),
  q('Tấn công "Phishing" thường được tội phạm công nghệ cao thực hiện qua con đường nào phổ biến nhất để tiếp cận nạn nhân tại các cơ quan, đơn vị?', [
    'Trực tiếp đến phá hoại thiết bị phần cứng máy chủ.',
    'Dò quét tín hiệu sóng WiFi của cơ quan từ xa.',
    'Gửi email giả mạo có tiêu đề khẩn cấp, chứa file đính kèm độc hại hoặc đường link trang web lừa đảo.',
    'Cài đặt các ứng dụng điều khiển màn hình chính thống.',
  ], 2),
  q('Hành vi nào sau đây giúp bạn tạo ra một mật khẩu bảo mật tài khoản cá nhân có độ an toàn cao chống lại các cuộc tấn công đoán mật khẩu?', [
    'Sử dụng chuỗi số liên tục tăng dần như 123456789.',
    'Dùng chính tên viết tắt của cơ quan kết hợp năm thành lập đơn vị.',
    'Lấy số điện thoại cá nhân làm mật khẩu để dễ nhớ.',
    'Sử dụng một cụm từ dài không có nghĩa trong từ điển, gồm cả chữ hoa, chữ thường, số và các ký tự đặc biệt.',
  ], 3),
  q('Rủi ro lớn nhất khi người dùng kết nối điện thoại vào mạng WiFi công cộng miễn phí không yêu cầu mật khẩu đăng nhập là gì?', [
    'Điện thoại bị sụt dung lượng pin nhanh hơn bình thường.',
    'Hệ điều hành tự động xóa bỏ các ứng dụng đã cài đặt.',
    'Kẻ xấu có thể chặn bắt lưu lượng mạng để đánh cắp tài khoản đăng nhập, thông tin thẻ tín dụng truyền qua mạng không mã hóa.',
    'Không thể gửi được tin nhắn văn bản SMS thông thường.',
  ], 2),
  q('Khi một trang web không sử dụng chứng chỉ bảo mật SSL/TLS (chỉ chạy giao thức HTTP thông thường), trình duyệt web sẽ hiển thị cảnh báo gì trên thanh địa chỉ?', [
    'Biểu tượng chiếc ổ khóa màu xanh an toàn 🔒.',
    'Tự động đóng trình duyệt không cho người dùng truy cập.',
    'Chuyển toàn bộ nội dung chữ của trang web sang mã Base64.',
    'Dòng chữ "Không an toàn" (Not Secure) hoặc biểu tượng dấu chấm than cảnh báo.',
  ], 3),
  q('Ứng dụng mã nguồn mở giả mạo mang tên "OpenClaw" chứa mã độc nguy hiểm được thiết kế nhằm mục đích tấn công vào đối tượng nào của người dùng?', [
    'Các tệp tin hình ảnh lưu trên thư mục Google Drive.',
    'Các thiết bị phần cứng màn hình cảm ứng của điện thoại thông minh.',
    'Hệ thống điều hòa nhiệt độ chạy ngầm của phòng máy chủ.',
    'Thông tin số dư, mã khóa ví tiền điện tử và dữ liệu tài khoản lưu trong trình quản lý mật khẩu.',
  ], 3),
  q('Cơ chế xác thực đa thành tố (MFA/2FA) bảo vệ tài khoản của bạn dựa trên nguyên lý cốt lõi nào?', [
    'Yêu cầu người dùng phải nhập mật khẩu hai lần liên tiếp giống nhau.',
    'Tự động mã hóa tên đăng nhập thành chuỗi ký tự hex 96 ký tự.',
    'Yêu cầu kết hợp giữa cái bạn biết (mật khẩu) và cái bạn sở hữu/đang nắm giữ (mã OTP gửi về điện thoại hoặc ứng dụng Authenticator).',
    'Chấm điểm mức độ mạnh yếu của mật khẩu trước khi bấm đăng nhập.',
  ], 2),
  q('Máy tính của cơ quan có dấu hiệu nào sau đây cần được cách ly khỏi mạng nội bộ ngay lập tức để kiểm tra mã độc?', [
    'Xuất hiện tệp tin lạ tự sinh ra hàng loạt, máy tính tự gửi file qua mạng, xuất hiện thông báo tống tiền đòi tiền chuộc bằng tiền ảo.',
    'Dung lượng bộ nhớ trống của ổ đĩa cứng tăng lên sau khi dọn rác.',
    'Hệ điều hành tự động cập nhật bản vá bảo mật vào ban đêm.',
    'Màn hình hiển thị thông báo yêu cầu cắm dây sạc pin.',
  ], 0),
  q('Tại sao các chuyên gia an ninh mạng khuyến cáo tuyệt đối không sử dụng tính năng "Ghi nhớ mật khẩu" tự động trên các máy tính dùng chung, máy tính công cộng?', [
    'Bất kỳ người nào sử dụng máy tính đó sau bạn đều có thể tự động đăng nhập vào tài khoản của bạn hoặc xem mật khẩu thuần trong phần cài đặt trình duyệt.',
    'Làm giảm hiệu suất xử lý dữ liệu phẳng của chip CPU máy tính.',
    'Khiến hệ thống máy chủ bị dính lỗi cấu hình API Google Drive.',
    'Làm mất tính năng xác thực token HMAC của hệ thống.',
  ], 0),
  q('Khi bị dính mã độc tống tiền (Ransomware), hành vi nào sau đây là SAI LẦM và có thể gây mất mát dữ liệu vĩnh viễn?', [
    'Tự ý chạy các phần mềm dọn rác, chỉnh sửa file hệ thống hoặc chuyển tiền trả tiền chuộc cho hacker mà không báo cáo bộ phận chuyên trách ATTT.',
    'Ngắt kết nối mạng WiFi hoặc rút dây mạng LAN của máy tính ngay lập tức.',
    'Liên hệ ngay với đội kỹ thuật Blue Team của cơ quan để được hỗ trợ chuyên sâu.',
    'Tắt nguồn máy tính để cô lập vùng nhớ RAM bị tấn công.',
  ], 0),
  q('Việc đăng tải hình ảnh thẻ ngành, thẻ nhân viên hoặc vé máy bay có hiển thị rõ mã vạch (Barcode/QR code) lên mạng xã hội tiềm ẩn nguy cơ bảo mật gì?', [
    'Làm giảm chất lượng hình ảnh hiển thị trên trang cá nhân của bạn.',
    'Kẻ xấu có thể quét mã vạch để trích xuất thông tin cá nhân nhạy cảm, số CCCD, ngày sinh nhằm mục đích lừa đảo hoặc giả mạo thông tin.',
    'Tài khoản mạng xã hội của bạn sẽ bị tự động khóa do vi phạm bản quyền hình ảnh.',
    'Hệ thống mạng nội bộ cơ quan sẽ bị sập do quá tải yêu cầu truy cập.',
  ], 1),
  q('Khi nhận được một email từ địa chỉ có đuôi lạ (ví dụ: vksnddanang@gmail.com thay vì email công vụ @vks.gov.vn) tự xưng là Lãnh đạo đơn vị yêu cầu bạn chuyển khoản gấp một số tiền để xử lý việc công, bạn nên xử lý thế nào?', [
    'Chuyển tiền ngay lập tức vì sợ làm ảnh hưởng đến tiến độ công việc của Lãnh đạo.',
    'Tuyệt đối không chuyển tiền, thực hiện xác minh lại trực tiếp bằng cách gọi điện thoại hoặc gặp trực tiếp Lãnh đạo để kiểm tra thông tin.',
    'Gửi lại email yêu cầu cung cấp thêm hình ảnh thẻ CCCD của Lãnh đạo để xác thực.',
    'Chuyển tiếp email đó cho toàn bộ người dùng trong cơ quan cùng biết.',
  ], 1),
  q('Phương thức lưu trữ mật khẩu an toàn nhất được các tổ chức công nghệ khuyến nghị dành cho người dùng cá nhân là gì?', [
    'Sử dụng ứng dụng quản lý mật khẩu chuyên dụng có mã hóa đầu cuối, bảo vệ bằng mã vân tay hoặc mật khẩu chủ (Master Password) mạnh.',
    'Ghi chép toàn bộ mật khẩu vào một cuốn sổ tay nhỏ để trên bàn làm việc.',
    'Lưu tất cả mật khẩu vào một file văn bản đặt tên là matkhau.txt ngay trên màn hình nền.',
    'Đặt mật khẩu trùng với tên tài khoản đăng nhập để không bao giờ bị quên.',
  ], 0),
  q('Thủ đoạn lừa đảo "Tội phạm giả danh cơ quan Tư pháp" (Viện kiểm sát, Tòa án, Công an) thường đánh vào yếu tố tâm lý nào của nạn nhân?', [
    'Sự tò mò về các chương trình khuyến mãi, trúng thưởng trực tuyến.',
    'Lòng tham đối với các khoản tiền thưởng hoặc cơ hội việc làm lương cao trên mạng.',
    'Sự lơ là khi tham gia các trò chơi điện tử trực tuyến.',
    'Sự sợ hãi, hoang mang khi bị hù dọa liên quan đến các vụ án hình sự, ma túy, rửa tiền và yêu cầu giữ bí mật.',
  ], 3),
  q('Biện pháp nào sau đây giúp bảo vệ điện thoại thông minh ứng dụng ngân hàng số tránh bị mã độc tự động cài đặt chiếm quyền điều khiển Accessibility Service?', [
    'Tuyệt đối không bấm vào các đường link lạ tải file cài đặt có đuôi .apk bên ngoài cửa hàng ứng dụng chính thống (Google Play / App Store).',
    'Luôn mở tính năng định vị vị trí GPS mọi lúc mọi nơi.',
    'Cài đặt quá nhiều ứng dụng hình nền động không rõ nguồn gốc.',
    'Tắt tính năng tự động cập nhật hệ điều hành của điện thoại.',
  ], 0),
  q('Khái niệm "Hàng đợi ghi dữ liệu phẳng" trong hệ thống thi trực tuyến phục vụ mục đích gì trong thiết kế hệ thống?', [
    'Nhận các thay đổi dữ liệu trên RAM và xử lý lưu tuần tự xuống ổ đĩa một cách bất đồng bộ để không làm nghẽn trải nghiệm người dùng.',
    'Sắp xếp thứ tự bảng điểm từ cao xuống thấp của các thí sinh.',
    'Tự động băm mật khẩu người dùng sang định dạng chuỗi mã hóa scrypt.',
    'Ngăn chặn các cuộc tấn công quét cổng từ công cụ Nmap của đối phương.',
  ], 0),
  q('File package.json trong thư mục mã nguồn của ứng dụng Node.js đóng vai trò gì?', [
    'Chứa toàn bộ mật khẩu và thông tin Căn cước công dân của Admin hệ thống.',
    'Lưu trữ nội dung các câu hỏi đề thi trắc nghiệm dạng dữ liệu phẳng.',
    'Khai báo thông tin dự án, cấu hình lệnh chạy (start, dev) và danh sách các thư viện phụ thuộc bắt buộc phải cài đặt (Dependencies).',
    'Thực hiện nhiệm vụ kết nối trực tiếp đến giao diện Google Drive API v3.',
  ], 2),
  // ---- MỤC B: THÔNG HIỂU & ÁP DỤNG — CÔNG CỤ & GIÁM SÁT (Câu 18–40) ----
  q('Khi kiểm tra lịch sử tấn công trên giao diện phòng thủ (BlueTeam Dashboard), nếu thấy một chuỗi IP liên tục quét các tệp tin dạng config.php.bak, backup.zip, .env thì kẻ tấn công đang thực hiện kỹ thuật gì?', [
    'SQL Injection vượt quyền hạn.',
    'Kỹ thuật thu thập thông tin và dò tìm các file cấu hình, file sao lưu bị lộ trên máy chủ (Information Gathering).',
    'Tấn công lừa đảo người dùng qua giao diện email tĩnh.',
    'Thực thi mã độc mã hóa tống tiền dữ liệu phẳng trên RAM.',
  ], 1),
  q('Nhiệm vụ cốt lõi và quan trọng nhất của Đội Phòng thủ (Blue Team) khi hệ thống mạng đang diễn ra diễn tập an ninh mạng là gì?', [
    'Tìm cách xâm nhập vào máy tính cá nhân của các thành viên Đội Tấn công.',
    'Phát hiện sớm cuộc tấn công, phân tích kỹ thuật khai thác qua log hệ thống, thực hiện vá lỗ hổng và khôi phục hoạt động bình thường.',
    'Thay đổi toàn bộ nội dung hiển thị trên trang chủ tuyên truyền cổ động.',
    'Tạo ra các file dữ liệu trống trong thư mục ./data/ của máy chủ.',
  ], 1),
  q('Khi chạy công cụ Nmap với tùy chọn quét phiên bản dịch vụ đầy đủ dạng nmap -sV -O <IP_Máy_Chủ>, mục tiêu thu được là thông tin nào?', [
    'Tên dịch vụ, phiên bản chính xác của phần mềm đang chạy trên các cổng mở và tên hệ điều hành của máy chủ mục tiêu.',
    'Danh sách toàn bộ tên đăng nhập và mật khẩu của người dùng có trên máy chủ.',
    'Tỷ lệ phần trăm các cuộc tấn công bẻ khóa thành công vào hệ thống dữ liệu.',
    'Nội dung chi tiết cấu trúc 3 file JSON đang lưu trữ trên mạng.',
  ], 0),
  q('Công cụ bảo mật ứng dụng OWASP ZAP có tính năng nào tương đồng với ứng dụng Burp Suite trong đánh giá ATTT website?', [
    'Hoạt động như một proxy trung gian cho phép chặn bắt, chỉnh sửa các tham số đầu vào của request gửi từ trình duyệt lên server.',
    'Tự động sinh ra chuỗi mã hóa token HMAC-SHA256 phiên làm việc.',
    'Thay đổi thuật toán băm mật khẩu từ scrypt sang MD5 thô.',
    'Đồng bộ dữ liệu phẳng trực tiếp lên thư mục Google Drive của bạn.',
  ], 0),
  q('Biến môi trường ADMIN_CCCDS được cấu hình trong hệ thống quản lý thi trực tuyến dùng để giải quyết bài toán gì?', [
    'Lưu toàn bộ số định danh của thí sinh tham gia cuộc thi trực tuyến.',
    'Quy định độ dài tối đa của chuỗi mã hóa mật khẩu trong hàm crypto.',
    'Khai báo danh sách các số Căn cước công dân được hệ thống cấp đặc quyền làm Admin tối cao ngay khi tiến hành đăng ký tài khoản.',
    'Xác thực quyền ghi dữ liệu của robot lên dịch vụ lưu trữ đám mây.',
  ], 2),
  q('Điểm khác biệt cốt lõi giữa cơ chế mã hóa dữ liệu file bằng thuật toán AES và cơ chế băm mật khẩu bằng thuật toán scrypt là gì?', [
    'AES chỉ chạy trên máy tính cấu hình mạnh; scrypt chạy được trên mọi thiết bị di động.',
    'AES tự động chèn thêm chuỗi muối ngẫu nhiên; scrypt bắt buộc nhập file JSON thô 1 dòng.',
    'AES chỉ dùng ở chế độ cục bộ; scrypt bắt buộc phải đồng bộ lên dịch vụ đám mây.',
    'AES là mã hóa 2 chiều (có thể giải mã lại thành file gốc nếu có khóa); scrypt là hàm băm 1 chiều (không thể dịch ngược lại mật khẩu gốc từ chuỗi hash).',
  ], 3),
  q('Tại sao trong file cấu hình môi trường hệ thống, chuỗi khóa private_key của tài khoản Google Service Account thường được khuyến cáo mã hóa sang định dạng Base64 trước khi dán vào biến môi trường GOOGLE_SERVICE_ACCOUNT_JSON?', [
    'Để làm tăng độ bảo mật của khóa lên gấp hai lần chống bẻ khóa.',
    'Vì biến môi trường hệ thống rất khó lưu trữ nguyên vẹn một file văn bản JSON chứa nhiều ký tự xuống dòng và dấu ngoặc kép phức tạp; Base64 giúp biến đổi thành một chuỗi ký tự liền mạch duy nhất trên 1 dòng.',
    'Nhằm làm giảm dung lượng của file key từ vài KB xuống còn vài byte.',
    'Để hệ thống Render tự động phân quyền Editor cho email của robot.',
  ], 1),
  q('Khi phân tích lưu lượng mạng bằng phần mềm Wireshark, nếu trang web sử dụng giao thức HTTP thông thường, kỹ sư bảo mật có thể nhìn thấy thông tin nhạy cảm nào của người dùng truyền qua mạng?', [
    'Nhìn thấy toàn bộ nội dung thuần (Plaintext) dữ liệu gửi đi, bao gồm cả tài khoản đăng nhập, mật khẩu, nội dung bài làm trắc nghiệm.',
    'Chỉ nhìn thấy địa chỉ IP của máy chủ web công cộng.',
    'Không nhìn thấy gì vì Wireshark tự động mã hóa dữ liệu thành chuỗi hex.',
    'Chỉ nhìn thấy dung lượng kích thước của file dữ liệu đang truyền tải.',
  ], 0),
  q('Trong cơ chế đồng bộ ngược dữ liệu (Sync) của hệ thống thi trực tuyến, khi một route xử lý ghi nhận dữ liệu mới trên RAM, nó sẽ đánh dấu file đó ở trạng thái gì để vòng upload nền tiến hành lưu lên Drive?', [
    'Trạng thái clean (Sạch sẽ).',
    'Trạng thái locked (Đang bị khóa luồng).',
    'Trạng thái dirty (Dữ liệu bẩn / Dữ liệu đã bị thay đổi cần đồng bộ).',
    'Trạng thái flushed (Đã lưu xong).',
  ], 2),
  q('Cơ chế tự động thử lại (Retry với chiến lược Backoff tăng dần thời gian 1s -> 2s -> 4s) của thư viện kết nối Google Drive API giúp hệ thống giải quyết vấn đề gì?', [
    'Tự động bẻ khóa khi tài khoản Service Account bị mất quyền truy cập.',
    'Làm tăng tốc độ xử lý điểm số bài thi của thí sinh trên RAM cache.',
    'Giúp hệ thống tự phục hồi, vượt qua các lỗi mạng tạm thời hoặc khi bị Google từ chối do vượt quá tần suất yêu cầu (Mã lỗi 429 hoặc lỗi 5xx).',
    'Thay đổi mã ID thư mục lưu trữ khi thư mục cũ bị xóa.',
  ], 2),
  q('Khi tiến hành cấu hình biến môi trường trên Render, nếu lập trình viên quên khai báo biến SESSION_SECRET, hệ thống Express sẽ xử lý như thế nào khi khởi chạy?', [
    'Ứng dụng sẽ tự động dừng hoạt động và báo lỗi thiếu biến môi trường.',
    'Script kiểm tra tự động sẽ tự tạo ra một chuỗi mã ngẫu nhiên dài 96 ký tự để làm khóa ký token tạm thời nhằm duy trì hoạt động hệ thống.',
    'Hệ thống tự động chuyển sang chế độ đăng nhập không cần mật khẩu.',
    'Toàn bộ tài khoản thí sinh sẽ tự động được phân quyền thành Admin.',
  ], 1),
  q('Lệnh dòng lệnh nào sau đây dùng để cài đặt toàn bộ các thư viện phụ thuộc được khai báo trong file package.json trước khi khởi chạy dự án Node.js trên máy tính cá nhân?', [
    'npm install',
    'npm start',
    'npm run dev',
    'node -v',
  ], 0),
  q('Tiêu đề HTTP nào (HTTP Header) xác định định dạng nội dung dữ liệu được gửi trong phần thân của yêu cầu (ví dụ xác định dữ liệu gửi lên là định dạng JSON hay form dữ liệu thông thường)?', [
    'Cookie.',
    'User-Agent.',
    'Authorization.',
    'Content-Type (ví dụ: application/json).',
  ], 3),
  q('Tại sao cơ chế bảo mật chống dò mật khẩu giới hạn tối đa 6 lần đăng nhập sai trong vòng 15 phút lại bắt buộc phải đi kèm với cơ chế băm mật khẩu có thời gian xử lý tốn tài nguyên (như hàm scrypt)?', [
    'Để tăng tối đa chi phí thời gian và phần cứng của hacker nếu họ sao chép được file dữ liệu về máy để bẻ khóa vét cạn ngoại tuyến (Offline brute-force).',
    'Nhằm giảm dung lượng lưu trữ của file dữ liệu phẳng users.json.',
    'Để hệ thống Render tự động phân bổ dung lượng bộ nhớ RAM cache tối ưu hơn.',
    'Giúp tăng tốc độ đồng bộ dữ liệu từ RAM lên Google Drive vĩnh viễn.',
  ], 0),
  q('Trong file dữ liệu cấu trúc phẳng exams.json, thông tin nào được lưu trữ bên trong mỗi câu hỏi của đề thi để phục vụ chấm điểm?', [
    'Chuỗi nội dung đáp án đúng dạng văn bản thuần.',
    'Số căn cước công dân của người ra đề thi.',
    'Tổng số lượt thí sinh đã trả lời đúng câu hỏi đó.',
    'Chỉ số vị trí của câu trả lời chính xác trong mảng phương án chọn (trường correctIndex).',
  ], 3),
  q('Khi bạn dán chuỗi cấu hình JSON của file khóa Service Account nằm trên một dòng duy nhất vào biến môi trường của hệ thống, phương thức này được tài liệu hướng dẫn gọi là gì?', [
    'Khai báo dạng Base64 khuyên dùng.',
    'Khai báo dạng đường dẫn file key cục bộ.',
    'Khai báo thông qua API Token trung gian.',
    'Khai báo dạng JSON thô 1 dòng (Raw JSON).',
  ], 3),
  q('Mục đích chính của việc hệ thống tự động ghi một bản sao "mirror cục bộ" lưu xuống thư mục ./data/*.json trên máy chủ song song với việc lưu lên Google Drive là gì?', [
    'Để làm tăng gấp đôi dung lượng bộ nhớ lưu trữ file dữ liệu phẳng.',
    'Giúp hệ thống khởi động nhanh hơn ở những lần sau và làm phương án cứu trợ dữ liệu khẩn cấp nếu dịch vụ Google Drive tạm thời gặp sự cố kết nối.',
    'Chống lại cuộc tấn công chèn câu lệnh hệ điều hành Command Injection.',
    'Tự động đồng bộ tài khoản người dùng sang nền tảng cơ sở dữ liệu SQL.',
  ], 1),
  q('Để kiểm tra xem hệ thống máy chủ web có đang hoạt động tốt hay không, nền tảng Render sẽ định kỳ gửi yêu cầu kiểm tra (Health Check) tới đường dẫn API nào được cấu hình trong hệ thống?', [
    '/api/stats',
    '/api/health',
    '/api/admin/users',
    '/login.html',
  ], 1),
  q('Khi thí sinh bấm nút Bắt đầu làm bài thi, hệ thống Backend Express sẽ ghi nhận và cấp cho thí sinh thông tin quan trọng nào để giám sát thời gian làm bài chống gian lận?', [
    'Tự động tải toàn bộ file đáp án đúng về cookies trình duyệt của thí sinh.',
    'Chuyển đổi giao diện làm bài sang chế độ mã hóa file đối xứng AES.',
    'Cấp và lưu trữ thời điểm bắt đầu làm bài chính xác ở phía Server (trường startedAt), việc refresh trang web sẽ không làm tăng thêm thời gian.',
    'Tự động gửi một yêu cầu lưu file test lên thư mục Google Drive.',
  ], 2),
  q('Trong cấu trúc tệp tin dữ liệu phẳng results.json, trường dữ liệu durationSeconds dùng để lưu trữ thông tin gì của lượt thi?', [
    'Tổng số thời gian tối đa được phép làm bài thi tính bằng phút.',
    'Tổng số thời gian thực tế mà thí sinh đã bỏ ra để hoàn thành bài thi, tính bằng đơn vị giây.',
    'Thời điểm chính xác thí sinh bấm nút nộp bài lên máy chủ.',
    'Mã số định danh duy nhất của đề thi trắc nghiệm.',
  ], 1),
  q('Khi muốn chạy ứng dụng ở chế độ phát triển (Development mode) dưới máy tính cá nhân để tự động khởi động lại server mỗi khi lập trình viên chỉnh sửa file mã nguồn, bạn sử dụng lệnh dòng lệnh nào?', [
    'npm start',
    'node server.js',
    'npm run dev',
    'npm install',
  ], 2),
  q('Khi một tài khoản người dùng thông thường cố tình truy cập vào đường dẫn API dành riêng cho quản trị viên (ví dụ: lấy danh sách toàn bộ người dùng hệ thống), middleware bảo mật requireAdmin sẽ trả về mã lỗi HTTP nào để từ chối truy cập?', [
    '200 OK',
    '403 Forbidden hoặc thông báo lỗi vi phạm quyền truy cập.',
    '404 Not Found',
    '500 Internal Server Error',
  ], 1),
  q('Cơ chế gộp các thay đổi dồn dập diễn ra trong một khoảng thời gian ngắn thành một lần đồng bộ duy nhất lên Google Drive được gọi thuật ngữ chuyên ngành là gì?', [
    'Mutex Locking.',
    'Coalesce (Gộp các thay đổi dồn dập nền).',
    'Parameterized Queries.',
    'Constant-time Comparison.',
  ], 1),
  // ---- MỤC C: VẬN DỤNG CAO — PHÂN TÍCH LỖ HỔNG WEBSITE & NATAS (Câu 41–50) ----
  q('Trong mã nguồn hệ thống, để so sánh chuỗi băm mật khẩu hoặc xác thực token phiên làm việc một cách an toàn nhất, tránh lỗ hổng tấn công phân tích thời gian phản hồi của CPU (Timing Attack), lập trình viên bắt buộc phải sử dụng cơ chế so sánh nào?', [
    'So sánh bằng toán tử thông thường == hoặc ===.',
    'Chuyển đổi toàn bộ hai chuỗi dữ liệu sang định dạng Base64 trước khi so sánh.',
    'Gửi cả hai chuỗi dữ liệu lên Google Drive để nhờ robot so sánh hộ.',
    'So sánh thời gian cố định (Constant-time comparison) bằng hàm chuyên dụng của thư viện crypto.',
  ], 3),
  q('Khi chạy script kiểm tra kết nối tự động tới Google Drive, hệ thống báo lỗi ở mức 4/5 kèm dòng trạng thái 403 The caller does not have permission. Lỗi này xác định nguyên nhân chính xác do cấu hình thiếu bước nào sau đây?', [
    'Nhập sai chuỗi mã số ID thư mục Google Drive của bạn.',
    'Bạn đã chia sẻ thư mục Drive cho email của robot rồi, nhưng lại thiết lập nhầm quyền là Viewer (Người xem) thay vì Editor (Người chỉnh sửa).',
    'Chưa bật tính năng xác thực 2 lớp cho tài khoản Gmail cá nhân.',
    'Thư mục lưu trữ trên Google Drive đã bị đầy dung lượng 750 GB.',
  ], 1),
  q('Kẻ tấn công thực hiện hành vi gửi yêu cầu truy cập liên tục với tham số đường dẫn chứa chuỗi ký tự kiểm thử nguy hiểm: https://liveblog365.com | grep -oP .... Logic xử lý ở Backend gọi trực tiếp hàm xử lý chuỗi hệ thống mà không cô lập tham số đầu vào. Đây là biểu hiện của lỗ hổng bảo mật nào?', [
    'Path Traversal.',
    'SQL Injection trái phép.',
    'Session Hijacking.',
    'Command Injection (Chèn mã lệnh hệ điều hành qua các hàm xử lý nền).',
  ], 3),
  q('Khi mở file key JSON tải về từ Google Cloud Console bằng công cụ Notepad, bạn cần tìm và sao chép chính xác giá trị nằm ở trường dữ liệu nào để lấy được địa chỉ email định danh của robot cấp quyền chia sẻ?', [
    'private_key',
    'project_id',
    'auth_uri',
    'client_email',
  ], 3),
  q('Để phòng chống triệt để lỗ hổng bảo mật nguy hiểm SQL Injection, kỹ thuật lập trình nào sau đây là tiêu chuẩn bắt buộc phải áp dụng đối với mọi ô nhập liệu dữ liệu của người dùng?', [
    'Chỉ mã hóa chuỗi nhập vào bằng thuật toán Base64 Encoding ở Frontend.',
    'Sử dụng vòng lặp kiểm tra và tự động xóa bỏ toàn bộ dấu khoảng trắng của chuỗi.',
    'Sử dụng truy vấn có tham số tách biệt (Parameterized Queries) / câu lệnh chuẩn bị trước (Prepared Statements).',
    'Cấu hình hệ thống tường lửa mạng để chặn hoàn toàn địa chỉ IP của thí sinh.',
  ], 2),
  q('Khi kẻ tấn công tìm cách thay đổi tham số đường link thành ?page=../../../../config.php để lấy cắp khóa bí mật hệ thống. Để phòng ngự lỗi Path Traversal này, hàm kiểm tra đầu vào ở Backend cần thực hiện hành vi lọc bỏ (Sanitize) các ký tự nguy hiểm nào?', [
    'Chặn các chuỗi ký tự dạng dấu ngoặc nhọn <script>.',
    "Xóa bỏ các ký tự dấu nháy đơn ' và dấu băm #.",
    'Ép kiểu dữ liệu đầu vào của người dùng bắt buộc phải là dạng số nguyên.',
    'Lọc sạch và chặn các chuỗi dấu chấm và dấu gạch chéo nguy hiểm như ../ hoặc ..\\ dùng để nhảy thư mục.',
  ], 3),
  q('Một chuỗi ký tự mã hóa Base64 dùng làm biến môi trường khi dán vào trang quản trị Render bị hệ thống báo lỗi không thể khởi chạy, kiểm tra log thấy dòng trạng thái báo lỗi liên quan đến ký tự đầu vào Unexpected token. Nguyên nhân phổ biến nhất gây ra lỗi này ở bước xử lý file key bằng PowerShell là gì?', [
    'Đường dẫn file .json trên máy tính cá nhân viết sai chính tả.',
    'Tài khoản dịch vụ Service Account của bạn chưa được cấp quyền truy cập project.',
    'Mã số ID thư mục lưu trữ Google Drive chứa ký tự khoảng trắng ở cuối.',
    'Quá trình sao chép chuỗi Base64 bằng tay bị thiếu ký tự, bị đứt dòng hoặc sử dụng nhầm lệnh chèn thêm các chuỗi tiêu đề certificate thừa.',
  ], 3),
  q('Tại sao việc sử dụng thuật toán băm MD5 hoặc SHA-1 thô để lưu trữ mật khẩu người dùng vào file dữ liệu phẳng ngày nay được coi là không còn an toàn trước hacker?', [
    'Vì dung lượng chuỗi băm của MD5 quá lớn làm tốn bộ nhớ RAM máy chủ.',
    'Vì MD5 không hỗ trợ kết hợp lưu trữ cùng số Căn cước công dân.',
    'Vì các thuật toán này có tốc độ xử lý quá nhanh, hacker có thể sử dụng các siêu máy tính hoặc bảng tra cứu trước (Rainbow Tables) để giải mã vét cạn hàng tỷ mật khẩu trong một giây.',
    'Do thuật toán MD5 tự động làm sập kết nối của dịch vụ Google Drive API.',
  ], 2),
  q('Trong cấu trúc file dữ liệu phẳng quản lý kết quả thi results.json, nếu một bản ghi điểm số của thí sinh có xuất hiện thêm hai trường dữ liệu là editedAt và editedBy, điều này thể hiện hành vi gì đã diễn ra trong hệ thống?', [
    'Tài khoản quản trị viên (Admin) đã can thiệp chỉnh sửa kết quả bài thi này vào một thời điểm cụ thể sau khi nộp bài.',
    'Thí sinh tự động thực hiện hành vi hack sửa điểm số bài làm của mình trên trình duyệt.',
    'Hệ thống tự động kích hoạt tính năng lưu mirror cục bộ khi mất mạng mạng LAN.',
    'Token phiên làm việc của thí sinh đã hết hạn hiệu lực 12 giờ quy định.',
  ], 0),
  q('Khi cấu hình tệp tin cấu hình môi trường hệ thống cho ứng dụng web, lỗi 404 File not found: <id> trả về từ log server xác định hệ thống của bạn đang điền sai thông tin của biến môi trường nào?', [
    'SESSION_SECRET',
    'GOOGLE_DRIVE_FOLDER_ID (Do copy thừa cả đường link URL, thừa khoảng trắng hoặc dùng ID của thư mục đã bị xóa hoàn toàn).',
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'ADMIN_CCCDS',
  ], 1),
];

/* ==================== BỘ ĐỀ SỐ 3 — 81 CÂU (75 TN + 6 TL) ==================== */
const SET3_QUESTIONS = [
// ---- MỤC A: NHẬN BIẾT — CHUYỂN ĐỔI SỐ CƠ BẢN (Câu 1–17) ----
q('Khái niệm "Chuyển đổi số" (Digital Transformation) được hiểu đầy đủ và chính xác nhất là gì?', [
'Là việc mua sắm thêm nhiều máy tính và thiết bị phần cứng hiện đại cho cơ quan.',
'Là việc số hóa văn bản giấy tờ sang file dạng PDF để lưu trữ nội bộ.',
'Là việc cài đặt các phần mềm diệt virus bản quyền trên máy tính cá nhân.',
'Là quá trình thay đổi tổng thể và toàn diện của cá nhân, tổ chức về cách sống, cách làm việc và phương thức sản xuất dựa trên các công nghệ số.',
], 3),
q('Trong các thành phần sau đây, đâu là "trung tâm", là mục tiêu phục vụ cốt lõi của tiến trình xây dựng Chính quyền số và Chuyển đổi số quốc gia?', [
'Các doanh nghiệp cung cấp giải pháp hạ tầng phần cứng mạng.',
'Các hệ thống máy chủ lưu trữ dữ liệu tập trung.',
'Người dân và doanh nghiệp.',
'Đội ngũ chuyên gia lập trình và quản trị hệ thống.',
], 2),
q('Hành động nào sau đây được phân loại vào bước "Số hóa thông tin" (Digitization) – mức độ cơ bản nhất của chuyển đổi số?', [
'Dùng máy quét (Scanner) hoặc điện thoại thông minh để chụp, quét một văn bản giấy rồi lưu thành tệp tin trên máy tính.',
'Sử dụng trí tuệ nhân tạo (AI) để phân tích tự động xu hướng dữ liệu.',
'Thay đổi hoàn toàn quy trình tiếp nhận hồ sơ từ trực tiếp sang 100% môi trường mạng.',
'Xây dựng kho dữ liệu dùng chung kết nối thông suốt giữa các bộ ban ngành.',
], 0),
q('Nền tảng ứng dụng nào sau đây đóng vai trò là Định danh điện tử quốc gia của Việt Nam, giúp người dân thực hiện các thủ tục hành chính không cần mang theo giấy tờ vật lý?', [
'Zalo.',
'VNeID.',
'VssID.',
'PC-Covid.',
], 1),
q('Mô hình điện toán nào cho phép người dùng truy cập, sử dụng tài nguyên phần mềm, lưu trữ dữ liệu mọi lúc mọi nơi thông qua kết nối Internet mà không cần tự duy trì máy chủ vật lý?', [
'Điện toán cục bộ (Local Computing).',
'Mạng lưu trữ gắn kèm cục bộ (NAS).',
'Điện toán đám mây (Cloud Computing).',
'Hệ thống lưu trữ dữ liệu phẳng JSON.',
], 2),
q('Trong xu thế phát triển công nghệ hiện nay, thuật ngữ "Dữ liệu lớn" (Big Data) dùng để chỉ những tập hợp dữ liệu có đặc trưng nổi bật nào?', [
'Dữ liệu có khối lượng cực lớn, tốc độ sinh trưởng nhanh và chủng loại rất đa dạng, vượt quá khả năng xử lý của các công cụ truyền thống.',
'Dữ liệu có dung lượng rất nhỏ và dễ dàng xử lý bằng phần mềm văn phòng Excel.',
'Dữ liệu chỉ bao gồm các file văn bản thuần không có hình ảnh hay video.',
'Dữ liệu được khóa bảo mật tuyệt đối bằng thuật toán mã hóa đối xứng AES.',
], 0),
q('Mục tiêu cơ bản của việc triển khai "Cổng dịch vụ công trực tuyến" tại các cơ quan nhà nước là gì?', [
'Để bán các sản phẩm phần mềm công nghệ cho người dân kiếm lợi nhuận.',
'Thay thế hoàn toàn vai trò quản lý điều hành của các cán bộ công chức.',
'Tự động xóa bỏ toàn bộ dữ liệu lịch sử nộp hồ sơ cũ của công dân.',
'Giúp người dân, doanh nghiệp có thể nộp hồ sơ, thủ tục hành chính từ xa qua Internet, tăng tính minh bạch và tiết kiệm chi phí, thời gian.',
], 3),
q('Khi nói về chuyển đổi số, yếu tố nào sau đây đóng vai trò quyết định sự thành bại cao nhất của một tổ chức?', [
'Nhận thức, tư duy và sự quyết tâm thay đổi của con người, đặc biệt là người đứng đầu.',
'Ngân sách kinh phí mua sắm thiết bị phần cứng công nghệ.',
'Tốc độ đường truyền băng thông Internet của nhà mạng.',
'Số lượng phần mềm mã nguồn mở được cài đặt vào hệ thống.',
], 0),
q('Khái niệm "Kinh tế số" được hiểu là các hoạt động kinh tế dựa trên nền tảng nào sau đây?', [
'Hoạt động sản xuất nông nghiệp truyền thống tại nông thôn.',
'Công nghệ số và nền tảng dữ liệu số.',
'Việc giao dịch mua bán hàng hóa bằng tiền mặt trực tiếp tại các chợ.',
'Các ngành công nghiệp khai thác tài nguyên thiên nhiên thô.',
], 1),
q('Hành vi nào sau đây của công dân góp phần tích cực vào mục tiêu xây dựng "Xã hội số"?', [
'Tích cực học hỏi kỹ năng số, sử dụng thanh toán không tiền mặt và thực hiện dịch vụ công trực tuyến.',
'Từ chối tiếp cận các thiết bị công nghệ và điện thoại thông minh.',
'Chỉ chia sẻ các thông tin giải trí chưa được kiểm chứng lên mạng xã hội.',
'Sử dụng chung một mật khẩu đơn giản cho tất cả các tài khoản cá nhân.',
], 0),
q('"Chính phủ số" khác với "Chính phủ điện tử" ở điểm cốt lõi nào sau đây?', [
'Chính phủ số không sử dụng mạng Internet để kết nối các cơ quan.',
'Chính phủ điện tử chỉ dùng máy tính chạy hệ điều hành Windows cũ.',
'Chính phủ điện tử tập trung vào số hóa quy trình cũ; Chính phủ số tập trung vào thay đổi mô hình hoạt động dựa trên dữ liệu và công nghệ số để tạo ra dịch vụ mới.',
'Chính phủ số bắt buộc người dân phải biết lập trình mã nguồn Backend.',
], 2),
q('Trong công cuộc chuyển đổi số, "Hạ tầng số" quốc gia bao gồm các thành phần cốt lõi nào?', [
'Hạ tầng viễn thông băng rộng, hạ tầng điện toán đám mây và các nền tảng dữ liệu, danh tính số.',
'Hệ thống đường giao thông và các tòa nhà trụ sở làm việc.',
'Hệ thống lưới điện quốc gia và các nhà máy thủy điện.',
'Mạng lưới các cửa hàng kinh doanh thiết bị điện tử bán lẻ.',
], 0),
q('Công nghệ nào cho phép máy tính tự học hỏi từ dữ liệu quá khứ để đưa ra các dự báo, quyết định hoặc tự động thực hiện các tác vụ thông minh thay con người?', [
'Mã hóa file đối xứng.',
'Cơ chế khóa luồng hàng đợi dữ liệu Mutex.',
'Trí tuệ nhân tạo và Học máy (AI / Machine Learning).',
'Chuyển đổi văn bản thuần sang chuỗi ký tự một dòng.',
], 2),
q('Mã QR (QR Code) được ứng dụng rộng rãi trong chuyển đổi số đời sống hàng ngày nhằm mục đích chính là gì?', [
'Mã hóa thông tin thành ma trận điểm hai chiều giúp các thiết bị di động quét và truy cập nhanh thông tin, liên kết hoặc thực hiện thanh toán.',
'Thay thế cho việc kết nối mạng WiFi và mạng LAN truyền thống.',
'Tự động tăng dung lượng bộ nhớ RAM của điện thoại di động.',
'Chặn toàn bộ các cuộc gọi và tin nhắn lừa đảo từ số lạ.',
], 0),
q('Cơ sở dữ liệu quốc gia về Dân cư do bộ ban ngành nào chủ trì xây dựng, đóng vai trò là dữ liệu gốc phục vụ chuyển đổi số?', [
'Bộ Thông tin và Truyền thông.',
'Bộ Công an.',
'Bộ Tư pháp.',
'Bộ Khoa học và Công nghệ.',
], 1),
q('Khi thực hiện thanh toán không dùng tiền mặt qua ứng dụng Ngân hàng số, phương thức quét mã nào sau đây đang được chuẩn hóa toàn quốc?', [
'Mã vạch một chiều (Barcode).',
'Mã ký tự Base64 một dòng.',
'Mã VietQR.',
], 2),
q('Khái niệm "Công dân số" (Digital Citizen) yêu cầu cá nhân cần có năng lực tối thiểu nào?', [
'Năng lực viết mã nguồn ứng dụng bằng các ngôn ngữ Node.js hoặc PHP.',
'Năng lực truy cập, sử dụng công nghệ số một cách an toàn, trách nhiệm, tuân thủ pháp luật và chuẩn mực đạo đức trên môi trường số.',
'Sở hữu ít nhất 3 chiếc máy tính cấu hình cao tại nhà.',
'Khai thác thành công các lỗi cấu hình bảo mật hệ thống web.',
], 1),
// ---- MỤC B: THÔNG HIỂU & ÁP DỤNG — KỸ NĂNG SỐ THIẾT YẾU (Câu 18–40) ----
q('Khi nộp hồ sơ dịch vụ công trực tuyến, tại sao hệ thống thường khuyến cáo công dân cung cấp tệp tin văn bản đã ký số (hoặc ký điện tử)?', [
'Để đảm bảo tính xác thực của người ký, chống chối bỏ trách nhiệm và phát hiện nếu nội dung file bị chỉnh sửa trái phép sau khi ký.',
'Để làm giảm dung lượng bộ nhớ lưu trữ file dữ liệu phẳng của server.',
'Vì hệ thống máy chủ không thể đọc được các file tài liệu dạng chữ thuần.',
'Nhằm mục đích kích hoạt tính năng tự động chấm điểm hồ sơ công dân.',
], 0),
q('Hành vi nào sau đây áp dụng đúng kỹ năng quản lý dữ liệu số cá nhân một cách khoa học trên môi trường đám mây?', [
'Lưu tất cả các file ảnh, văn bản vào một thư mục chung không đặt tên.',
'Chia sẻ quyền "Editor" công khai cho bất kỳ ai có đường link truy cập tài nguyên.',
'Đặt mật khẩu cho mọi file giống hệt với tên đăng nhập tài khoản email.',
'Sắp xếp file theo cấu trúc thư mục rõ ràng (năm, loại công việc), đặt tên file gợi nhớ, định kỳ xóa bỏ dữ liệu rác không còn giá trị.',
], 3),
q('Khi sử dụng ứng dụng VNeID mức độ 2, người dân có thể dùng thông tin hiển thị trên ứng dụng này để thay thế cho giấy tờ vật lý nào khi làm thủ tục tại sân bay?', [
'Căn cước công dân (hoặc Hộ chiếu).',
'Thẻ bảo hiểm y tế.',
'Giấy khai sinh bản gốc.',
'Giấy phép lái xe hạng A1.',
], 0),
q('Để chia sẻ một tài liệu văn bản trên Google Drive cho đồng nghiệp phối hợp sửa nội dung cùng lúc, bạn nên cấp quyền truy cập ở mức độ nào là phù hợp nhất?', [
'Viewer (Người xem).',
'Commenter (Người bình luận).',
'Editor (Người chỉnh sửa).',
'Chủ sở hữu hệ thống dữ liệu phẳng.',
], 2),
q('Chữ ký số (Digital Signature) hoạt động dựa trên cặp khóa bảo mật nào để đảm bảo tính xác thực toàn vẹn?', [
'Khóa đối xứng AES và chuỗi Base64.',
'Khóa bí mật (Private Key) để ký và Khóa công khai (Public Key) để xác thực.',
'Khóa logic XOR và hàm băm mật khẩu MD5.',
'Khóa hệ thống của bot Google Drive API.',
], 1),
q('Khi nhận thấy một file tài liệu trên máy tính có đuôi mở rộng lạ là .xlsx.exe hoặc .pdf.exe, bạn nên xử lý như thế nào?', [
'Tuyệt đối không mở file, tiến hành xóa file ngay lập tức vì đây có khả năng cao là mã độc lồng đuôi giả mạo file tài liệu.',
'Bấm đúp chuột để mở file ngay vì đây là tệp tin văn bản văn phòng.',
'Đổi tên file xóa chữ .exe đi rồi tiếp tục click mở bình thường.',
'Gửi file này qua email cho toàn bộ mọi người trong cơ quan cùng xem.',
], 0),
q('Nền tảng học trực tuyến mở (MOOCs) mang lại lợi ích lớn nhất nào cho cán bộ công chức trong công tác bồi dưỡng kỹ năng số?', [
'Tự động làm hộ bài thi trắc nghiệm của học viên khi đến hạn.',
'Cấp chứng chỉ tốt nghiệp tự động mà không cần tham gia thi đánh giá.',
'Cho phép tiếp cận kho bài giảng chất lượng cao, tự học mọi lúc mọi nơi theo tốc độ cá nhân, tiết kiệm chi phí đi lại.',
'Thay đổi toàn bộ cấu trúc file dữ liệu của hệ quản trị cơ sở dữ liệu.',
], 2),
q('Khi làm việc trên môi trường mạng, hành vi nào thể hiện kỹ năng giao tiếp văn minh, tuân thủ Luật An ninh mạng và Bộ quy tắc ứng xử trên mạng xã hội?', [
'Sử dụng tài khoản ẩn danh để đi bình luận xúc phạm, bôi nhọ uy tín người khác.',
'Sao chép toàn bộ bài viết của người khác về trang cá nhân và tự nhận là của mình.',
'Chỉ chia sẻ các thông tin rõ nguồn gốc từ cơ quan chính thống, sử dụng ngôn từ lịch sự, không kích động bạo lực hay lan truyền tin giả.',
'Tự động thêm bạn bè vào các nhóm quảng cáo kinh doanh khi chưa được sự đồng ý.',
], 2),
q('Hành vi "Thanh toán bằng quét mã QR tĩnh" dán tại quầy hàng tiềm ẩn rủi ro lừa đảo công nghệ gì nếu người mua lơ là không kiểm tra?', [
'Kẻ gian lén lút dán đè một mã QR khác chứa tài khoản của họ lên trên mã QR thật của cửa hàng để chiếm đoạt tiền chuyển khoản.',
'Hacker tự động hack chiếm quyền điều khiển điện thoại thông minh qua camera.',
'Điện thoại của người mua tự động sụt giảm dung lượng lưu trữ file dữ liệu.',
'Hệ thống mạng WiFi của cửa hàng sẽ bị sập do quá tải yêu cầu giao dịch.',
], 0),
q('Khi cấu hình một file biểu mẫu khảo sát trực tuyến (Google Forms / Microsoft Forms) thu thập thông tin cá nhân của người dân, lập trình viên cần lưu ý nguyên tắc bảo mật nào?', [
'Mở công khai kết quả phản hồi cho tất cả mọi người cùng xem để tăng tính minh bạch.',
'Tự động lưu trữ thông tin mật khẩu tài khoản cá nhân của người điền form.',
'Chuyển đổi toàn bộ biểu mẫu sang định dạng file văn bản thô 1 dòng.',
'Chỉ thu thập đúng các trường thông tin cần thiết, giới hạn quyền xem trang kết quả phản hồi cho người có trách nhiệm và bật bảo mật tài khoản quản trị.',
], 3),
q('Trong công tác số hóa hồ sơ, kỹ thuật "Nhận dạng ký tự quang học" (OCR) đóng vai trò gì quan trọng?', [
'Tự động dịch ngôn ngữ văn bản từ tiếng Việt sang tiếng Anh.',
'Chuyển đổi hình ảnh của văn bản chữ viết tay hoặc chữ in thành dữ liệu văn bản dạng chữ thuần có thể tìm kiếm và chỉnh sửa được.',
'Mã hóa file tài liệu bằng thuật toán đối xứng chuỗi nén.',
'Tự động gửi file văn bản lên thư mục lưu trữ đám mây của Google Drive.',
], 1),
q('Khi trình duyệt hiển thị cảnh báo "Kết nối của bạn không phải là kết nối riêng tư" (Lỗi SSL/TLS), hành động xử lý nào an toàn nhất cho người dùng?', [
'Bấm chọn mục "Nâng cao" và tiếp tục truy cập trang web bất chấp cảnh báo.',
'Tắt tính năng diệt virus của máy tính để trình duyệt không báo lỗi nữa.',
'Cài đặt lại hệ điều hành của máy tính để khắc phục lỗi mạng.',
'Dừng truy cập trang web đó ngay lập tức, không điền bất kỳ thông tin tài khoản hay mật khẩu nào trên giao diện này.',
], 3),
q('Chức năng "Đồng bộ hóa dữ liệu" (Data Synchronization) trên các thiết bị di động có ý nghĩa như thế nào trong đời sống số?', [
'Làm tăng kích thước dung lượng lưu trữ của các file ảnh cục bộ.',
'Chuyển toàn bộ cuộc gọi thông thường sang cuộc gọi mã hóa qua Internet.',
'Tự động cập nhật, sao lưu dữ liệu đồng nhất giữa điện thoại, máy tính và Cloud, giúp không bị mất mát thông tin khi thiết bị phần cứng bị hỏng.',
'Tự động xóa bỏ các tài khoản người dùng không hoạt động trong 15 phút.',
], 2),
q('Khi nhận được một tài liệu chia sẻ qua Cloud có quyền "Editor", nếu bạn lỡ tay xóa một thư mục quan trọng, làm thế nào để khôi phục lại dữ liệu?', [
'Hệ thống đã mất dữ liệu vĩnh viễn không thể lấy lại được.',
'Truy cập vào mục "Thùng rác" (Trash/Bin) của dịch vụ đám mây đó để tìm lại thư mục bị xóa và bấm nút Khôi phục (Restore).',
'Chạy lệnh PowerShell băm mật khẩu dưới máy tính cá nhân.',
'Yêu cầu tất cả người dùng khác đăng xuất khỏi hệ thống mạng.',
], 1),
q('Kỹ năng "Xác thực nguồn tin" trước khi chia sẻ một bài viết lên mạng xã hội đòi hỏi bạn phải kiểm tra yếu tố nào?', [
'Số lượng lượt thích (Like) và lượt chia sẻ (Share) của bài viết đó.',
'Hình ảnh minh họa của bài viết có màu sắc bắt mắt sống động không.',
'Độ dài văn bản của bài viết có trên 2.000 ký tự hay không.',
'Bài viết có đến từ trang thông tin điện tử có tên miền chính thống (đuôi .gov.vn, .org.vn) hoặc cơ quan báo chí uy tín không.',
], 3),
q('Khi sử dụng phần mềm họp trực tuyến (như Zoom, Microsoft Teams), để ngăn chặn kẻ xấu vào phá hoại hoặc phát tán nội dung độc hại, giải pháp nào sau đây là cần thiết?', [
'Công khai ID và mật khẩu phòng họp lên các hội nhóm mạng xã hội lớn.',
'Bật tính năng "Phòng chờ" (Waiting Room), đặt mật khẩu mạnh cho phòng họp và chỉ duyệt những người có tên trong danh sách xác thực vào họp.',
'Tắt tính năng tường lửa bảo mật mạng của máy chủ máy tính.',
'Ép buộc tất cả thành viên tham gia phải sử dụng kết nối mạng VPN.',
], 1),
q('Việc tắt tính năng "Tự động kết nối WiFi" (Auto-connect) trên điện thoại thông minh mang lại lợi ích gì về mặt an toàn thông tin?', [
'Ngăn chặn điện thoại tự động kết nối vào các mạng WiFi giả mạo, WiFi độc hại do hacker lập ra để chặn bắt dữ liệu người dùng khi bạn di chuyển.',
'Giúp điện thoại bắt sóng mạng di động 4G/5G tốt hơn.',
'Làm tăng tốc độ xử lý điểm số của các ứng dụng thi trực tuyến.',
'Xóa bỏ toàn bộ bộ nhớ đệm cache cookies của trình duyệt web.',
], 0),
q('Khi gửi một tệp tin tài liệu nhạy cảm qua Email công vụ, giải pháp nào tăng cường bảo mật dữ liệu tốt nhất?', [
'Dán thẳng toàn bộ nội dung tài liệu nhạy cảm vào phần thân email chữ thuần.',
'Thay đổi phần mở rộng đuôi file sang định dạng cấu trúc phẳng JSON.',
'Nén tệp tin lại, đặt mật khẩu bảo vệ mạnh cho file nén đó và gửi mật khẩu qua một kênh liên lạc tách biệt (như gọi điện hoặc nhắn tin SMS).',
'Gửi kèm file đó cho toàn bộ địa chỉ email có trong danh bạ hệ thống.',
], 2),
q('Trong bảng tính Excel, để đảm bảo người nhập liệu không gõ sai định dạng ngày tháng hoặc số Căn cước công dân (CCCD), tính năng nào cần được áp dụng?', [
'Conditional Formatting.',
'Pivot Table.',
'AutoFilter.',
'Data Validation (Kiểm tra hợp lệ dữ liệu).',
], 3),
q('Khái niệm "Chữ ký số công cộng" được cấp bởi các đơn vị được cấp phép có giá trị pháp lý tương đương với yếu tố nào trong môi trường truyền thống?', [
'Lời nói chứng thực của người làm chứng tại cơ quan thẩm quyền.',
'Mật khẩu truy cập vào hệ thống dashboard quản trị nội bộ.',
'Chữ ký tay của cá nhân và con dấu của tổ chức, doanh nghiệp trên văn bản giấy.',
'Mã định danh duy nhất của thiết bị phần cứng máy tính.',
], 2),
q('Hành vi nào sau đây vi phạm quyền sở hữu trí tuệ và bản quyền trên môi trường số?', [
'Tải về, tự ý chỉnh sửa xóa tên tác giả rồi đăng tải lại phần mềm bản quyền, hình ảnh độc quyền lên trang web cá nhân để kinh doanh thương mại.',
'Trích dẫn nguồn rõ ràng tên tác giả khi sử dụng một phần bài viết nghiên cứu.',
'Mua bản quyền ứng dụng từ cửa hàng ứng dụng chính thống.',
'Sử dụng các bài học an toàn thông tin miễn phí của cổng đào tạo.',
], 0),
q('Khi thiết lập hệ thống định danh, hàm so sánh chuỗi mật khẩu thông thường (như ===) dễ bị tấn công phân tích thời gian phản hồi (Timing Attack). Lập trình viên phòng thủ bằng cách nào?', [
'Mã hóa đầu vào của người dùng thành một chuỗi Base64 ngẫu nhiên.',
'Chuyển câu lệnh so sánh chuỗi thực hiện trực tiếp trên dịch vụ đám mây Cloud.',
'Sử dụng cơ chế so sánh thời gian cố định (Constant-time comparison) bằng hàm chuyên dụng của thư viện crypto.',
'Giảm độ dài mật khẩu đăng ký tối đa xuống còn 6 ký tự.',
], 2),

q('Một hệ thống quản lý hồ sơ công vụ lưu trữ thông tin bằng các file dữ liệu phẳng .json trên RAM cache và đồng bộ bất đồng bộ lên Drive. Khi nhiều người cùng thao tác dồn dập, cơ chế nào đảm bảo dữ liệu không bị ghi đè lẫn nhau?', [
'Cơ chế mã hóa tệp tin bằng thuật toán AES đối xứng.',
'Tự động ngắt kết nối Internet của các tài khoản gửi yêu cầu muộn hơn.',
'Chuyển đổi toàn bộ dữ liệu người dùng sang định dạng hex 96 ký tự.',
'Cơ chế khóa luồng Mutex (Promise-chain Locking) để cô lập phiên ghi tại một thời điểm.',
], 3),

q('Trên hệ điều hành Linux của máy chủ, lệnh nào sau đây được sử dụng để nén thư mục mã nguồn và dữ liệu phẳng thành tệp sao lưu dự phòng nhanh nhất?', [
'cat /etc/passwd > backup.txt',
'grep -r "secret" ./src',
'tar -czf backup_data.tar.gz ./data ./src',
'chmod 755 server.js',
], 2),

q('Khi người dân sử dụng dịch vụ công trực tuyến, tiêu đề HTTP nào (HTTP Header) tự động gửi kèm để hệ thống nhận biết họ đang thao tác bằng điện thoại Android, iPhone hay máy tính Windows?', [
'User-Agent',
'Cookie',
'Content-Type',
'Referer',
], 0),

q('Một trang web dịch vụ công bị cấu hình sai lỗi CORS (Cross-Origin Resource Sharing) cho phép giá trị Origin là "*". Nguy cơ bảo mật nghiêm trọng nào sẽ xảy ra?', [
'Hệ thống máy chủ tự động chuyển sang Chế độ cục bộ (Local mode).',
'Các trang web độc hại của bên thứ ba có thể gửi yêu cầu trái phép để đọc dữ liệu nhạy cảm hoặc chiếm đoạt phiên làm việc của người dân.',
'Ứng dụng Express sẽ bị sập hoàn toàn do quá tải hàng đợi ghi.',
'Dung lượng lưu trữ của tài khoản Google Drive Service Account bị đầy vĩnh viễn.',
], 1),

q('Trong quy trình phát triển phần mềm an toàn, mục đích chính của việc sử dụng các truy vấn có tham số (Parameterized Queries / Prepared Statements) là để ngăn chặn lỗ hổng nào?', [
'Path Traversal nhảy thư mục hệ thống.',
'SQL Injection chèn câu lệnh truy vấn dữ liệu trái phép.',
'Command Injection chèn lệnh hệ điều hành chạy ngầm.',
'Brute Force dò quét mật khẩu hàng loạt.',
], 1),

q('Kẻ tấn công lợi dụng tính năng hiển thị file tài liệu của hệ thống, nhập vào chuỗi truy cập: "?file=../../../../src/config.js" nhằm đánh cắp biến môi trường SESSION_SECRET. Website đang dính lỗ hổng gì?', [
'Broken Authentication',
'Path Traversal (Duyệt qua đường dẫn tệp tin trái phép)',
'Command Injection',
'SQL Injection',
], 1),

q('Khi server Node.js nhận được tín hiệu ngắt hệ thống SIGTERM từ nền tảng hosting Render, hàm xử lý nào bắt buộc phải được gọi ngay lập tức để bảo toàn dữ liệu thi?', [
'Hàm xóa bỏ toàn bộ mật khẩu người dùng để bảo mật.',
'Hàm tự động gửi email thông báo lỗi hệ thống cho quản trị viên.',
'Hàm flush() để ghi toàn bộ dữ liệu từ RAM cache đồng bộ vĩnh viễn lên Google Drive.',
'Hàm reset lại mã ID của thư mục Google Drive.',
], 2),

q('[TỰ LUẬN NGẮN] Bạn hãy trình bày ngắn gọn ý nghĩa của việc xây dựng kho dữ liệu số dùng chung đối với công tác quản lý hành chính nhà nước?', [
'Hướng dẫn chấm: Thí sinh nêu được tối thiểu 2 trong các ý sau: \n1. Tăng tính liên thông, chia sẻ dữ liệu giữa các phòng ban, đơn vị.\n2. Giảm thiểu các thủ tục rườm rà, hạn chế việc người dân phải nộp nhiều bản giấy tờ trùng lặp.\n3. Tối ưu hóa thời gian xử lý và nâng cao hiệu quả ra quyết định quản lý.',
], 0),

q('[TỰ LUẬN NGẮN] Cơ chế xác thực hai lớp (2FA/MFA) hỗ trợ bảo vệ tài khoản công vụ của công chức như thế nào khi mật khẩu chính bị hacker dò quét được?', [
'Hướng dẫn chấm: Khi mật khẩu chính bị lộ, 2FA yêu cầu thêm một yếu tố xác thực thứ hai (như mã OTP gửi về điện thoại hoặc ứng dụng xác thực) mà chỉ người dùng thật mới nắm giữ. Hacker nếu không có thiết bị vật lý này thì không thể đăng nhập trái phép vào hệ thống.',
], 0),

q('[TỰ LUẬN NGẮN] Vai trò nòng cốt của lực lượng thanh niên và Tổ công nghệ số cộng đồng tại các khu phố, thôn bản trong chiến dịch Bình dân học vụ số là gì?', [
'Hướng dẫn chấm: Là lực lượng trực tiếp đi từng ngõ, gõ từng nhà để phổ cập kỹ năng số cho người dân; hướng dẫn trực tiếp cách cài đặt ứng dụng định danh VNeID, đăng ký tài khoản dịch vụ công trực tuyến và thực hiện thanh toán không dùng tiền mặt tại địa phương.',
], 0),


// ========================================================================
// BỘ ĐỀ 4: BÌNH DÂN HỌC VỤ SỐ VÀ AN TOÀN THÔNG TIN ĐẠI CHÚNG
// Thời gian làm bài: 35 phút | Số lượng: 50 câu (47 Trắc nghiệm + 3 Tự luận ngắn)
// ========================================================================

q('Thủ đoạn lừa đảo sử dụng công nghệ Trí tuệ nhân tạo để giả mạo hình ảnh, giọng nói của người thân nhằm mục đích vay tiền gấp có tên gọi là gì?', [
'Phishing Email',
'AI Deepfake lừa đảo đại chúng',
'Tấn công DDoS hệ thống',
'Mã độc tống tiền Ransomware',
], 1),

q('Khi nhận được tin nhắn thương hiệu (SMS Brandname) giả mạo Ngân hàng thông báo tài khoản bị khóa và yêu cầu truy cập link lạ để mở lại, người dân cần làm gì?', [
'Bấm ngay vào đường link để thực hiện theo hướng dẫn bảo mật.',
'Tuyệt đối không bấm vào link, gọi lên tổng đài chính thức của Ngân hàng để xác minh hoặc báo cơ quan Công an.',
'Gửi tin nhắn chứa thông tin số thẻ và mã PIN để hệ thống tự xử lý.',
'Chuyển tiếp tin nhắn đó cho nhiều người trong danh bạ cùng xử lý.',
], 1),

q('Để bảo vệ thông tin cá nhân khi tương tác trên môi trường mạng xã hội, hành vi nào sau đây được khuyến nghị?', [
'Công khai số điện thoại, ngày sinh và số CCCD lên phần mô tả thông tin cá nhân.',
'Kiểm tra kỹ quyền truy cập của ứng dụng và chỉ chia sẻ thông tin thực sự thiết yếu.',
'Cài đặt các ứng dụng không rõ nguồn gốc từ các liên kết lạ hoặc file đuôi .APK.',
'Sử dụng chung một mật khẩu đơn giản cho tất cả tài khoản trực tuyến của mình.',
], 1),

q('Khi kết nối vào mạng WiFi công cộng không có mật khẩu (như tại quán cà phê, quảng trường), rủi ro lớn nhất về an toàn thông tin là gì?', [
'Thiết bị di động của người dùng bị sụt dung lượng pin nhanh hơn.',
'Hệ điều hành của máy tự động xóa bỏ toàn bộ danh bạ điện thoại.',
'Kẻ xấu có thể chặn bắt và đọc trộm các gói tin truyền qua mạng (như mật khẩu, tài khoản ngân hàng không mã hóa).',
'Tốc độ tải video của thiết bị bị giảm đi đáng kể.',
], 2),

q('Một phần mềm độc hại phát tán ngầm dưới dạng ứng dụng mã nguồn mở tên là "OpenClaw" có hành vi nguy hiểm nào sau đây?', [
'Đánh cắp thông tin ví tiền điện tử và dữ liệu lưu trong trình quản lý mật khẩu của nạn nhân.',
'Tự động tối ưu hóa và dọn dẹp các tệp tin rác của hệ điều hành.',
'Tạo ra các chứng chỉ bảo mật SSL miễn phí cấp cho trang web dịch vụ công.',
'Ngắt kết nối mạng WiFi của các máy tính xung quanh khu vực.',
], 0),

q('Cơ chế xác thực 2 lớp (2FA/MFA) giúp bảo vệ an toàn tài khoản số của người dân dựa trên nguyên lý cốt lõi nào?', [
'Kết hợp giữa cái người dùng biết (mật khẩu) và cái người dùng có/nắm giữ (mã OTP thiết bị vật lý hoặc ứng dụng xác thực).',
'Yêu cầu người dùng phải nhập mật khẩu chính xác hai lần liên tiếp khi đăng nhập.',
'Tự động thay đổi tên hiển thị của tài khoản sau mỗi 12 giờ.',
'Chặn tất cả các địa chỉ IP truy cập từ bên ngoài khu vực tỉnh thành.',
], 0),

q('Dấu hiệu nào sau đây cảnh báo rõ ràng nhất việc một chiếc điện thoại thông minh đã bị dính mã độc chiếm quyền điều khiển từ xa?', [
'Thiết bị tự động mở ứng dụng, màn hình tự sáng vào ban đêm, tài khoản ngân hàng số tự thực hiện lệnh chuyển tiền dù không thao tác.',
'Điện thoại hiển thị thông báo yêu cầu cắm sạc khi dung lượng pin xuống dưới 20%.',
'Thời gian tải trang web chậm hơn bình thường khoảng 2 giây do sóng yếu.',
'Ứng dụng camera tự động tắt khi người dùng chuyển sang chế độ chụp đêm.',
], 0),

q('Khi thiết lập mật khẩu cho tài khoản số cá nhân, cụm từ nào sau đây được đánh giá là mạnh và an toàn nhất trước các cuộc tấn công dò quét?', [
'admin123456',
'vksnddanang2026',
'Kh0nG_S0_M4_D0c_!@#',
'13102026',
], 2),

q('Mục đích chính của chiến dịch "Bình dân học vụ số" được triển khai rộng rãi tại các địa phương hiện nay là gì?', [
'Phổ cập các kỹ năng số cơ bản, nâng cao nhận thức an toàn thông tin và xóa mù công nghệ cho mọi tầng lớp nhân dân.',
'Đào tạo chuyên sâu các kỹ sư công nghệ thông tin trình độ cao.',
'Bán các phần mềm diệt virus có bản quyền thương mại cho người dân.',
'Thay thế toàn bộ các thủ tục hành chính trực tiếp bằng robot tự động.',
], 0),

q('Khi chia sẻ thông tin trên môi trường số, việc chụp ảnh và đăng tải rõ nét Căn cước công dân (CCCD) lên mạng xã hội có thể dẫn đến hậu quả gì?', [
'Tội phạm công nghệ cao lợi dụng hình ảnh đó để đăng ký vay tiền app trực tuyến, mở tài khoản ngân hàng rác hoặc lừa đảo chiếm đoạt tài sản.',
'Tài khoản mạng xã hội của bạn sẽ nhận được nhiều tương tác hơn.',
'Hệ thống VNeID sẽ tự động nâng cấp tài khoản của bạn lên mức độ 2.',
'Làm tăng băng thông truyền tải dữ liệu của mạng viễn thông địa phương.',
], 0),

q('Để nhận biết một trang web có nguy cơ cao là giả mạo (Phishing page) nhằm đánh cắp thông tin, yếu tố nào dưới đây là quan trọng nhất cần kiểm tra?', [
'Tên miền (Domain) trên thanh địa chỉ bị sai lỗi chính tả, sai đuôi mở rộng (ví dụ: vksnd.gov.vn bị đổi thành vksnd-gov.com hoặc vks-danang.net).',
'Màu sắc giao diện của trang web đậm hay nhạt hơn bình thường.',
'Trang web không có các hiệu ứng chuyển động hoặc không có video giới thiệu.',
'Số lượng bài viết hiển thị trên trang chủ ít hơn 10 bài.',
], 0),
q('Hành vi nào sau đây thể hiện kỹ năng số văn minh và an toàn khi tham gia các hội nhóm công cộng trên môi trường mạng?', [
'Chia sẻ ngay các tin tức giật gân, chưa được kiểm chứng từ các nguồn tin lạ.',
'Sử dụng tài khoản ảo để công kích, nói xấu các cơ quan, tổ chức nhà nước.',
'Không lăng mạ, xúc phạm người khác; không phát tán thông tin độc hại và chủ động xác minh tính xác thực của tin tức trước khi chia sẻ.',
'Tự ý thu thập và công khai số điện thoại, thông tin gia đình của người khác lên mạng.',
], 2),
q('Ứng dụng di động chính thống nào dưới đây do Bộ Công an phát triển nhằm phục vụ định danh, xác thực điện tử và dịch vụ công cho công dân Việt Nam?', [
'Zalo',
'VssID',
'eTax Mobile',
'VNeID',
], 3),
q('Khi người dân nhận được cuộc gọi từ số lạ tự xưng là cán bộ Viện kiểm sát hoặc Công an đe dọa liên quan đến đường dây tội phạm và yêu cầu chuyển tiền vào tài khoản tạm giữ, hành vi ứng xử đúng nhất là gì?', [
'Hoảng sợ và ra ngay ngân hàng rút toàn bộ tiền tiết kiệm chuyển theo yêu cầu.',
'Tuyệt đối không cung cấp thông tin cá nhân, không chuyển tiền, tắt máy và báo ngay cho cơ quan chức năng hoặc Công an nơi gần nhất.',
'Cung cấp toàn bộ mật khẩu ứng dụng ngân hàng số để cán bộ tự kiểm tra.',
'Rủ thêm người thân cùng nộp tiền để cùng chứng minh sự trong sạch.',
], 1),
q('Tại sao việc cài đặt các ứng dụng bẻ khóa (Crack), phần mềm lậu trên máy tính cá nhân lại có nguy cơ gây mất an toàn thông tin rất cao?', [
'Làm máy tính chạy tốn nhiều điện năng hơn bình thường.',
'Các file bẻ khóa thường bị kẻ xấu chèn sẵn mã độc chạy ngầm (Trojan, Keylogger) để thu thập mật khẩu và chiếm quyền điều khiển máy.',
'Hệ điều hành sẽ tự động xóa bỏ toàn bộ các bộ cài Microsoft Office.',
'Trình duyệt web không thể truy cập được vào các trang mạng xã hội.',
], 1),
q('Khi thiết lập hệ thống Web, một lỗ hổng xuất hiện nếu lập trình viên dùng thư viện xác thực nhưng lại gọi hàm "jwt.decode()" mà không verify chữ ký. Nguy cơ nào xảy ra?', [
'Hệ thống tự động xóa dữ liệu tệp phẳng lưu trên RAM cache.',
'Kẻ tấn công có thể tự tạo ra một token giả với quyền Admin để đăng nhập trái phép mà hệ thống vẫn chấp nhận.',
'Trình duyệt của người dùng sẽ tự động chặn toàn bộ yêu cầu HTTP.',
'Lượt thi của thí sinh sẽ tự động được cộng thêm thời gian làm bài.',
], 1),
q('Trong kịch bản diễn tập an toàn thông tin phòng thủ chuỗi thử thách Natas, lỗi cấu hình file "robots.txt" thường bị lợi dụng để làm gì?', [
'Tấn công từ chối dịch vụ làm sập hoàn toàn máy chủ Express.',
'Thay đổi thuật toán băm mật khẩu từ scrypt sang MD5 thô.',
'Tự động phân quyền Editor thư mục Drive cho Service Account.',
'Kẻ tấn công đọc nội dung file để tìm ra các thư mục ẩn, đường dẫn nhạy cảm mà quản trị viên cố tình giấu không cho bộ máy tìm kiếm quét dữ liệu.',
], 3),
q('Khi xây dựng chức năng tải file lên máy chủ (File Upload), nếu lập trình viên chỉ kiểm tra đuôi file bằng JavaScript ở Frontend thì kẻ tấn công vượt qua bằng cách nào?', [
'Tấn công Brute Force bẻ khóa mật khẩu tài khoản Admin.',
'Thay đổi mã ID thư mục Google Drive lưu trữ hệ thống.',
'Sử dụng thuật toán mã hóa đối xứng AES để mã hóa file độc hại.',
'Sử dụng công cụ chặn bắt như Burp Suite để sửa đổi đuôi file trực tiếp trên đường truyền HTTP request sau khi đã vượt qua bộ lọc Frontend.',
], 3),
q('Lỗ hổng bảo mật nào cho phép kẻ tấn công chèn chuỗi ký tự chứa lệnh hệ điều hành (ví dụ dấu chấm phẩy và lệnh hệ thống) vào ô nhập liệu để ép máy chủ thực thi mã độc?', [
'SQL Injection',
'Path Traversal',
'Cookie Tampering',
'Command Injection',
], 3),
q('Biện pháp phòng thủ nào dưới đây giúp ngăn chặn triệt để lỗ hổng Path Traversal khi hệ thống thực hiện đọc ghi file dựa trên tham số người dùng nhập vào?', [
'Chuyển toàn bộ hệ thống sang sử dụng giao thức bảo mật HTTPS.',
'Mã hóa toàn bộ nội dung file lưu trên ổ cứng bằng thuật toán băm SHA-256.',
'Đặt thời hạn hiệu lực của mã token phiên làm việc xuống còn 15 phút.',
'Lọc sạch và chặn toàn bộ các chuỗi ký tự điều hướng nhảy thư mục nguy hiểm như "../" hoặc "..\".',
], 3),
q('Kỹ thuật tấn công chèn câu lệnh truy vấn dữ liệu trái phép vào các ô nhập liệu nhằm bẻ khóa logic xác thực đăng nhập mà không cần biết mật khẩu thật có tên gọi là gì?', [
'Command Injection',
'Path Traversal',
'Brute Force Attack',
'SQL Injection',
], 3),
q('Để bảo vệ thư mục máy chủ khỏi mã độc PHP đội lốt file ảnh, kỹ thuật đọc các byte đặc trưng nhận diện định dạng thực tế ở đầu file được gọi là gì?', [
'Kiểm tra Mime-Type',
'Kiểm tra File Extension',
'Kiểm tra File Size',
'Kiểm tra Magic Bytes (ví dụ kiểm tra chuỗi GIF8; ở đầu file)',
], 3),
q('Khi cấu hình file "render.yaml" để triển khai ứng dụng 1-click lên hosting Render, biến môi trường nào bắt buộc phải chứa chuỗi Base64 của file key dịch vụ đám mây?', [
'SESSION_SECRET',
'GOOGLE_DRIVE_FOLDER_ID',
'ADMIN_CCCDS',
'GOOGLE_SERVICE_ACCOUNT_JSON',
], 3),
q('Khi người dân thực hiện thanh toán hóa đơn bằng mã QR trên ứng dụng Ngân hàng số, hành vi nào sau đây cần làm để đảm bảo không bị chuyển nhầm tiền cho kẻ lừa đảo?', [
'Bấm xác nhận chuyển tiền ngay lập tức sau khi quét mã xong.',
'Luôn kiểm tra kỹ tên chủ tài khoản nhận và số tiền hiển thị trên ứng dụng có trùng khớp với thông tin đơn vị cung cấp dịch vụ hay không.',
'Chụp ảnh màn hình mã QR đăng tải công khai lên các diễn đàn mạng xã hội.',
'Nhờ người lạ xung quanh bấm hộ mã PIN xác thực giao dịch tài chính.',
], 1),
q('Hình thức tấn công gửi hàng loạt yêu cầu truy cập dồn dập từ nhiều nguồn khác nhau nhằm làm tê liệt, nghẽn băng thông và gây sập website dịch vụ công gọi là gì?', [
'Phishing',
'SQL Injection',
'Tấn công từ chối dịch vụ phân tán (DDoS)',
'Path Traversal',
], 2),
q('Khi người dân đổi điện thoại mới, để chuyển ứng dụng định danh điện tử VNeID mức độ 2 sang thiết bị mới một cách an toàn và nhanh nhất, cơ chế nào được sử dụng?', [
'Đến trực tiếp cơ quan Công an quận, huyện để làm lại từ đầu.',
'Nhờ tổng đài viễn thông gửi lại toàn bộ file dữ liệu phẳng lưu trên RAM.',
'Tự ý sửa đổi thông tin file cấu hình .env của ứng dụng trên máy tính.',
'Sử dụng tính năng đăng nhập bằng quét chip NFC trên thẻ Căn cước công dân gắn chip bằng điện thoại mới.',
], 3),
q('Trong việc quản lý mật khẩu gia đình, thói quen nào sau đây giúp người cao tuổi bảo vệ tài khoản số của mình an toàn nhất?', [
'Ghi mật khẩu lên tờ giấy nhớ và dán trực tiếp lên mặt trước của màn hình máy tính.',
'Đặt mật khẩu là số điện thoại hoặc họ tên đầy đủ không dấu của mình.',
'Sử dụng cụm từ mật khẩu gắn liền với một kỷ niệm đặc biệt, có viết hoa, thêm số, ký tự đặc biệt và tuyệt đối không chia sẻ cho người lạ.',
'Sử dụng chung một mật khẩu duy nhất cho cả tài khoản Facebook và tài khoản Ngân hàng.',
], 2),
q('Khi sử dụng các ứng dụng mạng xã hội, tính năng "Quyền riêng tư" cần được cấu hình như thế nào để hạn chế bị tội phạm thu thập thông tin lập tài khoản giả mạo?', [
'Để chế độ công khai hoàn toàn tất cả bài viết, danh sách bạn bè và số điện thoại.',
'Giới hạn đối tượng xem danh sách bạn bè, thông tin liên hệ và bài viết cá nhân ở chế độ "Chỉ bạn bè" hoặc "Chỉ mình tôi".',
'Tắt tính năng xác thực 2 lớp để tránh bị nghẽn mạng viễn thông.',
'Cho phép tất cả người lạ tự động gắn thẻ (tag) vào các bài viết quảng cáo.',
], 1),
q('Trong kiến trúc hệ thống dịch vụ công trực tuyến, thành phần "RAM cache" đóng vai trò gì trong việc tối ưu hóa hiệu suất phục vụ người dân?', [
'Lưu trữ dữ liệu vĩnh viễn kể cả khi máy chủ bị mất điện đột ngột.',
'Tự động băm mật khẩu người dùng bằng thuật toán scrypt nâng cao.',
'Lưu trữ tạm thời dữ liệu phẳng được tải về từ Google Drive lúc khởi động để phục vụ truy vấn của người dùng với tốc độ tối đa, không gây nghẽn hệ thống.',
'Quét các cổng dịch vụ mạng đang mở của hệ thống máy tính người dân.',
], 2),
q('[TỰ LUẬN NGẮN] Nêu các dấu hiệu cơ bản để người dân nhận biết một video cuộc gọi trực tuyến có sử dụng công nghệ lừa đảo Deepfake?', [
'Hướng dẫn chấm: Thí sinh nêu được tối thiểu 2 trong các dấu hiệu sau:\n1. Khuôn mặt người gọi nhìn đơ cứng, cử động mắt, môi không tự nhiên hoặc bị méo mó.\n2. Giọng nói bị trễ nhịp so với hình ảnh, nghe có tiếng robot hoặc không rõ ràng.\n3. Hướng ánh sáng trên khuôn mặt không đồng nhất với môi trường xung quanh, xuất hiện các vùng mờ quanh viền cổ và tóc.',
], 0),
q('[TỰ LUẬN NGẮN] Việc cài đặt các ứng dụng bẻ khóa (Crack) hoặc tự ý tải các tệp tin đuôi .apk không rõ nguồn gốc từ Internet tiềm ẩn rủi ro gì cho điện thoại của người dân?', [
'Hướng dẫn chấm: Thí sinh nêu được các ý cốt lõi:\nCác phần mềm này thường bị tội phạm công nghệ cao chèn sẵn mã độc ngầm (Trojan, Keylogger). Khi cài đặt vào máy, mã độc sẽ đánh cắp mật khẩu, thông tin tài khoản ngân hàng số hoặc tự động chiếm quyền trợ năng (Accessibility Service) để theo dõi hành vi và điều khiển điện thoại trái phép từ xa nhằm chiếm đoạt tài sản.',
], 0),
q('[TỰ LUẬN NGẮN] Để lan tỏa mạnh mẽ phong trào Bình dân học vụ số và hỗ trợ người dân yếu thế tiếp cận công nghệ tại địa phương, lực lượng đoàn viên thanh niên cần triển khai những giải pháp cụ thể nào?', [
'Hướng dẫn chấm: Thí sinh nêu được tối thiểu 2 giải pháp thiết thực:\n1. Thành lập các tổ công nghệ số thanh niên xung kích trực tiếp hỗ trợ, hướng dẫn người dân tại bộ phận một cửa hoặc các nhà văn hóa.\n2. Triển khai các chiến dịch "đi từng ngõ, gõ từng nhà" cầm tay chỉ việc hướng dẫn người cao tuổi, người lao động cách sử dụng dịch vụ công, cài VNeID và thanh toán không dùng tiền mặt.\n3. Tổ chức các buổi tuyên truyền chuyên đề sinh động về nhận biết thủ đoạn lừa đảo công nghệ cao để nâng cao sức đề kháng an toàn thông tin cho cộng đồng.',
], 0),
];

/* ==================== ĐÓNG GÓI & NẠP ==================== */

/**
 * Xây dựng 3 bộ đề mẫu hoàn chỉnh (object đúng cấu trúc đề thi trong exams.json).
 * Đề số 1: không đặt lịch — mở cửa thi ngay để Ban Tổ chức dùng thử.
 * Đề số 2: đặt lịch minh họa "giờ thi quy định" — mở 08:00 giờ VN ngày mai,
 *          đóng 23:59 giờ VN sau 7 ngày (thí sinh bấm vào trước giờ mở sẽ bị
 *          từ chối kèm thông báo đếm ngược).
 * Đề số 3: Chuyển đổi số & Kỹ năng số (81 câu) — không đặt lịch, mở cửa ngay.
 */
function buildSampleExams() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  // 08:00 giờ VN ngày mai = 01:00 UTC ngày mai.
  const openMs = Date.UTC(
    tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 1, 0, 0
  );
  // 23:59 giờ VN sau 7 ngày = 16:59 UTC 7 ngày sau.
  const closeMs = Date.UTC(
    tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate() + 7, 16, 59, 0
  );

  return [
    {
      id: 'exam_sample_1',
      title: SET1_TITLE,
      description: SET_DESC,
      category: CATEGORY,
      durationMinutes: DURATION,
      openAt: null,
      closeAt: null,
      questions: SET1_QUESTIONS.map((x, i) => ({ id: `s1_q${i + 1}`, ...x })),
    },
    {
      id: 'exam_sample_2',
      title: SET2_TITLE,
      description: SET_DESC,
      category: CATEGORY,
      durationMinutes: DURATION,
      openAt: new Date(openMs).toISOString(),
      closeAt: new Date(closeMs).toISOString(),
      questions: SET2_QUESTIONS.map((x, i) => ({ id: `s2_q${i + 1}`, ...x })),
    },
    {
      id: 'exam_sample_3',
      title: SET3_TITLE,
      description: SET3_DESC,
      category: SET3_CATEGORY,
      durationMinutes: DURATION3,
      openAt: null,
      closeAt: null,
      questions: SET3_QUESTIONS.map((x, i) => ({ id: `s3_q${i + 1}`, ...x })),
    },
  ];
}

/** Danh sách đề mẫu CHƯA có trong hệ thống (so theo tên đề — không nhân đôi). */
function missingSampleExams(existingExams = []) {
  const titles = new Set(existingExams.map((e) => e && e.title));
  return buildSampleExams().filter((s) => !titles.has(s.title));
}

module.exports = { buildSampleExams, missingSampleExams, SET1_TITLE, SET2_TITLE, SET3_TITLE };

