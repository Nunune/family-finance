# CLAUDE.md — Quản Lý Thu Chi Gia Đình

## Tổng quan dự án

Ứng dụng web full-stack giúp các thành viên trong gia đình theo dõi thu chi chung và cá nhân, quản lý nợ/cho vay, tiết kiệm, hụi, ngân sách và lên kế hoạch tài chính. Hỗ trợ nhiều người dùng trong cùng một gia đình với ví chung, ví cá nhân, và quỹ phụ tách biệt.

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
| Database | PostgreSQL (via Prisma ORM) |
| Auth | JWT (access token + tokenVersion) + bcryptjs |

## Cách chạy development

```bash
# Cần có PostgreSQL đang chạy và DATABASE_URL trong server/.env

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

### Biến môi trường

`server/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/family_finance
JWT_SECRET=<chuỗi ngẫu nhiên dài ≥ 32 ký tự>
```

`client/.env` (tuỳ chọn cho deploy):
```
VITE_API_URL=https://your-backend-url.com
```

## Cấu trúc Server

```
server/src/
├── controllers/
│   ├── authController.ts         # Đăng ký, đăng nhập, khôi phục mật khẩu
│   ├── transactionController.ts  # CRUD giao dịch, categories, export CSV
│   ├── debtController.ts         # Nợ & cho vay
│   ├── recurringController.ts    # Giao dịch định kỳ
│   └── ...
├── routes/                       # Định nghĩa API endpoints
│   ├── auth.ts
│   ├── transactions.ts
│   ├── debt.ts
│   ├── recurring.ts
│   ├── savings.ts                # Quỹ tiết kiệm
│   ├── hui.ts                    # Hụi (rotating savings club)
│   ├── pockets.ts                # Ngăn ví (WalletPocket)
│   ├── subFunds.ts               # Quỹ phụ gia đình
│   ├── planItems.ts              # Dự thu / Dự chi
│   ├── budgets.ts                # Ngân sách tuần
│   ├── monthlyBudgets.ts         # Ngân sách tháng
│   ├── recipients.ts             # Nhãn người nhận
│   ├── exchangeRates.ts          # Tỷ giá ngoại tệ
│   ├── transfers.ts              # Chuyển tiền giữa ví
│   ├── wallets.ts                # Quản lý ví
│   └── admin.ts                  # Admin toàn hệ thống (isAppAdmin)
├── middleware/
│   ├── auth.ts          # Xác thực JWT + tokenVersion
│   ├── rateLimit.ts     # Giới hạn tần suất request
│   └── idempotency.ts   # Chống duplicate khi mạng yếu
├── socket/
│   └── handlers.ts      # Sự kiện real-time + tokenVersion validation
└── prisma/
    ├── schema.prisma    # Định nghĩa data model (PostgreSQL)
    └── seed.ts          # Dữ liệu mẫu khởi tạo
```

## Cấu trúc Client

```
client/src/
├── pages/
│   ├── DashboardPage.tsx    # Tổng quan thu chi, biểu đồ
│   ├── WalletPage.tsx       # Danh sách giao dịch, lịch sử
│   ├── FamilyPage.tsx       # Quản lý gia đình, mã mời
│   └── PlansPage.tsx        # Giao dịch định kỳ
├── components/
│   ├── Transaction/         # Form nhập, danh sách giao dịch
│   ├── Debt/                # Nợ & cho vay
│   ├── Charts/              # PieChart danh mục, BarChart theo ngày
│   ├── Recurring/           # Giao dịch định kỳ
│   ├── Family/              # Setup gia đình, mời thành viên
│   └── Auth/                # Form đăng nhập, đăng ký (có show/hide password)
├── contexts/
│   ├── AuthContext.tsx       # State người dùng, JWT
│   └── SocketContext.tsx     # Kết nối Socket.IO (hỗ trợ VITE_API_URL)
├── hooks/
│   └── useOfflineQueue.ts   # Hàng đợi giao dịch khi offline
├── services/
│   └── api.ts               # Axios instance — tự động redirect khi token hết hạn
└── utils/
    └── parser.ts            # Parse văn bản tự nhiên → giao dịch
