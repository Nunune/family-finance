# PLAN.md — Kế hoạch xây dựng ứng dụng Quản Lý Thu Chi Gia Đình

## Mục tiêu

Xây dựng một web app full-stack cho phép nhiều thành viên trong gia đình cùng theo dõi thu chi, quản lý nợ, và lên kế hoạch tài chính — thay thế cách ghi chép thủ công bằng bảng tính hoặc ghi giấy.

## Vấn đề cần giải quyết

- Các thành viên gia đình chi tiêu riêng lẻ, không ai có cái nhìn tổng thể
- Khó phân chia chi phí chung (tiền điện, chợ, thuê nhà)
- Không có nơi theo dõi nợ nần trong gia đình (ai mượn ai bao nhiêu)
- Giao dịch lặp lại (lương, tiền điện) phải nhập tay mỗi tháng

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

### Phase 3 — Tính năng nâng cao
- [x] Quản lý nợ & cho vay (3 loại: cá nhân / chung / nội bộ gia đình)
- [x] Ghi nhận thanh toán từng phần cho khoản nợ
- [x] Giao dịch định kỳ (hàng tuần / hàng tháng)
- [x] Đề xuất xác nhận giao dịch định kỳ đến hạn
- [x] Real-time cập nhật qua WebSocket (Socket.IO)
- [x] Idempotency key — chống duplicate khi mạng không ổn định
- [x] Rate limiting để bảo vệ API

## Quyết định kỹ thuật

| Quyết định | Lý do |
|---|---|
| SQLite thay vì PostgreSQL | Đơn giản cho bản MVP, không cần server DB riêng |
| Prisma ORM | Type-safe, migration dễ, phù hợp TypeScript |
| JWT stateless | Không cần session store, scale dễ |
| Recovery code thay vì email reset | Tránh phụ thuộc email service, phù hợp môi trường gia đình |
| Socket.IO real-time | Thành viên thấy ngay khi người khác nhập giao dịch |
| TailwindCSS | Phát triển UI nhanh, không cần viết CSS thủ công |
| Vite | Build nhanh hơn Create React App nhiều lần |

## Cấu trúc dữ liệu quan trọng

```
Family (1) ──── (n) User
Family (1) ──── (1) Wallet [SharedWallet]
User   (1) ──── (1) Wallet [PersonalWallet]
Wallet (1) ──── (n) Transaction
Transaction (n) ── (1) Category
User   (1) ──── (n) Debt
Debt   (1) ──── (n) DebtPayment
User   (1) ──── (n) RecurringTransaction
RecurringTransaction (1) ── (n) TransactionProposal
```

## Hướng phát triển tiếp theo (ngoài phạm vi BTVN)

- [ ] Deploy backend lên Railway / Render
- [ ] Deploy frontend lên Vercel
- [ ] Đổi SQLite → PostgreSQL cho production
- [ ] Thêm thông báo push (PWA) khi giao dịch định kỳ đến hạn
- [ ] Báo cáo tài chính theo tháng/quý dạng PDF
- [ ] Import giao dịch từ file CSV (sao kê ngân hàng)
- [ ] Phân quyền chi tiết hơn (ADMIN có thể xem ví cá nhân thành viên hay không)
