// Kiểm thử toàn vẹn số liệu SCT T1-T8/2026.
// Chạy: node scripts/test-statistical-sct.mjs (hoặc npm run test:statistical-sct)
import fs from "node:fs";

const DIR = "public/SoLieuThongKe/parsed";
const load = (n) => JSON.parse(fs.readFileSync(`${DIR}/${n}.json`, "utf8"));

let failures = 0;
const check = (cond, msg) => {
  if (cond) console.log(`ok - ${msg}`);
  else {
    failures++;
    console.error(`FAIL - ${msg}`);
  }
};

const iip = load("iip_monthly");
const spcn = load("spcn_monthly");
const tong = load("tmdv_tongmuc");
const banle = load("tmdv_banle");

check(iip.length === 8, `IIP đủ 8 tháng (có ${iip.length})`);
check(spcn.length === 8, `SPCN đủ 8 tháng (có ${spcn.length})`);
check(tong.length === 8, `TMDV Tổng mức đủ 8 tháng (có ${tong.length})`);
check(banle.length === 7, `TMDV DT bán lẻ 7 tháng, T1 không có chi tiết (có ${banle.length})`);

for (const m of tong) {
  const t = m.rows.find((r) => /tổng số/i.test(r.chitieu));
  check(!!t, `T${m.month} có dòng Tổng số`);
  if (t && t.pct_thang) {
    const back = (t.v2025_thang * t.pct_thang) / 100;
    check(
      Math.abs(back - t.uoc_thang) / t.uoc_thang < 0.01,
      `T${m.month} back-calc 2025 khớp (sai số <1%)`,
    );
  }
}

const t8iip = iip.find((d) => d.month === 8);
const all = t8iip.rows.find((r) => /toàn ngành/i.test(r.nganh));
check(all?.c3 === 116.02 && all?.c4 === 115.04, "IIP T8 toàn ngành đúng (116.02 / 115.04)");

const t8sp = spcn.find((d) => d.month === 8);
check(t8sp.rows.length === 40, `SPCN T8 đủ 40 sản phẩm (có ${t8sp.rows.length})`);

const t8bl = banle.find((d) => d.month === 8);
check(t8bl.rows.length === 13, `DT bán lẻ T8 đủ 13 dòng (có ${t8bl.rows.length})`);

// Tăng trưởng Tổng mức T1→T8 ổn định, không sụt giảm/jump bất thường (>10%)
const totals = tong.map((m) => m.rows.find((r) => /tổng số/i.test(r.chitieu)).uoc_thang);
check(
  totals.every((v, i) => i === 0 || Math.abs(v / totals[i - 1] - 1) < 0.1),
  "Tổng mức biến động <10%/tháng (T3 thấp hơn T2 nhẹ là đúng số thực)",
);

const src = fs.readFileSync("src/data/statistical-sct-2026.ts", "utf8");
for (const id of ["SCT-TMDV-TONG-8T26", "SCT-TMDV-BANLE-8T26", "SCT-IIP-8T26", "SCT-SPCN-8T26"]) {
  check(src.includes(id), `dataset ${id} có trong seed`);
}

if (failures) {
  console.error(`\n${failures} kiểm tra LỖI`);
  process.exit(1);
}
console.log("\nTất cả kiểm tra số liệu SCT đạt.");
