import type { PortalPost } from "@/lib/types";

// MOCK DATA — Nội dung công khai cho Trang thông tin (DEMO).
// Dữ liệu được lấy từ các bài viết thật trên Cổng thông tin điện tử Sở Công Thương Tây Ninh
// (https://sct.tayninh.gov.vn / https://sct.tayninh.gov.vn/tin-noi-bat), chỉ còn sự kiện/khuyến mại
// mang tính minh hoạ. Thay thế bằng REST API từ CMS/backend sau này.

const iso = (d: string) => d;

export const PORTAL_POSTS: PortalPost[] = [
  // ─── NEWS ────────────────────────────────────────────────────────────────
  {
    id: "news-01",
    type: "news",
    title:
      "Sở Công Thương làm việc với xã Hậu Nghĩa và các địa phương lân cận về triển khai nhiệm vụ ngành Công Thương",
    slug: "so-cong-thuong-lam-viec-voi-xa-hau-nghia",
    summary:
      "Đoàn công tác của Sở Công Thương có buổi làm việc với xã Hậu Nghĩa và các địa phương lân cận nhằm nắm tình hình triển khai nhiệm vụ ngành Công Thương sau mô hình chính quyền địa phương 2 cấp.",
    content:
      "Sáng ngày 25/6/2026, Đoàn công tác của Sở Công Thương tỉnh Tây Ninh đã có buổi làm việc với xã Hậu Nghĩa và các địa phương lân cận nhằm nắm tình hình triển khai nhiệm vụ ngành Công Thương sau khi thực hiện mô hình chính quyền địa phương 2 cấp, đồng thời ghi nhận những khó khăn, vướng mắc trong công tác quản lý nhà nước tại cơ sở.\n\nTại buổi làm việc, đại diện các địa phương đã trao đổi nhiều nội dung liên quan đến việc triển khai nhiệm vụ quản lý nhà nước lĩnh vực công thương ở cấp xã như: tổ chức thực hiện nhiệm vụ chuyên môn; công tác tập huấn nghiệp vụ; giải quyết thủ tục hành chính; phát triển hạ tầng công nghiệp, thương mại, năng lượng; công tác quản lý thị trường; hoạt động khuyến công và xúc tiến thương mại.\n\nQua trao đổi, các địa phương phản ánh một số khó khăn trong công tác quản lý hoạt động kinh doanh; phát triển hạ tầng thương mại – dịch vụ; nguồn nhân lực thực hiện nhiệm vụ công thương tại cấp xã; việc tiếp cận các chương trình hỗ trợ khuyến công và hoạt động xúc tiến thương mại. Riêng xã Hậu Nghĩa cũng thông tin thêm về tiến độ thực hiện các thủ tục liên quan dự án Chợ Bàu Trai và cho biết đã báo cáo UBND tỉnh cùng các sở, ngành liên quan đối với những nội dung thuộc thẩm quyền xem xét, giải quyết.\n\nLãnh đạo các phòng chuyên môn thuộc Sở đã trực tiếp trao đổi, hướng dẫn và giải đáp những nội dung thuộc phạm vi quản lý ngành, đồng thời ghi nhận các kiến nghị của địa phương để tiếp tục nghiên cứu, tham mưu giải quyết trong thời gian tới. Phát biểu kết luận buổi làm việc, ông Trương Tấn Sơn – Giám đốc Sở Công Thương cho biết, Sở sẽ tiếp tục tăng cường hỗ trợ chuyên môn, hướng dẫn nghiệp vụ và duy trì các kênh trao đổi trực tiếp nhằm kịp thời tháo gỡ khó khăn cho địa phương.\n\nĐặc biệt, trong 6 tháng cuối năm 2026, Sở Công Thương sẽ xây dựng kế hoạch tổ chức các lớp tập huấn chuyên đề, cập nhật những nội dung mới được phân cấp về cấp xã, qua đó góp phần nâng cao năng lực thực thi nhiệm vụ cho đội ngũ công chức phụ trách lĩnh vực công thương tại địa phương.",
    category: "Công nghiệp",
    tags: ["chính quyền 2 cấp", "Hậu Nghĩa", "khuyến công", "xúc tiến thương mại"],
    publishedAt: "2026-06-26",
    status: "published",
    featured: true,
    source:
      "https://sct.tayninh.gov.vn/tin-noi-bat/so-cong-thuong-lam-viec-voi-xa-hau-nghia-va-cac-dia-phuong-lan-can-ve-trien-khai-nhiem-vu-nganh--1075352",
    author: "Thanh Trang",
    views: 1240,
    thumbnail: "/img/portal/activity-hau-nghia.jpg",
  },
  {
    id: "news-02",
    type: "news",
    title: "Hội nghị thúc đẩy xuất khẩu đạt mục tiêu tăng trưởng hai con số",
    slug: "hoi-nghi-thuc-day-xuat-khau-tang-truong-hai-con-so",
    summary:
      "Tây Ninh tham dự Hội nghị thúc đẩy xuất khẩu đạt mục tiêu tăng trưởng hai con số do Bộ Công Thương tổ chức dưới sự chủ trì của Phó Thủ tướng Thường trực Chính phủ.",
    content:
      "Ngày 25/6/2026, Bộ Công Thương tổ chức Hội nghị thúc đẩy xuất khẩu đạt mục tiêu tăng trưởng hai con số dưới sự chủ trì của đồng chí Phạm Gia Túc, Phó Thủ tướng Thường trực Chính phủ. Hội nghị có sự tham dự của lãnh đạo các bộ, ngành, địa phương, hiệp hội ngành hàng và cộng đồng doanh nghiệp trên cả nước.\n\nĐại diện tỉnh Tây Ninh tham dự Hội nghị có đồng chí Nguyễn Hồng Thanh, Ủy viên Ban Thường vụ Tỉnh ủy, Phó Chủ tịch Thường trực UBND tỉnh và đồng chí Trần Thanh Toản, Phó Giám đốc Sở Công Thương.\n\nTại Hội nghị, các đại biểu đã đánh giá tình hình xuất khẩu thời gian qua, nhận diện những khó khăn, thách thức đối với hoạt động xuất nhập khẩu trong bối cảnh kinh tế thế giới diễn biến phức tạp, xu hướng bảo hộ thương mại gia tăng và nhu cầu tiêu dùng tại nhiều thị trường lớn phục hồi chậm. Đồng thời, Hội nghị tập trung thảo luận các giải pháp nhằm phát triển xuất nhập khẩu bền vững, nâng cao năng lực cạnh tranh, đa dạng hóa thị trường, tận dụng hiệu quả các FTA, thúc đẩy chuyển đổi số, chuyển đổi xanh và phát triển hệ thống logistics.\n\nTheo báo cáo tại Hội nghị, trong 5 tháng đầu năm 2026, xuất khẩu đạt gần 215,7 tỷ USD, tăng 19,5% so với cùng kỳ; nhập khẩu đạt gần 229,5 tỷ USD, tăng 30,8%. Cán cân thương mại tháng 5 nhập siêu 5,2 tỷ USD, nâng tổng mức thâm hụt thương mại 5 tháng đầu năm lên khoảng 13,8 tỷ USD.\n\nHoạt động xuất nhập khẩu 5 tháng đầu năm 2026 của tỉnh Tây Ninh tiếp tục duy trì đà tăng trưởng tích cực. Kim ngạch xuất nhập khẩu đạt 14,53 tỷ USD, trong đó xuất khẩu đạt 8,13 tỷ USD (tăng 16,1%), nhập khẩu đạt 6,40 tỷ USD (tăng 13,1%), tỉnh tiếp tục giữ vững mức xuất siêu 1,73 tỷ USD. Hiện hàng hóa của Tây Ninh đã xuất khẩu đến hơn 150 quốc gia và vùng lãnh thổ, với các mặt hàng chủ lực gồm dệt may, giày dép, phương tiện vận tải, máy móc thiết bị, xơ sợi dệt. Hoa Kỳ tiếp tục là thị trường xuất khẩu lớn nhất của tỉnh với kim ngạch trên 2 tỷ USD, tiếp theo là Trung Quốc, Campuchia, Nhật Bản và Hàn Quốc.\n\nHội nghị thống nhất tiếp tục triển khai đồng bộ các giải pháp hỗ trợ doanh nghiệp tháo gỡ khó khăn, đẩy mạnh sản xuất, mở rộng thị trường xuất khẩu, kiểm soát nhập khẩu hiệu quả, góp phần thực hiện thắng lợi mục tiêu tăng trưởng kinh tế hai con số theo Kết luận số 81-KL/TW của Ban Chấp hành Trung ương.",
    category: "Xuất nhập khẩu",
    tags: ["xuất khẩu", "tăng trưởng hai con số", "hội nghị"],
    publishedAt: "2026-06-25",
    status: "published",
    featured: true,
    source:
      "https://sct.tayninh.gov.vn/tin-noi-bat/hoi-nghi-thuc-day-xuat-khau-dat-muc-tieu-tang-truong-hai-con-so-1075220",
    author: "Duy Thanh",
    views: 980,
    thumbnail: "/img/portal/news-export-2026.jpg",
  },
  {
    id: "news-03",
    type: "news",
    title:
      "Sở Công Thương tỉnh Tây Ninh làm việc với 20 xã, phường khu vực Đồng Tháp Mười về tình hình thực hiện nhiệm vụ ngành công thương",
    slug: "lam-viec-20-xa-phuong-dong-thap-muoi",
    summary:
      "Đoàn công tác của Sở Công Thương làm việc với lãnh đạo 20 xã, phường khu vực Đồng Tháp Mười nhằm nắm bắt tình hình triển khai các nhiệm vụ quản lý nhà nước của ngành Công Thương tại địa phương.",
    content:
      "Sáng ngày 24/6, tại phường Kiến Tường, đoàn công tác của Sở Công Thương tỉnh Tây Ninh do ông Trương Tấn Sơn – Giám đốc Sở Công Thương làm trưởng đoàn đã có buổi làm việc với lãnh đạo 20 xã, phường khu vực Đồng Tháp Mười nhằm nắm bắt tình hình triển khai các nhiệm vụ thuộc lĩnh vực quản lý nhà nước của ngành Công Thương tại địa phương.\n\nBuổi làm việc diễn ra trong không khí trao đổi thẳng thắn, trách nhiệm, tập trung vào việc rà soát tình hình thực hiện các nhiệm vụ chuyên môn sau quá trình sắp xếp, kiện toàn tổ chức bộ máy hành chính địa phương, đồng thời ghi nhận những khó khăn, vướng mắc phát sinh trong thực tiễn để kịp thời có hướng tháo gỡ phù hợp.\n\nTại cuộc họp, đại diện lãnh đạo các xã, phường đã kiến nghị nhiều nội dung liên quan trực tiếp đến lĩnh vực quản lý của ngành Công Thương, gồm: công tác bố trí nhân sự phụ trách lĩnh vực công thương tại cơ sở; nhu cầu tổ chức tập huấn, bồi dưỡng chuyên môn nghiệp vụ; đầu tư, nâng cấp hạ tầng thương mại, hệ thống điện phục vụ sản xuất và đời sống dân sinh; công tác quản lý thị trường; hoạt động khuyến công, xúc tiến thương mại và hỗ trợ tiêu thụ nông sản.\n\nTrên cơ sở các ý kiến trao đổi, đại diện các phòng chuyên môn, đơn vị trực thuộc Sở đã trực tiếp giải đáp, làm rõ nhiều nội dung thuộc thẩm quyền quản lý của ngành như lộ trình xóa điện kế tổ, đầu tư nâng cấp hệ thống điện phục vụ sản xuất nông nghiệp; bảo đảm nguồn cung xăng dầu ổn định; tăng cường kiểm tra, kiểm soát chất lượng vật tư nông nghiệp, bình ổn giá cả; nâng cao hiệu quả hoạt động của hệ thống chợ truyền thống; định hướng phát triển, thu hút đầu tư vào các cụm công nghiệp trên địa bàn.\n\nPhát biểu kết luận, Giám đốc Sở Công Thương Trương Tấn Sơn nhấn mạnh việc tổ chức các buổi làm việc trực tiếp với địa phương là hoạt động cần thiết nhằm tăng cường kết nối giữa cơ quan quản lý nhà nước với cơ sở, giúp ngành Công Thương kịp thời nắm bắt thực tiễn, đồng hành cùng địa phương trong tháo gỡ khó khăn và nâng cao hiệu quả quản lý nhà nước. Đối với những kiến nghị vượt thẩm quyền hoặc liên quan đến nhiều ngành, nhiều cấp, Sở sẽ tổng hợp, nghiên cứu và tiếp tục tham mưu cấp có thẩm quyền xem xét giải quyết.",
    category: "Công nghiệp",
    tags: ["Đồng Tháp Mười", "chính quyền 2 cấp", "khuyến công", "quản lý thị trường"],
    publishedAt: "2026-06-24",
    status: "published",
    featured: true,
    source:
      "https://sct.tayninh.gov.vn/tin-noi-bat/so-cong-thuong-tinh-tay-ninh-lam-viec-voi-20-xa-phuong-khu-vuc-dong-thap-muoi-ve-tinh-hinh-thuc--1074787",
    author: "Thanh Trang",
    views: 760,
    thumbnail: "/img/portal/activity-dong-thap-muoi.jpg",
  },
  {
    id: "news-04",
    type: "news",
    title:
      "Sở Công Thương tham mưu thành lập 07 cụm công nghiệp vượt 40% chỉ tiêu được giao năm 2026",
    slug: "tham-muu-thanh-lap-07-cum-cong-nghiep-2026",
    summary:
      "Tính đến tháng 6/2026, Sở Công Thương đã tham mưu UBND tỉnh thành lập 07/07 cụm công nghiệp, đạt 140% kế hoạch trong năm, mở rộng quỹ đất sạch đón nhà đầu tư thứ cấp.",
    content:
      "Thực hiện kế hoạch đầu tư phát triển cụm công nghiệp trên địa bàn tỉnh Tây Ninh năm 2026, Sở Công Thương đã chủ động tham mưu UBND tỉnh xem xét, ban hành Quyết định thành lập 07/07 cụm công nghiệp theo kế hoạch giao, vượt 40% chỉ tiêu kế hoạch của cả năm (kế hoạch giao 05 cụm công nghiệp).\n\n07 cụm công nghiệp được thành lập gồm: Cụm công nghiệp Mỹ Thạnh Bắc 3, Cụm công nghiệp Mỹ Thạnh Bắc 4 (huyện Tân Biên); Cụm công nghiệp Tân Bình 1, Cụm công nghiệp Tân Bình 2 (huyện Tân Châu); Cụm công nghiệp Bình Hòa Nam 1, Cụm công nghiệp Bình Hòa Nam 2 (huyện Bến Cầu) và Cụm công nghiệp Long Thạnh (huyện Tân Châu).\n\nViệc thành lập sớm các cụm công nghiệp tạo quỹ đất sạch có hạ tầng để kêu gọi, thu hút các dự án đầu tư thứ cấp về sản xuất công nghiệp, góp phần đưa tổng diện tích cụm công nghiệp của tỉnh tăng đáng kể, tạo thêm việc làm cho lao động địa phương.",
    category: "Khu/Cụm công nghiệp",
    tags: ["cụm công nghiệp", "thu hút đầu tư", "quỹ đất"],
    publishedAt: "2026-06-15",
    status: "published",
    featured: true,
    source: "https://sct.tayninh.gov.vn/cong-nghiep",
    author: "Phòng Quản lý Công nghiệp",
    views: 640,
    thumbnail: "/img/portal/cluster-survey.jpg",
  },
  {
    id: "news-05",
    type: "news",
    title: "Họp Hội đồng đánh giá lựa chọn chủ đầu tư cụm công nghiệp Tân Hội 3 và Tân Hội 4",
    slug: "hoi-dong-danh-gia-chu-dau-tu-ccn-tan-hoi-3-4",
    summary:
      "Hội đồng đánh giá, lựa chọn chủ đầu tư xây dựng hạ tầng kỹ thuật CCN Tân Hội 3 (71,47 ha) và Tân Hội 4 (74,38 ha) họp xem xét hồ sơ đăng ký của nhà đầu tư.",
    content:
      "Chiều ngày 22/7/2026, Hội đồng đánh giá, lựa chọn chủ đầu tư xây dựng hạ tầng kỹ thuật cụm công nghiệp có phiên làm việc xem xét hồ sơ đăng ký lựa chọn chủ đầu tư xây dựng hạ tầng kỹ thuật Cụm công nghiệp Tân Hội 3 (diện tích 71,47 ha) và Cụm công nghiệp Tân Hội 4 (diện tích 74,38 ha) trên địa bàn huyện Tân Châu.\n\nTại cuộc họp, đại diện Sở Công Thương – cơ quan thường trực Hội đồng – đã báo cáo kết quả thẩm định hồ sơ của các nhà đầu tư tham gia đăng ký, nêu rõ tiêu chí về năng lực tài chính, kinh nghiệm đầu tư phát triển hạ tầng cụm công nghiệp và cam kết về tiến độ thực hiện dự án.\n\nTrên cơ sở tổng hợp ý kiến của các thành viên, Hội đồng đã thống nhất nội dung đánh giá và đề xuất phương án lựa chọn chủ đầu tư trình UBND tỉnh xem xét, quyết định. Theo định hướng của tỉnh, chủ đầu tư được lựa chọn phải bảo đảm triển khai nhanh, đồng bộ hạ tầng để sớm mời gọi các dự án đầu tư thứ cấp vào hoạt động.",
    category: "Khu/Cụm công nghiệp",
    tags: ["cụm công nghiệp", "chủ đầu tư", "Tân Hội", "thu hút đầu tư"],
    publishedAt: "2026-07-22",
    status: "published",
    source: "https://sct.tayninh.gov.vn/cong-nghiep",
    author: "Phòng Quản lý Công nghiệp",
    views: 510,
    thumbnail: "/img/portal/news-cluster-meeting.jpg",
  },
  {
    id: "news-06",
    type: "news",
    title:
      "Hội nghị kết nối chuỗi cung ứng và dịch vụ Logistics trong lĩnh vực Thủy hải sản, Lương thực Thực phẩm – Logistics chuỗi lạnh",
    slug: "hoi-nghi-ket-noi-chuoi-cung-ung-logistics-chuoi-lanh",
    summary:
      "Nằm trong chuỗi sự kiện Diễn đàn quốc tế về Logistics Việt Nam 2026, hội nghị kết nối nhà cung cấp dịch vụ logistics với doanh nghiệp sản xuất, xuất khẩu thủy hải sản, lương thực thực phẩm.",
    content:
      "Sáng 20/7/2026, tại Hà Nội, Bộ Công Thương tổ chức Hội nghị kết nối chuỗi cung ứng và dịch vụ Logistics trong lĩnh vực Thủy hải sản, Lương thực Thực phẩm (Logistics chuỗi lạnh). Đây là hoạt động nằm trong chuỗi sự kiện của Diễn đàn quốc tế về Logistics Việt Nam 2026.\n\nHội nghị là cầu nối trực tiếp giữa các nhà cung cấp dịch vụ logistics (vận tải, kho bãi, logistics chuỗi lạnh) với các doanh nghiệp sản xuất, chế biến và xuất khẩu nhằm trao đổi thông tin, chia sẻ khó khăn và tìm kiếm giải pháp tối ưu hóa chuỗi cung ứng.\n\nCác đại biểu đã nghe các bài trình bày về thị trường logistics lạnh, xu hướng đầu tư kho lạnh, kinh nghiệm quốc tế về quản trị chuỗi cung ứng thủy sản và hàng thực phẩm, đồng thời tham gia phiên kết nối giao thương trực tiếp giữa hai phía doanh nghiệp.",
    category: "Thương mại",
    tags: ["logistics", "chuỗi cung ứng", "chuỗi lạnh", "kết nối"],
    publishedAt: "2026-08-01",
    status: "published",
    source: "https://sct.tayninh.gov.vn/thuong-mai",
    author: "Phòng Quản lý Thương mại",
    views: 390,
    thumbnail: "/img/portal/news-logistics.jpg",
  },
  {
    id: "news-07",
    type: "news",
    title:
      "Thị trường hàng hoá thiết yếu 6 tháng đầu năm 2026 trên địa bàn tỉnh Tây Ninh duy trì ổn định",
    slug: "thi-truong-hang-hoa-thiet-yeu-6-thang-dau-nam-2026",
    summary:
      "6 tháng đầu năm 2026, thị trường hàng hoá thiết yếu trên địa bàn tỉnh Tây Ninh duy trì ổn định, tổng mức bán lẻ ước đạt 1,54 tỷ USD, tăng 22,35% so với cùng kỳ.",
    content:
      "Theo báo cáo của Sở Công Thương, 6 tháng đầu năm 2026 thị trường hàng hoá thiết yếu trên địa bàn tỉnh Tây Ninh tiếp tục duy trì ổn định. Nguồn cung các mặt hàng thiết yếu phục vụ sản xuất và tiêu dùng được bảo đảm, không xảy ra tình trạng thiếu hàng, sốt giá.\n\nTổng mức bán lẻ hàng hoá và doanh thu dịch vụ 6 tháng đầu năm 2026 ước đạt 1,54 tỷ USD, tăng 22,35% so với cùng kỳ năm 2025, phản ánh sức mua trên địa bàn tiếp tục tăng trưởng tốt.\n\nGiá các mặt hàng thiết yếu như lương thực, thực phẩm, xăng dầu, gas đạt mức tăng nhẹ chung theo mặt bằng cả nước và nhanh chóng hạ nhiệt, không để xảy ra biến động cục bộ. Sở Công Thương tăng cường công tác kiểm tra, kiểm soát thị trường và theo dõi sát diễn biến cung cầu nhằm kịp thời đề xuất các giải pháp bình ổn thị trường.",
    category: "Thương mại",
    tags: ["thị trường", "giá cả", "hàng thiết yếu"],
    publishedAt: "2026-07-20",
    status: "published",
    source: "https://sct.tayninh.gov.vn/thuong-mai",
    author: "Phòng Quản lý Thương mại",
    views: 300,
    thumbnail: "/img/portal/news-market.jpg",
  },
  {
    id: "news-08",
    type: "news",
    title: "EU triển khai Hệ thống điện tử ELAN đối với thủ tục phi hải quan cho nông sản",
    slug: "eu-he-thong-dien-tu-elan-thu-tuc-phi-hai-quan-nong-san",
    summary:
      "Từ ngày 23/7/2026, EU chính thức đưa Hệ thống điện tử ELAN vào vận hành đối với thủ tục phi hải quan cho nông sản, giúp rút ngắn thời gian thông quan hàng hoá.",
    content:
      "Từ ngày 23/7/2026, Hệ thống điện tử ELAN đã chính thức được EU triển khai vận hành đối với các thủ tục phi hải quan cho hàng hoá nông sản nhập khẩu vào EU.\n\nHệ thống ELAN cho phép doanh nghiệp, cơ quan có thẩm quyền trao đổi chứng từ, giấy chứng nhận qua môi trường điện tử, thay thế dần các thủ tục giấy tờ truyền thống, từ đó giảm thời gian, chi phí phát sinh trong quá trình thông quan hàng nông sản.\n\nĐây là thông tin quan trọng đối với các doanh nghiệp xuất khẩu nông sản trên địa bàn tỉnh. Doanh nghiệp cần cập nhật, tìm hiểu quy định mới của EU để chủ động trong việc kê khai, chuẩn bị hồ sơ chứng từ điện tử nhằm tận dụng ưu đãi và giảm thiểu rủi ro khi đưa hàng sang thị trường này.",
    category: "Xuất nhập khẩu",
    tags: ["xuất khẩu", "EU", "ELAN", "nông sản"],
    publishedAt: "2026-07-23",
    status: "published",
    source: "https://sct.tayninh.gov.vn/xuat-nhap-khau",
    author: "Phòng Quản lý Xuất nhập khẩu",
    views: 260,
    thumbnail: "/img/portal/news-forum.jpg",
  },
  {
    id: "news-09",
    type: "news",
    title: "Giám đốc Sở Công Thương khảo sát thực tế Cụm công nghiệp Lợi Bình Nhơn 2",
    slug: "giam-doc-so-cong-thuong-khao-sat-thuc-te-cum-cong-nghiep-loi-binh-nhon-2",
    summary:
      "Đoàn công tác của Sở Công Thương do Giám đốc Sở làm trưởng đoàn khảo sát thực tế khu vực đề xuất đầu tư xây dựng Cụm công nghiệp Lợi Bình Nhơn 2 tại phường Khánh Hậu.",
    content:
      "Ngày 21/5/2026, đoàn công tác của Sở Công Thương tỉnh Tây Ninh do đồng chí Giám đốc Sở làm trưởng đoàn đã tổ chức khảo sát thực tế khu vực đề xuất đầu tư xây dựng Cụm công nghiệp Lợi Bình Nhơn 2 trên địa bàn phường Khánh Hậu.\n\nTiếp và làm việc với đoàn có ông Nguyễn Việt Cường, Bí thư phường Khánh Hậu cùng đại diện lãnh đạo địa phương và các đơn vị liên quan.\n\nTheo báo cáo tại buổi khảo sát, khu đất đề xuất thực hiện dự án có diện tích khoảng 27,3 ha, hiện trạng chủ yếu là đất trồng lúa do người dân quản lý và sử dụng. Vị trí dự án phù hợp với các quy hoạch có liên quan theo Quyết định số 2968/QĐ-UBND ngày 26/02/2026 của Chủ tịch UBND tỉnh về việc phê duyệt điều chỉnh Quy hoạch tỉnh Tây Ninh thời kỳ 2021 – 2030, tầm nhìn đến năm 2050.\n\nQua khảo sát thực tế, đoàn công tác đánh giá khu vực đề xuất đầu tư có nhiều thuận lợi về kết nối hạ tầng giao thông khi tiếp giáp và kết nối với tuyến đường Vành đai Tân An, tạo điều kiện thuận lợi cho vận chuyển hàng hóa và phát triển công nghiệp trong thời gian tới.\n\nBên cạnh đó, khu vực dự án cơ bản đáp ứng yêu cầu về hạ tầng kỹ thuật như cấp điện, cấp thoát nước, viễn thông cũng như nguồn nhân lực phục vụ hoạt động sản xuất, kinh doanh khi cụm công nghiệp đi vào hoạt động.\n\nPhát biểu tại buổi làm việc, lãnh đạo Sở Công Thương đề nghị địa phương tiếp tục phối hợp chặt chẽ với các sở, ngành liên quan trong quá trình rà soát hiện trạng sử dụng đất, cập nhật quy hoạch và kêu gọi, thu hút nhà đầu tư có năng lực tham gia đầu tư xây dựng hạ tầng kỹ thuật cụm công nghiệp.\n\nHiện nay, Sở Công Thương đang xúc tiến kêu gọi đầu tư hạ tầng Cụm công nghiệp Lợi Bình Nhơn 2. Việc khảo sát, đánh giá thực tế nhằm phục vụ công tác định hướng phát triển công nghiệp địa phương, từng bước hình thành quỹ đất công nghiệp đáp ứng nhu cầu thu hút đầu tư, góp phần thúc đẩy phát triển kinh tế - xã hội của tỉnh trong giai đoạn tới.",
    category: "Khu/Cụm công nghiệp",
    tags: ["cụm công nghiệp", "khảo sát", "thu hút đầu tư", "Lợi Bình Nhơn 2"],
    publishedAt: "2026-05-23",
    status: "published",
    featured: true,
    source:
      "https://sct.tayninh.gov.vn/tin-noi-bat/giam-doc-so-cong-thuong-khao-sat-thuc-te-cum-cong-nghiep-loi-binh-nhon-2-1064906",
    author: "Trường Minh",
    views: 185,
    thumbnail: "/img/portal/cluster-survey.jpg",
  },
  {
    id: "news-10",
    type: "news",
    title:
      "Tổ chức khám sức khỏe định kỳ cho cán bộ, công chức, viên chức, người lao động Sở Công Thương và đôn đốc thực hiện khám sức khỏe lao động doanh nghiệp năm 2026",
    slug: "to-chuc-kham-suc-khoe-dinh-ky-cho-can-bo-cong-chuc-vien-chuc-nguoi-lao-dong-so-cong-thuong-va-do",
    summary:
      "Sở Công Thương triển khai Chiến dịch 90 ngày đêm khám sức khỏe định kỳ, khám sàng lọc miễn phí theo Kế hoạch số 2777/KH-UBND, bảo đảm 100% cán bộ, công chức, viên chức, người lao động được khám sức khỏe.",
    content:
      "Thực hiện Kế hoạch số 2777/KH-UBND ngày 17/6/2026 của UBND tỉnh Tây Ninh về khám sức khỏe định kỳ/khám sàng lọc miễn phí cho người dân giai đoạn 2026–2030 và Thông báo kết luận số 3499/TB-UBND ngày 23/7/2026 của UBND tỉnh, Sở Công Thương Tây Ninh đã xây dựng Kế hoạch tổ chức thực hiện Chiến dịch 90 ngày đêm khám sức khỏe định kỳ, khám sàng lọc miễn phí cho người dân trên địa bàn tỉnh.\n\nTheo kế hoạch, Sở phấn đấu bảo đảm 100% cán bộ, công chức, viên chức và người lao động thuộc Sở được kiểm tra, theo dõi và chăm sóc sức khỏe định kỳ; đôn đốc, hướng dẫn các doanh nghiệp, cơ sở sản xuất kinh doanh thuộc phạm vi quản lý ngành thực hiện đúng quy định về khám sức khỏe định kỳ cho người lao động; đồng thời chuẩn hóa và cập nhật 100% kết quả khám vào Hồ sơ sức khỏe điện tử/Cổng dữ liệu sức khỏe của Bộ Y tế theo phương châm “khám đến đâu, cập nhật dữ liệu đến đó”.\n\nPhạm vi triển khai gồm hai khối: khối Văn phòng Sở và các đơn vị trực thuộc (Nhóm 3.1 theo Kế hoạch 2777/KH-UBND) và khối doanh nghiệp ngành Công Thương – người lao động làm việc tại các công ty, doanh nghiệp, cơ sở sản xuất kinh doanh, cụm công nghiệp thuộc thẩm quyền quản lý của ngành (Nhóm 3.3).\n\nĐịnh mức chi phí khám tối đa 350.000 đồng/người/lần/năm (theo khoản 1 Điều 73 Nghị định 165/2026/NĐ-CP), nguồn kinh phí từ ngân sách nhà nước cấp cho Sở Công Thương năm 2026. Danh mục khám cơ bản gồm: tổng phân tích tế bào máu ngoại vi, Glucose, Urê, Creatinin, AST/GOT, ALT/GPT, tổng phân tích nước tiểu và chụp X-quang ngực thẳng số hóa 1 phim. Sở sẽ lựa chọn, ký hợp đồng với cơ sở y tế đủ điều kiện trên địa bàn tỉnh theo Phụ lục II – Kế hoạch 2777/KH-UBND.\n\nTheo tiến độ, Sở hoàn thành rà soát danh sách, lập dự toán và ký kết hợp đồng với cơ sở y tế trước ngày 15/8/2026; tổ chức khám sức khỏe tập trung cho toàn thể CBCCVC-NLĐ trước ngày 10/9/2026 và phối hợp cập nhật 100% dữ liệu vào Hồ sơ sức khỏe điện tử trước ngày 15/9/2026.\n\nĐối với khối doanh nghiệp, Sở phối hợp với Sở Y tế, Ban Quản lý Khu kinh tế và Liên đoàn Lao động tỉnh tuyên truyền, hướng dẫn, yêu cầu các doanh nghiệp thực hiện nghiêm túc khám sức khỏe định kỳ/khám bệnh nghề nghiệp cho người lao động theo Điều 21 Luật An toàn, vệ sinh lao động; yêu cầu các doanh nghiệp chủ động phối hợp với cơ sở y tế cập nhật kết quả khám lên Cổng dữ liệu sức khỏe của Bộ Y tế; đồng thời tổ chức kiểm tra, giám sát việc chấp hành quy định tại các cơ sở sản xuất kinh doanh thuộc thẩm quyền quản lý. Chế độ thông tin, báo cáo được thực hiện theo ngày, tháng và quý theo hướng dẫn của Sở Y tế.",
    category: "Thương mại",
    tags: ["khám sức khỏe", "CBCCVC", "an toàn vệ sinh lao động"],
    publishedAt: "2026-07-31",
    status: "published",
    source:
      "https://sct.tayninh.gov.vn/tin-noi-bat/to-chuc-kham-suc-khoe-dinh-ky-cho-can-bo-cong-chuc-vien-chuc-nguoi-lao-dong-so-cong-thuong-va-do-1084618",
    author: "Thuận An",
    views: 92,
    thumbnail: "/img/portal/news-health-check.png",
  },

  // ─── EVENTS ───────────────────────────────────────────────────────────────
  {
    id: "event-01",
    type: "event",
    title: "Hội chợ Công Thương Tây Ninh 2026",
    slug: "hoi-cho-cong-thuong-tay-ninh-2026",
    summary:
      "Hội chợ thương mại lớn nhất năm với sự tham gia của hàng trăm gian hàng sản phẩm công nghiệp, nông sản, thủ công mỹ nghệ.",
    content:
      "Hội chợ Công Thương Tây Ninh 2026 là sự kiện xúc tiến thương mại trọng điểm của tỉnh, quy tụ hơn 300 gian hàng đến từ các tỉnh, thành và doanh nghiệp trong nước.\n\nBên cạnh trưng bày, giới thiệu sản phẩm, hội chợ còn tổ chức chuỗi hoạt động kết nối giao thương, tư vấn đầu tư và chương trình khuyến mại hấp dẫn.",
    category: "Hội chợ",
    tags: ["hội chợ", "xúc tiến thương mại"],
    publishedAt: "2026-08-01",
    status: "published",
    featured: true,
    eventStartDate: "2026-09-10",
    eventEndDate: "2026-09-14",
    location: "Trung tâm Hội chợ Triển lãm tỉnh Tây Ninh",
    organizer: "Sở Công Thương tỉnh Tây Ninh",
    audience: "Doanh nghiệp, hợp tác xã, nhà phân phối, người tiêu dùng",
    registrationDeadline: "2026-08-30",
    author: "Phòng Xúc tiến Thương mại",
    views: 2100,
    thumbnail: "/img/portal/trade-aeon.jpg",
  },
  {
    id: "event-02",
    type: "event",
    title: "Hội nghị kết nối giao thương Việt Nam – Campuchia",
    slug: "hoi-nghi-ket-noi-giao-thuong-viet-nam-campuchia",
    summary:
      "Sự kiện kết nối doanh nghiệp hai nước nhân kỷ niệm quan hệ hữu nghị, mở rộng cơ hội xuất khẩu qua biên giới Tây Ninh.",
    content:
      "Hội nghị kết nối giao thương Việt Nam – Campuchia được tổ chức nhằm thúc đẩy quan hệ hợp tác thương mại giữa doanh nghiệp hai nước, tận dụng lợi thế cửa khẩu biên giới.\n\nChương trình gồm các phiên kết nối B2B, giới thiệu tiềm năng đầu tư và tham quan thực địa các cụm công nghiệp trên địa bàn tỉnh.",
    category: "Kết nối giao thương",
    tags: ["kết nối giao thương", "xuất khẩu", "campuchia"],
    publishedAt: "2026-07-25",
    status: "published",
    eventStartDate: "2026-09-22",
    eventEndDate: "2026-09-23",
    location: "TP. Tây Ninh",
    organizer: "Sở Công Thương, Hiệp hội doanh nghiệp",
    audience: "Doanh nghiệp xuất nhập khẩu hai nước",
    registrationDeadline: "2026-09-10",
    author: "Phòng Xúc tiến Thương mại",
    views: 1330,
    thumbnail: "/img/portal/trade-asean.jpg",
  },
  {
    id: "event-03",
    type: "event",
    title: "Hội thảo chuyển đổi số và thương mại điện tử cho doanh nghiệp",
    slug: "hoi-thao-chuyen-doi-so-thuong-mai-dien-tu",
    summary:
      "Hội thảo chia sẻ giải pháp chuyển đổi số, bán hàng đa kênh dành cho doanh nghiệp nhỏ và vừa trên địa bàn tỉnh.",
    content:
      "Hội thảo cập nhật xu hướng chuyển đổi số, kinh nghiệm triển khai thương mại điện tử và các chính sách hỗ trợ của tỉnh cho doanh nghiệp nhỏ và vừa.\n\nCác chuyên gia chia sẻ giải pháp thực tiễn về quản trị số, marketing số và xây dựng gian hàng trực tuyến phù hợp với ngành hàng.",
    category: "Hội thảo",
    tags: ["hội thảo", "chuyển đổi số", "thương mại điện tử"],
    publishedAt: "2026-07-15",
    status: "published",
    eventStartDate: "2026-10-08",
    eventEndDate: "2026-10-08",
    location: "Hội trường Sở Công Thương",
    organizer: "Sở Công Thương tỉnh Tây Ninh",
    audience: "Doanh nghiệp nhỏ và vừa, hợp tác xã",
    registrationDeadline: "2026-10-02",
    author: "Trung tâm Hỗ trợ doanh nghiệp",
    views: 820,
  },
  {
    id: "event-04",
    type: "event",
    title: "Chương trình tập huấn nghiệp vụ công tác khuyến công",
    slug: "tap-huan-nghiep-vu-khuyen-cong-2026",
    summary:
      "Tập huấn cập nhật quy định mới, quy trình lập hồ sơ và nghiệm thu các đề án khuyến công cho cán bộ và doanh nghiệp.",
    content:
      "Chương trình tập huấn dành cho cán bộ quản lý khuyến công và doanh nghiệp trên địa bàn, cập nhật các quy định pháp luật mới và quy trình triển khai đề án.\n\nNội dung gồm: hướng dẫn lập hồ sơ đề xuất, nghiệm thu, thanh quyết toán và các tiêu chí ưu tiên hỗ trợ.",
    category: "Tập huấn",
    tags: ["tập huấn", "khuyến công"],
    publishedAt: "2026-06-30",
    status: "published",
    eventStartDate: "2026-11-05",
    eventEndDate: "2026-11-06",
    location: "Hội trường Sở Công Thương",
    organizer: "Trung tâm Khuyến công",
    audience: "Cán bộ, doanh nghiệp trên địa bàn tỉnh",
    registrationDeadline: "2026-10-28",
    author: "Trung tâm Khuyến công",
    views: 460,
  },

  // ─── PROMOTION ─────────────────────────────────────────────────────────────
  {
    id: "promo-01",
    type: "promotion",
    title: "Chương trình khuyến mại tập trung Quý III/2026",
    slug: "khuyen-mai-tap-trung-quy-iii-2026",
    summary:
      "Chương trình khuyến mại tập trung do Sở Công Thương công bố, áp dụng cho hàng trăm doanh nghiệp trên địa bàn tỉnh.",
    content:
      "Chương trình khuyến mại tập trung Quý III/2026 được công bố nhằm kích cầu tiêu dùng, hỗ trợ doanh nghiệp tiêu thụ hàng hóa.\n\nCác hình thức khuyến mại bao gồm giảm giá, tặng quà, ưu đãi khi mua kèm sản phẩm theo đúng quy định pháp luật.",
    category: "Khuyến mại",
    tags: ["khuyến mại", "kích cầu"],
    publishedAt: "2026-07-01",
    status: "published",
    featured: true,
    eventStartDate: "2026-07-01",
    eventEndDate: "2026-09-30",
    author: "Phòng Quản lý Thương mại",
    views: 1650,
  },
  {
    id: "promo-02",
    type: "promotion",
    title: "Giảm giá 50% hàng tiêu dùng thiết yếu dịp lễ 2/9",
    slug: "giam-gia-hang-tieu-dung-dip-le-2-9",
    summary:
      "Chương trình giảm giá đối với nhóm hàng tiêu dùng thiết yếu do các hệ thống phân phối trên địa bàn phối hợp triển khai.",
    content:
      "Nhân dịp Quốc khánh 2/9, các hệ thống siêu thị, trung tâm thương mại trên địa bàn tỉnh phối hợp triển khai chương trình giảm giá hàng tiêu dùng thiết yếu.\n\nNgười tiêu dùng được hưởng ưu đãi lên đến 50% đối với nhiều mặt hàng phục vụ nhu cầu thiết yếu hằng ngày.",
    category: "Khuyến mại",
    tags: ["giảm giá", "tiêu dùng"],
    publishedAt: "2026-08-20",
    status: "published",
    eventStartDate: "2026-09-01",
    eventEndDate: "2026-09-03",
    author: "Phòng Quản lý Thương mại",
    views: 880,
  },
  {
    id: "promo-03",
    type: "promotion",
    title: "Ưu đãi đăng ký khu gian hàng hội chợ triển lãm",
    slug: "uu-dai-khu-gian-hang-hoi-cho",
    summary:
      "Doanh nghiệp đăng ký gian hàng hội chợ trước ngày 15/8 được hưởng ưu đãi chi phí thuê gian hàng.",
    content:
      "Nhằm khuyến khích doanh nghiệp tham gia Hội chợ Công Thương Tây Ninh 2026, Ban tổ chức áp dụng chính sách ưu đãi chi phí gian hàng cho doanh nghiệp đăng ký sớm.\n\nƯu đãi áp dụng cho gian hàng tiêu chuẩn và gian hàng đặc biệt của các doanh nghiệp, hợp tác xã trên địa bàn tỉnh.",
    category: "Khuyến mại",
    tags: ["hội chợ", "ưu đãi"],
    publishedAt: "2026-07-18",
    status: "published",
    eventStartDate: "2026-07-18",
    eventEndDate: "2026-08-15",
    author: "Phòng Xúc tiến Thương mại",
    views: 540,
  },

  // ─── TRADE PROMOTION ───────────────────────────────────────────────────────
  {
    id: "trade-01",
    type: "trade-promotion",
    title:
      "Sở Công Thương xúc tiến thương mại các sản phẩm của tỉnh Tây Ninh với hệ thống phân phối ViPro Japan",
    slug: "xuc-tien-thuong-mai-vipro-japan",
    summary:
      "Đoàn công tác tỉnh Tây Ninh làm việc với Công ty ViPro Japan tại Saitama nhằm kết nối giao thương, mở rộng thị trường tiêu thụ cho sản phẩm thế mạnh của tỉnh tại Nhật Bản.",
    content:
      "Trong khuôn khổ chương trình xúc tiến thương mại tại Nhật Bản, sáng ngày 13/6/2026, Đoàn công tác tỉnh Tây Ninh do ông Châu Thanh Long – Phó Giám đốc Sở Công Thương làm Trưởng đoàn đã có buổi làm việc với Công ty ViPro Japan tại tỉnh Saitama, Nhật Bản nhằm tìm hiểu hệ thống phân phối hàng hóa Việt Nam tại Nhật Bản, đồng thời thúc đẩy cơ hội hợp tác, kết nối giao thương và mở rộng thị trường tiêu thụ cho các sản phẩm thế mạnh của tỉnh.\n\nTại buổi làm việc, đoàn công tác đã tham quan thực tế hệ thống kho vận, quy trình nhập khẩu, lưu kho, phân phối hàng hóa và mô hình kinh doanh của ViPro Japan – doanh nghiệp hoạt động trong lĩnh vực nhập khẩu, phân phối và phát triển sản phẩm Việt Nam tại Nhật Bản, phục vụ hệ thống đại lý, cửa hàng thực phẩm châu Á, nhà hàng, kênh bán sỉ và cộng đồng người Việt.\n\nĐại diện ViPro Japan cho biết nhu cầu đối với các sản phẩm thực phẩm, nông sản chế biến và đặc sản Việt Nam tại Nhật Bản còn nhiều dư địa phát triển. Tuy nhiên, để tiếp cận và mở rộng thị trường bền vững, doanh nghiệp cần đáp ứng đầy đủ các yêu cầu về chất lượng, truy xuất nguồn gốc, bao bì, nhãn mác, hồ sơ sản phẩm và các tiêu chuẩn kỹ thuật theo quy định của Nhật Bản.\n\nĐoàn công tác cũng giới thiệu đến ViPro Japan nhiều nhóm sản phẩm thế mạnh của tỉnh như trái cây tươi, trái cây chế biến, hạt điều, bánh tráng, muối tôm, gia vị, trà, thực phẩm chế biến và các sản phẩm OCOP, sản phẩm công nghiệp nông thôn tiêu biểu. Phía ViPro Japan bày tỏ sự quan tâm và mong muốn tăng cường kết nối với các doanh nghiệp của tỉnh để nghiên cứu cơ hội hợp tác lâu dài.\n\nBuổi làm việc khẳng định hiệu quả của hoạt động xúc tiến thương mại chuyên sâu, lấy doanh nghiệp làm trung tâm và chú trọng kết nối trực tiếp với các nhà nhập khẩu, nhà phân phối nước ngoài, là cơ sở quan trọng để tỉnh tiếp tục hỗ trợ doanh nghiệp hoàn thiện sản phẩm, mở rộng thị trường xuất khẩu và nâng cao giá trị các sản phẩm đặc trưng của địa phương.",
    category: "Xúc tiến thương mại",
    tags: ["xúc tiến thương mại", "Nhật Bản", "ViPro", "xuất khẩu"],
    publishedAt: "2026-06-14",
    status: "published",
    featured: true,
    source:
      "https://sct.tayninh.gov.vn/xuc-tien-thuong-mai/so-cong-thuong-xuc-tien-thuong-mai-cac-san-pham-cua-tinh-tay-ninh-voi-he-thong-phan-phoi-vipro-j-1073464",
    author: "Huỳnh Đức",
    views: 720,
    thumbnail: "/img/portal/trade-vipro.jpg",
  },
  {
    id: "trade-02",
    type: "trade-promotion",
    title: "Tây Ninh tăng cường hợp tác xúc tiến thương mại với Trung tâm ASEAN – Nhật Bản",
    slug: "hop-tac-xuc-tien-thuong-mai-asean-nhat-ban",
    summary:
      "Trong khuôn khổ Tuần hàng Việt Nam tại hệ thống Aeon Nhật Bản 2026, đoàn công tác tỉnh Tây Ninh làm việc với Trung tâm ASEAN – Nhật Bản tại Tokyo.",
    content:
      "Trong khuôn khổ Chương trình Tuần hàng Việt Nam tại hệ thống Aeon Nhật Bản năm 2026, chiều ngày 11/6/2026, Đoàn công tác Sở Công Thương tỉnh Tây Ninh do ông Châu Thanh Long – Phó Giám đốc Sở Công Thương làm Trưởng đoàn đã tham gia buổi làm việc với Trung tâm ASEAN – Nhật Bản tại Tokyo, Nhật Bản.\n\nBuổi làm việc có sự tham dự của đại diện Bộ Công Thương Việt Nam, Thương vụ Việt Nam tại Nhật Bản, đại diện một số địa phương cùng lãnh đạo Trung tâm ASEAN – Nhật Bản. Nội dung trao đổi tập trung vào các hoạt động hợp tác xúc tiến thương mại, kết nối đầu tư, hỗ trợ doanh nghiệp và thúc đẩy giao thương giữa Việt Nam với Nhật Bản.\n\nTại buổi làm việc, các bên đã trao đổi thông tin về xu hướng thị trường Nhật Bản, nhu cầu tiêu dùng đối với các nhóm sản phẩm nông sản, thực phẩm chế biến, hàng tiêu dùng và các sản phẩm thân thiện môi trường. Đại diện Trung tâm ASEAN – Nhật Bản cũng chia sẻ nhiều thông tin liên quan đến tiêu chuẩn chất lượng, yêu cầu kỹ thuật, hoạt động kết nối doanh nghiệp và các chương trình hỗ trợ dành cho doanh nghiệp các nước ASEAN khi tham gia thị trường Nhật Bản.\n\nTây Ninh sở hữu vị trí chiến lược, là cửa ngõ kết nối vùng Đông Nam Bộ với Đồng bằng sông Cửu Long, tiếp giáp TP.HCM và có đường biên giới dài gần 369 km với Campuchia. Hệ thống 04 cửa khẩu quốc tế, Cảng quốc tế Long An cùng mạng lưới logistics đang được đầu tư mạnh tạo điều kiện thuận lợi cho giao thương, xuất nhập khẩu và phát triển chuỗi cung ứng khu vực. Nhiều sản phẩm chủ lực như gạo, thanh long, chanh, hạt điều, thủy sản chế biến đã có mặt tại nhiều thị trường trên thế giới.\n\nĐoàn công tác giới thiệu các nhóm sản phẩm thế mạnh có khả năng xuất khẩu sang Nhật Bản như hạt điều, trái cây tươi, trái cây chế biến, bánh tráng, muối tôm, gia vị, sản phẩm từ thanh long, trà và nhiều sản phẩm chế biến khác, đồng thời trao đổi về định hướng hỗ trợ doanh nghiệp nâng cao năng lực cạnh tranh, hoàn thiện bao bì, nhãn mác, truy xuất nguồn gốc và đáp ứng các tiêu chuẩn của thị trường quốc tế.",
    category: "Xúc tiến thương mại",
    tags: ["xúc tiến thương mại", "ASEAN", "Nhật Bản", "Aeon"],
    publishedAt: "2026-06-13",
    status: "published",
    source:
      "https://sct.tayninh.gov.vn/xuc-tien-thuong-mai/tay-ninh-tang-cuong-hop-tac-xuc-tien-thuong-mai-voi-trung-tam-asean-nhat-ban-1073459",
    author: "Huỳnh Đức",
    views: 610,
    thumbnail: "/img/portal/trade-vipro.jpg",
  },

  // ─── MARKET INFO ───────────────────────────────────────────────────────────
  {
    id: "market-01",
    type: "market-info",
    title: "Tổng mức bán lẻ hàng hoá và doanh thu dịch vụ 6 tháng đầu năm 2026 tăng 22,35%",
    slug: "tong-muc-ban-le-6-thang-dau-nam-2026",
    summary:
      "6 tháng đầu năm 2026, tổng mức bán lẻ hàng hoá và doanh thu dịch vụ trên địa bàn tỉnh ước đạt 1,54 tỷ USD, tăng 22,35% so với cùng kỳ.",
    content:
      "Theo số liệu thống kê, 6 tháng đầu năm 2026, tổng mức bán lẻ hàng hoá và doanh thu dịch vụ trên địa bàn tỉnh Tây Ninh ước đạt 1,54 tỷ USD, tăng 22,35% so với cùng kỳ năm 2025.\n\nTrong đó, nhóm hàng lương thực, thực phẩm, may mặc, vật phẩm văn hoá giáo dục và nhóm dịch vụ lưu trú, ăn uống tăng trưởng tích cực, phản ánh nhu cầu tiêu dùng nội địa và hoạt động du lịch, dịch vụ trên địa bàn tiếp tục phục hồi.\n\nSở Công Thương tiếp tục theo dõi, nắm bắt tình hình cung cầu, diễn biến giá cả để tham mưu kịp thời các giải pháp bảo đảm cân đối cung cầu, bình ổn thị trường những tháng cuối năm.",
    category: "Giá cả thị trường",
    tags: ["bán lẻ", "doanh thu dịch vụ", "thị trường"],
    publishedAt: "2026-07-24",
    status: "published",
    featured: true,
    author: "Phòng Quản lý Thương mại",
    views: 420,
    thumbnail: "/img/portal/news-market.jpg",
  },
  {
    id: "market-02",
    type: "market-info",
    title: "Xuất nhập khẩu 5 tháng đầu năm: Tây Ninh giữ vững mức xuất siêu 1,73 tỷ USD",
    slug: "xuat-nhap-khau-5-thang-xuat-sieu",
    summary:
      "Kim ngạch xuất nhập khẩu của tỉnh 5 tháng đầu năm 2026 đạt 14,53 tỷ USD, xuất khẩu 8,13 tỷ USD (tăng 16,1%), giữ vững xuất siêu 1,73 tỷ USD.",
    content:
      "Hoạt động xuất nhập khẩu 5 tháng đầu năm 2026 của tỉnh Tây Ninh tiếp tục duy trì đà tăng trưởng tích cực. Kim ngạch xuất nhập khẩu đạt 14,53 tỷ USD, trong đó xuất khẩu đạt 8,13 tỷ USD (tăng 16,1%), nhập khẩu đạt 6,40 tỷ USD (tăng 13,1%).\n\nTỉnh tiếp tục giữ vững mức xuất siêu 1,73 tỷ USD. Hàng hóa của Tây Ninh đã xuất khẩu đến hơn 150 quốc gia và vùng lãnh thổ. Các mặt hàng xuất khẩu chủ lực gồm dệt may, giày dép, phương tiện vận tải và phụ tùng, máy móc thiết bị, xơ sợi dệt.\n\nHoa Kỳ tiếp tục là thị trường xuất khẩu lớn nhất của tỉnh với kim ngạch trên 2 tỷ USD, tiếp theo là Trung Quốc, Campuchia, Nhật Bản và Hàn Quốc.",
    category: "Xuất nhập khẩu",
    tags: ["xuất nhập khẩu", "xuất siêu", "nông sản"],
    publishedAt: "2026-06-25",
    status: "published",
    featured: true,
    author: "Phòng Quản lý Xuất nhập khẩu",
    views: 690,
    thumbnail: "/img/portal/news-export-2026.jpg",
  },

  // ─── ANNOUNCEMENT ──────────────────────────────────────────────────────────
  {
    id: "ann-01",
    type: "announcement",
    title: "Kêu gọi, thu hút đầu tư vào các cụm công nghiệp trên địa bàn tỉnh Tây Ninh",
    slug: "keu-goi-dau-tu-cum-cong-nghiep-tay-ninh",
    summary:
      "Tỉnh Tây Ninh kêu gọi nhà đầu tư xây dựng hạ tầng và đầu tư sản xuất kinh doanh tại các cụm công nghiệp Tân Hội 3, Tân Hội 4 và 07 cụm công nghiệp mới được thành lập.",
    content:
      "Thực hiện chủ trương thu hút đầu tư, Sở Công Thương tỉnh Tây Ninh trân trọng kêu gọi các tổ chức, doanh nghiệp trong và ngoài nước đăng ký đầu tư xây dựng hạ tầng kỹ thuật và thuê đất sản xuất, kinh doanh tại các cụm công nghiệp trên địa bàn tỉnh.\n\nCác cụm công nghiệp đang kêu gọi đầu tư gồm: Cụm công nghiệp Tân Hội 3 (71,47 ha) và Cụm công nghiệp Tân Hội 4 (74,38 ha) tại huyện Tân Châu cùng 07 cụm công nghiệp mới được thành lập tại các huyện Tân Biên, Tân Châu, Bến Cầu (Mỹ Thạnh Bắc 3, Mỹ Thạnh Bắc 4, Tân Bình 1, Tân Bình 2, Bình Hòa Nam 1, Bình Hòa Nam 2, Long Thạnh).\n\nNhà đầu tư quan tâm đăng ký nộp hồ sơ về Sở Công Thương tỉnh Tây Ninh (Phòng Quản lý Công nghiệp). Thông tin chi tiết về quy hoạch, diện tích, chính sách ưu đãi vui lòng liên hệ Sở Công Thương để được hướng dẫn.",
    category: "Đầu tư",
    tags: ["kêu gọi đầu tư", "cụm công nghiệp", "Tân Hội"],
    publishedAt: "2026-08-11",
    status: "published",
    featured: true,
    author: "Phòng Quản lý Công nghiệp",
    views: 380,
    thumbnail: "/img/portal/cluster-camau.jpg",
  },
  {
    id: "ann-02",
    type: "announcement",
    title: "Mời doanh nghiệp đăng ký tham gia chương trình khuyến công năm 2026",
    slug: "moi-dang-ky-chuong-trinh-khuyen-cong-2026",
    summary:
      "Thông báo mời doanh nghiệp, cơ sở sản xuất công nghiệp nông thôn đăng ký đề án khuyến công năm 2026.",
    content:
      "Sở Công Thương mời các doanh nghiệp, cơ sở sản xuất công nghiệp nông thôn trên địa bàn đăng ký tham gia các đề án khuyến công.\n\nHồ sơ đăng ký nộp về Trung tâm Khuyến công trước ngày 30/09/2026 theo mẫu quy định.",
    category: "Thông báo",
    tags: ["khuyến công", "đăng ký"],
    publishedAt: "2026-08-08",
    status: "published",
    author: "Trung tâm Khuyến công",
    views: 300,
    thumbnail: "/img/portal/activity-hau-nghia.jpg",
  },
];

