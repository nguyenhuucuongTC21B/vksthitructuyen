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
├── tools/
│   └── check-drive.js           # Công cụ: sinh .env từ file key + kiểm tra kết nối Drive
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

## 3. Thiết lập Google Drive API (Service Account) — hướng dẫn từng nút bấm

> Hướng dẫn dưới đây mô tả **từng nút bấm** trên giao diện Google Cloud Console và Google Drive
> (cập nhật 2025). Làm đúng thứ tự 8 bước, mỗi bước chỉ 1–3 phút. Mỗi bước có dòng
> "✅ Đối chiếu" để bạn biết đã làm thành công. Cuối mục là bảng xử lý 6 lỗi thường gặp.

### Bước 1 — Tạo Project trên Google Cloud

1. Đăng nhập Google bằng **tài khoản cá nhân** (`@gmail.com`) rồi mở: **https://console.cloud.google.com/**
2. Lần đầu vào, Google hỏi đồng ý điều khoản dịch vụ → tích chọn và nhấn **Agree / Continue**
   (nếu được hỏi quốc gia, chọn Vietnam).
3. Nhìn **thanh trên cùng** (ngay dưới chữ Google Cloud): có ô chọn project — có thể đang hiện
   chữ **"Select a project"** → nhấn vào ô đó.
4. Cửa sổ bật lên hiện danh sách project → nhấn nút **New Project** ở góc trên bên phải.
5. Điền form "New Project":
   - **Project name:** `he-thong-thi-truc-tuyen` (nên dùng tên không dấu, không khoảng trắng);
   - **Organization/Location:** giữ nguyên mặc định ("No organization");
   - **Không cần** thẻ tín dụng / Billing — Google Drive API dùng được trong gói miễn phí.
6. Nhấn **Create** → chờ 20–60 giây. Khi có thông báo (hình chiếc chuông góc trên phải) → nhấn **Select Project**.

✅ **Đối chiếu:** thanh trên cùng hiện đúng tên project `he-thong-thi-truc-tuyen`.

### Bước 2 — Bật (Enable) Google Drive API

