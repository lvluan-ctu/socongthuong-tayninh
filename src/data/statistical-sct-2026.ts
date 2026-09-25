// ============================================================
// SỐ LIỆU THỐNG KÊ SCT T1-T8/2026 — parsed từ public/SoLieuThongKe.
// Nguồn: 16 file Excel Sở Công Thương (8 TMDV + 8 IIP/SPCN).
// Cột 2025 là giá trị back-calculate từ % so cùng kỳ trong file gốc
// (demo cân đối để đối sánh 2025-2026). Tái tạo: node scripts/parse-solieuthongke.mjs
// ============================================================
import type { ReportColumn, ReportDataset, ReportRow } from "@/lib/types";

export const SCT_TMDV_MONTHLY: { month: string; v2025: number; v2026: number; growth: number }[] = [
  { month: "T1", v2025: 16421418.04, v2026: 18350223.46, growth: 11.75 },
  { month: "T2", v2025: 15781084.17, v2026: 18676095.52, growth: 18.34 },
  { month: "T3", v2025: 15928226.73, v2026: 18546476.93, growth: 16.44 },
  { month: "T4", v2025: 16105814.29, v2026: 19169337.09, growth: 19.02 },
  { month: "T5", v2025: 16298912.08, v2026: 19372614.01, growth: 18.86 },
  { month: "T6", v2025: 15946099.74, v2026: 19510119.37, growth: 22.35 },
  { month: "T7", v2025: 16092069.87, v2026: 19978654.56, growth: 24.15 },
  { month: "T8", v2025: 16763139.93, v2026: 20150332.81, growth: 20.21 },
];
export const SCT_IIP_MONTHLY: { month: string; index: number; luyke: number }[] = [
  { month: "T1", index: 125.95, luyke: 125.95 },
  { month: "T2", index: 106.01, luyke: 116.32 },
  { month: "T3", index: 113.4, luyke: 115.52 },
  { month: "T4", index: 112.32, luyke: 114.86 },
  { month: "T5", index: 113.51, luyke: 114.91 },
  { month: "T6", index: 115.83, luyke: 115.14 },
  { month: "T7", index: 114.9, luyke: 115.02 },
  { month: "T8", index: 116.02, luyke: 115.04 },
];

