// ============================================================
// TT 40/2025/TT-BCT — Cấp C/O và Văn bản chấp thuận tự chứng
// nhận xuất xứ (khoản 6 Điều 28 NĐ 146/2025/NĐ-CP).
// - Phụ lục I: danh mục do Cục XNK (Bộ Công Thương) cấp.
// - Phụ lục II: danh mục do tổ chức được UBND cấp tỉnh giao
//   nhiệm vụ cấp (Sở Công Thương tỉnh Tây Ninh theo QĐ 34/2025).
// - Điều 5 + Phụ lục III: điều kiện & bản tự đánh giá.
// ============================================================
import type { CoApplicationStatus, CoWorkflowAction } from "./co-types";

export const TT40_REF = {
  number: "40/2025/TT-BCT",
  date: "2025-06-22",
  effectiveDate: "2025-07-01",
  title:
    "Quy định về cấp Giấy chứng nhận xuất xứ hàng hóa và chấp thuận bằng văn bản cho thương nhân tự chứng nhận xuất xứ hàng hóa xuất khẩu",
  legalBasis: "Nghị định 146/2025/NĐ-CP ngày 12/6/2025 (khoản 6 Điều 28)",
} as const;

export const PROVINCE_RECEIVING_AGENCY = "Sở Công Thương tỉnh Tây Ninh";
export const CENTRAL_RECEIVING_AGENCY = "Cục Xuất nhập khẩu (Bộ Công Thương)";

export type CoIssuingAuthority = "PROVINCE" | "CENTRAL" | "BOTH";

export interface CoIssuanceCatalogEntry {
  order: number;
  /** Tên mẫu C/O / Văn bản chấp thuận (Phụ lục I & II). */
  name: string;
  /** Mã mẫu tương ứng trong catalog co-forms.json. */
  formCodes: string[];
  certificateType: "CO" | "SELF_CERT" | "BOTH";
  /** Thông tư quy tắc xuất xứ tương ứng. */
  legalBasis: string;
  authority: CoIssuingAuthority;
}

/**
 * Phụ lục II — 20 nhóm mẫu C/O & Văn bản chấp thuận do tổ chức
 * được UBND cấp tỉnh giao nhiệm vụ cấp. (Phụ lục I — Cục XNK —
 * có cùng danh mục.)
 */
