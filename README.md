# Quản Lý Thu Chi Gia Đình

## Cài đặt & Chạy

### Terminal 1 — Backend
```bash
cd server
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

### Terminal 2 — Frontend
```bash
cd client
npm install
npm run dev
```

Mở: **http://localhost:5173**

---

## Lưu ý khi deploy production

- Đổi `JWT_SECRET` trong `server/.env` thành chuỗi ngẫu nhiên dài (tối thiểu 32 ký tự)
- Bật HTTPS qua reverse proxy (Nginx + Certbot)
- Backup file `server/src/prisma/dev.db` định kỳ

## Luồng sử dụng

1. Đăng ký → **lưu mã khôi phục** được cấp (dùng để reset mật khẩu sau này)
2. Người đầu tiên → **Tạo gia đình** → trở thành Admin
3. Admin vào trang **Gia đình** → **Tạo mã mời** → điền mã cá nhân + gợi ý → chia sẻ cho thành viên
4. Thành viên mới đăng ký → vào trang **Gia đình** → **Tham gia** bằng mã mời + mã cá nhân
5. Dùng nút **+** (góc phải màn hình) để nhập nhanh giao dịch bằng văn bản tự nhiên

## Tính năng nhập nhanh

```
"ăn trưa 45k"          → Chi · Ăn uống · 45.000 ₫
"lương 15tr"           → Thu · Lương · 15.000.000 ₫
"tiền điện 1.500.000"  → Chi · Hóa đơn · 1.500.000 ₫
"2tr rưỡi xăng"        → Chi · Di chuyển · 2.500.000 ₫
"ăn tối hôm qua 80k"   → Chi · Ăn uống · 80.000 ₫ · hôm qua
```