export const SCT_TMDV_TONGMUC_COLUMNS: ReportColumn[] = [
  { key: "chitieu", header: "Chỉ tiêu", type: "text" },
  { key: "v2025", header: "T8/2025 (triệu đồng)", type: "number" },
  { key: "v2026", header: "T8/2026 (triệu đồng)", type: "number" },
  { key: "growth", header: "Tăng/giảm (%)", type: "percent" },
];
export const SCT_TMDV_TONGMUC_ROWS: ReportRow[] = [
  {
    id: "R-01",
    cells: { chitieu: "Tổng số", v2025: 16763139.93, v2026: 20150332.81, growth: 20.21 },
  },
  {
    id: "R-02",
    cells: { chitieu: "Bán lẻ hàng hóa", v2025: 10922285.19, v2026: 13558532.78, growth: 24.14 },
  },
  {
    id: "R-03",
    cells: { chitieu: "Dịch vụ lưu trú", v2025: 61855.84, v2026: 70009, growth: 13.18 },
  },
  {
    id: "R-04",
    cells: { chitieu: "Dịch vụ ăn uống", v2025: 2129933.46, v2026: 2424023.75, growth: 13.81 },
  },
  {
    id: "R-05",
    cells: {
      chitieu: "Dịch vụ lữ hành và hoạt động hỗ trợ du lịch",
      v2025: 15918.27,
      v2026: 20083.85,
      growth: 26.17,
    },
  },
  {
    id: "R-06",
    cells: { chitieu: "Dịch vụ khác", v2025: 3633147.17, v2026: 4077683.43, growth: 12.24 },
  },
];
export const SCT_TMDV_BANLE_ROWS: ReportRow[] = [
  { id: "R-01", cells: { nhom: "Tổng số", v2025: 10922285.19, v2026: 13558532.78, growth: 24.14 } },
  {
    id: "R-02",
    cells: {
      nhom: "1. Lương thực, thực phẩm",
      v2025: 3800493.75,
      v2026: 4680812.04,
      growth: 23.16,
    },
  },
  {
    id: "R-03",
    cells: { nhom: "2. Hàng may mặc", v2025: 454796.92, v2026: 457237.24, growth: 0.54 },
  },
  {
    id: "R-04",
    cells: {
      nhom: "3. Đồ dùng, dụng cụ, trang thiết bị gia đình",
      v2025: 1255103.51,
      v2026: 1490405.73,
      growth: 18.75,
    },
  },
  {
    id: "R-05",
    cells: {
      nhom: "4. Vật phẩm văn hóa, giáo dục",
      v2025: 91331.26,
      v2026: 106260.74,
      growth: 16.35,
    },
  },
  {
    id: "R-06",
    cells: {
      nhom: "5. Gỗ và vật liệu xây dựng",
      v2025: 1355121.79,
      v2026: 1844137.58,
      growth: 36.09,
    },
  },
  {
    id: "R-07",
    cells: {
      nhom: "6. Ô tô con (dưới 9 chỗ ngồi)",
      v2025: 213490.36,
      v2026: 267446.8,
      growth: 25.27,
    },
  },
  {
    id: "R-08",
    cells: {
      nhom: "7. Phương tiện đi lại (trừ ô tô, kể cả phụ tùng)",
      v2025: 512923.33,
      v2026: 635270.93,
      growth: 23.85,
    },
  },
  {
    id: "R-09",
    cells: { nhom: "8. Xăng, dầu các loại", v2025: 1645278.69, v2026: 2252329.98, growth: 36.9 },
  },
  {
    id: "R-10",
    cells: {
      nhom: "9. Nhiên liệu khác (trừ xăng, dầu)",
      v2025: 189697.42,
      v2026: 241687.56,
      growth: 27.41,
    },
  },
  {
    id: "R-11",
    cells: {
      nhom: "10. Đá quý, kim loại quý và sản phẩm",
      v2025: 901750.84,
      v2026: 938357.05,
      growth: 4.06,
    },
  },
  {
    id: "R-12",
    cells: { nhom: "11. Hàng hóa khác", v2025: 230479.14, v2026: 316689.98, growth: 37.41 },
  },
  {
    id: "R-13",
    cells: {
      nhom: "12. Sửa chữa xe có động cơ, mô tô, xe máy và xe có động cơ",
      v2025: 271818.18,
      v2026: 327897.15,
      growth: 20.63,
    },
  },
];
export const SCT_IIP_ROWS: ReportRow[] = [
  { id: "R-01", cells: { nganh: "TOÀN NGÀNH", base: 100, index: 116.02, growth: 16.02 } },
  { id: "R-02", cells: { nganh: "Khai khoáng", base: 100, index: 76.27, growth: -23.73 } },
  { id: "R-03", cells: { nganh: "Khai khoáng khác", base: 100, index: 76.27, growth: -23.73 } },
  {
    id: "R-04",
    cells: { nganh: "Công nghiệp chế biến, chế tạo", base: 100, index: 116.43, growth: 16.43 },
  },
  {
    id: "R-05",
    cells: { nganh: "Sản xuất chế biến thực phẩm", base: 100, index: 106.96, growth: 6.96 },
  },
  { id: "R-06", cells: { nganh: "Sản xuất đồ uống", base: 100, index: 165.36, growth: 65.36 } },
  {
    id: "R-07",
    cells: { nganh: "Sản xuất sản phẩm thuốc lá", base: 100, index: 106.71, growth: 6.71 },
  },
  { id: "R-08", cells: { nganh: "Dệt", base: 100, index: 115.63, growth: 15.63 } },
  { id: "R-09", cells: { nganh: "Sản xuất trang phục", base: 100, index: 107.66, growth: 7.66 } },
  {
    id: "R-10",
    cells: {
      nganh: "Sản xuất da và các sản phẩm có liên quan",
      base: 100,
      index: 110.11,
      growth: 10.11,
    },
  },
  {
    id: "R-11",
    cells: {
      nganh:
        "Chế biến gỗ và sản xuất sản phẩm từ gỗ, tre, nứa (trừ giường, tủ, bàn, ghế); sản xuất sản phẩm từ rơm, rạ và vật liệu tết bện",
      base: 100,
      index: 102.4,
      growth: 2.4,
    },
  },
  {
    id: "R-12",
    cells: { nganh: "Sản xuất giấy và sản phẩm từ giấy", base: 100, index: 122.06, growth: 22.06 },
  },
  {
    id: "R-13",
    cells: { nganh: "In, sao chép bản ghi các loại", base: 100, index: 90.68, growth: -9.32 },
  },
  {
    id: "R-14",
    cells: {
      nganh: "Sản xuất than cốc, sản phẩm dầu mỏ tinh chế",
      base: 100,
      index: 128.05,
      growth: 28.05,
    },
  },
  {
    id: "R-15",
    cells: {
      nganh: "Sản xuất hoá chất và sản phẩm hoá chất",
      base: 100,
      index: 148.51,
      growth: 48.51,
    },
  },
  {
    id: "R-16",
    cells: {
      nganh: "Sản xuất thuốc, hoá dược và dược liệu",
      base: 100,
      index: 118.05,
      growth: 18.05,
    },
  },
  {
    id: "R-17",
    cells: {
      nganh: "Sản xuất sản phẩm từ cao su và plastic",
      base: 100,
      index: 117.33,
      growth: 17.33,
    },
  },
  {
    id: "R-18",
    cells: {
      nganh: "Sản xuất sản phẩm từ khoáng phi kim loại khác",
      base: 100,
      index: 119.65,
      growth: 19.65,
    },
  },
  { id: "R-19", cells: { nganh: "Sản xuất kim loại", base: 100, index: 136.69, growth: 36.69 } },
  {
    id: "R-20",
    cells: {
      nganh: "Sản xuất sản phẩm từ kim loại đúc sẵn (trừ máy móc, thiết bị)",
      base: 100,
      index: 92.48,
      growth: -7.52,
    },
  },
  {
    id: "R-21",
    cells: {
      nganh: "Sản xuất sản phẩm điện tử, máy vi tính và sản phẩm quang học",
      base: 100,
      index: 113.43,
      growth: 13.43,
    },
  },
  {
    id: "R-22",
    cells: { nganh: "Sản xuất thiết bị điện", base: 100, index: 120.43, growth: 20.43 },
  },
  {
    id: "R-23",
    cells: {
      nganh: "Sản xuất máy móc, thiết bị chưa được phân vào đâu",
      base: 100,
      index: 118,
      growth: 18,
    },
  },
  {
    id: "R-24",
    cells: { nganh: "Sản xuất xe có động cơ", base: 100, index: 206.9, growth: 106.9 },
  },
  {
    id: "R-25",
    cells: { nganh: "Sản xuất phương tiện vận tải khác", base: 100, index: 102.91, growth: 2.91 },
  },
  {
    id: "R-26",
    cells: { nganh: "Sản xuất giường, tủ, bàn, ghế", base: 100, index: 128.5, growth: 28.5 },
  },
  {
    id: "R-27",
    cells: { nganh: "Công nghiệp chế biến, chế tạo khác", base: 100, index: 157.8, growth: 57.8 },
  },
  {
    id: "R-28",
    cells: {
      nganh: "Sửa chữa, bảo dưỡng và lắp đặt máy móc và thiết bị",
      base: 100,
      index: 132.74,
      growth: 32.74,
    },
  },
  {
    id: "R-29",
    cells: {
      nganh: "Sản xuất và phân phối điện, khí đốt, nước nóng, hơi nước và điều hoà không khí",
      base: 100,
      index: 108.23,
      growth: 8.23,
    },
  },
  {
    id: "R-30",
    cells: {
      nganh: "Sản xuất và phân phối điện, khí đốt, nước nóng, hơi nước và điều hoà không khí",
      base: 100,
      index: 108.23,
      growth: 8.23,
    },
  },
  {
    id: "R-31",
    cells: {
      nganh: "Cung cấp nước; hoạt động quản lý và xử lý rác thải, nước thải",
      base: 100,
      index: 106.19,
      growth: 6.19,
    },
  },
  {
    id: "R-32",
    cells: { nganh: "Khai thác, xử lý và cung cấp nước", base: 100, index: 113, growth: 13 },
  },
  {
    id: "R-33",
    cells: { nganh: "Thoát nước và xử lý nước thải", base: 100, index: 97.89, growth: -2.11 },
  },
  {
    id: "R-34",
    cells: {
      nganh: "Hoạt động thu gom, xử lý và tiêu huỷ rác thải; tái chế phế liệu",
      base: 100,
      index: 92.89,
      growth: -7.11,
    },
  },
];
export const SCT_SPCN_ROWS: ReportRow[] = [
  {
    id: "R-01",
    cells: {
      sanpham: "Thuỷ hải sản đã được chế biến bảo quản khác dùng làm thức ăn cho người",
      dvt: "Tấn",
      v2025: 248.07,
      v2026: 315,
      growth: 26.98,
    },
  },
  {
    id: "R-02",
    cells: {
      sanpham: "Gạo đã xát toàn bộ hoặc sơ bộ, đã hoặc chưa đánh bóng hạt hoặc hồ",
      dvt: "Tấn",
      v2025: 53615.27,
      v2026: 74717.56,
      growth: 39.36,
    },
  },
  {
    id: "R-03",
    cells: {
      sanpham: "Tinh bột sắn, bột dong riềng",
      dvt: "Tấn",
      v2025: 112568,
      v2026: 110168.07,
      growth: -2.13,
    },
  },
  {
    id: "R-04",
    cells: { sanpham: "Đường RE", dvt: "Tấn", v2025: 23451.5, v2026: 23860, growth: 1.74 },
  },
  {
    id: "R-05",
    cells: { sanpham: "Đường RS", dvt: "Tấn", v2025: 4412.6, v2026: 4450, growth: 0.85 },
  },
  {
    id: "R-06",
    cells: {
      sanpham: "Thức ăn cho gia súc",
      dvt: "Tấn",
      v2025: 79020.5,
      v2026: 89756.65,
      growth: 13.59,
    },
  },
  {
    id: "R-07",
    cells: {
      sanpham: "Thức ăn cho thuỷ sản",
      dvt: "Tấn",
      v2025: 88812.94,
      v2026: 97778.91,
      growth: 10.1,
    },
  },
  {
    id: "R-08",
    cells: {
      sanpham: "Thức ăn cho vật nuôi làm cảnh",
      dvt: "Tấn",
      v2025: 4150,
      v2026: 4285,
      growth: 3.25,
    },
  },
  {
    id: "R-09",
    cells: {
      sanpham: "Bia đóng chai",
      dvt: "1000 lít",
      v2025: 107.86,
      v2026: 124.54,
      growth: 15.46,
    },
  },
  {
    id: "R-10",
    cells: { sanpham: "Bia đóng lon", dvt: "1000 lít", v2025: 1150.43, v2026: 1845, growth: 60.37 },
  },
  {
    id: "R-11",
    cells: {
      sanpham: "Nước khoáng không có ga",
      dvt: "1000 lít",
      v2025: 32919.21,
      v2026: 38402.5,
      growth: 16.66,
    },
  },
  {
    id: "R-12",
    cells: {
      sanpham: "Nước tinh khiết",
      dvt: "1000 lít",
      v2025: 5162,
      v2026: 10796,
      growth: 109.14,
    },
  },
  {
    id: "R-13",
    cells: {
      sanpham: "Nước ngọt (cocacola, 7 up, …)",
      dvt: "1000 lít",
      v2025: 15462,
      v2026: 29850,
      growth: 93.05,
    },
  },
  {
    id: "R-14",
    cells: {
      sanpham: "Thuốc lá có đầu lọc",
      dvt: "1000 bao",
      v2025: 15071.5,
      v2026: 16082.5,
      growth: 6.71,
    },
  },
  {
    id: "R-15",
    cells: {
      sanpham: "Sợi xe từ các loại sợi tự nhiên: bông, đay, lanh, xơ dừa, cói ...",
      dvt: "Tấn",
      v2025: 43418.14,
      v2026: 48964.36,
      growth: 12.77,
    },
  },
  {
    id: "R-16",
    cells: {
      sanpham: "Sợi tơ (filament) tổng hợp",
      dvt: "Tấn",
      v2025: 26787.02,
      v2026: 27000,
      growth: 0.8,
    },
  },
  {
    id: "R-17",
    cells: {
      sanpham: "Sợi từ bông (staple) nhân tạo có tỷ trọng của loại bông này dưới 85%",
      dvt: "Tấn",
      v2025: 881.27,
      v2026: 764.99,
      growth: -13.19,
    },
  },
  {
    id: "R-18",
    cells: {
      sanpham: "Vải dệt thoi từ sợi tơ (filament) tổng hợp",
      dvt: "1000 m2",
      v2025: 11955.26,
      v2026: 14473.68,
      growth: 21.07,
    },
  },
  {
    id: "R-19",
    cells: {
      sanpham: "Vải dệt thoi từ sợi tơ (filament) nhân tạo",
      dvt: "1000 m2",
      v2025: 17378.23,
      v2026: 18747.17,
      growth: 7.88,
    },
  },
  {
    id: "R-20",
    cells: {
      sanpham: "Vải dệt kim hoặc móc khác",
      dvt: "1000 m2",
      v2025: 47211.2,
      v2026: 58312.41,
      growth: 23.51,
    },
  },
  {
    id: "R-21",
    cells: {
      sanpham: "Quần áo da thuộc",
      dvt: "1000 cái",
      v2025: 653.78,
      v2026: 732,
      growth: 11.96,
    },
  },
  {
    id: "R-22",
    cells: {
      sanpham:
        "Bộ com-lê, quần áo đồng bộ, áo jacket, quần dài, quần yếm, quần soóc cho người lớn dệt kim hoặc đan móc",
      dvt: "1000 cái",
      v2025: 91.36,
      v2026: 120,
      growth: 31.35,
    },
  },
  {
    id: "R-23",
    cells: {
      sanpham: "Áo sơ mi cho người lớn dệt kim hoặc đan móc",
      dvt: "1000 cái",
      v2025: 2415.96,
      v2026: 2564.87,
      growth: 6.16,
    },
  },
  {
    id: "R-24",
    cells: {
      sanpham:
        "Bộ com-lê, quần áo đồng bộ, áo jacket, quần dài, quần yếm, quần soóc cho người lớn không dệt kim hoặc đan móc",
      dvt: "1000 cái",
      v2025: 46862.86,
      v2026: 51170.62,
      growth: 9.19,
    },
  },
  {
    id: "R-25",
    cells: {
      sanpham: "Áo sơ mi cho người lớn không dệt kim hoặc đan móc",
      dvt: "1000 cái",
      v2025: 60.77,
      v2026: 52.84,
      growth: -13.04,
    },
  },
  {
    id: "R-26",
    cells: {
      sanpham: "Giày, dép có đế ngoài và mũ bằng cao su hoặc plastic trừ giày dép không thấm nước",
      dvt: "1000 đôi",
      v2025: 532,
      v2026: 660,
      growth: 24.06,
    },
  },
  {
    id: "R-27",
    cells: {
      sanpham: "Giày, dép có đế hoặc mũ bằng da",
      dvt: "1000 đôi",
      v2025: 550,
      v2026: 480,
      growth: -12.73,
    },
  },
  {
    id: "R-28",
    cells: {
      sanpham: "Giày, dép thể thao có đế ngoài và mũ giày bằng cao su và plastic",
      dvt: "1000 đôi",
      v2025: 3825.33,
      v2026: 3491.69,
      growth: -8.72,
    },
  },
  {
    id: "R-29",
    cells: {
      sanpham: "Giày, dép thể thao có mũ bằng da và có đế ngoài",
      dvt: "1000 đôi",
      v2025: 6942.39,
      v2026: 7677.29,
      growth: 10.59,
    },
  },
  {
    id: "R-30",
    cells: {
      sanpham: "Lốp hơi mới bằng cao su, loại dùng cho ô tô con",
      dvt: "1000 cái",
      v2025: 2539.62,
      v2026: 3010,
      growth: 18.52,
    },
  },
  {
    id: "R-31",
    cells: {
      sanpham: "Lốp hơi mới bằng cao su, loại dùng cho xe buýt, xe tải hoặc máy bay",
      dvt: "1000 cái",
      v2025: 245.14,
      v2026: 236.5,
      growth: -3.52,
    },
  },
  {
    id: "R-32",
    cells: {
      sanpham: "Lốp hơi mới bằng cao su, loại dùng cho xe máy, xe đạp",
      dvt: "1000 cái",
      v2025: 2974.11,
      v2026: 3325.3,
      growth: 11.81,
    },
  },
  {
    id: "R-33",
    cells: { sanpham: "Clanke Poolan", dvt: "Tấn", v2025: 93897, v2026: 96150, growth: 2.4 },
  },
  {
    id: "R-34",
    cells: { sanpham: "Xi măng", dvt: "Tấn", v2025: 151863.5, v2026: 159650, growth: 5.13 },
  },
  {
    id: "R-35",
    cells: {
      sanpham: "Ống khác không nối, mặt cắt hình tròn bằng sắt, thép không hợp kim",
      dvt: "Tấn",
      v2025: 75133.86,
      v2026: 84364.45,
      growth: 12.29,
    },
  },
  {
    id: "R-36",
    cells: { sanpham: "Điện sản xuất", dvt: "Triệu KWh", v2025: 0, v2026: 0, growth: 0 },
  },
  {
    id: "R-37",
    cells: {
      sanpham: "Điện mặt trời",
      dvt: "Triệu KWh",
      v2025: 280.79,
      v2026: 304.5,
      growth: 8.45,
    },
  },
  {
    id: "R-38",
    cells: {
      sanpham: "Điện thương phẩm",
      dvt: "Triệu KWh",
      v2025: 1354.45,
      v2026: 1457,
      growth: 7.57,
    },
  },
  {
    id: "R-39",
    cells: {
      sanpham: "Nước máy sản xuất",
      dvt: "1000 m3",
      v2025: 12152.41,
      v2026: 13718.39,
      growth: 12.89,
    },
  },
  {
    id: "R-40",
    cells: {
      sanpham: "Dịch vụ thu gom rác thải không độc hại không thể tái chế",
      dvt: "Triệu đồng",
      v2025: 27569.26,
      v2026: 28003.48,
      growth: 1.58,
    },
  },
];
export const SCT_TMDV_BANLE_COLUMNS: ReportColumn[] = [
  { key: "nhom", header: "Nhóm hàng", type: "text" },
  { key: "v2025", header: "T8/2025 (triệu đồng)", type: "number" },
  { key: "v2026", header: "T8/2026 (triệu đồng)", type: "number" },
  { key: "growth", header: "Tăng/giảm (%)", type: "percent" },
];

