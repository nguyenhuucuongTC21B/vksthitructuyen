# 🎓 Hệ thống Thi trực tuyến Siêu nhẹ (Ultra-lightweight Online Exam System)

Hệ thống thi trắc nghiệm trực tuyến **không dùng SQL**: toàn bộ dữ liệu phẳng được lưu trữ
**vĩnh viễn trên Google Drive** dưới dạng 3 file JSON (`users.json`, `exams.json`, `results.json`).
Khi khởi động, dữ liệu được **tải về RAM cache** để phục vụ với tốc độ tối đa; mỗi thay đổi được
**đồng bộ ngược (Sync) lên Drive một cách bất đồng bộ, không chặn** trải nghiệm người dùng,
có **Mutex khóa luồng** đảm bảo nhiều thí sinh nộp bài cùng lúc không ghi đè mất dữ liệu của nhau.

**Backend:** Node.js (Express) · **Frontend:** HTML5 + Tailwind CSS (CDN) + JavaScript thuần
· **Dependency:** chỉ 2 gói (`express`, `googleapis`)

---

## 1. Kiến trúc tổng quan

```
                        ┌────────────────────────────────────────────────┐
                        │              GOOGLE DRIVE (vĩnh viễn)          │
                        │   users.json   exams.json   results.json       │
                        └───────────▲────────────────────┬───────────────┘
              Sync ngược (bất đồng  │                    │ Tải về lúc khởi động
              bộ, có Mutex + retry) │                    ▼
┌───────────────────────────────────┴──────────────────────────────────────────┐
│  NODE.JS SERVER (Express)                                                    │
│  ┌──────────────┐  ┌────────────────────┐  ┌──────────────────────────────┐  │
│  │  public/     │  │  store/dataStore   │  │  routes: auth / exam / admin │  │
│  │  4 trang HTML│◀▶│  RAM cache + hàng  │◀▶│  (scrypt, HMAC token,        │  │
│  │  + JS thuần  │  │  đợi ghi + Mutex   │  │   chấm điểm server-side)     │  │
│  └──────────────┘  └────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Cấu trúc thư mục

```
online-exam-system/
├── server.js                    # Điểm khởi động: Drive → RAM → HTTP, flush khi SIGTERM
├── package.json
├── render.yaml                  # Blueprint deploy Render 1-click
├── .env.example                 # Mẫu biến môi trường
├── src/
│   ├── config.js                # Nạp .env + cấu hình tập trung
│   ├── app.js                   # Lắp ráp Express (middleware, static, routes)
│   ├── drive/
│   │   └── driveClient.js       # Google Drive API v3 qua Service Account (+ retry backoff)
│   ├── store/
│   │   └── dataStore.js         # RAM cache, hàng đợi sync, Mutex, mirror cục bộ ./data
│   ├── middleware/
│   │   └── auth.js              # requireAuth / requireAdmin
│   ├── routes/
│   │   ├── auth.routes.js       # Đăng ký / Đăng nhập (rate-limit chống dò mật khẩu)
│   │   ├── exam.routes.js       # Xem đề, bắt đầu, nộp bài — chấm điểm trên server
│   │   ├── admin.routes.js      # Quản lý user, ra đề, can thiệp kết quả
│   │   └── public.routes.js     # /api/stats (trang chủ) + /api/health (Render)
│   └── utils/
│       ├── mutex.js             # Cơ chế khóa luồng Mutex (promise-chain)
│       ├── crypto.js            # scrypt băm mật khẩu, HMAC token phiên
│       └── validate.js          # Kiểm tra dữ liệu (thông báo lỗi tiếng Việt)
└── public/
    ├── index.html               # Trang chủ tuyên truyền cổ động + nút "Tham gia"
    ├── login.html               # Đăng nhập / Đăng ký (bắt buộc nhập đủ trường)
    ├── quiz.html                # Làm bài: đếm ngược, palette câu hỏi, nộp bài
    ├── admin.html               # Dashboard quản trị
    └── assets/
        ├── css/base.css         # Bổ trợ Tailwind (marquee, đồng hồ, vòng điểm…)
        └── js/                  # common.js, home.js, auth.js, quiz.js, admin.js
