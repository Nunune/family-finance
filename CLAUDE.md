# CLAUDE.md — Quản Lý Thu Chi Gia Đình

## Tổng quan dự án

Ứng dụng web full-stack giúp các thành viên trong gia đình theo dõi thu chi chung và cá nhân, quản lý nợ/cho vay, và thiết lập giao dịch định kỳ. Hỗ trợ nhiều người dùng trong cùng một gia đình với ví chung và ví cá nhân tách biệt.

## Kiến trúc

```
family-finance/
├── client/          # React + TypeScript + Vite (frontend)
└── server/          # Node.js + Express + Prisma (backend)
```

**Luồng dữ liệu:** Client giao tiếp với Server qua REST API (`/api/*`) và WebSocket (Socket.IO) cho cập nhật real-time.

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Recharts |
| Backend | Node.js, Express, TypeScript, Socket.IO |
| Database | SQLite (via Prisma ORM) |
| Auth | JWT (access token) + bcryptjs |

## Cách chạy development

```bash
# Terminal 1 — Backend (port 3000)
cd server
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev

# Terminal 2 — Frontend (port 5173)
cd client
npm install
npm run dev
```

## Cấu trúc Server

```
server/src/
├── controllers/     # Logic xử lý request
│   ├── authController.ts       # Đăng ký, đăng nhập, khôi phục mật khẩu
│   ├── transactionController.ts # CRUD giao dịch
│   ├── debtController.ts       # Nợ & cho vay
│   └── recurringController.ts  # Giao dịch định kỳ
├── routes/          # Định nghĩa API endpoints
├── middleware/
│   ├── auth.ts          # Xác thực JWT
│   ├── rateLimit.ts     # Giới hạn tần suất request
│   └── idempotency.ts   # Chống duplicate khi mạng yếu
├── socket/
│   └── handlers.ts      # Sự kiện real-time (thành viên mới, giao dịch mới)
└── prisma/
    ├── schema.prisma    # Định nghĩa data model
    └── seed.ts          # Dữ liệu mẫu khởi tạo
```

## Cấu trúc Client

```
client/src/
├── pages/           # Các trang chính
│   ├── DashboardPage.tsx    # Tổng quan thu chi, biểu đồ
│   ├── WalletPage.tsx       # Danh sách giao dịch, lịch sử
│   ├── FamilyPage.tsx       # Quản lý gia đình, mã mời
│   └── PlansPage.tsx        # Giao dịch định kỳ
├── components/      # UI components tái sử dụng
│   ├── Transaction/         # Form nhập, danh sách giao dịch
│   ├── Debt/                # Nợ & cho vay
│   ├── Charts/              # PieChart danh mục, BarChart theo ngày
│   ├── Recurring/           # Giao dịch định kỳ
│   ├── Family/              # Setup gia đình, mời thành viên
│   └── Auth/                # Form đăng nhập, đăng ký
├── contexts/
│   ├── AuthContext.tsx       # State người dùng, JWT
│   └── SocketContext.tsx     # Kết nối Socket.IO
├── hooks/
│   └── useOfflineQueue.ts   # Hàng đợi giao dịch khi offline
├── services/
│   └── api.ts               # Axios instance, gọi API
└── utils/
    └── parser.ts            # Parse văn bản tự nhiên → giao dịch
```

## Data Models chính

- **User** — tài khoản người dùng, thuộc 1 Family
- **Family** — nhóm gia đình, có ví chung (SharedWallet)
- **Wallet** — ví cá nhân (PersonalWallet) hoặc ví chung
- **Transaction** — giao dịch thu/chi, gắn với ví và danh mục
- **Category** — danh mục mặc định (Ăn uống, Di chuyển, Lương…)
- **Debt** — khoản nợ/cho vay, hỗ trợ 3 loại: PERSONAL / SHARED / INTERNAL
- **RecurringTransaction** — mẫu giao dịch định kỳ (hàng tuần/tháng)
- **TransactionProposal** — đề xuất xác nhận giao dịch định kỳ đến hạn

## API Endpoints chính

```
POST   /api/auth/register          # Đăng ký
POST   /api/auth/login             # Đăng nhập
POST   /api/auth/forgot-password   # Khôi phục mật khẩu

GET    /api/transactions           # Lấy danh sách giao dịch
POST   /api/transactions           # Tạo giao dịch mới
PATCH  /api/transactions/:id       # Sửa giao dịch
DELETE /api/transactions/:id       # Xóa mềm giao dịch

GET    /api/debts                  # Danh sách nợ/cho vay
POST   /api/debts                  # Tạo khoản nợ
POST   /api/debts/:id/payments     # Ghi nhận thanh toán

GET    /api/recurring              # Giao dịch định kỳ
POST   /api/recurring/confirm      # Xác nhận đề xuất định kỳ
```

## Tính năng đặc biệt

**Nhập giao dịch bằng văn bản tự nhiên** (`utils/parser.ts`):
- `"ăn trưa 45k"` → Chi · Ăn uống · 45.000 ₫
- `"lương 15tr"` → Thu · Lương · 15.000.000 ₫
- `"tiền điện hôm qua 1tr5"` → Chi · Hóa đơn · 1.500.000 ₫ · hôm qua

**Offline queue** (`hooks/useOfflineQueue.ts`): Giao dịch được lưu local khi mất mạng, tự đồng bộ khi có kết nối lại.

**Idempotency middleware**: Mỗi request POST có header `Idempotency-Key` để tránh tạo trùng giao dịch khi retry.

## Lưu ý quan trọng

- Database là SQLite file tại `server/src/prisma/dev.db` — không commit file này
- JWT secret lưu trong `server/.env` — không commit file `.env`
- Seed data tạo sẵn 2 user mẫu và các danh mục mặc định