export const SCT_IIP_COLUMNS: ReportColumn[] = [
  { key: "nganh", header: "Ngành công nghiệp", type: "text" },
  { key: "base", header: "Cùng kỳ 2025 (=100)", type: "number" },
  { key: "index", header: "Chỉ số T8/2026", type: "number" },
  { key: "growth", header: "Tăng/giảm (%)", type: "percent" },
];

export const SCT_SPCN_COLUMNS: ReportColumn[] = [
  { key: "sanpham", header: "Sản phẩm", type: "text" },
  { key: "dvt", header: "ĐVT", type: "text" },
  { key: "v2025", header: "T8/2025", type: "number" },
  { key: "v2026", header: "T8/2026", type: "number" },
  { key: "growth", header: "Tăng/giảm (%)", type: "percent" },
];

const SCT_META = {
  fileType: "MẪU" as const,
  year: 2026,
  quarter: "8T",
  source: "Sở Công Thương – Số liệu thống kê T1-T8/2026",
  status: "approved" as const,
  extractedAt: "25/09/2026 08:00",
  savedAt: "25/09/2026 08:00",
  via: "sample" as const,
};

export const SCT_TMDV_TONGMUC_DATASET: ReportDataset = {
  id: "SCT-TMDV-TONG-8T26",
  name: "Tổng mức bán lẻ hàng hóa và doanh thu dịch vụ T8/2026 so cùng kỳ 2025",
  fileName: "8. SCT- TMDV thang 8.xlsx",
  period: "Tháng 8 và 8 tháng đầu 2026 (so cùng kỳ 2025)",
  columns: SCT_TMDV_TONGMUC_COLUMNS,
  rows: SCT_TMDV_TONGMUC_ROWS,
  summary:
    "Tổng mức bán lẻ và doanh thu dịch vụ T8/2026 đạt 20.150 tỷ đồng (+20,2% so cùng kỳ); " +
    "lũy kế 8 tháng đạt 153.938 tỷ đồng (+19,0%). Bán lẻ hàng hóa tăng mạnh nhất (+24,1%), " +
    "lữ hành +26,2%, ăn uống +13,8%, lưu trú +13,2%, dịch vụ khác +12,2%. " +
    "Cột 2025 là giá trị back-calculate từ % cùng kỳ trong file gốc (demo cân đối).",
  ...SCT_META,
};

