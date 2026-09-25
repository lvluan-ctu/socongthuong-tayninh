// Parse 16 file SoLieuThongKe T01-T08/2026 ra JSON chuẩn hóa.
// Chạy: node scripts/parse-solieuthongke.mjs
// Đọc bằng SheetJS (xlsx) để hỗ trợ cả .xls OLE cũ và .xlsx.
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const DIR = "public/SoLieuThongKe";
const OUT_DIR = path.join(DIR, "parsed");

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().replace(/%/g, "").replace(/\s+/g, "");
  if (!s) return null;
  // số VN có thể dùng dấu phẩy thập phân trong file gốc, nhưng SheetJS đã parse số thật
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const clean = (v) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();

const back2025 = (v2026, pct) => {
  if (v2026 === null || pct === null || pct === 0) return null;
  return Math.round(((v2026 * 100) / pct) * 100) / 100;
};

function aoa(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
}

function findSheet(wb, pred) {
  return wb.SheetNames.find((s) => pred(s));
}

function parseIIP(rows) {
  // header nằm ở dòng index 2 (dòng thứ 3), cột B-E
  const h = rows[2] || [];
  const header = { c1: clean(h[1]), c2: clean(h[2]), c3: clean(h[3]), c4: clean(h[4]) };
  const out = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r[0]);
    if (!name) continue;
    if (/chỉ số sản xuất/i.test(name)) continue;
    if (/đơn vị tính/i.test(name)) continue;
    if (/ghi chú/i.test(name)) continue;
    if (/chậm nhất/i.test(name)) continue;
    if (/báo cáo chưa/i.test(name)) continue;
    const c1 = num(r[1]),
      c2 = num(r[2]),
      c3 = num(r[3]),
      c4 = num(r[4]);
    if (c1 === null && c2 === null && c3 === null && c4 === null) continue;
    out.push({ nganh: name, c1, c2, c3, c4 });
  }
  return { header, rows: out };
}

function parseSPCN(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r[0]);
    if (!name || name.length < 4) continue;
    if (/sản phẩm chủ yếu/i.test(name)) continue;
    if (/tên sản phẩm/i.test(name)) continue;
    if (/đơn vị tính/i.test(String(r[1]))) continue;
    if (/ghi chú/i.test(name)) continue;
    if (/chậm nhất/i.test(name)) continue;
    const b = clean(r[1]);
    const isCode = /^\d{6,}$/.test(b.replace(/\s/g, ""));
    let dvt, th_truoc, uoc_thang, luyke, pct_thang, pct_luyke;
    if (isCode) {
      dvt = "";
      th_truoc = num(r[2]);
      uoc_thang = num(r[3]);
      luyke = num(r[4]);
      pct_thang = num(r[5]);
      pct_luyke = num(r[6]);
    } else {
      // loại bỏ dòng header lặp (dvt = "Đơn vị tính")
      if (/đơn vị tính/i.test(b)) continue;
      dvt = b;
      th_truoc = num(r[2]);
      uoc_thang = num(r[3]);
      luyke = num(r[4]);
      pct_thang = num(r[5]);
      pct_luyke = num(r[6]);
      // dòng phân nhóm không có số
      if (th_truoc === null && uoc_thang === null && luyke === null) continue;
    }
    out.push({
      sanpham: name,
      dvt,
      th_truoc,
      uoc_thang,
      luyke,
      pct_thang,
      pct_luyke,
      v2025_thang: back2025(uoc_thang, pct_thang),
      v2025_luyke: back2025(luyke, pct_luyke),
    });
  }
  return out;
}

function parseTMDV(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r[0]);
    if (!name) continue;
    if (/tổng mức bán lẻ/i.test(name)) continue;
    if (/doanh thu bán lẻ/i.test(name)) continue;
    if (/đơn vị tính/i.test(name)) continue;
    if (/thực hiện/i.test(name) && /dự tính/i.test(clean(r[1])) === false && num(r[1]) === null) {
      // dòng header nhiều dòng — bỏ qua nếu không có số
      if (num(r[1]) === null && num(r[2]) === null) continue;
    }
    if (/phân theo/i.test(name)) continue;
    const v1 = num(r[1]),
      v2 = num(r[2]),
      v3 = num(r[3]),
      p1 = num(r[4]),
      p2 = num(r[5]);
    if (v1 === null && v2 === null && v3 === null) continue;
    // bỏ dòng rác số lẻ (ví dụ 1.006... ở file T8)
    if (
      !/tổng số/i.test(name) &&
      !/bán lẻ/i.test(name) &&
      !/dịch vụ/i.test(name) &&
      !/lưu trú/i.test(name) &&
      !/ăn uống/i.test(name) &&
      !/lữ hành/i.test(name) &&
      !/^\d+\./.test(name)
    )
      continue;
    out.push({
      chitieu: name,
      th_truoc: v1,
      uoc_thang: v2,
      luyke: v3,
      pct_thang: p1,
      pct_luyke: p2,
      v2025_thang: back2025(v2, p1),
      v2025_luyke: back2025(v3, p2),
    });
  }
  return out;
}

