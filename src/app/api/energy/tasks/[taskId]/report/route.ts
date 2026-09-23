import { NextResponse } from "next/server";

import { renderMissionReportPdf, missionReportFilename } from "@/lib/mission-report-pdf";
import { MISSION_REPORTS } from "@/lib/mission-reports";
import type { MissionSummary } from "@/lib/mission-report-types";
import { GET as getMissionSummary } from "../summary/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissionSummary(value: unknown, taskId: number): value is MissionSummary {
  if (!isRecord(value) || value.taskId !== taskId) return false;

  if (
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.coverage !== "string" ||
    typeof value.updatedAt !== "string" ||
    Number.isNaN(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.kpis) ||
    !Array.isArray(value.breakdown) ||
    !Array.isArray(value.records)
  ) {
    return false;
  }

  if (value.intelligence === null) return true;
  if (!isRecord(value.intelligence)) return false;

  const { intelligence } = value;
  if (
    typeof intelligence.trendTitle !== "string" ||
    typeof intelligence.trendUnit !== "string" ||
    typeof intelligence.forecastMethod !== "string" ||
    !Array.isArray(intelligence.trend) ||
    !Array.isArray(intelligence.forecast) ||
    !Array.isArray(intelligence.alerts) ||
    !isRecord(intelligence.provenance) ||
    !Array.isArray(intelligence.provenance.notes)
  ) {
    return false;
  }

  return true;
}

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId: taskIdParam } = await context.params;
  if (!/^[1-8]$/.test(taskIdParam)) {
    return NextResponse.json({ error: "Nhiệm vụ không tồn tại." }, { status: 404 });
  }

  const taskId = Number(taskIdParam);
  const config = MISSION_REPORTS[taskId];
  if (!config) {
    return NextResponse.json({ error: "Nhiệm vụ không tồn tại." }, { status: 404 });
  }

  try {
    // KPI, nhận định và nguồn dữ liệu phải được làm mới phía máy chủ. Nội dung do
    // trình duyệt gửi lên không được dùng để tạo văn bản mang đầu Sở Công Thương.
    const summaryResponse = await getMissionSummary(request, {
      params: Promise.resolve({ taskId: taskIdParam }),
    });
    if (!summaryResponse.ok) {
      return NextResponse.json({ error: "Không thể tổng hợp dữ liệu nhiệm vụ." }, { status: 502 });
    }
    const summary: unknown = await summaryResponse.json();
    if (!isMissionSummary(summary, taskId)) {
      return NextResponse.json(
        { error: "Dữ liệu tổng hợp phía máy chủ không hợp lệ." },
        { status: 500 },
      );
    }

    const pdf = await renderMissionReportPdf(summary, config);
    const filename = missionReportFilename(taskId);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Content-Type": "application/pdf",
        "X-Report-Data-Source": "server-database",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`Cannot render mission ${taskId} report`, error);
    return NextResponse.json({ error: "Không thể tạo báo cáo PDF." }, { status: 500 });
  }
}
