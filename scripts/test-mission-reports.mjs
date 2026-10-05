import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3113";
const shouldWriteOutput = process.argv.includes("--output");
const outputDirectory = resolve("output/pdf");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getSummary(taskId) {
  const path = `/api/energy/tasks/${taskId}/summary`;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  assert(response.status === 200, `${path}: HTTP ${response.status} (${JSON.stringify(body)})`);
  return body;
}

async function getReport(taskId, summary) {
  const path = `/api/energy/tasks/${taskId}/report`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/pdf",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ summary }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${path}: HTTP ${response.status} (${detail})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  assert(
    response.headers.get("content-type")?.includes("application/pdf"),
    `${path}: missing application/pdf content type`,
  );
  assert(
    response.headers.get("content-disposition")?.includes("attachment"),
    `${path}: missing attachment content disposition`,
  );
  assert(
    response.headers.get("cache-control")?.includes("no-store"),
    `${path}: reports must not be cached`,
  );
  assert(
    response.headers.get("x-report-data-source") === "server-database",
    `${path}: report must be regenerated from the server database`,
  );
  assert(buffer.subarray(0, 5).toString("ascii") === "%PDF-", `${path}: invalid PDF signature`);
  assert(buffer.includes(Buffer.from("%%EOF")), `${path}: PDF trailer is incomplete`);
  assert(buffer.length > 20_000, `${path}: report is unexpectedly small (${buffer.length} bytes)`);
  return buffer;
}

if (shouldWriteOutput) await mkdir(outputDirectory, { recursive: true });

const results = [];
for (let taskId = 1; taskId <= 7; taskId += 1) {
  const summary = await getSummary(taskId);
  assert(summary.taskId === taskId, `Task ${taskId}: mismatched summary taskId`);
  assert(summary.coverageStatus === "READY", `Task ${taskId}: source data is not ready`);
  assert(summary.kpis?.length >= 4, `Task ${taskId}: at least four KPIs are required`);
  assert(summary.records?.length > 0, `Task ${taskId}: report has no detail records`);
  assert(summary.intelligence?.trend?.length > 0, `Task ${taskId}: trend data is missing`);
  const usableTrendPeriods = summary.intelligence.trend.filter(
    (point) => !/SNAPSHOT|PARTIAL|TẠM/i.test(String(point.period)),
  ).length;
  if (usableTrendPeriods >= 6) {
    assert(summary.intelligence.forecast.length > 0, `Task ${taskId}: scenario series is missing`);
    assert(
      summary.intelligence.forecast.every((point) => point.min < point.max),
      `Task ${taskId}: scenario range must not have zero width`,
    );
  } else {
    assert(
      summary.intelligence.forecast.length === 0,
      `Task ${taskId}: must not extrapolate from fewer than six complete periods`,
    );
  }
  assert(
    Number.isFinite(summary.intelligence?.provenance?.observations),
    `Task ${taskId}: provenance observations are missing`,
  );

  const pagePath = `/energy/nhiem-vu-${taskId}/bao-cao`;
  const page = await fetch(`${baseUrl}${pagePath}`, { cache: "no-store" });
  assert(page.status === 200, `${pagePath}: expected HTTP 200, received ${page.status}`);

  const pdf = await getReport(taskId, summary);
  const fileName = `bao-cao-nhiem-vu-${taskId}-so-cong-thuong-tay-ninh.pdf`;
  if (shouldWriteOutput) await writeFile(resolve(outputDirectory, fileName), pdf);

  results.push({
    taskId,
    title: summary.title,
    kpis: summary.kpis.length,
    records: summary.records.length,
    alerts: summary.intelligence.alerts.length,
    pdfBytes: pdf.length,
    output: shouldWriteOutput ? `output/pdf/${fileName}` : null,
  });
}

const serverOwned = await fetch(`${baseUrl}/api/energy/tasks/1/report`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ summary: { taskId: 7 } }),
});
assert(
  serverOwned.status === 200 &&
    serverOwned.headers.get("x-report-data-source") === "server-database",
  "Client-supplied summary must be ignored in favor of a server-side database refresh.",
);

console.log(JSON.stringify({ ok: true, baseUrl, reports: results }, null, 2));
