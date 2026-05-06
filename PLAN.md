# PLAN.md — Kế hoạch xây dựng ứng dụng Quản Lý Thu Chi Gia Đình

## Mục tiêu

Xây dựng một web app full-stack cho phép nhiều thành viên trong gia đình cùng theo dõi thu chi, quản lý nợ, tiết kiệm, ngân sách và lên kế hoạch tài chính — thay thế cách ghi chép thủ công bằng bảng tính hoặc ghi giấy.

## Vấn đề cần giải quyết

- Các thành viên gia đình chi tiêu riêng lẻ, không ai có cái nhìn tổng thể
- Khó phân chia chi phí chung (tiền điện, chợ, thuê nhà)
- Không có nơi theo dõi nợ nần trong gia đình (ai mượn ai bao nhiêu)
- Giao dịch lặp lại (lương, tiền điện) phải nhập tay mỗi tháng
- Không theo dõi được tiến độ mục tiêu tiết kiệm
- Quản lý hụi thủ công dễ nhầm lẫn

## Phạm vi tính năng

### Phase 1 — Nền tảng (MVP)
- [x] Đăng ký / đăng nhập với JWT
- [x] Khôi phục mật khẩu bằng mã recovery (không cần email)
- [x] Tạo gia đình và mời thành viên bằng mã mời + mã cá nhân
- [x] Ví cá nhân và ví chung cho từng gia đình
- [x] Nhập giao dịch thu/chi với danh mục
- [x] Danh sách giao dịch theo ngày, lọc theo ví/loại
- [x] Dashboard tổng quan: số dư, thu/chi tháng

### Phase 2 — Trải nghiệm người dùng
- [x] Nhập giao dịch bằng văn bản tự nhiên tiếng Việt
- [x] Biểu đồ tròn theo danh mục (Recharts)
- [x] Biểu đồ cột thu/chi theo ngày
- [x] Xóa mềm giao dịch (soft delete, có thể khôi phục)
- [x] Audit log — lịch sử chỉnh sửa giao dịch
- [x] Offline queue — nhập giao dịch khi mất mạng
- [x] Show/hide mật khẩu khi đăng nhập
- [x] Thông báo khi phiên đăng nhập hết hạn

### Phase 3 — Tính năng tài chính nâng cao
- [x] Quản lý nợ & cho vay (3 loại: cá nhân / chung / nội bộ)
- [x] Ghi nhận thanh toán từng phần cho khoản nợ
- [x] Giao dịch định kỳ (hàng tuần / hàng tháng)
- [x] Đề xuất xác nhận giao dịch định kỳ đến hạn
- [x] Quỹ tiết kiệm (SavingsGoal) — cá nhân & gia đình
- [x] Yêu cầu rút tiết kiệm với phê duyệt
- [x] Hụi (Rotating Savings Club) — quản lý các kỳ đóng/hốt
- [x] Dự thu / Dự chi (PlanItem) — lịch tài chính cá nhân

### Phase 4 — Quản lý & Phân tích
- [x] Ngăn ví (WalletPocket) — envelope budgeting trong ví cá nhân
- [x] Quỹ phụ gia đình (SubFund) — tách quỹ riêng trong ví chung
- [x] Ngân sách tuần theo danh mục (WeeklyBudget)
- [x] Ngân sách tháng chi tiết (MonthlyBudget)
- [x] Nhãn người nhận (RecipientLabel) — tag giao dịch theo người
- [x] Danh mục tuỳ chỉnh theo user (ngoài danh mục mặc định)
- [x] Xuất CSV danh sách giao dịch
- [x] Thống kê thu/chi theo tuần (weekly summary)
- [x] Chuyển tiền giữa các ví (transfers)
- [x] Tỷ giá ngoại tệ (ExchangeRate)
- [x] Nhiều ví cá nhân / đa ví (multiple personal wallets)

### Phase 5 — Bảo mật & Hạ tầng
- [x] tokenVersion — thu hồi toàn bộ phiên đăng nhập (logout all)
- [x] isAppAdmin — admin cấp toàn hệ thống tách biệt admin gia đình
- [x] Real-time cập nhật qua WebSocket (Socket.IO) + tokenVersion validation
- [x] Idempotency key — chống duplicate khi mạng không ổn định
- [x] Rate limiting bảo vệ API
- [x] Chuyển database từ SQLite → PostgreSQL
- [x] Hỗ trợ biến môi trường VITE_API_URL cho deploy

## Quyết định kỹ thuật

| Quyết định | Lý do |
|---|---|
| PostgreSQL (thay SQLite ban đầu) | Cần concurrent writes, relations phức tạp, sẵn sàng cho production |
| Prisma ORM | Type-safe, migration dễ, phù hợp TypeScript |
| JWT + tokenVersion | Stateless nhưng vẫn có thể thu hồi phiên mà không cần session store |
| Recovery code thay vì email reset | Tránh phụ thuộc email service, phù hợp môi trường gia đình |
| Socket.IO real-time | Thành viên thấy ngay khi người khác nhập giao dịch |
| TailwindCSS | Phát triển UI nhanh, không cần viết CSS thủ công |
| Vite | Build nhanh hơn Create React App nhiều lần |
| WalletPocket (envelope budgeting) | Phù hợp văn hoá chia tiền theo mục đích ở VN |
| Hui model riêng | Hụi có logic đặc thù (bidAmount, kỳ hốt) khác giao dịch thông thường |

## Sơ đồ quan hệ dữ liệu (rút gọn)

```
Family ──── User[]
Family ──── Wallet (SharedWallet)
Family ──── SubFund[] ──── Wallet

User ──── Wallet[] (PERSONAL)
User ──── SavingsGoal[]
User ──── Hui[]
User ──── PlanItem[]
User ──── MonthlyBudget[]
User ──── WeeklyBudget[]
User ──── RecipientLabel[]
User ──── Category[]  (custom)

Wallet ──── WalletPocket[]
Wallet ──── Transaction[]

Transaction ──── Category
Transaction ──── WalletPocket?
Transaction ──── RecipientLabel?
Transaction ──── TransactionLog[]

Debt ──── DebtPayment[]
RecurringTransaction ──── TransactionProposal[]
Hui ──── HuiRound[]
SavingsGoal ──── SavingsContribution[]
SavingsGoal ──── SavingsWithdrawalRequest[] ──── SavingsWithdrawalApproval[]
PlanItem ──── PlanCompletion[]
```

## Hướng phát triển tiếp theo

- [ ] Deploy backend lên Railway / Render (PostgreSQL đã sẵn sàng)
- [ ] Deploy frontend lên Vercel
- [ ] Thêm thông báo push (PWA) khi giao dịch định kỳ đến hạn
- [ ] Báo cáo tài chính theo tháng/quý dạng PDF
- [ ] Import giao dịch từ file CSV (sao kê ngân hàng)
- [ ] Phân quyền chi tiết hơn trong SubFund (ADMIN vs MEMBER)
