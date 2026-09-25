// Parse file Chỉ tiêu ngành Công Thương ra JSON chuẩn hóa.
// Chạy: node scripts/parse-chi-tieu-nganh.mjs
// Nguồn: public/Chi_Tieu_Nganh_Cong_Thuong.xlsx
// Đích: public/ChiTieuNganh/parsed/*.json
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const SRC = "public/Chi_Tieu_Nganh_Cong_Thuong.xlsx";
const OUT_DIR = "public/ChiTieuNganh/parsed";

const clean = (v) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

function aoa(wb, sheet) {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
}

// --- TMBLHH / XNK: dòng tháng là số, dòng tổng hợp là chuỗi -----------------
function parseMonthlySheet(rows, kind) {
  let kh = null;
  const items = [];
  for (const r of rows) {
    const label = clean(r[0]);
    if (kind === "xnk" && label === "" && /KH 2026/i.test(clean(r[1]))) {
      kh = {
        xk: num(r[2]),
        xkTocdo: num(r[4]),
        nk: num(r[6]),
        nkTocdo: num(r[8]),
      };
      continue;
    }
    if (/KH 2026/i.test(label) || (kind === "xnk" && /KH 2026/i.test(clean(r[1])))) continue;
    if (kind === "tmblhh" && /KH 2026/i.test(clean(r[1]))) {
      kh = { value: num(r[2]), tocdo: num(r[4]) };
      continue;
    }
    if (!label) continue;
    if (/tháng.*tổng mức|doanh thu dịch vụ/i.test(label)) continue;
    if (/^năm 2025$/i.test(label)) continue;
    const isMonth = /^\d+$/.test(label);
    if (!isMonth && !/quí|quý|tháng|năm|sơ bộ/i.test(label)) continue;
    if (kind === "tmblhh") {
      const v2025 = num(r[1]);
      const v2026 = num(r[2]);
      if (v2025 === null && v2026 === null) continue;
      items.push({
        ky: isMonth ? `T${label}` : label,
        v2025,
        v2026,
        soCK: num(r[3]),
        soKH: num(r[4]),
      });
    } else {
      const xk2025 = num(r[1]);
      const xk2026 = num(r[2]);
      const nk2025 = num(r[5]);
      const nk2026 = num(r[6]);
      if (xk2025 === null && xk2026 === null && nk2025 === null && nk2026 === null) continue;
      items.push({
        ky: isMonth ? `T${label}` : label,
        xk2025,
        xk2026,
        xkSoCK: num(r[3]),
        xkSoKH: num(r[4]),
        nk2025,
        nk2026,
        nkSoCK: num(r[7]),
        nkSoKH: num(r[8]),
      });
    }
  }
  return { kh, items };
}

// --- Năm 2022-2024: ô text tự do, giữ raw -----------------------------------
function parseYearSheet(rows, year) {
  const items = [];
  let mucTieu = "";
  for (const r of rows) {
    const label = clean(r[0]);
    if (!label) continue;
    if (/dự kiến năm/i.test(label)) {
      mucTieu = [label, clean(r[1]), clean(r[2])].filter(Boolean).join(" ");
      continue;
    }
    if (/chỉ số ngành|tháng/i.test(label) && /IIP/i.test(clean(r[1]))) continue;
    if (/^(tháng|quý|[0-9]|quý i|quý ii|[0-9]+\s*tháng)/i.test(label)) {
      items.push({
        ky: label,
        iip: clean(r[1]),
        tongmuc: clean(r[2]),
        xk: clean(r[3]),
        nk: clean(r[4]),
        cpi: clean(r[5]),
      });
    }
  }
  return { year, items, mucTieu };
}