export const CO_ISSUANCE_CATALOG: CoIssuanceCatalogEntry[] = [
  { order: 1, name: "C/O mẫu D và Văn bản chấp thuận", formCodes: ["D"], certificateType: "BOTH", legalBasis: "TT 19/2020/TT-BCT (ATIGA)", authority: "BOTH" },
  { order: 2, name: "C/O mẫu E", formCodes: ["E"], certificateType: "CO", legalBasis: "TT 12/2019/TT-BCT (ACFTA)", authority: "BOTH" },
  { order: 3, name: "C/O mẫu AI", formCodes: ["AI"], certificateType: "CO", legalBasis: "TT 15/2010/TT-BCT (ASEAN–Ấn Độ)", authority: "BOTH" },
  { order: 4, name: "C/O mẫu AK", formCodes: ["AK"], certificateType: "CO", legalBasis: "TT 20/2014/TT-BCT (AKFTA)", authority: "BOTH" },
  { order: 5, name: "C/O mẫu AJ", formCodes: ["AJ"], certificateType: "CO", legalBasis: "TT 37/2022/TT-BCT (AJCEP)", authority: "BOTH" },
  { order: 6, name: "C/O mẫu AANZ", formCodes: ["AANZ"], certificateType: "CO", legalBasis: "TT 31/2015/TT-BCT (AANZFTA)", authority: "BOTH" },
  { order: 7, name: "C/O mẫu AHK", formCodes: ["AHK"], certificateType: "CO", legalBasis: "TT 21/2019/TT-BCT (AHKFTA)", authority: "BOTH" },
  { order: 8, name: "C/O mẫu RCEP", formCodes: ["RCEP"], certificateType: "CO", legalBasis: "TT 05/2022/TT-BCT (RCEP)", authority: "BOTH" },
  { order: 9, name: "C/O mẫu EUR.1", formCodes: ["EUR.1"], certificateType: "CO", legalBasis: "TT 11/2020/TT-BCT (EVFTA)", authority: "BOTH" },
  { order: 10, name: "C/O mẫu EUR.1 UK", formCodes: ["EUR.UK"], certificateType: "CO", legalBasis: "TT 02/2021/TT-BCT (UKVFTA)", authority: "BOTH" },
  { order: 11, name: "C/O mẫu CPTPP", formCodes: ["CPTPP"], certificateType: "CO", legalBasis: "TT 03/2019/TT-BCT (CPTPP)", authority: "BOTH" },
  { order: 12, name: "C/O mẫu EAV", formCodes: ["EAV"], certificateType: "CO", legalBasis: "TT 21/2016/TT-BCT (EAEUFTA)", authority: "BOTH" },
  { order: 13, name: "C/O mẫu VN-CU", formCodes: ["VNCU"], certificateType: "CO", legalBasis: "TT 08/2020/TT-BCT (Việt Nam–Cuba)", authority: "BOTH" },
  { order: 14, name: "C/O mẫu VC", formCodes: ["VC"], certificateType: "CO", legalBasis: "TT 31/2013/TT-BCT (VCFTA)", authority: "BOTH" },
  { order: 15, name: "C/O mẫu VK", formCodes: ["VK"], certificateType: "CO", legalBasis: "TT 40/2015/TT-BCT (VKFTA)", authority: "BOTH" },
  { order: 16, name: "C/O mẫu VJ", formCodes: ["VJ"], certificateType: "CO", legalBasis: "TT 10/2009/TT-BCT (AJCEP song phương)", authority: "BOTH" },
  { order: 17, name: "C/O mẫu VI", formCodes: ["VI"], certificateType: "CO", legalBasis: "TT 11/2024/TT-BCT (Việt Nam–I-xra-en)", authority: "BOTH" },
  { order: 18, name: "C/O mẫu X", formCodes: ["X"], certificateType: "CO", legalBasis: "TT 17/2011/TT-BCT (Việt Nam–Campuchia)", authority: "BOTH" },
  { order: 19, name: "C/O mẫu S", formCodes: ["S"], certificateType: "CO", legalBasis: "TT 04/2010/TT-BCT (Việt Nam–Lào)", authority: "BOTH" },
  {
    order: 20,
    name: "C/O mẫu B, A, ICO, Thổ Nhĩ Kỳ, GSTP, BR9, DA59, Peru, Venezuela, CNM và mã số REX",
    formCodes: ["B", "A", "ICO", "T", "GSTP", "BR9", "DA59", "PER", "VEN", "CNM", "REX"],
    certificateType: "CO",
    legalBasis: "TT 23/2025/TT-BCT (sửa TT 05/2018, TT 38/2018)",
    authority: "BOTH",
  },
];

/** Mã C/O các tổ chức cấp tỉnh được phép cấp (Phụ lục II). */
export const PROVINCE_ISSUABLE_FORM_CODES: string[] = CO_ISSUANCE_CATALOG.flatMap(
  (e) => e.formCodes,
);

export function isProvinceIssuableForm(formCode: string): boolean {
  return PROVINCE_ISSUABLE_FORM_CODES.includes(formCode);
}

export function getIssuanceEntryByForm(formCode: string): CoIssuanceCatalogEntry | undefined {
  return CO_ISSUANCE_CATALOG.find((e) => e.formCodes.includes(formCode));
}

export interface Tt40Condition {
  id: string;
  order: number;
  /** Điều kiện cấp C/O & Văn bản chấp thuận (Điều 5 TT 40/2025). */
  requirement: string;
  detail: string;
}