1. Mở menu **☰** (góc trên bên trái) → **APIs & Services** → **Library**.
   (Hoặc truy cập thẳng: https://console.cloud.google.com/apis/library )
2. Trong ô tìm kiếm gõ `google drive` → chọn **Google Drive API**
   (dòng đầu tiên, logo hình tam giác vàng–xanh lục–hồng).
3. Nhấn nút xanh **Enable** và chờ vài giây.

✅ **Đối chiếu:** trang API hiện nút **Manage** và chữ "API enabled".

⚠️ **Bỏ qua bước này là nguyên nhân số 1** gây lỗi `403 SERVICE_DISABLED` khi chạy server.

### Bước 3 — Tạo Service Account

1. Menu ☰ → **APIs & Services** → **Credentials**. (https://console.cloud.google.com/apis/credentials )
2. Nhấn **+ Create Credentials** (hàng nút trên cùng) → chọn **Service account**.
3. Form "Create service account" gồm 3 màn:
   - **Service account details**:
     - *Service account name:* `exam-drive-bot`
     - *Service account ID:* Google tự điền — giữ nguyên
     - *Description:* `Bot luu du lieu thi` (có thể bỏ trống)
     → nhấn **Create and Continue**.
   - **Grant this service account access to project (optional):** không cần chọn gì → nhấn **Continue**.
   - **Grant users access to this service account (optional):** không cần chọn gì → nhấn **Done**.
4. Quay lại trang **Credentials**, mục **Service Accounts** hiện 1 dòng dạng:
   `exam-drive-bot@he-thong-thi-truc-tuyen.iam.gserviceaccount.com`

✅ **Đối chiếu:** thấy dòng email trên trong trang Credentials.

### Bước 4 — Tạo file key JSON

1. Trong trang **Credentials**, nhấn vào **email** của service account vừa tạo (dòng ở Bước 3).
2. Chuyển sang tab **Keys** (ngang hàng với Details / Permissions...).
3. Nhấn **Add key** → **Create new key**.
4. Chọn **JSON** → nhấn **Create** → trình duyệt **tự động tải về** một file `.json`
   (tên dạng `he-thong-thi-truc-tuyen-1a2b3c4d5e6f.json`) và Google hiện cảnh báo vàng
   "Private key saved to your computer" → chỉ cần nhấn **Close**.
5. Chuyển file vừa tải tới nơi an toàn (ví dụ đặt cạnh thư mục dự án) và **đổi tên thành
   `service-account.json`** cho dễ nhớ:
   - Windows thường lưu tại: `C:\Users\<TênBạn>\Downloads\`
   - macOS / Linux: `~/Downloads/`

> ⚠️ File key là **mật khẩu cấp hệ thống** — không commit lên Git, không chia sẻ công khai.
> Nếu nghi lộ key: vào tab Keys → xóa key cũ → tạo key mới (Bước 4 làm lại), key cũ tự vô hiệu.

### Bước 5 — Tìm email Service Account trong file key (trường `client_email`)

File key là file văn bản thuần, mở bằng trình soạn thảo bất kỳ:

| Hệ điều hành | Cách mở |
|---|---|
| Windows | Chuột phải file → **Open with → Notepad**. Hoặc mở CMD gõ: `notepad "%USERPROFILE%\Downloads\service-account.json"` |
| macOS | Terminal gõ: `open -a TextEdit ~/Downloads/service-account.json` |
| Linux | Terminal gõ: `nano ~/Downloads/service-account.json` (hoặc gedit) |

Nội dung file (rút gọn) trông như sau:

```json
{
  "type": "service_account",
  "project_id": "he-thong-thi-truc-tuyen",
  "private_key_id": "9f8e7d6c5b4a3210fedcba9876543210abcdef12",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n",
  "client_email": "exam-drive-bot@he-thong-thi-truc-tuyen.iam.gserviceaccount.com",
  "client_id": "112233445566778899000",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth"
}
```

👉 Dòng **`client_email`** (thứ 5) chính là **email của bot**. Copy **toàn bộ giá trị giữa hai dấu
ngoặc kép** — ví dụ trên là `exam-drive-bot@he-thong-thi-truc-tuyen.iam.gserviceaccount.com`.
Email có quy tắc nhận biết: `<tên-bot>@<project-id>.iam.gserviceaccount.com`.

> 💡 Không muốn mở file tay? Chạy luôn công cụ của dự án (Bước 8) — nó tự in email này ra màn hình:
> `node tools/check-drive.js "đường-dẫn-đến-service-account.json"`

### Bước 6 — Tạo thư mục Drive, lấy Folder ID và SHARE cho Service Account

Đây là bước quan trọng nhất — làm chậm từng ý nhỏ:

**6a. Tạo thư mục**

1. Mở **https://drive.google.com/** bằng chính tài khoản Google ở Bước 1.
2. Góc trên trái nhấn **+ New** (Mới) → **New folder** (Thư mục mới) → đặt tên
   `He-thong-thi-truc-tuyen` → **Create**.
3. **Nhấp đúp** vào thư mục để mở bên trong.

**6b. Lấy Folder ID**

- Khi đã ở trong thư mục, nhìn **thanh địa chỉ trình duyệt**:
  `https://drive.google.com/drive/folders/1AbCdEf_GhIjKlMnOpQrStUvWxYz123456`
- **Folder ID = toàn bộ đoạn sau chữ `/folders/`** → ví dụ trên là `1AbCdEf_GhIjKlMnOpQrStUvWxYz123456`
- Copy riêng đoạn đó (KHÔNG kèm `https://drive.google.com/drive/folders/`, KHÔNG có khoảng trắng đầu/cuối).

**6c. Chia sẻ (Share) thư mục cho Service Account — bước "Share" bạn cần làm**

1. Đang **ở bên trong thư mục** (đã nhấp đúp), nhìn **góc trên bên phải**: có nút **Share**
   (biểu tượng hình người). Nhấn vào nút đó.
   - *Không thấy chữ "Share"?* Giao diện mới rút gọn thành **biểu tượng hình người có dấu ✚**
     ngay cạnh khung tên thư mục — di chuột vào sẽ hiện tooltip "Share".
   - *Cách chắc chắn đúng thứ 2:* quay ra danh sách Drive, **chuột phải** vào tên thư mục →
     **Share** → **Share**.
2. Cửa sổ **"Share 'He-thong-thi-truc-tuyen'"** hiện ra:
   - Gõ email Service Account (lấy ở Bước 5) vào ô **"Add people, groups and calendar events"**:
     `exam-drive-bot@he-thong-thi-truc-tuyen.iam.gserviceaccount.com`
   - Email bot **không có gợi ý autocomplete** (khác email người thường) — chuyện bình thường.
     Gõ đủ rồi **nhấn Enter**: email chuyển thành một "thẻ" (chip) nằm trong ô nhập.
   - **Quan trọng:** cạnh ô nhập có menu thả xuống chọn quyền — mặc định **Viewer** →
     nhấn đổi thành **Editor**. (Để Viewer thì bot chỉ đọc được, server sẽ KHÔNG ghi được file.)
3. Nhấn nút **Send** (một số máy hiện chữ **Share**) ở góc dưới phải cửa sổ.
   ("Notify people" tích hay bỏ đều được — bot không có hộp thư.)
4. Kiểm tra lại: mở lại cửa sổ Share → mục **People with access** phải xuất hiện dòng
   `exam-drive-bot@...` kèm nhãn **Editor**.

✅ **Đối chiếu:** email bot hiện trong "People with access" với quyền Editor.

> ⚠️ Tài khoản Google **của tổ chức** (công ty/trường, đuôi khác @gmail.com) có thể bị chính sách
> chặn chia sẻ ra ngoài tổ chức. Nếu không share được hoặc server vẫn bị từ chối quyền:
> tạo thư mục bằng **tài khoản @gmail.com cá nhân** — chắc chắn hoạt động.

### Bước 7 — Mã hóa file key thành Base64

Base64 chỉ là cách biến file JSON thành **một chuỗi ký tự dài duy nhất** để dán được vào biến môi
trường (biến môi trường khó chứa nguyên một file JSON nhiều dòng):

**Windows (PowerShell):**

1. Nhấn phím Windows, gõ `powershell`, mở **Windows PowerShell**.
2. Chạy lệnh (sửa đường dẫn cho đúng nơi bạn để file — nhớ giữ ngoặc kép):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\Ten\Downloads\service-account.json")) | Set-Clipboard
   ```
   Chuỗi Base64 đã nằm trong clipboard — dán thẳng vào Render / file `.env`.
   Muốn in ra màn hình xem trước: bỏ `| Set-Clipboard`.

**macOS:**

```bash
base64 -i ~/Downloads/service-account.json | pbcopy
```

**Linux:**

```bash
base64 -w0 ~/Downloads/service-account.json
```

Chuỗi có thể dài **2.000+ ký tự nằm trên MỘT dòng** — hoàn toàn bình thường.

⚠️ **Ba lỗi hay gặp nhất ở bước này:**
- **Copy thiếu / đứt dòng** → server báo lỗi `JSON.parse` / `Unexpected token`. Luôn dùng
  `| Set-Clipboard` (Windows) hoặc `| pbcopy` (macOS) để copy trọn vẹn; khi dán vào `.env`,
  chuỗi phải nằm trên đúng 1 dòng.
- **Dùng nhầm `certutil -encode` trên CMD** — lệnh đó chèn thêm dòng `-----BEGIN CERTIFICATE-----`
  làm hỏng dữ liệu → **không dùng**.
- **Dán nhầm ô**: Base64 chỉ đi vào `GOOGLE_SERVICE_ACCOUNT_JSON`; Folder ID (Bước 6b) đi vào
  `GOOGLE_DRIVE_FOLDER_ID` — hai biến tách biệt, đừng hoán đổi.

### Bước 8 — Kiểm tra tự động (khuyên dùng trước khi deploy)

```bash
cd online-exam-system
npm install

# Lần 1: đọc file key -> in email Service Account -> sinh .env -> mã hóa Base64
node tools/check-drive.js "đường-dẫn-đến-service-account.json"

# Sau khi điền GOOGLE_DRIVE_FOLDER_ID vào .env — lần 2: test kết nối THẬT tới Drive
node tools/check-drive.js
```

Lần chạy thứ 2 kiểm tra tuần tự 5 mức — script in rõ bước nào đạt (✓), bước nào lỗi (✗) kèm
**cách sửa đúng theo mã lỗi Google trả về**:

| Mức | Kiểm tra gì | Thường lỗi khi |
|---|---|---|
| 1/5 | Đọc key, đủ `client_email` + `private_key` | Base64 / JSON hỏng |
| 2/5 | Nạp thư viện googleapis | Chưa chạy `npm install` |
| 3/5 | Liệt kê nội dung thư mục (quyền ĐỌC) | Chưa bật Drive API / sai Folder ID / chưa Share |
| 4/5 | Tạo + ghi đè file test (quyền GHI) | Share rồi nhưng để quyền Viewer |
| 5/5 | Xóa file test (dọn dẹp) | — |

Khi cả 5 mức đều ✓ → cấu hình đã đúng 100%. Copy 3 biến từ `.env`
(`SESSION_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`) sang Render là xong.

### Bước 9 — Kiểm tra Drive NGAY TRÊN RENDER (không cần máy local)

> `check-drive.js` chỉ chạy được trên máy bạn. Còn trên Render thì sao? Từ phiên bản mới,
> **Admin Dashboard có nút kiểm tra Drive chạy trực tiếp trên server** — chính là 5 mức giống
> Bước 8 nhưng thực hiện bởi chính máy chủ Render đang chạy hệ thống:

1. Mở `https://<ten-app>.onrender.com/admin.html` và đăng nhập Admin.
2. Nhìn **banner trạng thái đồng bộ** ngay đầu trang:
   - 🔴 **Đỏ** "CHẾ ĐỘ CỤC BỘ" → server chưa kết nối Drive (thiếu/sai biến môi trường).
   - 🟡 **Vàng** "Có N file chưa đồng bộ" → env có khai báo nhưng lệnh ghi lên Drive THẤT BẠI
     (banner sẽ in **Lỗi gần nhất** cụ thể, ví dụ `403 The caller does not have permission`).
   - 🟢 **Xanh** "Dữ liệu đã đồng bộ an toàn" → mọi thứ OK.
3. Bấm **"🔍 Kiểm tra Drive ngay"** → một bảng chẩn đoán hiện ra với 5 mức kiểm tra,
   mức nào FAIL sẽ có ô **"Cách sửa"** viết đúng nút bấm / đúng biến cần sửa.
4. Sửa xong (theo gợi ý) → bấm **"Kiểm tra lại"** trong bảng → tới khi hiện
   **"✅ Kết nối Google Drive: TỐT"** → bấm **"⟳ Đồng bộ ngay"** trên banner để đẩy toàn bộ
   dữ liệu đang chờ lên Drive. Nếu server đang kẹt ở chế độ local mà chẩn đoán PASS,
   server **tự kết nối lại Drive mà không cần restart**.

**Sửa biến môi trường trên Render như thế nào?** Render Dashboard → chọn service
`thi-truc-tuyen` → tab **Environment** → **Add Environment Variable** (sửa giá trị cũ bằng nút
chi tiết bên phải từng biến) → **Save Changes** → sang tab **Manual Deploy** → bấm
**Deploy latest commit** → chờ 2–4 phút deploy xong rồi đăng nhập lại Admin để kiểm tra lại.

> ⚠️ Lưu ý: sửa biến môi trường trên Render **bắt buộc phải Manual Deploy** — chỉ Save Changes
> không làm server chạy lại với giá trị mới. Sau deploy, giữ tab admin.html mở và bấm chờ
> 20–60 giây (Render khởi động lạnh) rồi đăng nhập lại.

> 💡 **Mức 4 báo "Service Accounts do not have storage quota"?** Đây là giới hạn của Google:
> Service Account không có dung lượng riêng nên KHÔNG tự tạo được file mới, nhưng **CẬP NHẬT
> được file có sẵn**. Cách xử lý: tạo sẵn 3 file trong thư mục bằng **File upload** (kéo thả
> file `.json` từ máy vào thư mục — KHÔNG tạo bằng Google Docs), đặt đúng tên chữ thường
> `users.json` / `exams.json` / `results.json`, nội dung mỗi file chỉ cần `[]`. Bấm "Kiểm tra
> lại" — mức 4 sẽ tự chuyển sang kiểm tra cập nhật file có sẵn và hiện ✅ nếu mọi thứ ổn.
> Server tự nhận các file này trong tối đa 30 giây, không cần restart.

### Bảng xử lý 6 lỗi thường gặp

| Thông báo lỗi (log server / script) | Nguyên nhân | Cách xử lý |
|---|---|---|
| `403 SERVICE_DISABLED` / "Google Drive API has not been used..." | Chưa bật Drive API | Làm lại Bước 2, chờ 1–2 phút rồi chạy lại |
| `403 The caller does not have permission` | Chưa Share thư mục, hoặc share quyền Viewer; hoặc tài khoản tổ chức chặn chia sẻ ngoài | Làm lại 6c với quyền **Editor**; nếu là tài khoản tổ chức → chuyển sang @gmail.com cá nhân |
| `404 File not found: <id>` | `GOOGLE_DRIVE_FOLDER_ID` sai (copy cả URL, dư khoảng trắng, thư mục đã xóa) | Lấy lại ở Bước 6b — chỉ lấy đoạn sau `/folders/` |
| `401 invalid_grant` / `invalid_client` / lỗi JWT | Base64 hỏng (copy thiếu, thừa dòng trống) hoặc key đã bị xóa/thu hồi | Tạo lại key (Bước 4) + mã hóa lại (Bước 7, dùng Set-Clipboard / pbcopy) |
| `403 storageQuotaExceeded` / "Service Accounts do not have storage quota" | Service Account KHÔNG có dung lượng riêng — KHÔNG tự tạo được file MỚI (giới hạn của Google, không phải lỗi cấu hình) | Tạo sẵn 3 file THUẦN đúng tên `users.json`, `exams.json`, `results.json` trong thư mục Drive: **bấm New → File upload** (hoặc kéo thả file .json từ máy) — KHÔNG dùng New → Google Docs; nội dung mỗi file chỉ cần `[]`. Cập nhật file có sẵn thì KHÔNG tốn quota — hệ thống chạy bình thường. Mức 4 của "Kiểm tra Drive ngay" sẽ tự nhận diện và xác nhận |
| Log in `CHE DO CUC BO` (local mode) | Thiếu 1 trong 2 biến Google | Kiểm tra `.env` (local) hoặc mục Environment (Render) đã khai báo đủ 2 biến chưa |

---

## 4. Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|------|----------|---------|
| `PORT` | — (Render tự set) | Cổng HTTP. Mặc định 3000. |
| `SESSION_SECRET` | ✅ | Khóa ký token phiên. Script `check-drive.js` tự sinh; hoặc tự tạo: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ (prod) | File key Service Account dạng **Base64** (khuyên dùng) hoặc JSON thô 1 dòng — sinh ở mục 3, Bước 7. |
| `GOOGLE_DRIVE_FOLDER_ID` | ✅ (prod) | ID thư mục Drive lưu 3 file JSON — lấy ở mục 3, Bước 6b. |
| `ADMIN_CCCDS` | tùy chọn | Danh sách CCCD được cấp quyền Admin khi đăng ký, phân cách bởi dấu phẩy. |

Ví dụ file `.env` hoàn chỉnh (giá trị minh họa):

```dotenv
PORT=3000
SESSION_SECRET=7f3a9c1e5d8b... (chuỗi hex 96 ký tự, script tự sinh)
GOOGLE_SERVICE_ACCOUNT_JSON=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Iiwi... (chuỗi Base64 1 dòng dài)
GOOGLE_DRIVE_FOLDER_ID=1AbCdEf_GhIjKlMnOpQrStUvWxYz123456
ADMIN_CCCDS=012345678901
```

> 💡 **Chế độ dev:** nếu bỏ trống 2 biến Google, hệ thống chạy **chế độ cục bộ** — dữ liệu ghi vào `./data/`.
> Tiện để phát triển giao diện mà chưa cần Drive.

---

## 5. Chạy thử trên máy local

```bash
cd online-exam-system
npm install

# (Khuyên dùng) Sinh .env từ file key + kiểm tra Drive — xem mục 3, Bước 8:
node tools/check-drive.js "đường-dẫn-đến-service-account.json"

# (Chỉ khi KHÔNG dùng script trên) tạo .env thủ công:
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
3. Sau khi service được tạo, vào **Environment** và bổ sung các biến `sync: false`:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = chuỗi Base64 (mục 3, Bước 7);
   - `GOOGLE_DRIVE_FOLDER_ID` = Folder ID của thư mục Drive (mục 3, Bước 6b);
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
- **ĐÂY LÀ NGUYÊN NHÂN ĐỀ THI "TỰ BIẾN MẤT"**: khi Render ngủ, toàn bộ RAM + đĩa tạm bị XÓA SẠCH.
  Khi thức dậy, server chỉ có dữ liệu nằm trên Google Drive. Nếu Drive chưa cấu hình đúng (sync lỗi),
  MỌI đề thi / tài khoản / điểm đã tạo sau lần thức gần nhất sẽ mất hết. Cách phòng tránh:
  1. Hoàn thành mục 3 (8 bước) **trước khi** ra đề thật — mở trang `/admin.html`: banner màu đỏ nghĩa là
     chưa có Drive, màu vàng nghĩa là chưa sync xong, màu xanh là dữ liệu đã an toàn trên Drive.
  2. Bấm nút **"⟳ Đồng bộ ngay"** trên banner để ghi Drive tức thì và xác nhận kết quả.
  3. Dùng UptimeRobot ping `/api/health` mỗi 5 phút để Render không ngủ trong giờ tổ chức thi.
- Bản ghi "lượt thi đang làm" nằm trong RAM: nếu server restart giữa chừng, thí sinh vào lại đề sẽ được
  cấp lại toàn bộ thời gian (dữ liệu kết quả đã nộp thì **không bao giờ mất** — đã sync Drive ngay khi nộp).
- Log server hiển thị rõ `[store] Da dong bo xxx.json len Google Drive` sau mỗi lần lưu — dùng để giám sát sync.
- Đặt `SESSION_SECRET` là một chuỗi cố định (không để trống): nếu bỏ trống, mỗi lần Render ngủ dậy
  token đăng nhập cũ bị vô hiệu — mọi người phải đăng nhập lại (dữ liệu thì không mất nếu Drive OK).

---

## 7. Câu hỏi nhanh

**Ra 1 đề nhưng danh sách hiện 3 đề giống nhau?** Do bấm nút "Lưu đề thi" nhiều lần khi Render đang
khởi động lạnh (request gửi đi phải chờ 20–60s, tưởng là không ăn nên bấm tiếp). Bản mới đã: (1) khóa nút
và hiện "Đang lưu..." khi đang gửi; (2) server từ chối tạo đề trùng tên + hạng mục trong vòng 2 phút
(lỗi 409 với lời giải thích). Các đề trùng cũ: vào "Đề thi → Xóa" từng đề thừa.

**Không xem được nội dung / không sửa được đề thi?** Bản cũ thiếu chức năng này. Bản mới có đủ:
card đề thi có 3 nút **Xem đề** (xem toàn bộ câu hỏi, đáp án đúng tô xanh) — **Sửa** (mở lại form ra đề
điền sẵn nội dung, sửa xong bấm "Cập nhật đề thi") — **Xóa**.

**Đề thi tạo xong ~15 phút thì biến mất?** Render Free ngủ sau 15 phút không có truy cập — khi ngủ,
mọi dữ liệu chưa ghi lên Google Drive bị xóa sạch. Nghĩa là Google Drive của bạn đang KHÔNG sync được.
Kiểm tra: mở `/admin.html` → bấm **"🔍 Kiểm tra Drive ngay"** (Bước 9) — công cụ chạy ngay trên server
Render, chỉ ra chính xác mức nào lỗi và cách sửa; sau khi sửa env var trên Render nhớ **Manual Deploy**,
rồi bấm **"⟳ Đồng bộ ngay"** để đẩy dữ liệu chờ lên Drive. Xem thêm "Lưu ý khi vận hành
trên Render Free" ở trên.

**Banner vàng "Có N file chưa đồng bộ" báo nguyên nhân gì?** Banner mới in thẳng **Lỗi gần nhất**
do server ghi nhận (ví dụ `403 The caller does not have permission` → thiếu Share / sai quyền;
`DECODER routines::unsupported` → chuỗi Base64 key bị hỏng khi copy). Bấm "Kiểm tra Drive ngay"
để xem đủ 5 mức kèm ô "Cách sửa" cho từng mức.

**Sửa cấu hình xong rồi, dữ liệu có tự lên Drive không?** Có — hệ thống tự thử lại mỗi 30 giây.
Ngoài ra, khi server khởi động mà KHÔNG đọc được dữ liệu cũ trên Drive, phiên bản mới sẽ **KHÔNG
cho phép upload đè** — nó chờ đọc được dữ liệu cũ rồi **GỘP** (bản ghi cũ trên Drive được giữ,
bản ghi mới trong RAM được thêm vào) trước khi ghi, nên không bao giờ có chuyện sync fix xong lại
làm mất dữ liệu cũ trên Drive.

**Đổi nội dung trang chủ / tên cuộc thi / hạn thi?** Sửa trực tiếp `public/index.html`
và hằng số `DEADLINE` trong `public/assets/js/home.js`.

**Muốn nhiều Admin?** Đăng ký tài khoản rồi Admin hiện tại vào "Người dùng → Sửa → Quyền hạn → Admin",
hoặc khai báo `ADMIN_CCCDS` trước khi người đó đăng ký.

**Đăng ký / nộp bài báo "Lỗi máy chủ. Vui lòng thử lại sau." (trên Render)?** Gần như chắc chắn do
Google Drive **chưa cấu hình xong** — server không ghi được file JSON lên Drive. Cách kiểm tra nhanh:
mở `https://<ten-app>.onrender.com/api/health` → nếu `"mode":"drive"` mà `"pending":true` là dữ liệu
đang chờ sync (bị kẹt). Từ phiên bản mới, đăng ký/nộp bài **không còn bị chặn** khi Drive lỗi — dữ liệu
giữ an toàn trong RAM + bộ nhớ cục bộ và **tự thử lại mỗi 30 giây**, kèm cảnh báo trong thông báo thành
công; nhưng bạn vẫn phải hoàn thành mục 3 (8 bước) rồi **Manual Deploy** để dữ liệu được lưu vĩnh viễn.

**Bị lỗi khi kết nối Drive / chưa làm được bước Share?** Xem mục 3: đã có **hướng dẫn từng nút bấm
(8 bước)** kèm dấu hiệu đối chiếu, bảng xử lý 6 lỗi thường gặp, và script kiểm tra tự động —
chạy `node tools/check-drive.js` sẽ chỉ ra chính xác bạn sai chỗ nào (chưa bật API / sai Folder ID /
chưa Share / sai quyền / key hỏng).

**Quota Google Drive?** Service Account được 750 GB/ngày upload — với file JSON vài chục KB,
hệ thống hàng nghìn thí sinh vẫn dư sức.