// Các chỉ số thị trường nhỏ cho section "Thông tin thị trường" (không biến thành Dashboard).
export const PORTAL_MARKET_KPIS = [
  {
    label: "Kim ngạch XK 5 tháng",
    value: "8,13",
    unit: "tỷ USD",
    trend: "+16,1%",
    tone: "success",
  },
  { label: "Xuất siêu 5 tháng", value: "1,73", unit: "tỷ USD", trend: "giữ vững", tone: "gov" },
  {
    label: "Tổng mức bán lẻ 6 tháng",
    value: "38.452",
    unit: "tỷ đồng",
    trend: "+22,35%",
    tone: "warning",
  },
  { label: "Thị trường XK", value: "150", unit: "quốc gia", trend: "+12", tone: "teal" },
] as const;

// Nguồn dữ liệu tái sử dụng từ module GIS (Cơ hội đầu tư) — không duplicate dữ liệu.
export const PORTAL_INVESTMENT_NOTE =
  "Thông tin Khu/Cụm công nghiệp được đồng bộ từ module GIS Cụm công nghiệp của nền tảng. Danh mục kêu gọi đầu tư hiện hành gồm các cụm công nghiệp mới thành lập năm 2026 và các cụm công nghiệp Tân Hội 3, Tân Hội 4.";
