// Cấu hình thông tin công khai của Sở Công Thương tỉnh Tây Ninh.
// Nguồn: thông tin chính thức do đơn vị cung cấp — dùng cho Trang thông tin (public portal).

export const SITE_CONFIG = {
  organization: {
    shortName: "SỞ CÔNG THƯƠNG",
    fullName: "Sở Công Thương tỉnh Tây Ninh",
    subtitle: "Nền tảng số hóa dữ liệu ngành Công Thương",
  },
  contact: {
    address: "04 đường Song hành, phường Long An, tỉnh Tây Ninh",
    phone: "(072) 3826 336",
    phoneHref: "tel:+84723826336",
    email: "sct@tayninh.gov.vn",
    emailHref: "mailto:sct@tayninh.gov.vn",
  },
} as const;
