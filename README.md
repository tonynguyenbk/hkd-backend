# HKD Financial Health — Backend Setup

## Yêu cầu

- Node.js 18+
- PostgreSQL 14+
- npm

## Cài đặt

```bash
# 1. Vào thư mục backend
cd backend

# 2. Cài dependencies
npm install

# 3. Copy và chỉnh sửa file cấu hình
cp .env.example .env
# Mở .env và điền DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, SMTP...

# 4. Tạo database
createdb hkd_financial

# 5. Chạy schema
npm run db:init

# 6. Khởi động server (dev)
npm run dev

# 7. Hoặc production
npm start
```

## Cấu trúc thư mục

```
backend/
├── server.js          ← Toàn bộ API (routes + logic)
├── schema.sql         ← PostgreSQL schema
├── package.json
├── .env.example       ← Template cấu hình
└── README.md

frontend/
└── ho-kinh-doanh-tai-chinh-v4.html   ← Gọi API thay localStorage
```

## API Endpoints

| Method | Route | Mô tả |
|--------|-------|-------|
| POST | /api/auth/register | Đăng ký tài khoản |
| POST | /api/auth/login | Đăng nhập |
| POST | /api/auth/refresh | Làm mới access token |
| GET | /api/auth/me | Thông tin user |
| GET | /api/hkd | Danh sách HKD của user |
| POST | /api/hkd | Tạo HKD mới |
| PUT | /api/hkd/:id | Cập nhật HKD |
| POST | /api/analysis | Lưu kết quả phân tích |
| GET | /api/analysis/history/:hkd_id | Lịch sử phân tích |
| GET | /api/analysis/:id | Chi tiết một kỳ |
| POST | /api/ai/analyze | AI tư vấn (proxy Claude) |
| POST | /api/import/excel | Parse file Excel |
| POST | /api/import/xml | Parse file HTKK XML |
| POST | /api/report/schedule | Cài báo cáo định kỳ |
| GET | /api/benchmark | Ngưỡng benchmark vùng/ngành |
| GET | /health | Kiểm tra server |

## Deploy lên VPS (Ubuntu)

```bash
# Cài Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Cài PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createdb hkd_financial

# Clone code, cài dependencies
npm install --production

# Dùng PM2 để giữ server chạy
npm install -g pm2
pm2 start server.js --name hkd-api
pm2 startup && pm2 save

# Nginx reverse proxy (port 80/443 → 3000)
# Cấu hình trong /etc/nginx/sites-available/hkd-api
```

## Biến môi trường cần thiết

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| DATABASE_URL | ✓ | PostgreSQL connection string |
| JWT_SECRET | ✓ | Chuỗi bí mật 64 ký tự |
| ANTHROPIC_API_KEY | ✓ | Key từ console.anthropic.com |
| SMTP_HOST/USER/PASS | Nếu dùng email | Cấu hình SMTP |
| FRONTEND_URL | Nên có | URL frontend cho CORS |

## Cron Job báo cáo

Server tự động chạy cron lúc 8:00 sáng mỗi ngày, kiểm tra các lịch báo cáo
và gửi email tóm tắt cho những HKD có `send_day` = ngày hôm đó.
