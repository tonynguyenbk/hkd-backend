# HKD Financial Health Analysis Platform

## 📋 Tổng quan dự án

**HKD Financial Health Analysis** là ứng dụng web fullstack giúp các hộ kinh doanh Việt Nam phân tích sức khỏe tài chính thông qua 10 chỉ số tài chính chuyên sâu, so sánh với chuẩn ngành, và nhận khuyến nghị AI từ Claude.

**Mục đích chính:**
- Cung cấp công cụ phân tích tài chính cho hộ kinh doanh (HKD)
- Giúp chủ hộ hiểu rõ tình hình tài chính của mình
- Đưa ra lộ trình cải thiện dựa trên dữ liệu thực tế
- Tuân thủ khung pháp lý thuế 2026 của Việt Nam

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.18
- **Database:** PostgreSQL 12+
- **ORM/Query:** pg (native PostgreSQL driver)
- **Auth:** JWT (jsonwebtoken) + bcryptjs
- **Security:** helmet, express-rate-limit, CORS
- **File Upload:** multer (Excel, XML parsing)
- **Scheduled Jobs:** node-cron (daily email reports)
- **Email:** nodemailer (SMTP)
- **AI Integration:** Anthropic Claude API (proxy pattern)
- **Data Processing:** xlsx (Excel parser)

### Frontend
- **HTML5 + CSS3 + Vanilla JavaScript** (no framework)
- **Charts:** Chart.js 4.4 (radar & bar charts)
- **Data Import:** XLSX (Excel/CSV), custom XML parser
- **Storage:** LocalStorage (history), Server (PostgreSQL)
- **Authentication:** JWT tokens in localStorage
- **API Communication:** Fetch API with auto-refresh token

### Database
- **PostgreSQL** with UUID primary keys
- **Migrations:** SQL files in `database/migrations/`
- **Seed data:** `database/seeds/`
- **Triggers:** Auto `updated_at` timestamp

### DevOps
- **Deployment:** Railway (git push → deploy)
- **Package Manager:** npm
- **Dev Server:** nodemon

---

## 🏗️ Architecture

### Monorepo Structure
```
financial-household-business/
├── backend/                  ← Node.js API Server
│   ├── src/
│   │   ├── routes/          ← API endpoint definitions (7 files)
│   │   ├── controllers/     ← Request handling logic (5 files)
│   │   ├── services/        ← Business logic layer (4 files)
│   │   ├── repositories/    ← Database queries (5 files)
│   │   ├── middleware/      ← Auth, upload, rate-limit (3 files)
│   │   ├── jobs/            ← Cron jobs for scheduled tasks
│   │   ├── config/          ← Database connection
│   │   └── utils/           ← JWT, response helpers
│   ├── server.js            ← Entry point
│   ├── package.json
│   └── .env
│
├── frontend/                 ← Static HTML/CSS/JS
│   ├── index.html           ← Single-page app
│   └── assets/
│       ├── css/style.css    ← All styling (219 lines)
│       └── js/              ← Modular JS (4 files, 1752 lines total)
│           ├── api.js       ← API layer & auth state
│           ├── auth.js      ← Login/register UI
│           ├── charts.js    ← Chart rendering
│           └── app.js       ← Core app logic
│
├── database/
│   ├── migrations/001_init.sql    ← Schema & triggers
│   └── seeds/001_demo_user.sql    ← Demo account
│
├── .gitignore
├── .env
└── README.md
```

### Design Pattern
- **Controller-Service-Repository:** Clean separation of concerns
  - Routes → Controllers (validation)
  - Controllers → Services (business logic)
  - Services → Repositories (SQL queries)
- **Middleware Pipeline:** helmet → CORS → rate-limit → express.json → routes
- **Error Handling:** Try-catch in services, status codes in responses
- **Database Transactions:** Implicit in unit queries

---

## 💾 Database Schema

### Users Table
```sql
users
├── id (UUID PK)
├── email (unique)
├── password_hash (bcrypt)
├── full_name
├── phone
├── last_login
├── is_active
└── created_at, updated_at
```

