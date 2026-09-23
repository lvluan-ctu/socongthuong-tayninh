import type { MissionReportConfig } from "@/lib/mission-report-types";

const COMMON_ADMINISTRATIVE_BASIS = [
  "Quyết định số 05/2025/QĐ-UBND ngày 03/7/2025 của UBND tỉnh Tây Ninh quy định chức năng, nhiệm vụ, quyền hạn và cơ cấu tổ chức của Sở Công Thương tỉnh Tây Ninh (đang có hiệu lực).",
  "Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư, được dùng làm căn cứ tham chiếu thể thức trình bày báo cáo.",
];

export const MISSION_REPORTS: Record<number, MissionReportConfig> = {
  1: {
    missionTitle: "Hạ tầng lưới điện",
    executiveTitle: "Báo cáo năng lực cung cấp và vận hành lưới",
    trendTitle: "Báo cáo xu hướng phụ tải và nguy cơ quá tải",
    riskTitle: "Báo cáo điểm nghẽn, sự cố và ưu tiên đầu tư",
    reportSubject:
      "Tình hình năng lực cung cấp điện, vận hành lưới và nhu cầu ưu tiên đầu tư hạ tầng",
    executiveLead:
      "Dữ liệu lưới điện được tổng hợp theo tài sản, cấp điện áp, chuỗi vận hành và cảnh báo để nhận diện sớm điểm nghẽn có thể ảnh hưởng phát triển kinh tế - xã hội.",
    managementBasis: [
      ...COMMON_ADMINISTRATIVE_BASIS,
      "Luật Điện lực số 61/2024/QH15 ngày 30/11/2024 của Quốc hội, có hiệu lực từ ngày 01/02/2025.",
      "Dữ liệu tài sản, đo đếm, vận hành và cảnh báo được cập nhật trên Hệ thống thông tin ngành Công Thương.",
    ],
    decisionQuestions: [
      "Khu vực nào sắp chạm giới hạn mang tải?",
      "Hạng mục lưới nào cần ưu tiên đầu tư trong kỳ tới?",
    ],
    standingRecommendations: [
      "Ưu tiên xử lý các trạm và tuyến có cảnh báo mức cao.",
      "Đối chiếu dự báo phụ tải với kế hoạch đầu tư trung hạn của tỉnh.",
    ],
    analyticalFocus: [
      "Dư địa công suất theo trạm, tuyến và cấp điện áp.",
      "Diễn biến phụ tải, tổn thất và nguy cơ vượt ngưỡng mang tải.",
      "Mức độ đầy đủ của telemetry, đo đếm và hình học PostGIS.",
      "Danh mục điểm nghẽn cần đưa vào kế hoạch đầu tư, sửa chữa.",
    ],
    investmentBenefits: [
      "Rút ngắn thời gian tổng hợp hiện trạng lưới và tra cứu hồ sơ tài sản.",
      "Cảnh báo sớm quá tải giúp chủ động phương án cấp điện và giảm sự cố.",
      "Liên kết GIS - vận hành - đầu tư tạo bằng chứng rõ ràng khi ưu tiên vốn.",
      "Hỗ trợ chia sẻ một nguồn dữ liệu thống nhất giữa Sở, điện lực và địa phương.",
    ],
    implementationPriorities: [
      "Hoàn thiện kết nối telemetry và chuẩn hóa mã tài sản dùng chung.",
      "Xác minh các tuyến đang dùng hình học suy diễn trước khi phát hành báo cáo chính thức.",
      "Thiết lập ngưỡng cảnh báo theo từng cấp điện áp và quy trình giao xử lý.",
    ],
  },
  2: {
    missionTitle: "Nguồn năng lượng tái tạo",
    executiveTitle: "Báo cáo cơ cấu và tiến độ nguồn năng lượng tái tạo",
    trendTitle: "Báo cáo sản lượng, công suất và khả năng giải tỏa",
    riskTitle: "Báo cáo dự án chậm tiến độ và rủi ro đấu nối",
    reportSubject:
      "Tình hình phát triển nguồn năng lượng tái tạo, sản lượng và khả năng giải tỏa công suất",
    executiveLead:
      "Báo cáo hợp nhất danh mục dự án, công suất, sản lượng, trạng thái pháp lý - vận hành và điều kiện đấu nối để theo dõi đóng góp của từng loại nguồn.",
    managementBasis: [
      ...COMMON_ADMINISTRATIVE_BASIS,
      "Luật Điện lực số 61/2024/QH15 ngày 30/11/2024 của Quốc hội, có hiệu lực từ ngày 01/02/2025; hồ sơ quy hoạch và dự án chỉ được dùng khi đã được cơ quan có thẩm quyền cập nhật.",
      "Dữ liệu dự án nguồn điện và snapshot vận hành trên Hệ thống thông tin ngành Công Thương.",
    ],
    decisionQuestions: [
      "Nguồn điện nào đóng góp lớn nhất cho Tây Ninh?",
      "Dự án nào cần tháo gỡ thủ tục hoặc hạ tầng đấu nối?",
    ],
    standingRecommendations: [
      "Theo dõi riêng các dự án công suất lớn chưa vận hành.",
      "Gắn tiến độ nguồn với khả năng giải tỏa của lưới khu vực.",
    ],
    analyticalFocus: [
      "Cơ cấu công suất theo loại nguồn và trạng thái triển khai.",
      "Sản lượng, độ khả dụng và hiệu suất vận hành theo kỳ.",
      "Tiến độ pháp lý, xây dựng và khả năng giải tỏa công suất.",
      "Dự án quy mô lớn cần tháo gỡ hoặc giám sát đặc biệt.",
    ],
    investmentBenefits: [
      "Cung cấp bức tranh thống nhất về nguồn điện đang vận hành và chuẩn bị đầu tư.",
      "Đối chiếu tiến độ nguồn với lưới giúp giảm nguy cơ nghẽn giải tỏa.",
      "Theo dõi sản lượng và độ khả dụng hỗ trợ đánh giá hiệu quả dự án.",
      "Minh bạch căn cứ khi làm việc với nhà đầu tư và cơ quan quy hoạch.",
    ],
    implementationPriorities: [
      "Đồng bộ hồ sơ pháp lý, mốc tiến độ và điểm đấu nối của từng dự án.",
      "Kết nối sản lượng đo đếm chính thức thay cho dữ liệu kịch bản ở các dự án còn thiếu.",
      "Xây dựng màn hình theo dõi giải tỏa công suất theo khu vực và thời gian.",
    ],
  },
  3: {
    missionTitle: "Điện mặt trời mái nhà",
    executiveTitle: "Báo cáo phát triển điện mặt trời mái nhà",
    trendTitle: "Báo cáo sản lượng, tự dùng và tiềm năng mái nhà",
    riskTitle: "Báo cáo chất lượng hồ sơ và khả năng tiếp nhận lưới",
    reportSubject: "Tình hình phát triển điện mặt trời mái nhà, mức tự dùng và tiềm năng khai thác",
    executiveLead:
      "Báo cáo phân tích quy mô hệ thống mái nhà, phân bố khách hàng, sản lượng và dư địa đấu nối nhằm hỗ trợ tư vấn phát triển có kiểm soát.",
    managementBasis: [
      ...COMMON_ADMINISTRATIVE_BASIS,
      "Luật Điện lực số 61/2024/QH15 ngày 30/11/2024 của Quốc hội, có hiệu lực từ ngày 01/02/2025.",
      "Chỉ thị số 10/CT-TTg ngày 30/3/2026 của Thủ tướng Chính phủ về tăng cường thực thi tiết kiệm điện và phát triển điện mặt trời mái nhà.",
      "Hồ sơ khách hàng, hệ thống mái nhà và dữ liệu vận hành được cập nhật trên Hệ thống.",
    ],
    decisionQuestions: [
      "Khu vực nào còn tiềm năng phát triển mái nhà?",
      "Tỷ lệ tự dùng và hiệu quả đầu tư đang ở mức nào?",
    ],
    standingRecommendations: [
      "Ưu tiên tư vấn tại khu vực còn dư địa đấu nối.",
      "Khuyến khích lưu trữ ở nhóm phụ tải cần điện buổi tối hoặc dự phòng.",
    ],
    analyticalFocus: [
      "Công suất lắp đặt theo nhóm quy mô, địa bàn và loại khách hàng.",
      "Tỷ lệ tự dùng, sản lượng phát và nhu cầu lưu trữ.",
      "Dư địa tiếp nhận của trạm/tuyến tại điểm đấu nối.",
      "Chất lượng hồ sơ, tọa độ và dữ liệu sản lượng thực đo.",
    ],
    investmentBenefits: [
      "Tạo công cụ tư vấn một cửa dựa trên dữ liệu mái, phụ tải và lưới.",
      "Giảm thời gian khảo sát sơ bộ và sàng lọc điểm đấu nối.",
      "Theo dõi phát triển phân tán giúp hạn chế quá tải cục bộ.",
      "Hỗ trợ xây dựng chương trình khuyến khích tự dùng và lưu trữ phù hợp.",
    ],
    implementationPriorities: [
      "Đối soát tọa độ, công suất và trạng thái vận hành với dữ liệu điện lực.",
      "Thay thế chuỗi sản lượng suy diễn bằng số liệu công tơ/inverter được xác thực.",
      "Tích hợp lớp mái nhà và mô hình 3D để đánh giá tiềm năng kỹ thuật.",
    ],
  },
  4: {
    missionTitle: "Sử dụng năng lượng hiệu quả",
    executiveTitle: "Báo cáo hiệu quả sử dụng năng lượng trọng điểm",
    trendTitle: "Báo cáo cường độ năng lượng và tiềm năng tiết kiệm",
    riskTitle: "Báo cáo cơ sở tiêu thụ cao và nghĩa vụ báo cáo",
    reportSubject:
      "Tình hình sử dụng năng lượng, nghĩa vụ báo cáo và tiềm năng tiết kiệm tại các cơ sở",
    executiveLead:
      "Báo cáo tổng hợp khách hàng, cơ sở sử dụng năng lượng trọng điểm, đo đếm và chỉ tiêu cường độ để xác định nơi cần kiểm toán, hỗ trợ và giám sát.",
    managementBasis: [
      ...COMMON_ADMINISTRATIVE_BASIS,
      "Luật Sử dụng năng lượng tiết kiệm và hiệu quả số 50/2010/QH12 và Luật số 77/2025/QH15 sửa đổi, bổ sung, có hiệu lực từ ngày 01/01/2026.",
      "Dữ liệu khách hàng, báo cáo định kỳ, đo đếm và chỉ tiêu hiệu quả trên Hệ thống.",
    ],
    decisionQuestions: [
      "Cơ sở nào có cường độ năng lượng cao bất thường?",
      "Giải pháp tiết kiệm nào đem lại hiệu quả lớn nhất?",
    ],
    standingRecommendations: [
      "Tập trung kiểm toán các cơ sở vượt chuẩn so sánh ngành.",
      "Theo dõi thực hiện giải pháp bằng sản lượng tiết kiệm đã xác minh.",
    ],
    analyticalFocus: [
      "Cơ cấu tiêu thụ theo ngành, địa bàn và nhóm khách hàng.",
      "Mức độ thực hiện nghĩa vụ báo cáo, kiểm toán và kế hoạch năng lượng.",
      "Cường độ năng lượng so với đường cơ sở và chuẩn so sánh ngành.",
      "Giải pháp tiết kiệm, chi phí dự kiến và kết quả đã xác minh.",
    ],
    investmentBenefits: [
      "Tự động hóa danh sách theo dõi và nhắc nghĩa vụ báo cáo.",
      "Phát hiện cơ sở có cường độ bất thường để ưu tiên kiểm toán.",
      "Đo lường kết quả tiết kiệm bằng dữ liệu trước - sau có truy vết.",
      "Cung cấp bằng chứng cho chương trình hỗ trợ doanh nghiệp của tỉnh.",
    ],
    implementationPriorities: [
      "Chuẩn hóa phân loại cơ sở trọng điểm và trạng thái nghĩa vụ báo cáo.",
      "Mở rộng kết nối công tơ thông minh, baseline và benchmark theo ngành.",
      "Thiết lập quy trình thẩm định, xác minh và phê duyệt mức tiết kiệm.",
    ],
  },
  5: {
    missionTitle: "An toàn điện và hành lang lưới",
    executiveTitle: "Báo cáo điều hành an toàn điện",
    trendTitle: "Báo cáo diễn biến vi phạm và sự cố",
    riskTitle: "Báo cáo điểm nóng hành lang và xử lý hiện trường",
    reportSubject:
      "Hiện trạng dữ liệu an toàn điện, vi phạm hành lang lưới và kịch bản điều hành xử lý",
    executiveLead:
      "Báo cáo liên kết sự cố, vi phạm hành lang, kiểm tra hiện trường, ảnh minh chứng và GIS để điều hành xử lý theo mức độ nguy hiểm và thời hạn.",
    managementBasis: [
      ...COMMON_ADMINISTRATIVE_BASIS,
      "Luật Điện lực số 61/2024/QH15 ngày 30/11/2024 của Quốc hội, có hiệu lực từ ngày 01/02/2025; các quy định chi tiết về an toàn điện phải được đơn vị chuyên môn đối chiếu tại thời điểm phát hành.",
      "Hồ sơ vi phạm, sự cố, kiểm tra, cắt điện và bằng chứng hiện trường trên Hệ thống.",
    ],
    decisionQuestions: [
      "Điểm nóng nào đe dọa an toàn cộng đồng?",
      "Vụ việc nào quá hạn xử lý hoặc tái diễn?",
    ],
    standingRecommendations: [
      "Ưu tiên kiểm tra các cảnh báo nghiêm trọng có vị trí GIS.",
      "Giao rõ đơn vị, thời hạn và bằng chứng khắc phục cho từng vụ việc.",
    ],
    analyticalFocus: [
      "Số lượng và mức độ vi phạm, sự cố theo thời gian và địa bàn.",
      "Điểm nóng tái diễn, vụ việc quá hạn và hạ tầng trọng yếu bị ảnh hưởng.",
      "Khoảng cách an toàn, hành lang GIS và ảnh phân tích AI.",
      "Tiến độ giao xử lý, kiểm tra lại và bằng chứng khắc phục.",
    ],
    investmentBenefits: [
      "Rút ngắn thời gian tiếp nhận - phân loại - giao xử lý sự cố.",
      "Bản đồ điểm nóng và ảnh AI hỗ trợ ưu tiên kiểm tra có căn cứ.",
      "Hồ sơ điện tử giúp truy vết trách nhiệm và thời hạn khắc phục.",
      "Cải thiện phối hợp giữa Sở, điện lực, địa phương và lực lượng hiện trường.",
    ],
    implementationPriorities: [
      "Hoàn thiện quy trình xác nhận kết quả AI bởi cán bộ chuyên môn.",
      "Chuẩn hóa mức độ nguy hiểm, thời hạn xử lý và cơ chế cảnh báo quá hạn.",
      "Bổ sung ảnh trước - sau, biên bản và tọa độ thực địa cho từng vụ việc.",
    ],
  },
  6: {
    missionTitle: "Kiểm kê khí nhà kính",
    executiveTitle: "Báo cáo kiểm kê phát thải khí nhà kính",
    trendTitle: "Báo cáo xu hướng phát thải và mục tiêu giảm",
    riskTitle: "Báo cáo nguồn phát thải lớn và chất lượng dữ liệu",
    reportSubject:
      "Hiện trạng dữ liệu phục vụ kiểm kê khí nhà kính ngành năng lượng và tiến độ chuẩn hóa",
    executiveLead:
      "Báo cáo tổng hợp nguồn, hoạt động, phạm vi phát thải và nghĩa vụ báo cáo; đồng thời tách rõ dữ liệu nguồn, hệ số và kịch bản chưa đủ điều kiện sử dụng pháp lý.",
    managementBasis: [
      ...COMMON_ADMINISTRATIVE_BASIS,
      "Nghị định số 06/2022/NĐ-CP ngày 07/01/2022 của Chính phủ về giảm nhẹ phát thải khí nhà kính và bảo vệ tầng ô-dôn, được sửa đổi, bổ sung bởi Nghị định số 119/2025/NĐ-CP có hiệu lực từ ngày 01/08/2025.",
      "Dữ liệu hoạt động, hệ số phát thải, kết quả tính toán và hồ sơ thẩm tra trên Hệ thống.",
    ],
    decisionQuestions: [
      "Nguồn nào chiếm tỷ trọng phát thải lớn nhất?",
      "Tiến độ giảm phát thải có đạt mục tiêu của tỉnh?",
    ],
    standingRecommendations: [
      "Ưu tiên xác minh hoạt động có hệ số phát thải hoặc dữ liệu đầu vào yếu.",
      "Theo dõi kết quả giảm phát thải theo từng kế hoạch và đơn vị chịu trách nhiệm.",
    ],
    analyticalFocus: [
      "Phát thải theo phạm vi, nguồn, cơ sở và kỳ báo cáo.",
      "Hệ số phát thải, phiên bản phương pháp và dấu vết dữ liệu hoạt động.",
      "Nguồn phát thải lớn, cường độ phát thải và xu hướng biến động.",
      "Mục tiêu, kế hoạch giảm nhẹ và kết quả được xác minh.",
    ],
    investmentBenefits: [
      "Chuẩn hóa quy trình kiểm kê và lưu vết hệ số/phương pháp tính.",
      "Giảm sai lệch khi tổng hợp nhiều nguồn dữ liệu và nhiều kỳ báo cáo.",
      "Theo dõi mục tiêu giảm phát thải bằng chỉ tiêu có thể kiểm chứng.",
      "Tạo nền dữ liệu phục vụ cơ chế carbon và chương trình chuyển đổi xanh.",
    ],
    implementationPriorities: [
      "Không phát hành số liệu pháp lý khi nguồn hoạt động và hệ số chưa được xác minh.",
      "Bổ sung quy trình rà soát, phê duyệt và khóa phiên bản kỳ kiểm kê.",
      "Kết nối hồ sơ minh chứng, nghĩa vụ báo cáo và kế hoạch giảm nhẹ của cơ sở.",
    ],
  },
  7: {
    missionTitle: "Hạ tầng trạm sạc xe điện",
    executiveTitle: "Báo cáo phát triển hạ tầng trạm sạc",
    trendTitle: "Báo cáo nhu cầu sạc và mức sử dụng công suất",
    riskTitle: "Báo cáo vùng thiếu phủ và rủi ro quá tải trạm",
    reportSubject:
      "Hiện trạng dữ liệu và kịch bản phát triển hạ tầng trạm sạc xe điện, độ phủ, nhu cầu công suất",
    executiveLead:
      "Báo cáo tổng hợp mạng lưới trạm sạc, đầu sạc khả dụng, công suất đấu nối và nhu cầu theo địa bàn để sàng lọc vị trí ưu tiên phát triển.",
    managementBasis: [
      ...COMMON_ADMINISTRATIVE_BASIS,
      "Luật Điện lực số 61/2024/QH15 ngày 30/11/2024 của Quốc hội, có hiệu lực từ ngày 01/02/2025.",
      "Quyết định số 876/QĐ-TTg ngày 22/7/2022 của Thủ tướng Chính phủ phê duyệt Chương trình hành động về chuyển đổi năng lượng xanh của ngành giao thông vận tải.",
      "Dữ liệu trạm, đầu sạc, phiên sạc, công suất và điểm đấu nối trên Hệ thống.",
    ],
    decisionQuestions: [
      "Địa bàn nào còn thiếu điểm sạc công cộng?",
      "Trạm nào cần mở rộng cổng sạc hoặc nâng cấp đấu nối?",
    ],
    standingRecommendations: [
      "Ưu tiên điểm sạc tại đô thị, khu công nghiệp và trục giao thông chính.",
      "Đồng bộ quy hoạch trạm sạc với năng lực cấp điện tại điểm đấu nối.",
    ],
    analyticalFocus: [
      "Độ phủ trạm sạc theo địa bàn, trục giao thông và khu công nghiệp.",
      "Công suất, số đầu sạc, mức sử dụng và tình trạng lỗi.",
      "Nhu cầu dự báo, vùng thiếu phủ và dư địa cấp điện tại điểm đấu nối.",
      "Danh mục vị trí mới/mở rộng cần khảo sát và phê duyệt.",
    ],
    investmentBenefits: [
      "Cung cấp bản đồ nhu cầu và độ phủ để ưu tiên vị trí đầu tư.",
      "Cảnh báo mức sử dụng cao và đầu sạc lỗi giúp nâng chất lượng dịch vụ.",
      "Đồng bộ nhu cầu sạc với năng lực lưới giảm nguy cơ quá tải cục bộ.",
      "Tạo thông tin minh bạch hỗ trợ xã hội hóa đầu tư hạ tầng sạc.",
    ],
    implementationPriorities: [
      "Xác minh tọa độ, công suất và số đầu sạc đang là kịch bản kỹ thuật.",
      "Kết nối snapshot vận hành/phiên sạc thực tế từ nhà khai thác.",
      "Xây dựng quy trình đánh giá vị trí gắn với giao thông, đất đai và lưới điện.",
    ],
  },
  8: {
    missionTitle: "Quản lý hạ tầng dầu khí",
    executiveTitle: "Báo cáo hiện trạng hạ tầng dầu khí",
    trendTitle: "Báo cáo xu hướng sản lượng và năng lực cung ứng",
    riskTitle: "Báo cáo rủi ro cơ sở, kho và tuyến ống",
    reportSubject: "Hiện trạng cơ sở kinh doanh, kho chứa và đường ống xăng dầu trên địa bàn",
    executiveLead: "Báo cáo hợp nhất trạm xăng, kho xăng dầu, tuyến ống, năng lực chứa và sản lượng ước tính để hỗ trợ điều hành hạ tầng dầu khí.",
    managementBasis: [
      ...COMMON_ADMINISTRATIVE_BASIS,
      "Dữ liệu cơ sở dầu khí, kho và tuyến ống được nạp từ bộ dữ liệu GIS trong docs/data của dự án.",
    ],
    decisionQuestions: ["Khu vực nào cần ưu tiên nâng năng lực cung ứng?", "Cơ sở hoặc tuyến ống nào cần kiểm tra an toàn và bảo trì trước?"],
    standingRecommendations: ["Đối soát sản lượng ước tính với dữ liệu vận hành chính thức.", "Ưu tiên kiểm tra kho và tuyến ống có vai trò đầu mối hoặc mức độ quan trọng cao."],
    analyticalFocus: ["Phân bố cơ sở theo loại, thương hiệu, địa bàn và trạng thái.", "Năng lực chứa, bơm xuất, sản lượng và độ phủ hạ tầng.", "Chiều dài, nguồn - đích và vai trò của mạng lưới đường ống.", "Chất lượng tọa độ, nguồn dữ liệu và trạng thái xác minh."],
    investmentBenefits: ["Rút ngắn thời gian tổng hợp danh mục hạ tầng dầu khí.", "Bản đồ GIS hỗ trợ nhận diện khoảng trống cung ứng và tuyến trọng yếu.", "Dữ liệu thống nhất giúp lập kế hoạch kiểm tra, bảo trì và đầu tư."],
    implementationPriorities: ["Kết nối sản lượng và tồn kho chính thức từ đơn vị vận hành.", "Bổ sung hồ sơ an toàn, giấy phép và lịch kiểm tra cho từng cơ sở/tuyến.", "Chuẩn hóa địa danh, đơn vị đo và mã liên kết nguồn - đích đường ống."],
  },
};
