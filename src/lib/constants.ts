import type { DataStatus, Factory } from "./types";

export const FACTORY_STATUS_LABEL: Record<Factory["status"], string> = {
  active: "Đang hoạt động",
  expanding: "Đang mở rộng",
  suspended: "Tạm ngừng",
};

// Nhãn + màu trạng thái theo vòng đời dữ liệu (VI. quy tắc demo)
export const STATUS_LABEL: Record<DataStatus, string> = {
  draft: "Draft",
  checking: "Đang kiểm tra",
  need_more: "Cần bổ sung",
  pending: "Chờ duyệt",
  approved: "Đã phê duyệt",
  locked: "Đã khóa kỳ",
  published: "Đã công khai",
  error: "Có lỗi",
};

export const LIFECYCLE_STEPS = [
  "Tiếp nhận",
  "Số hóa / OCR-AI",
  "Staging",
  "Kiểm tra chất lượng",
  "Đối soát",
  "Kiểm duyệt",
  "Phê duyệt",
  "Khóa kỳ",
  "Dữ liệu chính thức",
  "GIS / BI / Báo cáo",
  "Công khai / Chia sẻ",
];

// Chỉ dữ liệu đã phê duyệt / khóa kỳ / công khai mới lên dashboard chính thức
export const OFFICIAL_STATUSES: DataStatus[] = ["approved", "locked", "published"];

export const DISTRICTS = [
  "Toàn tỉnh",
  "TP. Tây Ninh",
  "Trảng Bàng",
  "Gò Dầu",
  "Bến Cầu",
  "Tân Biên",
  "Châu Thành",
];

export const SECTORS = [
  "Tất cả lĩnh vực",
  "Cơ khí",
  "Điện tử",
  "Chế biến nông sản",
  "Dệt may",
  "Cao su",
  "Năng lượng",
  "Thương mại",
];

export const PERIODS = ["Quý II/2026", "Quý I/2026", "Năm 2025", "Năm 2024"];

export const INDUSTRIES = [
  "Dệt may",
  "Cao su",
  "Cơ khí",
  "Điện tử",
  "Chế biến nông sản",
  "Chế biến thực phẩm",
  "Hóa chất – Nhựa",
  "Thép – VLXD",
  "Năng lượng",
  "Thương mại",
];