### HKD Profiles (Hộ Kinh Doanh)
```sql
hkd_profiles
├── id (UUID PK)
├── user_id (FK → users)
├── name
├── industry (thuong_mai, dich_vu, san_xuat, xay_dung, khac)
├── size (sieu_nho, nho)
├── region (hn_hcm, tinh_lon, tinh_nho)
├── province, duration, mst, address
└── created_at, updated_at
```

### Analyses (Kết quả phân tích)
```sql
analyses
├── id (UUID PK)
├── hkd_id, user_id (FK)
├── period (thang, quy, nam)
├── score (0-100)
├── classification (safe, warn, danger)
├── input_revenue, input_expenses, input_assets (JSONB)
├── ratios, summary (JSONB)
├── ai_analysis (text)
├── import_source (manual, excel, xml)
└── created_at
```

### Refresh Tokens
```sql
refresh_tokens
├── id (UUID PK)
├── user_id (FK)
├── token_hash (SHA256)
├── expires_at
├── revoked
└── created_at
```

### Report Schedules
```sql
report_schedules
├── id (UUID PK)
├── hkd_id, user_id (FK)
├── frequency (monthly)
├── send_day (1-31)
├── email
├── is_active
├── last_sent_at
└── created_at
```

---

## 🎯 Tính năng chính

### 1️⃣ **Quản lý hộ kinh doanh**
- Tạo, sửa, xóa hồ sơ HKD
- Lưu thông tin: ngành nghề, quy mô, địa điểm, MST
- Tự động tạo hồ sơ khi phân tích lần đầu

### 2️⃣ **Nhập dữ liệu tài chính**
- **5 bước interactive:**
  1. Thông tin cơ bản HKD
  2. Doanh thu & Thu nhập
  3. Chi phí hoạt động
  4. Tài sản & Nợ (bảng cân đối)
  5. Xem kết quả

- **Hỗ trợ import:**
  - Excel/CSV (client-side parser)
  - XML HTKK từ Tờ khai thuế
  - Toàn bộ từ ô tính → tự động norm hóa

### 3️⃣ **Phân tích 10 chỉ số tài chính**

| Chỉ số | Ý nghĩa | Công thức | Ngưỡng |
|--------|---------|-----------|--------|
| **Thanh khoản hiện thời** | Khả năng trả nợ ngắn hạn | TSNH / Nợ NH | ≥1.5 (safe) |
| **Thanh khoản nhanh** | TTiền + PT / Nợ NH | Tính toán | ≥1.0 |
| **Biên LN gộp** | % lợi nhuận trước CP | LN gộp / DT × 100 | 15-25% |
| **Biên LN ròng** | % lợi nhuận thực | LN ròng / DT × 100 | 5-10% |
| **Hệ số Nợ/Vốn (D/E)** | Mức độ đòn bẩy | Tổng nợ / Vốn CSH | ≤1.0 |
| **Vòng quay HTK** | Tốc độ bán hàng | DT / HTK (lần/năm) | 4-8 |
| **Chi phí HĐ / DT** | % chi phí so DT | CP HĐ / DT × 100 | ≤20% |
| **Tự tài trợ** | % vốn tự có | Vốn CSH / Tổng TS | 30-50% |
| **Tuân thủ thuế** | Nộp đủ thuế dự kiến | Thuế nộp / Dự kiến | ≥90% |
| **MB / DT** | % chi phí thuê MB | MB / DT × 100 | ≤10% |

**Điểm số:**
- Safe chỉ số: +100 điểm
- Warn chỉ số: +55 điểm
- Danger chỉ số: +15 điểm
- **Tổng điểm = trung bình cộng → phân loại tài chính**

### 4️⃣ **So sánh với chuẩn ngành**
- 5 ngành: Thương mại, Dịch vụ, Sản xuất, Xây dựng, Khác
- 3 vùng: Hà Nội/TP.HCM, Tỉnh lớn, Tỉnh nhỏ
- Biên lợi nhuận kỳ vọng theo ngành
- Ngưỡng cảnh báo tùy vùng

### 5️⃣ **Biểu đồ phân tích**
- **Radar Chart:** Tổng quan 10 chỉ số
- **Bar Chart:** So sánh điểm từng chỉ số
- **Hỗ trợ tương tác:** Zoom, export

