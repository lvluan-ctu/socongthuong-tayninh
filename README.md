# Energy App v2

Giao diện v2 của Sở Công Thương.

## Chạy ứng dụng

Yêu cầu Node.js 20+ và pnpm 10+.

```bash
pnpm install
pnpm dev
```

Production:

```bash
pnpm build
pnpm start
```

## Cấu hình

Tạo `.env` từ `.env.example` và điền `DATABASE_URL` tới PostgreSQL/PostGIS
đã được cấp sẵn. Ứng dụng dùng schema Drizzle trong `src/db/schema` để truy
vấn dữ liệu runtime.

Gói bàn giao không bao gồm migration, seed script hoặc dữ liệu seed. Database
phải được khách hàng provision trước khi chạy các màn hình/API dùng dữ liệu.