```

## Data Models chính

```
Family ──── User[] ──── Wallet[] (PERSONAL, nhiều ví)
Family ──── Wallet (SharedWallet)
Family ──── SubFund[] ──── Wallet (SubFundWallet)
Family ──── Debt[]

Wallet ──── WalletPocket[]     (ngăn ví / envelope budgeting)
Wallet ──── Transaction[]
Transaction ──── Category
Transaction ──── WalletPocket?
Transaction ──── RecipientLabel?

User ──── SavingsGoal[]        (mục tiêu tiết kiệm)
User ──── Hui[]                (hụi)
User ──── PlanItem[]           (dự thu / dự chi)
User ──── WeeklyBudget[]
User ──── MonthlyBudget[]
User ──── RecipientLabel[]
User ──── ExchangeRate[]
User ──── Category[]           (danh mục tuỳ chỉnh thêm vào default)
```

## API Endpoints chính

```
# Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/forgot-password

# Giao dịch
GET    /api/transactions                 # Có phân trang, lọc nhiều chiều
POST   /api/transactions                 # Idempotency-Key header
PUT    /api/transactions/:id
DELETE /api/transactions/:id
GET    /api/transactions/summary/stats
GET    /api/transactions/summary/weekly
GET    /api/transactions/export/csv      # Xuất CSV
GET    /api/transactions/categories/all
POST   /api/transactions/categories
PUT    /api/transactions/wallet/balance  # Đặt số dư ban đầu

# Nợ & cho vay
GET|POST       /api/debts
POST           /api/debts/:id/payments

# Giao dịch định kỳ
GET|POST       /api/recurring
POST           /api/recurring/confirm

# Tiết kiệm
GET|POST       /api/savings
POST           /api/savings/:id/contribute

# Hụi
GET|POST       /api/hui
POST           /api/hui/:id/rounds/:roundNo/pay|receive

# Ngăn ví
GET|POST       /api/pockets
PUT|DELETE     /api/pockets/:id

# Quỹ phụ gia đình
GET|POST       /api/sub-funds
POST           /api/sub-funds/:id/members

# Dự thu / Dự chi
GET|POST       /api/plan-items
PATCH          /api/plan-items/:id/completions/:periodKey

# Ngân sách tuần / tháng
GET|PUT        /api/budgets/:categoryId
GET|POST|PUT   /api/monthly-budgets

# Nhãn người nhận
GET|POST       /api/recipients
PUT|DELETE     /api/recipients/:id

# Chuyển tiền
POST           /api/transfers

# Tỷ giá
GET|PUT        /api/exchange-rates
```

## Tính năng đặc biệt

**Nhập giao dịch bằng văn bản tự nhiên** (`utils/parser.ts`):
- `"ăn trưa 45k"` → Chi · Ăn uống · 45.000 ₫
- `"lương 15tr"` → Thu · Lương · 15.000.000 ₫
- `"tiền điện hôm qua 1tr5"` → Chi · Hóa đơn · 1.500.000 ₫ · hôm qua

**Session security**: `tokenVersion` trong DB — tăng khi đổi mật khẩu hoặc logout all, làm hỏng toàn bộ token cũ mà không cần blacklist.

**Offline queue** (`hooks/useOfflineQueue.ts`): Giao dịch được lưu local khi mất mạng, tự đồng bộ khi có kết nối lại.

**Idempotency middleware**: Mỗi POST có header `Idempotency-Key` để tránh tạo trùng giao dịch khi retry.

**Session expired UX**: Khi token hết hạn, client tự động redirect về trang login kèm thông báo rõ ràng.

## Lưu ý quan trọng

- Database là PostgreSQL — cần `DATABASE_URL` trong `server/.env`
- JWT secret lưu trong `server/.env` — không commit file `.env`
- Không commit `server/src/prisma/dev.db` (nếu còn tồn tại)
- Seed data tạo sẵn các danh mục mặc định (INCOME + EXPENSE)