### 6️⃣ **Lộ trình cải thiện**
- Ưu tiên cao (xử lý 1-4 tuần) cho nguy cơ cao
- Cần cải thiện (1-3 tháng) cho cảnh báo
- Chiến lược dài hạn (6-12 tháng)
- Hỗ trợ theo quy mô HKD nhỏ

### 7️⃣ **Tư vấn AI từ Claude**
- Phân tích tự động từ dữ liệu phân tích
- 4 phần: Nhận xét tổng quan + 3 điểm mạnh + 3 rủi ro + Khuyến nghị
- Proxy server-side (bảo vệ API key)
- Fallback: gọi trực tiếp nếu có LOCAL_API_KEY

### 8️⃣ **Lịch sử phân tích**
- Lưu tự động vào localStorage (24 kỳ)
- Sau lần phân tích thứ 2: so sánh biểu đồ
- Delta (thay đổi) so kỳ trước
- Có thể reload snapshot cũ

### 9️⃣ **Xác thực & Bảo mật**
- Đăng nhập / Đăng ký
- JWT token (15 min) + Refresh token (30 ngày)
- Rate limit: 100 req/15 min (tổng), 10 req/15 min (auth)
- Helmet headers, CORS
- Bcryptjs hash (round 12)

### 🔟 **Báo cáo định kỳ**
- Cấu hình gửi báo cáo qua email
- Lên lịch gửi vào ngày cố định
- Email HTML với điểm, biểu đồ, nhận xét AI
- Tự động chạy hàng ngày 8:00 sáng (cron)

---

## 📡 API Endpoints

### Authentication
```
POST   /api/auth/register          ← Đăng ký tài khoản
POST   /api/auth/login             ← Đăng nhập
POST   /api/auth/refresh           ← Làm mới token
POST   /api/auth/logout            ← Đăng xuất
GET    /api/auth/me                ← Lấy thông tin user
```

### HKD Profiles
```
GET    /api/hkd                    ← Danh sách HKD của user
POST   /api/hkd                    ← Tạo HKD mới
PUT    /api/hkd/:id                ← Cập nhật HKD
DELETE /api/hkd/:id                ← Xóa HKD
```

### Analysis
```
POST   /api/analysis               ← Lưu kết quả phân tích
GET    /api/analysis/history/:hkd_id   ← Lịch sử phân tích
GET    /api/analysis/:id           ← Chi tiết 1 kỳ
```

### AI Analysis
```
POST   /api/ai/analyze             ← Gọi Claude API (proxy)
```

### Import
```
POST   /api/import/excel           ← Parse Excel/CSV
POST   /api/import/xml             ← Parse XML HTKK
```

### Report Scheduling
```
POST   /api/report/schedule        ← Cấu hình báo cáo
GET    /api/report/schedules       ← Danh sách báo cáo
```

### Public
```
GET    /api/benchmark              ← Dữ liệu chuẩn ngành
GET    /health                     ← Health check
```

---

## 📊 Dữ liệu mẫu (Test Cases)

Project bao gồm **7 tình huống thực tế:**

1. **🛒 Tạp hóa Thành Phát** (DT 480tr) → Warn
2. **🍜 Quán bún bò Mệ Tám** (DT 720tr) → Safe
3. **🔧 Sửa xe Hùng Moto** (DT 380tr) → Safe
4. **🧵 Xưởng may Thanh Loan** (DT 840tr) → Danger
5. **🏠 Nhà trọ Bác Năm** (DT 450tr) → Safe
6. **✂️ Barber Minh Tuấn** (DT 540tr) → Danger
7. **📦 Thảo Cosmetic (Online)** (DT 1.2 tỷ) → Safe

---

## 📋 Khung pháp lý Việt Nam 2026

Ứng dụng tuân thủ:
- **Nghị quyết 198/2025/QH15:** Bỏ thuế khoán, chuyển sang tự kê khai
- **TT 18/2026/TT-BTC:** Hồ sơ & thủ tục kê khai thuế HKD
- **TT 152/2025/TT-BTC:** Chế độ kế toán HKD từ 1/1/2026 (3 nhóm)
- **Luật Thuế GTGT/TNCN 2024/2025:** Ngưỡng chịu thuế 500tr/năm
- **NĐ 74/2024/NĐ-CP:** Lương tối thiểu vùng