function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".xls") || f.endsWith(".xlsx"));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const iipMonthly = [];
  const spcnMonthly = [];
  const tmdvTong = [];
  const tmdvBanle = [];
  const baseline2025 = [];
  const warnings = [];

  const monthOf = (f) => {
    const m = f.match(/^(\d+)\./);
    return m ? Number(m[1]) : null;
  };

  for (const f of files.sort()) {
    const month = monthOf(f);
    const p = path.join(DIR, f);
    let wb;
    try {
      wb = XLSX.readFile(p, { cellDates: false });
    } catch (e) {
      warnings.push(`${f}: không đọc được (${e.message})`);
      continue;
    }
    const isT1Multi =
      month === 1 && wb.SheetNames.some((s) => /TM tháng/i.test(s)) && wb.SheetNames.length > 5;
    const hasIIP = wb.SheetNames.some((s) => /IIP/i.test(s));
    const hasTM = wb.SheetNames.some((s) => /TM|Tổng mức/i.test(s));

    if (isT1Multi) {
      // T1 đặc biệt: vừa có TMDV T1/2026 (sheet 12. TM tháng) vừa có baseline 2025
      const tmSheet = findSheet(wb, (s) => /TM tháng|Tổng mức/i.test(s));
      if (tmSheet) {
        const rows = aoa(wb, tmSheet);
        // sheet T1 không có DT bán lẻ chi tiết
        tmdvTong.push({
          month: 1,
          file: f,
          sheet: tmSheet,
          unit: "Triệu đồng",
          rows: parseTMDV(rows),
        });
      } else warnings.push(`${f}: thiếu sheet Tổng mức T1`);
      for (const sn of ["5. IIP thang", "6. IIPquy", "7. SPCNthang", "8. SPCN quý"]) {
        if (wb.SheetNames.includes(sn)) {
          const rows = aoa(wb, sn);
          baseline2025.push({
            sheet: sn,
            sampleRows: rows.slice(0, 8).map((r) => r.slice(0, 7)),
            totalRows: rows.length,
          });
        }
      }
      // IIP T1/2026 nằm ở file xlsx riêng (1.1), xử lý ở vòng IIP bên dưới
      continue;
    }

    if (hasIIP && !hasTM) {
      // File IIP thuần (1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8)
      const cands = wb.SheetNames.filter((s) => /IIP/i.test(s));
      let sheet =
        cands.find((s) => /IIP\s*T$/i.test(s)) ||
        cands.find((s) => /^7\.IIP|IIP$/i.test(s)) ||
        cands.find((s) => !/Q$/i.test(s)) ||
        cands[0];
      if (!sheet) {
        warnings.push(`${f}: thiếu sheet IIP`);
        continue;
      }
      const { header, rows } = parseIIP(aoa(wb, sheet));
      iipMonthly.push({ month, file: f, sheet, unit: "%", header, rows });
      const spcnSheet =
        wb.SheetNames.find((s) => /SPCN/i.test(s) && !/Q$/i.test(s)) ||
        wb.SheetNames.find((s) => /SPCN/i.test(s));
      if (spcnSheet) {
        const srows = parseSPCN(aoa(wb, spcnSheet));
        spcnMonthly.push({ month, file: f, sheet: spcnSheet, rows: srows });
      } else warnings.push(`${f}: thiếu sheet SPCN`);
      continue;
    }

    // còn lại là TMDV T2-T8 (sheet Tổng mức có thể là "Tổng mức", "TM T", "11.TM", ...)
    const tmSheet = findSheet(wb, (s) => /TM|Tổng mức/i.test(s));
    const blSheet = findSheet(wb, (s) => /DTBL|DT bán lẻ|^BL /i.test(s));
    if (tmSheet)
      tmdvTong.push({
        month,
        file: f,
        sheet: tmSheet,
        unit: "Triệu đồng",
        rows: parseTMDV(aoa(wb, tmSheet)),
      });
    else warnings.push(`${f}: thiếu sheet Tổng mức`);
    if (blSheet)
      tmdvBanle.push({
        month,
        file: f,
        sheet: blSheet,
        unit: "Triệu đồng",
        rows: parseTMDV(aoa(wb, blSheet)),
      });
    else warnings.push(`${f}: thiếu sheet DT bán lẻ (T1 không có là bình thường)`);
  }

  const write = (name, data) =>
    fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2), "utf8");

  write("iip_monthly.json", iipMonthly);
  write("spcn_monthly.json", spcnMonthly);
  write("tmdv_tongmuc.json", tmdvTong);
  write("tmdv_banle.json", tmdvBanle);
  write("baseline2025_sheets.json", baseline2025);

  const summary = {
    generatedAt: new Date().toISOString(),
    months: {
      iip: iipMonthly.map((d) => d.month),
      tmdvTong: tmdvTong.map((d) => d.month),
      tmdvBanle: tmdvBanle.map((d) => d.month),
    },
    counts: {
      iipMonths: iipMonthly.length,
      iipRowsT8: iipMonthly.find((d) => d.month === 8)?.rows.length ?? 0,
      spcnRowsT8: spcnMonthly.find((d) => d.month === 8)?.rows.length ?? 0,
      tongMucT8: tmdvTong.find((d) => d.month === 8)?.rows.length ?? 0,
      banleT8: tmdvBanle.find((d) => d.month === 8)?.rows.length ?? 0,
    },
    notes: [
      "T1 TMDV lấy từ sheet '12. TM tháng' trong file .xls 464KB; file này đồng thời chứa baseline 2025 (GRDP, IIP T9/2025, vốn, ngân sách).",
      "T1 không có sheet DT bán lẻ chi tiết.",
      "Giá trị 2025 (v2025_thang/luyke) được back-calculate từ % cùng kỳ để đối sánh demo cân đối.",
      "T6 SPCN có mã sản phẩm thay ĐVT — parser tự nhận diện.",
    ],
    warnings,
  };
  write("summary.json", summary);
  console.log(JSON.stringify(summary, null, 2));
}

main();