export const SCT_TMDV_BANLE_DATASET: ReportDataset = {
  id: "SCT-TMDV-BANLE-8T26",
  name: "Doanh thu bán lẻ theo nhóm hàng T8/2026 so cùng kỳ 2025",
  fileName: "8. SCT- TMDV thang 8.xlsx",
  period: "Tháng 8/2026 (so cùng kỳ 2025)",
  columns: SCT_TMDV_BANLE_COLUMNS,
  rows: SCT_TMDV_BANLE_ROWS,
  summary:
    "Doanh thu bán lẻ T8/2026 tăng ở cả 12 nhóm hàng. Gỗ và vật liệu xây dựng tăng mạnh nhất (+36,1%), " +
    "xăng dầu +36,9%, lương thực-thực phẩm +23,2% (nhóm tỷ trọng lớn nhất), ô tô con +25,3%. " +
    "Cột 2025 là giá trị back-calculate từ % cùng kỳ (demo cân đối).",
  ...SCT_META,
};

export const SCT_IIP_DATASET: ReportDataset = {
  id: "SCT-IIP-8T26",
  name: "Chỉ số sản xuất công nghiệp (IIP) T8/2026 so cùng kỳ 2025",
  fileName: "8.8. So lieu IIP- SCT T8.2026.xlsx",
  period: "Tháng 8 và 8 tháng đầu 2026 (so cùng kỳ 2025)",
  columns: SCT_IIP_COLUMNS,
  rows: SCT_IIP_ROWS,
  summary:
    "IIP toàn ngành T8/2026 tăng 16,0% so cùng kỳ; lũy kế 8 tháng tăng 15,0%. " +
    "Chế biến-chế tạo +16,4% dẫn dắt; đồ uống, xe có động cơ, dệt, hóa chất tăng trên 30%; " +
    "khai khoáng tiếp tục giảm (-23,7%). Kỳ gốc 2025 quy về 100 để đối sánh.",
  ...SCT_META,
};

export const SCT_SPCN_DATASET: ReportDataset = {
  id: "SCT-SPCN-8T26",
  name: "Sản lượng sản phẩm công nghiệp chủ yếu T8/2026 so cùng kỳ 2025",
  fileName: "8.8. So lieu IIP- SCT T8.2026.xlsx",
  period: "Tháng 8/2026 (so cùng kỳ 2025)",
  columns: SCT_SPCN_COLUMNS,
  rows: SCT_SPCN_ROWS,
  summary:
    "40 sản phẩm chủ yếu T8/2026: gạo xát +39,4%, bia lon +60,4%, nước ngọt +93,1%, " +
    "xi măng +5,1%, điện thương phẩm +7,6%, điện mặt trời +8,4%. " +
    "Cột 2025 là giá trị back-calculate từ % cùng kỳ (demo cân đối).",
  ...SCT_META,
};

export const SCT_STATISTICAL_DATASETS: ReportDataset[] = [
  SCT_TMDV_TONGMUC_DATASET,
  SCT_TMDV_BANLE_DATASET,
  SCT_IIP_DATASET,
  SCT_SPCN_DATASET,
];