---

## 🚀 Cách sử dụng

### Từ người dùng
1. Đăng ký / Đăng nhập
2. Tạo hồ sơ HKD (hoặc chọn từ danh sách)
3. Chọn kỳ phân tích (tháng/quý/năm)
4. Điền thông tin: Doanh thu → Chi phí → Tài sản & Nợ
5. Xem kết quả: Chỉ số + Biểu đồ + Lộ trình + AI
6. Lưu lịch sử, so sánh kỳ trước

### Từ developer
```bash
# Chạy backend
cd financial-household-business/backend
npm run dev                    # Chạy dev server (port 3000)
npm run db:migrate            # Setup database
npm run db:reset              # Reset DB (xóa all data + init)
npm start                      # Production mode

# Chạy frontend
# Dùng VSCode Live Server hoặc static server nào đó
# Frontend gọi API tới http://localhost:3000
```

---

## 📈 Hiệu suất & Khả năng mở rộng

**Hiện tại:**
- ✅ 1 user → unlimited HKD profiles
- ✅ 1 HKD → 24 kỳ phân tích (localStorage)
- ✅ Rate limit: 100 req/15min (tổng), 10 req/15min (auth)
- ✅ JWT auto-refresh khi hết hạn
- ✅ Email async (nodemailer)

**Có thể mở rộng:**
- Thêm báo cáo PDF/Excel export
- Multi-user collaboration trên 1 HKD
- Dự báo dòng tiền (forecasting)
- Tích hợp ngân hàng (open banking)
- Mobile app native

---

## 🔐 Bảo mật

- ✅ Bcrypt hash round 12
- ✅ JWT signed (HS256)
- ✅ Helmet headers (XSS, Clickjacking, MIME sniffing)
- ✅ CORS whitelist (FRONTEND_URL)
- ✅ Rate limit (brute-force protection)
- ✅ SQL injection prevention (parameterized queries)
- ✅ HTTPS ready (Railway + certificate)
- ✅ Sensitive info: không log API key, token

---

## 📦 Dependencies chính

| Package | Version | Mục đích |
|---------|---------|---------|
| express | 4.18.2 | Web server |
| pg | 8.11.3 | PostgreSQL driver |
| jsonwebtoken | 9.0.2 | JWT signing |
| bcryptjs | 2.4.3 | Password hashing |
| helmet | 7.1.0 | Security headers |
| express-rate-limit | 7.1.5 | Rate limiting |
| xlsx | 0.18.5 | Excel parsing |
| node-cron | 3.0.3 | Scheduled jobs |
| nodemailer | 6.9.7 | Email sending |
| Chart.js | 4.4.1 | Frontend charts |

---

## 📝 Lưu ý triển khai

### Railway (Production)
- Repository tự động deploy khi push
- Set environment variables trong Railway dashboard:
  - `DATABASE_URL=postgresql://...`
  - `JWT_SECRET=...` (tối thiểu 64 ký tự)
  - `ANTHROPIC_API_KEY=...` (nếu dùng AI)
  - `SMTP_*` credentials (nếu dùng email)

### Local Development
- Cài PostgreSQL & tạo database
- Copy `.env.example` → `.env` (nếu có)
- `npm install` & `npm run dev`
- Frontend qua Live Server tại `127.0.0.1:5500`

---

## 🎓 Học hỏi từ project

**Better Practices:**
- ✅ Tách controller-service-repository
- ✅ Middleware pipeline pattern
- ✅ JSONB cho flexible data
- ✅ Cron job cho scheduled tasks
- ✅ JWT + Refresh token pattern
- ✅ Client-side parsing (XLSX, XML)

**Có thể cải thiện:**
- Frontend có thể chuyển sang Vue/React
- Thêm validation schema (Joi/Zod)
- Thêm comprehensive testing (Jest/Mocha)
- Thêm logging framework (Winston/Pino)
- Thêm caching (Redis)

---

## 📞 Liên hệ & Support

- **Repository:** d:/financial-household-business
- **Deployment:** Railway
- **Team:** Solo developer
- **Status:** MVP ready for user testing

---

**Generated:** 2026-04-09
**Version:** 1.0.0 (Professional Fullstack)