```

### Thiết kế 3 file dữ liệu

| File | Cấu trúc bản ghi |
|------|------------------|
| `users.json` | `{ cccd, phone, email, position, unit, passwordHash (scrypt), role: "user"/"admin", createdAt }` |
| `exams.json` | `{ id, title, description, category, durationMinutes, questions: [{ id, text, options[], correctIndex }], createdBy, createdAt }` |
| `results.json` | `{ id, examId, examTitle, category, cccd, score (thang 10), correct, total, startedAt, durationSeconds, submittedAt, editedAt?, editedBy?, note? }` |

---

## 2. Cơ chế hoạt động quan trọng

### a) Google Drive Service Account
- Kết nối bằng thư viện chính thức `googleapis` với **Service Account**, thông tin đọc từ biến môi trường
  (hỗ trợ Base64 / JSON thô / đường dẫn file key).
- Khi khởi động: tìm 3 file JSON trong thư mục Drive → tải về RAM; file nào chưa có sẽ được **tự tạo rỗng**.
- Lỗi tạm thời (429/5xx/mạng) được **tự retry với backoff 1s→2s→4s**.

### b) Sync bất đồng bộ + Mutex (chống mất dữ liệu khi nhiều thí sinh nộp bài)
- Route xử lý request **chỉ thao tác trên RAM** rồi đánh dấu file "dirty" — trả kết quả cho người dùng ngay lập tức.
- Vòng upload nền (có **Mutex theo từng file**) mới thực tế ghi lên Drive:
  - Gộp (coalesce) các thay đổi dồn dập trong 1.2s thành một lần upload;
  - Nếu đang upload mà có thay đổi mới → upload thêm lần nữa với dữ liệu **mới nhất** (không bao giờ ghi đè ngược);
  - Nộp bài / đăng ký dùng `saveNow()` — đồng bộ ngay, vẫn không chặn các request khác.
- Mỗi lần lưu thành công ghi thêm **mirror cục bộ** `./data/*.json` (cache khởi động nhanh + cứu trợ khi Drive tạm lỗi).
- Khi Render gửi SIGTERM: server **flush dữ liệu trước khi tắt**.

### c) Bảo mật & công bằng thi cử
- Mật khẩu băm **scrypt + salt**; so sánh constant-time. Token phiên **HMAC-SHA256**, hạn 12 giờ.
- Đề gửi cho thí sinh **không chứa đáp án**; chấm điểm **100% trên server**; thời gian làm bài **giám sát server-side**
  (POST `/start` cấp thời điểm bắt đầu — refresh trang không được thêm thời gian).
- Giới hạn 6 lần đăng nhập sai / 15 phút; các trường CCCD/SDT/email kiểm tra định dạng.

---

## 3. Thiết lập Google Drive API (Service Account)

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/) → tạo Project (VD: `he-thong-thi-truc-tuyen`).
2. **APIs & Services → Library** → tìm **Google Drive API** → nhấn **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service Account** → đặt tên (VD `exam-drive-bot`) → tạo xong vào tab **Keys → Add key → Create new key → JSON** → tải file key về máy.
4. Tạo **thư mục trên Google Drive** cá nhân (VD `He-thong-thi-truc-tuyen`) → mở thư mục → copy **Folder ID** trên URL:
   `https://drive.google.com/drive/folders/`**`<FOLDER_ID>`**
5. Chia sẻ thư mục cho Service Account: nhấn **Share** → nhập email dạng
   `exam-drive-bot@<project-id>.iam.gserviceaccount.com` (có trong file key, trường `client_email`) → quyền **Editor**.
6. Mã hóa file key thành Base64 để dán an toàn vào biến môi trường:
   - **Linux/macOS:** `base64 -w0 service-account.json`
   - **Windows (PowerShell):** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))`

> ⚠️ File key là mật khẩu cấp hệ thống — không commit lên Git, không chia sẻ công khai.

---

## 4. Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|------|----------|---------|
| `PORT` | — (Render tự set) | Cổng HTTP. Mặc định 3000. |
| `SESSION_SECRET` | ✅ | Khóa ký token phiên. Sinh: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ (prod) | File key Service Account dạng **Base64** (khuyên dùng) hoặc JSON thô 1 dòng. |
| `GOOGLE_DRIVE_FOLDER_ID` | ✅ (prod) | ID thư mục Drive lưu 3 file JSON (xem bước 4 ở trên). |
| `ADMIN_CCCDS` | tùy chọn | Danh sách CCCD được cấp quyền Admin khi đăng ký, phân cách bởi dấu phẩy. |

> 💡 **Chế độ dev:** nếu bỏ trống 2 biến Google, hệ thống chạy **chế độ cục bộ** — dữ liệu ghi vào `./data/`.
> Tiện để phát triển giao diện mà chưa cần Drive.

---

## 5. Chạy thử trên máy local

```bash
cd online-exam-system
npm install
cp .env.example .env        # điền SESSION_SECRET (+ biến Google nếu muốn)
npm start                   # hoặc: npm run dev (tự restart khi sửa code)
```

Mở `http://localhost:3000`:

1. **Người dùng ĐẦU TIÊN đăng ký khi hệ thống trống sẽ tự động là Admin** (hoặc khai báo `ADMIN_CCCDS`).
2. Đăng nhập Admin → `admin.html` → **Đề thi → Ra đề thi mới** (thêm câu hỏi, đánh dấu đáp án đúng).
3. Đăng ký thêm tài khoản thí sinh → `quiz.html` → **Vào thi** → làm bài → nộp bài → xem điểm.
4. Admin vào **Bảng điểm** xem chi tiết theo hạng mục, sửa/xóa kết quả khi cần.

---

## 6. Deploy lên Render (Free Hosting)

### Cách A — Blueprint (khuyên dùng)

1. Tạo repo GitHub và đẩy toàn bộ thư mục dự án lên (file `render.yaml` đã cấu hình sẵn).
2. Trên [Render Dashboard](https://dashboard.render.com/) → **New + → Blueprint** → chọn repository → **Apply**.
3. Sau khi service được tạo, vào **Environment** và bổ sung 2 biến `sync: false`:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = chuỗi Base64 ở mục 3;
   - `GOOGLE_DRIVE_FOLDER_ID` = Folder ID của thư mục Drive;
   - (tùy chọn) `ADMIN_CCCDS`.
4. **Save → Manual Deploy** để khởi động lại với biến mới. Xong!

### Cách B — Thủ công

- **New + → Web Service** → kết nối repo GitHub.
- **Runtime:** Node · **Build Command:** `npm install` · **Start Command:** `npm start`
- **Health Check Path:** `/api/health`
- Khai báo đầy đủ các biến môi trường ở mục 4 → **Create Web Service**.

### Lưu ý khi vận hành trên Render Free

- Free tier **sleep sau 15 phút không có truy cập**; lần truy cập đầu sẽ chậm 20–40s (cold start) do server
  tải dữ liệu từ Drive về RAM. Có thể dùng cron-pinger miễn phí (VD UptimeRobot) ping `/api/health` mỗi 5 phút.
- Bản ghi "lượt thi đang làm" nằm trong RAM: nếu server restart giữa chừng, thí sinh vào lại đề sẽ được
  cấp lại toàn bộ thời gian (dữ liệu kết quả đã nộp thì **không bao giờ mất** — đã sync Drive ngay khi nộp).
- Log server hiển thị rõ `[store] Da dong bo xxx.json len Google Drive` sau mỗi lần lưu — dùng để giám sát sync.

---

## 7. Câu hỏi nhanh

**Đổi nội dung trang chủ / tên cuộc thi / hạn thi?** Sửa trực tiếp `public/index.html`
và hằng số `DEADLINE` trong `public/assets/js/home.js`.

**Muốn nhiều Admin?** Đăng ký tài khoản rồi Admin hiện tại vào "Người dùng → Sửa → Quyền hạn → Admin",
hoặc khai báo `ADMIN_CCCDS` trước khi người đó đăng ký.

**Bị lỗi 403 khi sync Drive?** Kiểm tra: (1) đã bật Google Drive API; (2) đã Share thư mục cho
email Service Account với quyền Editor; (3) `GOOGLE_DRIVE_FOLDER_ID` đúng ID thư mục (không phải URL đầy đủ).

**Quota Google Drive?** Service Account được 750 GB/ngày upload — với file JSON vài chục KB,
hệ thống hàng nghìn thí sinh vẫn dư sức.
