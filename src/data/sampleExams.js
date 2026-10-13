/**
 * sampleExams.js — BỘ ĐỀ MẪU do Ban Tổ chức chuẩn bị sẵn.
 *
 * Nguồn: file "Bộ đề thi số 1 / số 2 — Đánh giá năng lực An toàn thông tin"
 * (mỗi đề 50 câu trắc nghiệm, 35 phút, cấu trúc 17 Nhận biết | 23 Thông hiểu
 * & Áp dụng | 10 Vận dụng nâng cao). Đáp án đúng đã được đối chiếu NGHIÊM
 * NGẪT với chính mã nguồn hệ thống (TTL token 12 giờ, debounce 1.2s, scrypt
 * + salt, user đầu tiên nhận quyền Admin, rate-limit 6 lần/15 phút...).
 *
 * Cách dùng:
 *  - dataStore.init(): exams rỗng hoàn toàn → tự nạp cả 2 đề (lần chạy đầu).
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
const CATEGORY = 'An toàn thông tin';
const DURATION = 35;
const SET_DESC =
  '50 câu trắc nghiệm ATTT: 17 câu Nhận biết (ATTT cơ bản & phòng chống lừa đảo), ' +
  '23 câu Thông hiểu & Áp dụng (công cụ & giám sát), 10 câu Vận dụng nâng cao ' +
  '(phân tích lỗ hổng website & Natas). Thời gian làm bài: 35 phút.';

/* ==================== BỘ ĐỀ SỐ 1 — 50 CÂU ==================== */
const SET1_QUESTIONS = [
  // ---- MỤC A: NHẬN BIẾT — ATTT CƠ BẢN & PHÒNG CHỐNG LỪA ĐẢO (Câu 1–17) ----
  q('Quy tắc sao lưu dữ liệu "3-2-1" yêu cầu điều kiện nào sau đây?', [
    '3 bản sao, 2 người quản lý, 1 mật khẩu.',
    '3 thiết bị giống nhau, 2 tuần cập nhật 1 lần, 1 bản lưu Cloud.',
    'Ít nhất 3 bản sao, lưu trên 2 loại phương tiện khác nhau, 1 bản lưu ở vị trí độc lập bên ngoài.',
    '3 file nén, 2 ổ cứng di động, 1 mã khóa AES.',
  ], 2),
  q('Hình thức lừa đảo gửi email/tin nhắn giả mạo cơ quan chức năng để lừa người dùng cung cấp số Căn cước công dân (CCCD) và mã OTP được gọi là gì?', [
    'Malware.',
    'Phishing (Tấn công giả mạo).',
    'DDoS.',
    'Brute Force.',
  ], 1),
  q('Thành phần nào sau đây của mật khẩu quyết định độ an toàn cao nhất chống lại các cuộc tấn công dò quét tự động?', [
    'Chỉ chứa thông tin ngày sinh và tên viết tắt.',
    'Độ dài tối thiểu từ 8-12 ký tự, kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt.',
    'Chứa toàn bộ là các ký tự số viết liền nhau.',
    'Là một từ tiếng Anh có ý nghĩa rõ ràng trong từ điển.',
  ], 1),
  q('Khi truy cập mạng WiFi công cộng không có mật khẩu bảo vệ, hành vi nào sau đây được khuyến cáo để bảo vệ dữ liệu?', [
    'Tải và cài đặt các phần mềm bẻ khóa (Crack).',
    'Thực hiện giao dịch chuyển tiền ngân hàng trực tuyến.',
    'Sử dụng mạng riêng ảo (VPN) bảo mật để mã hóa lưu lượng mạng.',
    'Bật tính năng tự động chia sẻ thư mục lưu trữ.',
  ], 2),
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
    'Bật xác thực 2 lớp / 2 thành tố (2FA / MFA).',
    'Ẩn số điện thoại hiển thị công khai.',
    'Sử dụng tính năng lưu mật khẩu tự động của trình duyệt.',
  ], 1),
  q('Dấu hiệu nào cảnh báo máy tính của bạn đã bị nhiễm mã độc hoặc bị hacker điều khiển từ xa?', [
    'Quạt tản nhiệt của máy tính chạy hơi ồn khi xử lý đồ họa.',
    'Chuột tự di chuyển tự động bấm nút, các cửa sổ lệnh tự bật/tắt liên tục, tài khoản tự gửi link rác.',
    'Thời gian khởi động của hệ điều hành tăng thêm 3 giây.',
    'Độ sáng màn hình tự động giảm khi rút dây sạc pin.',
  ], 1),
  q('Khi đăng ký tài khoản trên các trang web, việc sử dụng cùng một mật khẩu cho tất cả các dịch vụ (Email, Facebook, Ngân hàng, Portal công việc) dẫn đến rủi ro gì?', [
    'Làm giảm tốc độ đường truyền mạng khi truy cập.',
    'Hiệu ứng domino: nếu lộ mật khẩu ở 1 trang web yếu, hacker sẽ chiếm toàn bộ các tài khoản còn lại.',
    'Tài khoản sẽ bị hệ thống tự động khóa do vi phạm chính sách.',
    'Không thể kích hoạt được tính năng xác thực 2 lớp.',
  ], 1),
  q('Mã độc mã hóa tống tiền (Ransomware) thực hiện hành vi phá hoại nào nguy hiểm nhất trên thiết bị nạn nhân?', [
    'Tự động gửi email rác đến toàn bộ danh bạ.',
    'Mã hóa toàn bộ các file tài liệu quan trọng và đòi tiền chuộc để giải mã.',
    'Làm hỏng phần cứng ổ cứng của máy tính vĩnh viễn.',
    'Thay đổi hình nền màn hình máy tính của bạn.',
  ], 1),
  q('Trong các loại thông tin sau, thông tin nào tuyệt đối KHÔNG được chia sẻ công khai lên mạng xã hội để tránh bị tội phạm lợi dụng làm giả danh tính?', [
    'Hình ảnh phong cảnh nơi bạn đi du lịch.',
    'Ảnh chụp rõ nét hai mặt của Căn cước công dân (CCCD) hoặc Hộ chiếu.',
    'Tiêu đề một bài báo khoa học bạn vừa đọc.',
    'Lịch thi đấu thể thao của cơ quan.',
  ], 1),
  q('Khi lướt web, làm thế nào để nhận biết một website có nguy cơ cao là giả mạo (Phishing page)?', [
    'Giao diện trang web có màu sắc khác với bình thường.',
    'Trang web hiển thị quá nhiều hình ảnh quảng cáo động.',
    'Tên miền (Domain) trên thanh địa chỉ bị viết sai chính tả, sai đuôi mở rộng (ví dụ: vksnddanang.com đổi thành vksdanang-fake.net).',
    'Trang web không có thanh tìm kiếm thông tin bài viết.',
  ], 2),
  q('Chức năng chính của phần mềm quản lý mật khẩu (Password Manager) là gì?', [
    'Tự động chia sẻ mật khẩu của bạn cho đồng nghiệp khi cần.',
    'Lưu trữ mã hóa an toàn và tự động đồng bộ tất cả mật khẩu phức tạp của bạn.',
    'Tự động bẻ khóa mật khẩu WiFi của các khu vực xung quanh.',
    'Quét và loại bỏ mã độc nằm trong các file đính kèm email.',
  ], 1),
  q('Khi bạn nhận được cuộc gọi từ số lạ tự xưng là cán bộ Công an hoặc Viện kiểm sát báo bạn đang liên quan đến vụ án mạng và yêu cầu chuyển tiền vào tài khoản để điều tra, bạn nên làm gì?', [
    'Làm theo hướng dẫn, ra ngân hàng rút tiền chuyển ngay để chứng minh vô tội.',
    'Tuyệt đối không chuyển tiền, không cung cấp thông tin cá nhân, tắt máy và báo ngay cho cơ quan Công an nơi gần nhất.',
    'Chia sẻ thông tin tài khoản ngân hàng của mình cho người gọi để họ tự kiểm tra.',
    'Rủ thêm bạn bè cùng chuyển tiền để cùng xác minh dữ liệu.',
  ], 1),
  q('Việc cập nhật hệ điều hành (Windows/macOS) và phần mềm thường xuyên có ý nghĩa gì trong an toàn thông tin?', [
    'Chỉ để làm thay đổi giao diện sử dụng cho đẹp hơn.',
    'Vá các lỗ hổng bảo mật cố hữu mà hacker có thể lợi dụng để xâm nhập máy tính.',
    'Làm tăng dung lượng lưu trữ trống của ổ đĩa cứng.',
    'Xóa bỏ toàn bộ các file tài liệu cũ mà bạn không dùng đến.',
  ], 1),
  q('Tấn công "Social Engineering" (Thao túng tâm lý con người) nhắm vào yếu tố nào trong hệ thống an ninh mạng?', [
    'Lỗ hổng trong mã nguồn của hệ quản trị cơ sở dữ liệu.',
    'Lỗi cấu hình các thiết bị phần cứng tường lửa.',
    'Điểm yếu trong nhận thức, sự lơ là hoặc lòng tin của con người.',
    'Sự thiếu sót của các chứng chỉ bảo mật SSL/TLS.',
  ], 2),
  q('Thuật ngữ "Chế độ cục bộ" (Local mode) của ứng dụng thi trực tuyến khi không cấu hình biến Google được hiểu là gì?', [
    'Ứng dụng sẽ bị lỗi và không thể khởi động được.',
    'Dữ liệu được lưu tạm thời vào các file JSON trong thư mục ./data/ trên ổ cứng của server thay vì đồng bộ lên Google Drive.',
    'Ứng dụng chỉ cho phép các máy tính trong cùng phòng truy cập.',
    'Hệ thống tự động chuyển sang giao diện quản trị Admin.',
  ], 1),
  // ---- MỤC B: THÔNG HIỂU & ÁP DỤNG — CÔNG CỤ & GIÁM SÁT (Câu 18–40) ----
  q('Khi phân tích nhật ký truy cập tại BlueTeam Dashboard, bạn thấy một IP liên tục gửi yêu cầu đăng nhập sai 6 lần trong vòng 15 phút với nhiều mật khẩu khác nhau. Cơ chế nào của mã nguồn hệ thống sẽ tự động kích hoạt để ngăn chặn?', [
    'Cơ chế mã hóa file dữ liệu phẳng bằng thuật toán AES.',
    'Cơ chế Rate-limit (Giới hạn tần suất yêu cầu) để chống dò mật khẩu.',
    'Cơ chế khóa luồng dữ liệu bằng vòng lặp hằng số.',
    'Tự động xóa tài khoản người dùng đang bị dò quét.',
  ], 1),
  q('Vai trò chủ đạo của Đội Tấn công (Red Team) trong các buổi diễn tập An toàn thông tin là gì?', [
    'Xây dựng hệ thống tường lửa để bảo vệ dữ liệu.',
    'Đóng vai kẻ tấn công, sử dụng các công cụ và kỹ thuật bẻ khóa để tìm ra các lỗ hổng bảo mật của hệ thống.',
    'Cài đặt hệ điều hành và cấu hình mạng nội bộ cho cơ quan.',
    'Giám sát các log ghi nhận hành vi đăng nhập trái phép của người dùng.',
  ], 1),
  q('Khi sử dụng lệnh nmap -p 80,443 vksdanang.22web.org, kỹ sư mạng đang thực hiện hành vi gì?', [
    'Tải toàn bộ mã nguồn của trang web về máy tính cá nhân.',
    'Kiểm tra xem các cổng mạng dịch vụ web (80 cho HTTP, 443 cho HTTPS) của máy chủ có đang mở không.',
    'Tấn công từ chối dịch vụ làm sập máy chủ web.',
    'Dò tìm mật khẩu tài khoản quản trị Admin của hệ thống.',
  ], 1),
  q('Ứng dụng bảo mật Burp Suite được định nghĩa chính xác là công cụ thuộc loại nào?', [
    'Trình quét virus và mã độc tự động trên hệ điều hành Windows.',
    'Hệ quản trị cơ sở dữ liệu phẳng dùng cho các file JSON.',
    'Proxy chặn bắt (Interception Proxy) dùng để xem và sửa đổi dữ liệu HTTP/HTTPS truyền giữa trình duyệt và server.',
    'Hệ điều hành chuyên dụng dành cho hacker mũ trắng.',
  ], 2),
  q('Để tính tỷ lệ tấn công thành công hiển thị trên bảng thống kê hệ thống (Thống kê hệ thống portal), công thức nào sau đây được áp dụng?', [
    'Tỷ lệ = Tổng lượt tấn công / Lượt thành công',
    'Tỷ lệ = (Thành công / Tổng lượt tấn công) x 100%',
    'Tỷ lệ = Lượt thất bại - Lượt thành công',
    'Tỷ lệ = (Lượt thất bại / Tổng lượt tấn công) x 100%',
  ], 1),
  q('Thuật toán mã hóa AES thuộc loại mã hóa nào và thường dùng để làm gì trên ứng dụng bảo mật trực tuyến?', [
    'Mã hóa bất đối xứng, dùng để băm mật khẩu người dùng sang chuỗi cố định.',
    'Mã hóa đối xứng, dùng để bảo mật mã hóa và giải mã nội dung tệp tin an toàn.',
    'Thuật toán mã hóa dòng lệnh dùng để chống tấn công SQL Injection.',
    'Phương pháp chuyển đổi định dạng tệp tin sang chuỗi Base64 một dòng.',
  ], 1),
  q('Trong tệp cấu hình môi trường ứng dụng .env, biến môi trường SESSION_SECRET đóng vai trò gì?', [
    'Lưu trữ địa chỉ email kết nối với bot Google Drive.',
    'Làm khóa bí mật dùng để ký và xác thực tính toàn vẹn của token phiên làm việc (HMAC-SHA256 tokens).',
    'Lưu số Căn cước công dân của những người dùng hệ thống.',
    'Quy định cổng kết nối mạng mặc định của máy chủ Express.',
  ], 1),
  q('Điểm khác biệt lớn nhất giữa chức năng của công cụ Nmap và công cụ Nikto khi trinh sát hệ thống là gì?', [
    'Nmap chỉ dùng trên Windows, Nikto chỉ dùng trên Linux.',
    'Nmap tập trung quét cổng và dịch vụ mạng; Nikto tập trung quét máy chủ web để tìm các file nguy hiểm và lỗi cấu hình cụ thể.',
    'Nmap dùng để tấn công SQL Injection, Nikto dùng để bẻ khóa mật khẩu tài khoản.',
    'Nmap tạo ra file dữ liệu JSON, Nikto giải mã các chuỗi dữ liệu dạng Base64.',
  ], 1),
  q('Khi server Node.js nhận được tín hiệu ngắt hệ thống SIGTERM từ nền tảng hosting (như Render), hệ thống xử lý dữ liệu phẳng sẽ thực hiện hành động gì trước khi tắt hẳn?', [
    'Xóa toàn bộ tài khoản người dùng có trên hệ thống để bảo mật.',
    'Kích hoạt hàm flush để đảm bảo toàn bộ dữ liệu đang lưu trên RAM cache được sync hết lên Google Drive vĩnh viễn.',
    'Tự động gửi email thông báo lỗi hệ thống cho quản trị viên.',
    'Chuyển toàn bộ giao diện người dùng sang chế độ bảo trì.',
  ], 1),
  q('Tại sao khi hệ thống thi trực tuyến trên Render (bản Free Tier) ở trạng thái "ngủ" (sau 15 phút không có người truy cập), lượt truy cập đầu tiên lại bị chậm từ 20–40 giây?', [
    'Do hệ thống mạng internet tại Việt Nam bị nghẽn băng thông.',
    'Do server phải trải qua quá trình khởi động nguội (Cold start) và thực hiện tải toàn bộ dữ liệu 3 file JSON từ Google Drive về RAM cache.',
    'Do mã độc tự động chạy ngầm để quét kiểm tra lỗ hổng bảo mật.',
    'Do trình duyệt web của người dùng tự động xóa cookies phiên cũ.',
  ], 1),
  q('Phương pháp băm mật khẩu nào được sử dụng trong hệ thống để đảm bảo an toàn cao nhất chống lại tấn công vét cạn (Brute force), có sử dụng thêm chuỗi muối ngẫu nhiên (salt)?', [
    'MD5 thô.',
    'Base64 Encoding.',
    'scrypt + salt.',
    'SHA-1 không salt.',
  ], 2),
  q('Để kiểm tra tự động xem cấu hình kết nối giữa server ứng dụng và Google Drive đã hoạt động chính xác 100% hay chưa (gồm cả quyền đọc và quyền ghi), lập trình viên nên chạy lệnh nào trong thư mục dự án?', [
    'npm start',
    'node server.js',
    'node tools/check-drive.js',
    'npm install googleapis',
  ], 2),
  q('Khi cấu hình phân quyền cho tài khoản Service Account của Google trên thư mục dữ liệu Drive, nếu bạn chỉ đặt quyền là Viewer (Người xem) thì điều gì sẽ xảy ra với ứng dụng?', [
    'Ứng dụng không thể đọc được danh sách đề thi.',
    'Server chỉ đọc được dữ liệu lúc khởi động, nhưng KHÔNG THỂ đồng bộ ghi dữ liệu (như đăng ký mới, nộp bài) lên Drive, gây lỗi hệ thống.',
    'Hệ thống tự động chuyển sang lưu trữ bằng cơ sở dữ liệu SQL.',
    'Tài khoản Admin bị tước quyền điều khiển dashboard.',
  ], 1),
  q('Tiêu đề HTTP nào được trình duyệt tự động gửi kèm để định danh hệ điều hành, trình duyệt và phiên bản phần mềm mà người dùng đang sử dụng để truy cập website?', [
    'Cookie.',
    'User-Agent.',
    'Referer.',
    'Content-Type.',
  ], 1),
  q('Cơ chế Mutex hoạt động trên hàng đợi ghi dữ liệu phẳng (dataStore) của hệ thống thi trực tuyến có vai trò gì quan trọng nhất?', [
    'Mã hóa chuỗi dữ liệu sang dạng không thể đọc được.',
    'Khóa luồng ghi, ngăn ngừa tình trạng nhiều thí sinh nộp bài cùng một lúc ghi đè làm mất mát dữ liệu của nhau.',
    'Tự động chấm điểm các câu hỏi trắc nghiệm của thí sinh.',
    'Tách biệt file mã nguồn PHP ra khỏi giao diện HTML5.',
  ], 1),
  q('Khi sử dụng lệnh curl -u natas0:natas0 https://22web.org, tham số -u có ý nghĩa là gì?', [
    'Chỉ định đường dẫn tệp tin cần tải về máy.',
    'Cung cấp thông tin tên đăng nhập và mật khẩu (Username:Password) để xác thực HTTP Basic Authentication.',
    'Ép buộc curl sử dụng giao thức bảo mật mã hóa nâng cao.',
    'Chuyển đổi toàn bộ kết quả phản hồi sang định dạng Base64.',
  ], 1),
  q('Hệ thống lưu trữ dữ liệu phẳng gộp các thay đổi dồn dập diễn ra trong vòng bao nhiêu giây thành một lần upload nền duy nhất lên Google Drive để tiết kiệm tài nguyên và quota API?', [
    '0.5 giây.',
    '1.2 giây.',
    '5.0 giây.',
    '10.0 giây.',
  ], 1),
  q('Tại sao việc chấm điểm bài thi trắc nghiệm bắt buộc phải được thực hiện 100% ở phía Server (Server-side) thay vì thực hiện ở trình duyệt của thí sinh (Client-side)?', [
    'Để làm giảm dung lượng bộ nhớ RAM của máy tính thí sinh.',
    'Để đảm bảo tính công bằng, ngăn chặn việc thí sinh dùng F12 sửa code JavaScript đổi điểm hoặc xem trước đáp án đúng.',
    'Vì trình duyệt không hỗ trợ các phép toán cộng trừ điểm số.',
    'Để hệ thống Render tự động đồng bộ dữ liệu nhanh hơn.',
  ], 1),
  q('Giới hạn thời gian hiệu lực mặc định của một mã mã hóa Token phiên làm việc (HMAC-SHA256 token) trong hệ thống thi được cấu hình là bao lâu?', [
    '30 phút.',
    '1 giờ.',
    '12 giờ.',
    '7 ngày.',
  ], 2),
  q('Khi một người dùng mới đăng ký vào hệ thống thi trực tuyến khi dữ liệu đang hoàn toàn trống rỗng (users.json rỗng), tài khoản này sẽ nhận được đặc quyền gì?', [
    'Bị hệ thống tự động khóa tài khoản để kiểm tra an toàn.',
    'Tự động được cấp quyền hạn cao nhất là Quản trị viên (Admin).',
    'Được quyền tự động cộng thêm 2 điểm vào mọi bài thi.',
    'Hệ thống tự động xóa file kết quả lưu trữ cục bộ.',
  ], 1),
  q('Hằng số DEADLINE quy định hạn cuối nộp bài thi của cuộc thi trực tuyến được cấu hình trực tiếp ở file nào trong mã nguồn hệ thống?', [
    'src/drive/driveClient.js',
    'src/config.js',
    'public/assets/js/home.js',
    'package.json',
  ], 2),
  q('Giới hạn hạn ngạch (Quota) tải lên dữ liệu của một tài khoản Google Drive Service Account thông thường theo quy định của Google là bao nhiêu trong một ngày?', [
    '10 GB/ngày.',
    '100 GB/ngày.',
    '750 GB/ngày.',
    'Không giới hạn dung lượng.',
  ], 2),
  q('Trong mô hình kiến trúc tổng quan của hệ thống, thành phần nào đóng vai trò trung gian nhận request, xử lý logic kiểm tra đăng nhập/đăng ký rate-limit và chấm điểm bài thi?', [
    'Thư mục public/ chứa file tĩnh HTML.',
    'Các file định tuyến trong thư mục src/routes/ (auth, exam, admin routes).',
    'Ổ cứng lưu trữ mạng của dịch vụ Google Drive.',
    'Công cụ kiểm tra kết nối dòng lệnh check-drive.js.',
  ], 1),
  // ---- MỤC C: VẬN DỤNG CAO — PHÂN TÍCH LỖ HỔNG WEBSITE & NATAS (Câu 41–50) ----
  q('Một trang web lưu mật khẩu của cấp độ tiếp theo ngay trong một đoạn text ẩn của thuộc tính HTML có cấu trúc dạng <div id="pass" data-password="SECRET_KEY">. Để lấy được chuỗi mật khẩu này bằng lệnh dòng lệnh curl kết hợp biểu thức chính quy (Regex), lệnh nào sau đây là chính xác?', [
    'curl -u user:pass URL | grep secret',
    'curl -s -u user:pass URL | grep -oP \'data-password="\\K[^"]+\'',
    'curl URL > secret.txt',
    'curl -X POST -d "password" URL',
  ], 1),
  q('Khi ứng dụng Web sử dụng cơ chế mã hóa Cookie bằng thuật toán phép toán logic XOR (Mô phỏng Natas Level 11). Kẻ tấn công có thể thao túng dữ liệu bên trong Cookie (ví dụ đổi quyền từ user thành admin) bằng cách tận dụng đặc điểm nào của phép toán XOR?', [
    'XOR không bao giờ có thể bị giải mã nếu không có khóa RSA 2048-bit.',
    'Nếu biết trước nội dung gốc (Plaintext) và chuỗi kết quả đã mã hóa (Ciphertext), kẻ tấn công hoàn toàn có thể tính toán ngược lại để tìm ra Khóa bí mật (XOR Key).',
    'Phép toán XOR tự động thay đổi độ dài chuỗi theo thời gian thực hệ thống.',
    'XOR luôn tạo ra các ký tự đặc biệt nằm trong comment HTML.',
  ], 1),
  q('Hệ thống web cho phép người dùng xem tài liệu thông qua tham số đường dẫn có dạng https://gt.tc. Nếu lập trình viên không lọc sạch dữ liệu đầu vào, kẻ tấn công nhập vào chuỗi dữ liệu ?page=../../../../etc/natas_webpass/natas8. Lỗ hổng nguy hiểm này gọi là gì?', [
    'SQL Injection.',
    'Command Injection.',
    'Path Traversal (Duyệt qua đường dẫn tệp tin trái phép).',
    'Cross-Site Request Forgery (CSRF).',
  ], 2),
  q('Khi chạy mã nguồn, hệ thống trả về mã lỗi hiển thị trên màn hình console log là 403 SERVICE_DISABLED kèm dòng trạng thái "Google Drive API has not been used...". Lỗi này do nguyên nhân cấu hình sai ở bước nào?', [
    'Điền sai mã ID thư mục lưu trữ của Google Drive.',
    'Chưa bấm nút Kích hoạt (Enable) dịch vụ Google Drive API trong trang quản trị thư viện Google Cloud Console.',
    'File key JSON của tài khoản Service Account bị xóa hoàn toàn.',
    'Thiết bị máy chủ Render bị hết dung lượng bộ nhớ RAM cache.',
  ], 1),
  q('Một trang web có tính năng thực hiện lệnh tìm kiếm văn bản bằng cách gọi lệnh hệ thống grep chạy ngầm ở Backend. Kẻ tấn công nhập chuỗi ký tự ; cat /etc/natas_webpass/natas10 vào ô tìm kiếm nhằm ép máy chủ thực thi thêm lệnh đọc file hệ thống. Kỹ thuật tấn công này có tên là gì?', [
    'SQL Injection.',
    'Command Injection (Chèn mã lệnh hệ điều hành).',
    'Path Traversal.',
    'Brute Force Attack.',
  ], 1),
  q("Đoạn code Backend xử lý đăng nhập chứa câu lệnh SQL nối chuỗi trực tiếp: SELECT * FROM users WHERE username = ' + req.body.username + ' AND password = ' + req.body.password + '. Kẻ tấn công nhập chuỗi giá trị nào vào ô username để đăng nhập thành công quyền Admin mà không cần mật khẩu?", [
    'admin123',
    "<script>location.href='hacker.com'</script>",
    "admin' OR '1'='1' -- hoặc ' OR 1=1 #",
    '../../config/database.json',
  ], 2),
  q('Để kiểm tra tính toàn vẹn của một chuỗi dữ liệu Base64 dùng làm biến môi trường GOOGLE_SERVICE_ACCOUNT_JSON trên môi trường Production, nếu chuỗi bị thiếu ký tự hoặc chèn sai dòng trống, server sẽ ném ra ngoại lệ (lỗi) gì khi khởi chạy ứng dụng?', [
    '404 File Not Found',
    'SyntaxError: Unexpected token / JSON.parse error',
    '403 Unauthorized',
    '502 Bad Gateway',
  ], 1),
  q('Kỹ thuật phòng thủ nào sau đây của Blue Team giúp ngăn chặn triệt để lỗ hổng Command Injection khi viết code gọi ứng dụng hệ thống?', [
    'Chặn người dùng nhập các từ khóa như "SELECT", "UNION", "WHERE".',
    'Không dùng các hàm thực thi chuỗi lệnh trực tiếp (như eval() hay exec()), sử dụng hàm truyền đối số tách biệt dưới dạng mảng (Array arguments).',
    'Chuyển toàn bộ ứng dụng sang chạy giao thức HTTPS bảo mật ổ khóa.',
    'Mã hóa chuỗi đầu vào của người dùng bằng thuật toán đối xứng AES-256.',
  ], 1),
  q('Khi cấu hình file cấu hình hạ tầng render.yaml (Blueprint 1-click deploy), thuộc tính nào định nghĩa đường dẫn dùng để Render tự động kiểm tra xem ứng dụng Web đang hoạt động ổn định hay đã chết (Health Check)?', [
    'build_command',
    'start_command',
    'health_check_path (được cấu hình dẫn tới /api/health).',
    'env_vars_sync',
  ], 2),
  q('Trong thử thách vượt qua lỗ hổng tải file (File Upload), ứng dụng Backend kiểm tra định dạng file bằng cách đọc các ký tự đặc trưng ở đầu file. Kẻ tấn công đã chèn chuỗi ký tự nào sau đây vào đầu file PHP để đánh lừa hệ thống rằng đây là một file ảnh GIF hợp lệ?', [
    'PNG89a',
    'GIF8; hoặc GIF89a (Kỹ thuật bypass qua Magic Bytes).',
    '<?php',
    'Content-Type: image/gif',
  ], 1),
];

