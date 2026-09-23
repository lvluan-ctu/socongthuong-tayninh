import type { CoFta, CoForm, CoCountry, CoHsCode, CoOriginCriterion, CoTariffSchedule } from "./co-types";
import { PROVINCE_ISSUABLE_FORM_CODES } from "./co-regulation";

import CO_FTA_DATA from "@/data/co-fta.json";
import CO_FORMS_DATA from "@/data/co-forms.json";
import CO_COUNTRIES_DATA from "@/data/co-countries.json";
import CO_HS_CODES_DATA from "@/data/co-hs-codes.json";
import CO_ORIGIN_CRITERIA_DATA from "@/data/co-origin-criteria.json";
import CO_TARIFF_DATA from "@/data/co-tariff-schedules.json";

export const CO_FTA = CO_FTA_DATA as CoFta[];
export const CO_FORMS: CoForm[] = CO_FORMS_DATA;
export const CO_COUNTRIES: CoCountry[] = CO_COUNTRIES_DATA;
export const CO_HS_CODES: CoHsCode[] = CO_HS_CODES_DATA;
export const CO_ORIGIN_CRITERIA = CO_ORIGIN_CRITERIA_DATA as CoOriginCriterion[];
export const CO_TARIFF_SCHEDULES: CoTariffSchedule[] = CO_TARIFF_DATA;

export const CO_FTA_MAP = new Map(CO_FTA.map((f) => [f.code, f]));
export const CO_FORMS_MAP = new Map(CO_FORMS.map((f) => [f.code, f]));
export const CO_COUNTRIES_MAP = new Map(CO_COUNTRIES.map((c) => [c.code, c]));
export const CO_HS_CODES_MAP = new Map(CO_HS_CODES.map((h) => [h.code, h]));
export const CO_TARIFF_MAP = new Map(CO_TARIFF_SCHEDULES.map((t) => [t.hsCode, t]));

export function getFtaByCode(code: string): CoFta | undefined {
  return CO_FTA_MAP.get(code);
}

export function getFormByCode(code: string): CoForm | undefined {
  return CO_FORMS_MAP.get(code);
}

export function getCountryByCode(code: string): CoCountry | undefined {
  return CO_COUNTRIES_MAP.get(code);
}

export function getHsCode(code: string): CoHsCode | undefined {
  return CO_HS_CODES_MAP.get(code);
}

export function getTariffByHs(hsCode: string): CoTariffSchedule | undefined {
  return CO_TARIFF_MAP.get(hsCode);
}

export function getFormsForFta(ftaCode: string): CoForm[] {
  return CO_FORMS.filter((f) => f.ftaCode === ftaCode);
}

export function getPreferentialForms(): CoForm[] {
  return CO_FORMS.filter((f) => f.isPreferential);
}

export function getNonPreferentialForms(): CoForm[] {
  return CO_FORMS.filter((f) => !f.isPreferential);
}

export function getFormsForTayNinh(): CoForm[] {
  // Phụ lục II TT 40/2025 — 20 nhóm mẫu do tổ chức cấp tỉnh cấp.
  return CO_FORMS.filter((f) => PROVINCE_ISSUABLE_FORM_CODES.includes(f.code));
}

export function searchHsCodes(query: string): CoHsCode[] {
  const q = query.toLowerCase();
  return CO_HS_CODES.filter(
    (h) =>
      h.code.includes(q) ||
      h.nameVi.toLowerCase().includes(q) ||
      h.nameEn.toLowerCase().includes(q),
  ).slice(0, 20);
}

export function getMemberCountries(ftaCode: string): CoCountry[] {
  const fta = getFtaByCode(ftaCode);
  if (!fta) return [];
  return CO_COUNTRIES.filter((c) => fta.members.includes(c.code));
}

export const CO_LEGAL_BASIS = [
  {
    type: "Luật",
    name: "Luật Quản lý ngoại thương",
    number: "Luật số 36/2013/QH13",
    date: "2013-06-20",
    description: "Quy định chung về xuất xứ hàng hóa, quản lý ngoại thương",
  },
  {
    type: "Nghị định",
    name: "Nghị định về xuất xứ hàng hóa",
    number: "NĐ 31/2018/NĐ-CP",
    date: "2018-03-08",
    description: "Chi tiết Luật Quản lý ngoại thương về xuất xứ hàng hóa",
  },
  {
    type: "Nghị định",
    name: "Nghị định phân quyền, phân cấp",
    number: "NĐ 146/2025/NĐ-CP",
    date: "2025-06-12",
    description: "Phân quyền, phân cấp cấp C/O cho UBND cấp tỉnh",
  },
  {
    type: "Thông tư",
    name: "Hướng dẫn cấp C/O và tự chứng nhận xuất xứ",
    number: "TT 40/2025/TT-BCT",
    date: "2025-06-22",
    description: "Quy định về cấp C/O và chấp thuận tự chứng nhận xuất xứ",
  },
  {
    type: "Thông tư",
    name: "Sửa đổi phân cấp C/O",
    number: "TT 26/2026/TT-BCT",
    date: "2026-05-20",
    description: "Sửa đổi danh mục mẫu C/O do từng cơ quan cấp, hiệu lực 01/08/2026",
  },
  {
    type: "Văn bản hợp nhất",
    name: "Hợp nhất quy định về C/O",
    number: "VBHN 16/VBHN-BCT",
    date: "2026-03-13",
    description: "Hợp nhất các Thông tư quy định về cấp C/O",
  },
  {
    type: "Quyết định",
    name: "Phân cấp Sở CT Tây Ninh",
    number: "QĐ 34/2025/QĐ-UBND",
    date: "2025-10-14",
    description: "Phân cấp cho Sở Công Thương Tây Ninh thực hiện cấp C/O",
  },
  {
    type: "Thông tư",
    name: "Quy tắc XX trong ACFTA",
    number: "TT 12/2019/TT-BCT",
    date: "2019-08-30",
    description: "Quy tắc xuất xứ hàng hóa trong ASEAN-Trung Quốc",
  },
  {
    type: "Thông tư",
    name: "Quy tắc XX trong CPTPP",
    number: "TT 03/2019/TT-BCT",
    date: "2019-01-22",
    description: "Quy tắc xuất xứ hàng hóa trong CPTPP",
  },
  {
    type: "Thông tư",
    name: "Quy tắc XX trong EVFTA",
    number: "TT 14/2026/TT-BCT",
    date: "2026-04-01",
    description: "Quy tắc xuất xứ hàng hóa trong EVFTA",
  },
  {
    type: "Thông tư",
    name: "Quy tắc XX trong RCEP",
    number: "TT 32/2022/TT-BCT",
    date: "2022-10-15",
    description: "Quy tắc xuất xứ hàng hóa trong RCEP",
  },
];
