# Transitional route screens

Các file trong thư mục này là màn hình giao diện v2 được giữ lại trong giai đoạn chuyển từ TanStack Start/Vite sang Next.js.

Runtime và routing gốc hiện do Next.js App Router quản lý. `src/components/routing/LegacyRouteView.tsx` ánh xạ các URL cũ đến các màn hình tại đây, còn `src/lib/router-compat.tsx` cung cấp adapter tạm thời cho Link, params và search params.

Để chuyển một màn hình sang Next.js native:

1. Tạo `src/app/<route>/page.tsx` hoặc Route Handler tương ứng.
2. Tách phần tương tác cần thiết thành Client Component nhỏ.
3. Kết nối database/API ở Server Component hoặc `route.ts`.
4. Xóa ánh xạ cũ khỏi `LegacyRouteView` khi màn hình mới đã được kiểm tra.

Không thêm lại `routeTree.gen.ts`, `src/router.tsx`, `src/start.ts` hoặc cấu hình Vite.