/** Điều 5 — điều kiện cấp C/O và Văn bản chấp thuận (Phụ lục III tự đánh giá). */
export const TT40_CONDITIONS: Tt40Condition[] = [
  {
    id: "dk1",
    order: 1,
    requirement: "Đảm bảo đội ngũ nhân lực",
    detail: "Đủ nhân lực để thực hiện việc cấp và tổ chức triển khai việc cấp C/O và Văn bản chấp thuận.",
  },
  {
    id: "dk2",
    order: 2,
    requirement: "Đào tạo người có thẩm quyền ký",
    detail:
      "Người có thẩm quyền ký C/O và Văn bản chấp thuận đã được đào tạo, tập huấn kiến thức về xuất xứ hàng hóa.",
  },
  {
    id: "dk3",
    order: 3,
    requirement: "Tài khoản thu phí chứng nhận xuất xứ",
    detail: "Có tài khoản thu phí chứng nhận xuất xứ hàng hóa.",
  },
  {
    id: "dk4",
    order: 4,
    requirement: "Hạ tầng số vận hành eCoSys",
    detail:
      "Hạ tầng số đảm bảo Hệ thống eCoSys (www.ecosys.gov.vn) vận hành liên tục, ổn định — thu phí điện tử, cấp C/O điện tử, truyền dữ liệu C/O điện tử và cấp Văn bản chấp thuận.",
  },
  {
    id: "dk5",
    order: 5,
    requirement: "Khu lưu trữ hồ sơ, chứng từ riêng",
    detail: "Có khu vực lưu trữ riêng, trang thiết bị lưu trữ hồ sơ, chứng từ cấp C/O và Văn bản chấp thuận.",
  },
];

// ---------------------------------------------------------------------------
// Workflow hồ sơ (Điều 7 — thực hiện quy trình, thủ tục theo pháp luật XX)
// ---------------------------------------------------------------------------

export interface CoWorkflowTransition {
  action: CoWorkflowAction;
  label: string;
  target: CoApplicationStatus;
  /** Trạng thái bắt đầu cho action này. */
  from: CoApplicationStatus;
  /** Action bắt buộc nhập ghi chú. */
  requireNote?: boolean;
}

export const CO_WORKFLOW: CoWorkflowTransition[] = [
  { action: "SUBMIT", label: "Nộp hồ sơ", from: "DRAFT", target: "SUBMITTED" },
  { action: "ACCEPT", label: "Tiếp nhận & thẩm định", from: "SUBMITTED", target: "PROCESSING" },
  { action: "RETURN", label: "Trả lại/yc bổ sung", from: "SUBMITTED", target: "RETURNED", requireNote: true },
  { action: "REJECT", label: "Từ chối", from: "SUBMITTED", target: "REJECTED", requireNote: true },
  { action: "RETURN", label: "Trả lại/yc bổ sung", from: "PROCESSING", target: "RETURNED", requireNote: true },
  { action: "APPROVE", label: "Duyệt", from: "PROCESSING", target: "APPROVED" },
  { action: "REJECT", label: "Từ chối", from: "PROCESSING", target: "REJECTED", requireNote: true },
  { action: "SUBMIT", label: "Nộp lại hồ sơ", from: "RETURNED", target: "SUBMITTED" },
  { action: "ISSUE", label: "Cấp C/O", from: "APPROVED", target: "ISSUED" },
  { action: "REJECT", label: "Từ chối", from: "APPROVED", target: "REJECTED", requireNote: true },
  { action: "CANCEL", label: "Hủy/thu hồi C/O", from: "ISSUED", target: "CANCELLED", requireNote: true },
];

export function getAvailableTransitions(status: CoApplicationStatus): CoWorkflowTransition[] {
  return CO_WORKFLOW.filter((t) => t.from === status);
}

export function findTransition(
  from: CoApplicationStatus,
  action: CoWorkflowAction,
): CoWorkflowTransition | undefined {
  return CO_WORKFLOW.find((t) => t.from === from && t.action === action);
}

/** Trạng thái có coNumber được cấp và còn hiệu lực. */
export function isActiveIssuedStatus(status: CoApplicationStatus): boolean {
  return status === "ISSUED";
}
