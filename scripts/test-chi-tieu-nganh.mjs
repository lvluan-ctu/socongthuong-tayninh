// Kiểm thử toàn vẹn file Chỉ tiêu ngành Công Thương.
// Chạy: node scripts/test-chi-tieu-nganh.mjs
import fs from "node:fs";

const DIR = "public/ChiTieuNganh/parsed";
const load = (n) => JSON.parse(fs.readFileSync(`${DIR}/${n}.json`, "utf8"));

let failures = 0;
const check = (cond, msg) => {
  if (cond) console.log(`ok - ${msg}`);
  else {
    failures++;
    console.error(`FAIL - ${msg}`);
  }
};

const tm = load("tmblhh_monthly");
const xnk = load("xnk_monthly");
const tasks = load("tasks_by_unit");

check(tm.kh?.value === 232129.194 && tm.kh?.tocdo === 0.14, "KH Tổng mức 232.129 tỷ (+14%)");
check(xnk.kh?.xk === 19600 && xnk.kh?.nk === 15600, "KH XK 19.600 / NK 15.600 tr.USD");
check(tm.items.filter((i) => /^T[1-8]$/.test(i.ky)).length === 8, "TMBLHH đủ T1-T8");
check(xnk.items.filter((i) => /^T[1-8]$/.test(i.ky)).length === 8, "XNK đủ T1-T8");

const t8tm = tm.items.find((i) => i.ky === "T8");
check(t8tm?.v2026 === 20150.333, "TMBLHH T8/2026 = 20.150,333 tỷ");
const t8x = xnk.items.find((i) => i.ky === "T8");
check(t8x?.xk2026 === 1832.452499 && t8x?.nk2026 === 1185.30367, "XNK T8 đúng số");

check(tasks.length === 9, `Đủ 9 đơn vị (có ${tasks.length})`);
const total = tasks.reduce((s, u) => s + u.tasks.length, 0);
check(total === 81, `Đủ 81 nhiệm vụ (có ${total})`);
const withDl = tasks.reduce((s, u) => s + u.tasks.filter((t) => t.deadline).length, 0);
check(withDl >= 25, `Deadline parse được ≥25 (có ${withDl})`);
const validStatus = ["completed", "in_progress", "pending", "recurring", "blocked"];
check(
  tasks.every((u) => u.tasks.every((t) => validStatus.includes(t.statusAuto))),
  "Trạng thái auto hợp lệ",
);
check(
  tasks.every((u) => u.tasks.every((t) => t.noidung && t.id === undefined)),
  "Nhiệm vụ có nội dung",
);
const hasVanbanX = tasks.some((u) => u.tasks.some((t) => t.vanban === "UBND tỉnh giao"));
check(hasVanbanX, 'Cột "X" map thành "UBND tỉnh giao"');

const src = fs.readFileSync("src/data/chi-tieu-nganh.ts", "utf8");
for (const id of ["SCT-TMBLHH-8T26", "SCT-XK-8T26", "SCT-NK-8T26", "SCT-DIEN-HOGD-26"]) {
  check(src.includes(id), `dataset ${id} có trong seed`);
}
const comp = fs.readFileSync("src/components/analytics/TongHopNganh.tsx", "utf8");
for (const key of ["TongHopDashboard", "NhiemVuTracker", "frappe-gantt", "nhiemvu.overrides"]) {
  check(comp.includes(key), `component chứa "${key}"`);
}
check(fs.existsSync("src/styles/vendor-frappe-gantt.css"), "CSS Gantt được vendor trong src/styles");
const layout = fs.readFileSync("src/app/layout.tsx", "utf8");
check(layout.includes("vendor-frappe-gantt.css"), "layout nạp CSS Gantt");
const nav = fs.readFileSync("src/lib/nav.ts", "utf8");
const analyticsRoles = nav.match(/to:\s*"\/analytics"[\s\S]{0,200}?roles:\s*\[([^\]]+)\]/);
check(
  analyticsRoles !== null &&
    !analyticsRoles[1].includes("investor") &&
    analyticsRoles[1].includes("leader"),
  "Quyền /analytics nội bộ (leader/dept/specialist/admin, không investor)",
);

if (failures) {
  console.error(`\n${failures} kiểm tra LỖI`);
  process.exit(1);
}
console.log("\nTất cả kiểm tra Chỉ tiêu ngành đạt.");
