// Dữ liệu lãnh đạo & các đơn vị trực thuộc Sở Công Thương tỉnh Tây Ninh.
// Nguồn: Cổng TTĐT Sở Công Thương Tây Ninh – Sơ đồ, cơ cấu tổ chức
// (https://sct.tayninh.gov.vn/organization-chart-57979)

export interface Leader {
  name: string;
  role: string;
  photo?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  duties?: string;
}

export interface UnitHead {
  unit: string;
  title: string;
  name: string;
  officePhone?: string;
  mobile?: string;
  email?: string;
}

export const SCT_LEADERS: Leader[] = [
  {
    name: "Trương Tấn Sơn",
    role: "Giám đốc Sở",
    mobile: "0983 445 566",
    email: "ttson@tayninh.gov.vn",
    duties: "Phụ trách chung",
  },
  {
    name: "Châu Thị Lệ",
    role: "Phó Giám đốc Sở",
    photo: "/img/portal/leader-ctle.jpg",
    phone: "0723.830.153",
    mobile: "0918.955.666",
    email: "ctle@tayninh.gov.vn",
    duties: "Lĩnh vực phụ trách",
  },
  {
    name: "Ngô Văn Lê",
    role: "Phó Giám đốc Sở",
    photo: "/img/portal/leader-nvle.jpg",
    mobile: "0938 908 178",
    email: "nvle@tayninh.gov.vn",
    duties: "Lĩnh vực phụ trách",
  },
  {
    name: "Trần Thanh Toản",
    role: "Phó Giám đốc Sở",
    photo: "/img/portal/leader-tttoan.jpg",
    mobile: "0989 617 663",
    email: "tttoan@tayninh.gov.vn",
    duties: "Lĩnh vực phụ trách",
  },
  {
    name: "Châu Thanh Long",
    role: "Phó Giám đốc Sở",
    photo: "/img/portal/leader-ctlong.jpg",
    mobile: "0908 863 218",
    email: "longct@tayninh.gov.vn",
    duties: "Lĩnh vực phụ trách",
  },
  {
    name: "Huỳnh Đăng Khoa",
    role: "Phó Giám đốc Sở",
    photo: "/img/portal/leader-hdkhoa.jpg",
    mobile: "0913 731 567",
    email: "khoahd@tayninh.gov.vn",
    duties: "Lĩnh vực phụ trách",
  },
];

export const SCT_UNITS: UnitHead[] = [
  {
    unit: "Văn phòng Sở",
    title: "Chánh Văn phòng",
    name: "Nguyễn Thị Hạnh",
    officePhone: "02723.826 336",
    mobile: "0948 836 849",
    email: "nguyenthihanh@tayninh.gov.vn",
  },
  {
    unit: "Phòng Pháp chế",
    title: "Phó Trưởng phòng",
    name: "Nguyễn Thị Song Thanh",
    officePhone: "02723.832.731",
    mobile: "0913 999 938",
    email: "ntsthanh@tayninh.gov.vn",
  },
  {
    unit: "Phòng Kế hoạch - Tổng hợp",
    title: "Trưởng phòng",
    name: "Bùi Thị Thúy Hằng",
    officePhone: "02723 832 099",
    mobile: "0913 642 634",
    email: "hangsct@tayninh.gov.vn",
  },
  {
    unit: "Phòng Quản lý Công nghiệp",
    title: "Trưởng phòng",
    name: "Võ Trường Minh",
    officePhone: "02723 567 367",
    mobile: "0988 388 113",
    email: "vtminh@tayninh.gov.vn",
  },
  {
    unit: "Phòng Quản lý Thương mại",
    title: "Trưởng phòng",
    name: "Trần Văn Kết",
    officePhone: "02723 821 411",
    mobile: "0931 546 566",
    email: "kettv@tayninh.gov.vn",
  },
  {
    unit: "Phòng Quản lý Năng lượng",
    title: "Trưởng phòng",
    name: "Nguyễn Tấn Bửu Trân",
    officePhone: "02723 832 066",
    mobile: "0983 880 538",
    email: "buutran@tayninh.gov.vn",
  },
  {
    unit: "Phòng Kỹ thuật An toàn - Môi trường",
    title: "Trưởng phòng",
    name: "Nguyễn Duy Phong",
    officePhone: "02723 521 123",
    mobile: "0987 706 625",
    email: "ndphong@tayninh.gov.vn",
  },
  {
    unit: "Trung tâm Khuyến công và Xúc tiến Thương mại",
    title: "Giám đốc",
    name: "Huỳnh Anh Phụng",
    officePhone: "02723 521 700",
    mobile: "0947 376 987",
    email: "haphung@tayninh.gov.vn",
  },
  {
    unit: "Chi cục Quản lý thị trường",
    title: "Chi cục trưởng",
    name: "Nguyễn Minh",
    officePhone: "02763 815 520",
    mobile: "0988 252 228",
    email: "minhn@dms.gov.vn",
  },
];