// --- Nhiệm vụ: tách đơn vị theo dòng header, rule đoán deadline/trạng thái --
const DEADLINE_RE = /hoàn thành[^\d(]*\(?\s*(trong\s+)?(tháng|quí|quý)\s*(\d+)(?:\s*\/\s*(\d+))?/i;
const QUARTER_END = { 1: 3, 2: 6, 3: 9, 4: 12 };

function guessDeadline(text) {
  const m = String(text).match(DEADLINE_RE);
  if (!m) return null;
  const isQuarter = /quí|quý/i.test(m[2]);
  const n = Number(m[3]);
  const year = m[4] ? Number(m[4]) : 2026;
  const month = isQuarter ? (QUARTER_END[n] ?? 12) : n;
  if (month < 1 || month > 12) return null;
  return { month, year, isQuarter, raw: m[0].trim() };
}

function guessStatus(noidung, tiendo) {
  const t = `${noidung} ${tiendo}`;
  if (/chưa có cơ sở/i.test(t)) return "blocked";
  if (
    /\(hoàn thành\)/i.test(tiendo) ||
    /đã (ban hành|trình|báo cáo|gửi|tham mưu trình|phê duyệt)/i.test(tiendo)
  )
    return "completed";
  if (/đang thực hiện/i.test(t)) return "in_progress";
  if (/thường xuyên|nhiệm vụ thường xuyên/i.test(t)) return "recurring";
  return "pending";
}

function parseTasks(rows) {
  const units = [];
  let current = null;
  for (const r of rows) {
    const a = clean(r[0]);
    const b = clean(r[1]);
    const c = clean(r[2]);
    const d = clean(r[3]);
    if (!a && !b && !c && !d) continue;
    if (/báo cáo tiến độ/i.test(a)) continue;
    if (/^lưu ý/i.test(a)) continue;
    if (/^stt$/i.test(a)) continue;
    // Dòng header đơn vị: cột A là tên, B/C/D trống (hoặc A trống + B là tên)
    const unitName =
      a !== "" && b === "" && c === ""
        ? a
        : a === "" && b !== "" && c === "" && d === ""
          ? b
          : null;
    if (unitName && isNaN(Number(unitName))) {
      current = { unit: unitName, tasks: [] };
      units.push(current);
      continue;
    }
    if (!current) continue;
    if (a !== "" && !isNaN(Number(a)) && b !== "") {
      const deadline = guessDeadline(b);
      const status = guessStatus(b, c);
      current.tasks.push({
        stt: Number(a),
        noidung: b,
        tiendo: c,
        vanban: /^\s*x\s*$/i.test(d) ? "UBND tỉnh giao" : d,
        deadline,
        statusAuto: status,
      });
    }
  }
  return units;
}

function main() {
  const wb = XLSX.readFile(SRC, { cellDates: false });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (name, data) =>
    fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2), "utf8");
  const warnings = [];

  const years = {};
  for (const y of [2022, 2023, 2024]) {
    const sheet = `Năm ${y}`;
    if (!wb.SheetNames.includes(sheet)) {
      warnings.push(`thiếu sheet ${sheet}`);
      continue;
    }
    years[y] = parseYearSheet(aoa(wb, sheet), y);
  }
  write("nam_2022_2024.json", years);

  if (!wb.SheetNames.includes("TMBLHH")) warnings.push("thiếu sheet TMBLHH");
  else write("tmblhh_monthly.json", parseMonthlySheet(aoa(wb, "TMBLHH"), "tmblhh"));

  if (!wb.SheetNames.includes("XNK")) warnings.push("thiếu sheet XNK");
  else write("xnk_monthly.json", parseMonthlySheet(aoa(wb, "XNK"), "xnk"));

  const emptySheets = ["IIP", "TLHDSD điện"].filter((s) => {
    const rows = aoa(wb, s);
    return rows.filter((r) => r.some((c) => clean(c) !== "")).length === 0;
  });

  const taskSheet = "Tiến độ nhiệm vụ trọng tâm 2026";
  let units = [];
  if (!wb.SheetNames.includes(taskSheet)) warnings.push(`thiếu sheet ${taskSheet}`);
  else {
    units = parseTasks(aoa(wb, taskSheet));
    write("tasks_by_unit.json", units);
  }

  const totalTasks = units.reduce((s, u) => s + u.tasks.length, 0);
  const withDeadline = units.reduce((s, u) => s + u.tasks.filter((t) => t.deadline).length, 0);
  const summary = {
    generatedAt: new Date().toISOString(),
    source: SRC,
    units: units.map((u) => ({ unit: u.unit, tasks: u.tasks.length })),
    totalTasks,
    withDeadline,
    emptySheets,
    notes: [
      "TMBLHH/XNK: đơn vị TMBLHH là tỷ đồng; XNK là triệu USD.",
      "Cột So KH là tỷ lệ hoàn thành kế hoạch (0.xx).",
      "Nhiệm vụ: deadline/statusAuto do rule đoán từ text, công chức hiệu chỉnh tay trên UI.",
      "Sheet IIP và TLHDSD điện đang trống: IIP lấy từ 16 file SoLieuThongKe; hộ dùng điện nhập tay demo 99,9%.",
    ],
    warnings,
  };
  write("summary.json", summary);
  console.log(JSON.stringify(summary, null, 2));
}

main();
