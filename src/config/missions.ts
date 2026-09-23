export type MissionKey =
  | 'grid'
  | 'generation'
  | 'rooftop-solar'
  | 'efficiency'
  | 'grid-safety'
  | 'carbon'
  | 'ev-charging';

export type MissionDefinition = {
  key: MissionKey;
  order: number;
  shortLabel: string;
  title: string;
  description: string;
  accent: string;
  icon: 'grid' | 'generation' | 'solar' | 'efficiency' | 'safety' | 'carbon' | 'ev';
  href: `/mission/${MissionKey}`;
  kpis: readonly { label: string; value: string; note: string }[];
  capabilities: readonly string[];
  ai: {
    title: string;
    description: string;
    predictions: readonly string[];
  };
};

export const MISSIONS: readonly MissionDefinition[] = [
  {
    key: 'grid', order: 1, shortLabel: 'Lưới & TBA', title: 'Lưới điện và trạm biến áp',
    description: 'Quản lý TBA, MBA, feeder, đường dây, trụ điện, topology, phụ tải và khả năng tiếp nhận nguồn mới.',
    accent: '#0369a1', icon: 'grid', href: '/mission/grid',
    kpis: [
      { label: 'Trạm biến áp', value: '—', note: 'Dữ liệu Asset Registry' },
      { label: 'Đường dây', value: '—', note: 'Dữ liệu PostGIS' },
      { label: 'Cảnh báo tải', value: '—', note: 'Dữ liệu vận hành' },
    ],
    capabilities: ['Bản đồ lưới điện (Energy GIS)', 'Khám phá cấu trúc lưới (Topology Explorer)', 'Giám sát thông số và phụ tải (Telemetry)', 'Khả năng tiếp nhận nguồn và tải (Hosting Capacity)'],
    ai: {
      title: 'Dự báo vận hành lưới điện',
      description: 'Phân tích chuỗi đo, cấu trúc lưới và lịch sử sự cố để hỗ trợ điều độ và lập kế hoạch đầu tư.',
      predictions: ['Dự báo phụ tải theo trạm và ngăn lộ', 'Cảnh báo nguy cơ quá tải', 'Phát hiện bất thường và rủi ro sự cố'],
    },
  },
  {
    key: 'generation', order: 2, shortLabel: 'Nguồn điện', title: 'Nguồn điện tập trung',
    description: 'Theo dõi các dự án nguồn, vận hành, nhiên liệu đầu vào, dự trữ và quy hoạch phát triển nguồn.',
    accent: '#b45309', icon: 'generation', href: '/mission/generation',
    kpis: [
      { label: 'Tổng công suất', value: '—', note: 'Hồ sơ nguồn điện' },
      { label: 'Năng lượng tái tạo', value: '—', note: 'Hồ sơ nguồn điện' },
      { label: 'Cảnh báo nhiên liệu', value: '—', note: 'Dữ liệu kho và tiêu thụ' },
    ],
    capabilities: ['Hồ sơ dự án toàn diện (Project 360)', 'Quản lý tồn kho nhiên liệu (Fuel Inventory)', 'Phân tích vận hành nguồn điện (Generation Analytics)', 'Quản lý quy hoạch nguồn điện (Generation Planning)'],
    ai: {
      title: 'Dự báo nguồn điện và nhiên liệu',
      description: 'Kết hợp lịch vận hành, công suất, tồn kho và kế hoạch bảo dưỡng để dự báo khả năng đáp ứng nguồn.',
      predictions: ['Dự báo sản lượng phát điện', 'Dự báo thời gian duy trì nhiên liệu', 'Cảnh báo suy giảm hiệu suất tổ máy'],
    },
  },
  {
    key: 'rooftop-solar', order: 3, shortLabel: 'Solar mái nhà', title: 'Điện mặt trời mái nhà',
    description: 'Tra cứu khách hàng EVN, đánh giá tiềm năng mái, khuyến nghị công suất và thiết kế Solar Digital Twin 3D.',
    accent: '#a16207', icon: 'solar', href: '/mission/rooftop-solar',
    kpis: [
      { label: 'Công suất áp mái', value: '—', note: 'Hồ sơ đã xác nhận' },
      { label: 'Khách hàng', value: '—', note: 'Dữ liệu khách hàng EVN' },
      { label: 'Tiềm năng', value: '—', note: 'Kết quả đánh giá' },
    ],
    capabilities: ['Tư vấn theo hồ sơ khách hàng EVN (Customer Advisor)', 'Đánh giá tiềm năng trên bản đồ (Solar Potential GIS)', 'Mô hình số công trình 3D (Digital Twin)', 'Khối lượng, hoàn vốn và carbon (BOM • ROI • Carbon)'],
    ai: {
      title: 'Dự báo hiệu quả điện mặt trời',
      description: 'Kết hợp tiêu thụ, diện tích mái, bức xạ và khả năng tiếp nhận lưới để hỗ trợ lựa chọn phương án.',
      predictions: ['Dự báo sản lượng theo thời gian', 'Dự báo tỷ lệ điện tự dùng', 'Đánh giá rủi ro quá công suất tiếp nhận'],
    },
  },
  {
    key: 'efficiency', order: 4, shortLabel: 'Hiệu quả', title: 'Sử dụng năng lượng tiết kiệm & hiệu quả',
    description: 'Quản lý đơn vị trọng điểm, dữ liệu EVN, đối soát báo cáo, benchmark và giải pháp tiết kiệm năng lượng.',
    accent: '#15803d', icon: 'efficiency', href: '/mission/efficiency',
    kpis: [
      { label: 'Đơn vị trọng điểm', value: '—', note: 'Danh sách quản lý' },
      { label: 'Điện tháng này', value: '—', note: 'Dữ liệu tiêu thụ' },
      { label: 'Cần đối soát', value: '—', note: 'Kết quả đối soát' },
    ],
    capabilities: ['Hồ sơ tiêu thụ toàn diện (Consumption 360)', 'Đối soát dữ liệu điện lực (EVN Reconciliation)', 'So sánh định mức năng lượng (Benchmark)', 'Giải pháp tiết kiệm năng lượng (Saving Measures)'],
    ai: {
      title: 'Dự báo tiêu thụ và tiềm năng tiết kiệm',
      description: 'Phân tích phụ tải, mùa vụ và nhóm ngành để phát hiện bất thường và đề xuất ưu tiên kiểm toán.',
      predictions: ['Dự báo điện năng tiêu thụ', 'Phát hiện sai lệch và bất thường', 'Ước tính tiềm năng tiết kiệm'],
    },
  },
  {
    key: 'grid-safety', order: 5, shortLabel: 'An toàn lưới', title: 'An toàn hành lang và sự cố',
    description: 'Quản lý quy định hành lang, lịch cắt điện, hồ sơ kiểm tra xây dựng, vi phạm và AI nhận diện hình ảnh.',
    accent: '#be123c', icon: 'safety', href: '/mission/grid-safety',
    kpis: [
      { label: 'Vi phạm mở', value: '—', note: 'Hồ sơ đang xử lý' },
      { label: 'Lịch cắt điện', value: '—', note: 'Kế hoạch đã phê duyệt' },
      { label: 'Sự cố đang xử lý', value: '—', note: 'Dữ liệu vận hành' },
    ],
    capabilities: ['Quản lý quy định hành lang (Corridor Rules)', 'Kiểm tra hồ sơ xây dựng (Construction Check)', 'Đánh giá ảnh hưởng mất điện (Outage Impact)', 'Nhận diện nguy cơ qua hình ảnh (AI)'],
    ai: {
      title: 'Dự báo rủi ro an toàn lưới điện',
      description: 'Phân tích không gian, lịch sử vi phạm, sự cố và hình ảnh để ưu tiên khu vực cần kiểm tra.',
      predictions: ['Dự báo nguy cơ vi phạm hành lang', 'Ước tính phạm vi ảnh hưởng sự cố', 'Nhận diện vật thể và tình huống nguy hiểm'],
    },
  },
  {
    key: 'carbon', order: 6, shortLabel: 'Carbon', title: 'Carbon và khí nhà kính',
    description: 'Kiểm kê nguồn phát thải, CO₂e, nghĩa vụ báo cáo, tín chỉ carbon và kế hoạch giảm phát thải.',
    accent: '#6d28d9', icon: 'carbon', href: '/mission/carbon',
    kpis: [
      { label: 'Phát thải', value: '—', note: 'Kết quả kiểm kê' },
      { label: 'Đơn vị phải báo cáo', value: '—', note: 'Danh sách nghĩa vụ' },
      { label: 'Quá hạn', value: '—', note: 'Trạng thái báo cáo' },
    ],
    capabilities: ['Kiểm kê phát thải (Emission Inventory)', 'Tích hợp văn bản điều hành (VBĐH Integration)', 'Kế hoạch giảm phát thải (Reduction Plan)', 'Quản lý tín chỉ carbon (Carbon Credits)'],
    ai: {
      title: 'Dự báo phát thải và nghĩa vụ carbon',
      description: 'Phân tích dữ liệu hoạt động và hệ số phát thải có nguồn gốc để hỗ trợ lập lộ trình giảm phát thải.',
      predictions: ['Dự báo xu hướng phát thải CO₂e', 'Cảnh báo nguy cơ chậm nghĩa vụ báo cáo', 'Ước tính tác động của phương án giảm phát thải'],
    },
  },
  {
    key: 'ev-charging', order: 7, shortLabel: 'Trạm sạc EV', title: 'Trạm sạc điện thông minh',
    description: 'Quản lý hồ sơ đăng ký trạm sạc, công suất yêu cầu, trạng thái trạm, connector và khả năng cấp điện.',
    accent: '#0f766e', icon: 'ev', href: '/mission/ev-charging',
    kpis: [
      { label: 'Trạm sạc', value: '—', note: 'Hồ sơ đã xác nhận' },
      { label: 'Điểm sạc', value: '—', note: 'Trạng thái vận hành' },
      { label: 'Hồ sơ chờ xử lý', value: '—', note: 'Quy trình tiếp nhận' },
    ],
    capabilities: ['Quy trình tiếp nhận hồ sơ (Application Workflow)', 'Hồ sơ trạm sạc toàn diện (Station 360)', 'Khả năng cấp điện của lưới (Grid Capacity)', 'Lập kế hoạch nhu cầu sạc (Demand Planning)'],
    ai: {
      title: 'Dự báo nhu cầu sạc và phụ tải lưới',
      description: 'Kết hợp vị trí, hành vi sử dụng và năng lực lưới để hỗ trợ quy hoạch điểm sạc.',
      predictions: ['Dự báo nhu cầu sạc theo khu vực', 'Dự báo phụ tải giờ cao điểm', 'Xếp hạng vị trí ưu tiên đầu tư'],
    },
  },
] as const;

export function findMission(key: string) {
  return MISSIONS.find((mission) => mission.key === key);
}