/* ==================== BỘ ĐỀ SỐ 2 — 50 CÂU ==================== */
const SET2_QUESTIONS = [
  // ---- MỤC A: NHẬN BIẾT — ATTT CƠ BẢN & PHÒNG CHỐNG LỪA ĐẢO (Câu 1–17) ----
  q('Trong quy tắc sao lưu dữ liệu "3-2-1", con số "2" có ý nghĩa cốt lõi là gì?', [
    'Thực hiện cập nhật sao lưu dữ liệu tối thiểu 2 lần một tuần.',
    'Lưu trữ các bản sao dữ liệu trên ít nhất 2 loại phương tiện vật lý khác nhau (ví dụ: ổ cứng máy tính và ổ cứng di động).',
    'Yêu cầu có ít nhất 2 người quản lý cấp cao giữ mật khẩu giải mã.',
    'Chia file tài liệu thành 2 phần mã hóa độc lập.',
  ], 1),
  q('Tấn công "Phishing" thường được tội phạm công nghệ cao thực hiện qua con đường nào phổ biến nhất để tiếp cận nạn nhân tại các cơ quan, đơn vị?', [
    'Trực tiếp đến phá hoại thiết bị phần cứng máy chủ.',
    'Gửi email giả mạo có tiêu đề khẩn cấp, chứa file đính kèm độc hại hoặc đường link trang web lừa đảo.',
    'Dò quét tín hiệu sóng WiFi của cơ quan từ xa.',
    'Cài đặt các ứng dụng điều khiển màn hình chính thống.',
  ], 1),
  q('Hành vi nào sau đây giúp bạn tạo ra một mật khẩu bảo mật tài khoản cá nhân có độ an toàn cao chống lại các cuộc tấn công đoán mật khẩu?', [
    'Sử dụng chuỗi số liên tục tăng dần như 123456789.',
    'Sử dụng một cụm từ dài không có nghĩa trong từ điển, gồm cả chữ hoa, chữ thường, số và các ký tự đặc biệt.',
    'Dùng chính tên viết tắt của cơ quan kết hợp năm thành lập đơn vị.',
    'Lấy số điện thoại cá nhân làm mật khẩu để dễ nhớ.',
  ], 1),
  q('Rủi ro lớn nhất khi người dùng kết nối điện thoại vào mạng WiFi công cộng miễn phí không yêu cầu mật khẩu đăng nhập là gì?', [
    'Điện thoại bị sụt dung lượng pin nhanh hơn bình thường.',
    'Kẻ xấu có thể chặn bắt lưu lượng mạng để đánh cắp tài khoản đăng nhập, thông tin thẻ tín dụng truyền qua mạng không mã hóa.',
    'Hệ điều hành tự động xóa bỏ các ứng dụng đã cài đặt.',
    'Không thể gửi được tin nhắn văn bản SMS thông thường.',
  ], 1),
  q('Khi một trang web không sử dụng chứng chỉ bảo mật SSL/TLS (chỉ chạy giao thức HTTP thông thường), trình duyệt web sẽ hiển thị cảnh báo gì trên thanh địa chỉ?', [
    'Biểu tượng chiếc ổ khóa màu xanh an toàn 🔒.',
    'Dòng chữ "Không an toàn" (Not Secure) hoặc biểu tượng dấu chấm than cảnh báo.',
    'Tự động đóng trình duyệt không cho người dùng truy cập.',
    'Chuyển toàn bộ nội dung chữ của trang web sang mã Base64.',
  ], 1),
  q('Ứng dụng mã nguồn mở giả mạo mang tên "OpenClaw" chứa mã độc nguy hiểm được thiết kế nhằm mục đích tấn công vào đối tượng nào của người dùng?', [
    'Các tệp tin hình ảnh lưu trên thư mục Google Drive.',
    'Thông tin số dư, mã khóa ví tiền điện tử và dữ liệu tài khoản lưu trong trình quản lý mật khẩu.',
    'Các thiết bị phần cứng màn hình cảm ứng của điện thoại thông minh.',
    'Hệ thống điều hòa nhiệt độ chạy ngầm của phòng máy chủ.',
  ], 1),
  q('Cơ chế xác thực đa thành tố (MFA/2FA) bảo vệ tài khoản của bạn dựa trên nguyên lý cốt lõi nào?', [
    'Yêu cầu người dùng phải nhập mật khẩu hai lần liên tiếp giống nhau.',
    'Yêu cầu kết hợp giữa cái bạn biết (mật khẩu) và cái bạn sở hữu/đang nắm giữ (mã OTP gửi về điện thoại hoặc ứng dụng Authenticator).',
    'Tự động mã hóa tên đăng nhập thành chuỗi ký tự hex 96 ký tự.',
    'Chấm điểm mức độ mạnh yếu của mật khẩu trước khi bấm đăng nhập.',
  ], 1),
  q('Máy tính của cơ quan có dấu hiệu nào sau đây cần được cách ly khỏi mạng nội bộ ngay lập tức để kiểm tra mã độc?', [
    'Dung lượng bộ nhớ trống của ổ đĩa cứng tăng lên sau khi dọn rác.',
    'Xuất hiện tệp tin lạ tự sinh ra hàng loạt, máy tính tự gửi file qua mạng, xuất hiện thông báo tống tiền đòi tiền chuộc bằng tiền ảo.',
    'Hệ điều hành tự động cập nhật bản vá bảo mật vào ban đêm.',
    'Màn hình hiển thị thông báo yêu cầu cắm dây sạc pin.',
  ], 1),
  q('Tại sao các chuyên gia an ninh mạng khuyến cáo tuyệt đối không sử dụng tính năng "Ghi nhớ mật khẩu" tự động trên các máy tính dùng chung, máy tính công cộng?', [
    'Làm giảm hiệu suất xử lý dữ liệu phẳng của chip CPU máy tính.',
    'Bất kỳ người nào sử dụng máy tính đó sau bạn đều có thể tự động đăng nhập vào tài khoản của bạn hoặc xem mật khẩu thuần trong phần cài đặt trình duyệt.',
    'Khiến hệ thống máy chủ bị dính lỗi cấu hình API Google Drive.',
    'Làm mất tính năng xác thực token HMAC của hệ thống.',
  ], 1),
  q('Khi bị dính mã độc tống tiền (Ransomware), hành vi nào sau đây là SAI LẦM và có thể gây mất mát dữ liệu vĩnh viễn?', [
    'Ngắt kết nối mạng WiFi hoặc rút dây mạng LAN của máy tính ngay lập tức.',
    'Tự ý chạy các phần mềm dọn rác, chỉnh sửa file hệ thống hoặc chuyển tiền trả tiền chuộc cho hacker mà không báo cáo bộ phận chuyên trách ATTT.',
    'Liên hệ ngay với đội kỹ thuật Blue Team của cơ quan để được hỗ trợ chuyên sâu.',
    'Tắt nguồn máy tính để cô lập vùng nhớ RAM bị tấn công.',
  ], 1),
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
    'Ghi chép toàn bộ mật khẩu vào một cuốn sổ tay nhỏ để trên bàn làm việc.',
    'Sử dụng ứng dụng quản lý mật khẩu chuyên dụng có mã hóa đầu cuối, bảo vệ bằng mã vân tay hoặc mật khẩu chủ (Master Password) mạnh.',
    'Lưu tất cả mật khẩu vào một file văn bản đặt tên là matkhau.txt ngay trên màn hình nền.',
    'Đặt mật khẩu trùng với tên tài khoản đăng nhập để không bao giờ bị quên.',
  ], 1),
  q('Thủ đoạn lừa đảo "Tội phạm giả danh cơ quan Tư pháp" (Viện kiểm sát, Tòa án, Công an) thường đánh vào yếu tố tâm lý nào của nạn nhân?', [
    'Sự tò mò về các chương trình khuyến mãi, trúng thưởng trực tuyến.',
    'Sự sợ hãi, hoang mang khi bị hù dọa liên quan đến các vụ án hình sự, ma túy, rửa tiền và yêu cầu giữ bí mật.',
    'Lòng tham đối với các khoản tiền thưởng hoặc cơ hội việc làm lương cao trên mạng.',
    'Sự lơ là khi tham gia các trò chơi điện tử trực tuyến.',
  ], 1),
  q('Biện pháp nào sau đây giúp bảo vệ điện thoại thông minh ứng dụng ngân hàng số tránh bị mã độc tự động cài đặt chiếm quyền điều khiển Accessibility Service?', [
    'Luôn mở tính năng định vị vị trí GPS mọi lúc mọi nơi.',
    'Tuyệt đối không bấm vào các đường link lạ tải file cài đặt có đuôi .apk bên ngoài cửa hàng ứng dụng chính thống (Google Play / App Store).',
    'Cài đặt quá nhiều ứng dụng hình nền động không rõ nguồn gốc.',
    'Tắt tính năng tự động cập nhật hệ điều hành của điện thoại.',
  ], 1),
  q('Khái niệm "Hàng đợi ghi dữ liệu phẳng" trong hệ thống thi trực tuyến phục vụ mục đích gì trong thiết kế hệ thống?', [
    'Sắp xếp thứ tự bảng điểm từ cao xuống thấp của các thí sinh.',
    'Nhận các thay đổi dữ liệu trên RAM và xử lý lưu tuần tự xuống ổ đĩa một cách bất đồng bộ để không làm nghẽn trải nghiệm người dùng.',
    'Tự động băm mật khẩu người dùng sang định dạng chuỗi mã hóa scrypt.',
    'Ngăn chặn các cuộc tấn công quét cổng từ công cụ Nmap của đối phương.',
  ], 1),
  q('File package.json trong thư mục mã nguồn của ứng dụng Node.js đóng vai trò gì?', [
    'Chứa toàn bộ mật khẩu và thông tin Căn cước công dân của Admin hệ thống.',
    'Khai báo thông tin dự án, cấu hình lệnh chạy (start, dev) và danh sách các thư viện phụ thuộc bắt buộc phải cài đặt (Dependencies).',
    'Lưu trữ nội dung các câu hỏi đề thi trắc nghiệm dạng dữ liệu phẳng.',
    'Thực hiện nhiệm vụ kết nối trực tiếp đến giao diện Google Drive API v3.',
  ], 1),
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
    'Danh sách toàn bộ tên đăng nhập và mật khẩu của người dùng có trên máy chủ.',
    'Tên dịch vụ, phiên bản chính xác của phần mềm đang chạy trên các cổng mở và tên hệ điều hành của máy chủ mục tiêu.',
    'Tỷ lệ phần trăm các cuộc tấn công bẻ khóa thành công vào hệ thống dữ liệu.',
    'Nội dung chi tiết cấu trúc 3 file JSON đang lưu trữ trên mạng.',
  ], 1),
  q('Công cụ bảo mật ứng dụng OWASP ZAP có tính năng nào tương đồng với ứng dụng Burp Suite trong đánh giá ATTT website?', [
    'Tự động sinh ra chuỗi mã hóa token HMAC-SHA256 phiên làm việc.',
    'Hoạt động như một proxy trung gian cho phép chặn bắt, chỉnh sửa các tham số đầu vào của request gửi từ trình duyệt lên server.',
    'Thay đổi thuật toán băm mật khẩu từ scrypt sang MD5 thô.',
    'Đồng bộ dữ liệu phẳng trực tiếp lên thư mục Google Drive của bạn.',
  ], 1),
  q('Biến môi trường ADMIN_CCCDS được cấu hình trong hệ thống quản lý thi trực tuyến dùng để giải quyết bài toán gì?', [
    'Lưu toàn bộ số định danh của thí sinh tham gia cuộc thi trực tuyến.',
    'Khai báo danh sách các số Căn cước công dân được hệ thống cấp đặc quyền làm Admin tối cao ngay khi tiến hành đăng ký tài khoản.',
    'Quy định độ dài tối đa của chuỗi mã hóa mật khẩu trong hàm crypto.',
    'Xác thực quyền ghi dữ liệu của robot lên dịch vụ lưu trữ đám mây.',
  ], 1),
  q('Điểm khác biệt cốt lõi giữa cơ chế mã hóa dữ liệu file bằng thuật toán AES và cơ chế băm mật khẩu bằng thuật toán scrypt là gì?', [
    'AES chỉ chạy trên máy tính cấu hình mạnh; scrypt chạy được trên mọi thiết bị di động.',
    'AES là mã hóa 2 chiều (có thể giải mã lại thành file gốc nếu có khóa); scrypt là hàm băm 1 chiều (không thể dịch ngược lại mật khẩu gốc từ chuỗi hash).',
    'AES tự động chèn thêm chuỗi muối ngẫu nhiên; scrypt bắt buộc nhập file JSON thô 1 dòng.',
    'AES chỉ dùng ở chế độ cục bộ; scrypt bắt buộc phải đồng bộ lên dịch vụ đám mây.',
  ], 1),
  q('Tại sao trong file cấu hình môi trường hệ thống, chuỗi khóa private_key của tài khoản Google Service Account thường được khuyến cáo mã hóa sang định dạng Base64 trước khi dán vào biến môi trường GOOGLE_SERVICE_ACCOUNT_JSON?', [
    'Để làm tăng độ bảo mật của khóa lên gấp hai lần chống bẻ khóa.',
    'Vì biến môi trường hệ thống rất khó lưu trữ nguyên vẹn một file văn bản JSON chứa nhiều ký tự xuống dòng và dấu ngoặc kép phức tạp; Base64 giúp biến đổi thành một chuỗi ký tự liền mạch duy nhất trên 1 dòng.',
    'Nhằm làm giảm dung lượng của file key từ vài KB xuống còn vài byte.',
    'Để hệ thống Render tự động phân quyền Editor cho email của robot.',
  ], 1),
  q('Khi phân tích lưu lượng mạng bằng phần mềm Wireshark, nếu trang web sử dụng giao thức HTTP thông thường, kỹ sư bảo mật có thể nhìn thấy thông tin nhạy cảm nào của người dùng truyền qua mạng?', [
    'Chỉ nhìn thấy địa chỉ IP của máy chủ web công cộng.',
    'Nhìn thấy toàn bộ nội dung thuần (Plaintext) dữ liệu gửi đi, bao gồm cả tài khoản đăng nhập, mật khẩu, nội dung bài làm trắc nghiệm.',
    'Không nhìn thấy gì vì Wireshark tự động mã hóa dữ liệu thành chuỗi hex.',
    'Chỉ nhìn thấy dung lượng kích thước của file dữ liệu đang truyền tải.',
  ], 1),
  q('Trong cơ chế đồng bộ ngược dữ liệu (Sync) của hệ thống thi trực tuyến, khi một route xử lý ghi nhận dữ liệu mới trên RAM, nó sẽ đánh dấu file đó ở trạng thái gì để vòng upload nền tiến hành lưu lên Drive?', [
    'Trạng thái clean (Sạch sẽ).',
    'Trạng thái dirty (Dữ liệu bẩn / Dữ liệu đã bị thay đổi cần đồng bộ).',
    'Trạng thái locked (Đang bị khóa luồng).',
    'Trạng thái flushed (Đã lưu xong).',
  ], 1),
  q('Cơ chế tự động thử lại (Retry với chiến lược Backoff tăng dần thời gian 1s -> 2s -> 4s) của thư viện kết nối Google Drive API giúp hệ thống giải quyết vấn đề gì?', [
    'Tự động bẻ khóa khi tài khoản Service Account bị mất quyền truy cập.',
    'Giúp hệ thống tự phục hồi, vượt qua các lỗi mạng tạm thời hoặc khi bị Google từ chối do vượt quá tần suất yêu cầu (Mã lỗi 429 hoặc lỗi 5xx).',
    'Làm tăng tốc độ xử lý điểm số bài thi của thí sinh trên RAM cache.',
    'Thay đổi mã ID thư mục lưu trữ khi thư mục cũ bị xóa.',
  ], 1),
  q('Khi tiến hành cấu hình biến môi trường trên Render, nếu lập trình viên quên khai báo biến SESSION_SECRET, hệ thống Express sẽ xử lý như thế nào khi khởi chạy?', [
    'Ứng dụng sẽ tự động dừng hoạt động và báo lỗi thiếu biến môi trường.',
    'Script kiểm tra tự động sẽ tự tạo ra một chuỗi mã ngẫu nhiên dài 96 ký tự để làm khóa ký token tạm thời nhằm duy trì hoạt động hệ thống.',
    'Hệ thống tự động chuyển sang chế độ đăng nhập không cần mật khẩu.',
    'Toàn bộ tài khoản thí sinh sẽ tự động được phân quyền thành Admin.',
  ], 1),
  q('Lệnh dòng lệnh nào sau đây dùng để cài đặt toàn bộ các thư viện phụ thuộc được khai báo trong file package.json trước khi khởi chạy dự án Node.js trên máy tính cá nhân?', [
    'npm start',
    'npm run dev',
    'npm install',
    'node -v',
  ], 2),
  q('Tiêu đề HTTP nào (HTTP Header) xác định định dạng nội dung dữ liệu được gửi trong phần thân của yêu cầu (ví dụ xác định dữ liệu gửi lên là định dạng JSON hay form dữ liệu thông thường)?', [
    'Cookie.',
    'User-Agent.',
    'Content-Type (ví dụ: application/json).',
    'Authorization.',
  ], 2),
  q('Tại sao cơ chế bảo mật chống dò mật khẩu giới hạn tối đa 6 lần đăng nhập sai trong vòng 15 phút lại bắt buộc phải đi kèm với cơ chế băm mật khẩu có thời gian xử lý tốn tài nguyên (như hàm scrypt)?', [
    'Nhằm giảm dung lượng lưu trữ của file dữ liệu phẳng users.json.',
    'Để tăng tối đa chi phí thời gian và phần cứng của hacker nếu họ sao chép được file dữ liệu về máy để bẻ khóa vét cạn ngoại tuyến (Offline brute-force).',
    'Để hệ thống Render tự động phân bổ dung lượng bộ nhớ RAM cache tối ưu hơn.',
    'Giúp tăng tốc độ đồng bộ dữ liệu từ RAM lên Google Drive vĩnh viễn.',
  ], 1),
  q('Trong file dữ liệu cấu trúc phẳng exams.json, thông tin nào được lưu trữ bên trong mỗi câu hỏi của đề thi để phục vụ chấm điểm?', [
    'Chuỗi nội dung đáp án đúng dạng văn bản thuần.',
    'Chỉ số vị trí của câu trả lời chính xác trong mảng phương án chọn (trường correctIndex).',
    'Số căn cước công dân của người ra đề thi.',
    'Tổng số lượt thí sinh đã trả lời đúng câu hỏi đó.',
  ], 1),
  q('Khi bạn dán chuỗi cấu hình JSON của file khóa Service Account nằm trên một dòng duy nhất vào biến môi trường của hệ thống, phương thức này được tài liệu hướng dẫn gọi là gì?', [
    'Khai báo dạng Base64 khuyên dùng.',
    'Khai báo dạng JSON thô 1 dòng (Raw JSON).',
    'Khai báo dạng đường dẫn file key cục bộ.',
    'Khai báo thông qua API Token trung gian.',
  ], 1),
  q('Mục đích chính của việc hệ thống tự động ghi một bản sao "mirror cục bộ" lưu xuống thư mục ./data/*.json trên máy chủ song song với việc lưu lên Google Drive là gì?', [
    'Để làm tăng gấp đôi dung lượng bộ nhớ lưu trữ file dữ liệu phẳng.',
    'Giúp hệ thống khởi động nhanh hơn ở những lần sau và làm phương án cứu trợ dữ liệu khẩn cấp nếu dịch vụ Google Drive tạm thời gặp sự cố kết nối.',
    'Chống lại cuộc tấn công chèn câu lệnh hệ điều hành Command Injection.',
    'Tự động đồng bộ tài khoản người dùng sang nền tảng cơ sở dữ liệu SQL.',
  ], 1),
  q('Để kiểm tra xem hệ thống máy chủ web có đang hoạt động tốt hay không, nền tảng Render sẽ định kỳ gửi yêu cầu kiểm tra (Health Check) tới đường dẫn API nào được cấu hình trong hệ thống?', [
    '/api/stats',
    '/api/admin/users',
    '/api/health',
    '/login.html',
  ], 2),
  q('Khi thí sinh bấm nút Bắt đầu làm bài thi, hệ thống Backend Express sẽ ghi nhận và cấp cho thí sinh thông tin quan trọng nào để giám sát thời gian làm bài chống gian lận?', [
    'Tự động tải toàn bộ file đáp án đúng về cookies trình duyệt của thí sinh.',
    'Cấp và lưu trữ thời điểm bắt đầu làm bài chính xác ở phía Server (trường startedAt), việc refresh trang web sẽ không làm tăng thêm thời gian.',
    'Chuyển đổi giao diện làm bài sang chế độ mã hóa file đối xứng AES.',
    'Tự động gửi một yêu cầu lưu file test lên thư mục Google Drive.',
  ], 1),
  q('Trong cấu trúc tệp tin dữ liệu phẳng results.json, trường dữ liệu durationSeconds dùng để lưu trữ thông tin gì của lượt thi?', [
    'Tổng số thời gian tối đa được phép làm bài thi tính bằng phút.',
    'Tổng số thời gian thực tế mà thí sinh đã bỏ ra để hoàn thành bài thi, tính bằng đơn vị giây.',
    'Thời điểm chính xác thí sinh bấm nút nộp bài lên máy chủ.',
    'Mã số định danh duy nhất của đề thi trắc nghiệm.',
  ], 1),
  q('Khi muốn chạy ứng dụng ở chế độ phát triển (Development mode) dưới máy tính cá nhân để tự động khởi động lại server mỗi khi lập trình viên chỉnh sửa file mã nguồn, bạn sử dụng lệnh dòng lệnh nào?', [
    'npm start',
    'npm run dev',
    'node server.js',
    'npm install',
  ], 1),
  q('Khi một tài khoản người dùng thông thường cố tình truy cập vào đường dẫn API dành riêng cho quản trị viên (ví dụ: lấy danh sách toàn bộ người dùng hệ thống), middleware bảo mật requireAdmin sẽ trả về mã lỗi HTTP nào để từ chối truy cập?', [
    '200 OK',
    '404 Not Found',
    '403 Forbidden hoặc thông báo lỗi vi phạm quyền truy cập.',
    '500 Internal Server Error',
  ], 2),
  q('Cơ chế gộp các thay đổi dồn dập diễn ra trong một khoảng thời gian ngắn thành một lần đồng bộ duy nhất lên Google Drive được gọi thuật ngữ chuyên ngành là gì?', [
    'Mutex Locking.',
    'Coalesce (Gộp các thay đổi dồn dập nền).',
    'Parameterized Queries.',
    'Constant-time Comparison.',
  ], 1),
  // ---- MỤC C: VẬN DỤNG CAO — PHÂN TÍCH LỖ HỔNG WEBSITE & NATAS (Câu 41–50) ----
  q('Trong mã nguồn hệ thống, để so sánh chuỗi băm mật khẩu hoặc xác thực token phiên làm việc một cách an toàn nhất, tránh lỗ hổng tấn công phân tích thời gian phản hồi của CPU (Timing Attack), lập trình viên bắt buộc phải sử dụng cơ chế so sánh nào?', [
    'So sánh bằng toán tử thông thường == hoặc ===.',
    'So sánh thời gian cố định (Constant-time comparison) bằng hàm chuyên dụng của thư viện crypto.',
    'Chuyển đổi toàn bộ hai chuỗi dữ liệu sang định dạng Base64 trước khi so sánh.',
    'Gửi cả hai chuỗi dữ liệu lên Google Drive để nhờ robot so sánh hộ.',
  ], 1),
  q('Khi chạy script kiểm tra kết nối tự động tới Google Drive, hệ thống báo lỗi ở mức 4/5 kèm dòng trạng thái 403 The caller does not have permission. Lỗi này xác định nguyên nhân chính xác do cấu hình thiếu bước nào sau đây?', [
    'Nhập sai chuỗi mã số ID thư mục Google Drive của bạn.',
    'Bạn đã chia sẻ thư mục Drive cho email của robot rồi, nhưng lại thiết lập nhầm quyền là Viewer (Người xem) thay vì Editor (Người chỉnh sửa).',
    'Chưa bật tính năng xác thực 2 lớp cho tài khoản Gmail cá nhân.',
    'Thư mục lưu trữ trên Google Drive đã bị đầy dung lượng 750 GB.',
  ], 1),
  q('Kẻ tấn công thực hiện hành vi gửi yêu cầu truy cập liên tục với tham số đường dẫn chứa chuỗi ký tự kiểm thử nguy hiểm: https://liveblog365.com | grep -oP .... Logic xử lý ở Backend gọi trực tiếp hàm xử lý chuỗi hệ thống mà không cô lập tham số đầu vào. Đây là biểu hiện của lỗ hổng bảo mật nào?', [
    'Path Traversal.',
    'SQL Injection trái phép.',
    'Command Injection (Chèn mã lệnh hệ điều hành qua các hàm xử lý nền).',
    'Session Hijacking.',
  ], 2),
  q('Khi mở file key JSON tải về từ Google Cloud Console bằng công cụ Notepad, bạn cần tìm và sao chép chính xác giá trị nằm ở trường dữ liệu nào để lấy được địa chỉ email định danh của robot cấp quyền chia sẻ?', [
    'private_key',
    'project_id',
    'client_email',
    'auth_uri',
  ], 2),
  q('Để phòng chống triệt để lỗ hổng bảo mật nguy hiểm SQL Injection, kỹ thuật lập trình nào sau đây là tiêu chuẩn bắt buộc phải áp dụng đối với mọi ô nhập liệu dữ liệu của người dùng?', [
    'Chỉ mã hóa chuỗi nhập vào bằng thuật toán Base64 Encoding ở Frontend.',
    'Sử dụng truy vấn có tham số tách biệt (Parameterized Queries) / câu lệnh chuẩn bị trước (Prepared Statements).',
    'Sử dụng vòng lặp kiểm tra và tự động xóa bỏ toàn bộ dấu khoảng trắng của chuỗi.',
    'Cấu hình hệ thống tường lửa mạng để chặn hoàn toàn địa chỉ IP của thí sinh.',
  ], 1),
  q('Khi kẻ tấn công tìm cách thay đổi tham số đường link thành ?page=../../../../config.php để lấy cắp khóa bí mật hệ thống. Để phòng ngự lỗi Path Traversal này, hàm kiểm tra đầu vào ở Backend cần thực hiện hành vi lọc bỏ (Sanitize) các ký tự nguy hiểm nào?', [
    'Chặn các chuỗi ký tự dạng dấu ngoặc nhọn <script>.',
    'Lọc sạch và chặn các chuỗi dấu chấm và dấu gạch chéo nguy hiểm như ../ hoặc ..\\ dùng để nhảy thư mục.',
    "Xóa bỏ các ký tự dấu nháy đơn ' và dấu băm #.",
    'Ép kiểu dữ liệu đầu vào của người dùng bắt buộc phải là dạng số nguyên.',
  ], 1),
  q('Một chuỗi ký tự mã hóa Base64 dùng làm biến môi trường khi dán vào trang quản trị Render bị hệ thống báo lỗi không thể khởi chạy, kiểm tra log thấy dòng trạng thái báo lỗi liên quan đến ký tự đầu vào Unexpected token. Nguyên nhân phổ biến nhất gây ra lỗi này ở bước xử lý file key bằng PowerShell là gì?', [
    'Đường dẫn file .json trên máy tính cá nhân viết sai chính tả.',
    'Quá trình sao chép chuỗi Base64 bằng tay bị thiếu ký tự, bị đứt dòng hoặc sử dụng nhầm lệnh chèn thêm các chuỗi tiêu đề certificate thừa.',
    'Tài khoản dịch vụ Service Account của bạn chưa được cấp quyền truy cập project.',
    'Mã số ID thư mục lưu trữ Google Drive chứa ký tự khoảng trắng ở cuối.',
  ], 1),
  q('Tại sao việc sử dụng thuật toán băm MD5 hoặc SHA-1 thô để lưu trữ mật khẩu người dùng vào file dữ liệu phẳng ngày nay được coi là không còn an toàn trước hacker?', [
    'Vì dung lượng chuỗi băm của MD5 quá lớn làm tốn bộ nhớ RAM máy chủ.',
    'Vì các thuật toán này có tốc độ xử lý quá nhanh, hacker có thể sử dụng các siêu máy tính hoặc bảng tra cứu trước (Rainbow Tables) để giải mã vét cạn hàng tỷ mật khẩu trong một giây.',
    'Vì MD5 không hỗ trợ kết hợp lưu trữ cùng số Căn cước công dân.',
    'Do thuật toán MD5 tự động làm sập kết nối của dịch vụ Google Drive API.',
  ], 1),
  q('Trong cấu trúc file dữ liệu phẳng quản lý kết quả thi results.json, nếu một bản ghi điểm số của thí sinh có xuất hiện thêm hai trường dữ liệu là editedAt và editedBy, điều này thể hiện hành vi gì đã diễn ra trong hệ thống?', [
    'Thí sinh tự động thực hiện hành vi hack sửa điểm số bài làm của mình trên trình duyệt.',
    'Tài khoản quản trị viên (Admin) đã can thiệp chỉnh sửa kết quả bài thi này vào một thời điểm cụ thể sau khi nộp bài.',
    'Hệ thống tự động kích hoạt tính năng lưu mirror cục bộ khi mất mạng mạng LAN.',
    'Token phiên làm việc của thí sinh đã hết hạn hiệu lực 12 giờ quy định.',
  ], 1),
  q('Khi cấu hình tệp tin cấu hình môi trường hệ thống cho ứng dụng web, lỗi 404 File not found: <id> trả về từ log server xác định hệ thống của bạn đang điền sai thông tin của biến môi trường nào?', [
    'SESSION_SECRET',
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'GOOGLE_DRIVE_FOLDER_ID (Do copy thừa cả đường link URL, thừa khoảng trắng hoặc dùng ID của thư mục đã bị xóa hoàn toàn).',
    'ADMIN_CCCDS',
  ], 2),
];

/* ==================== ĐÓNG GÓI & NẠP ==================== */

/**
 * Xây dựng 2 bộ đề mẫu hoàn chỉnh (object đúng cấu trúc đề thi trong exams.json).
 * Đề số 1: không đặt lịch — mở cửa thi ngay để Ban Tổ chức dùng thử.
 * Đề số 2: đặt lịch minh họa "giờ thi quy định" — mở 08:00 giờ VN ngày mai,
 *          đóng 23:59 giờ VN sau 7 ngày (thí sinh bấm vào trước giờ mở sẽ bị
 *          từ chối kèm thông báo đếm ngược).
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
  ];
}

/** Danh sách đề mẫu CHƯA có trong hệ thống (so theo tên đề — không nhân đôi). */
function missingSampleExams(existingExams = []) {
  const titles = new Set(existingExams.map((e) => e && e.title));
  return buildSampleExams().filter((s) => !titles.has(s.title));
}

module.exports = { buildSampleExams, missingSampleExams, SET1_TITLE, SET2_TITLE };

