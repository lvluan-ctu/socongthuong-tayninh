import type {
  MissionReportConfig,
  MissionReportInsights,
  MissionSummary,
} from "@/lib/mission-report-types";

export function formatMissionValue(value: number, unit?: string) {
  const formatted = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: Math.abs(value) >= 1_000 ? 0 : 2,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function buildMissionReportInsights(
  data: MissionSummary,
  config: MissionReportConfig,
): MissionReportInsights {
  const breakdown = data.breakdown.filter((item) => Number.isFinite(item.value));
  const totalBreakdown = breakdown.reduce((sum, item) => sum + item.value, 0);
  const top = breakdown.toSorted((a, b) => b.value - a.value)[0] ?? null;
  const topBreakdown = top
    ? {
        ...top,
        sharePct: totalBreakdown > 0 ? (top.value / totalBreakdown) * 100 : 0,
      }
    : null;

  const trend = (data.intelligence?.trend ?? []).filter(
    (item) => !/SNAPSHOT|PARTIAL|TẠM/i.test(item.period),
  );
  const firstActual = trend[0]?.value;
  const latestActual = trend.at(-1)?.value ?? null;
  const trendDeltaPct =
    firstActual != null && latestActual != null && Math.abs(firstActual) > 0
      ? ((latestActual - firstActual) / Math.abs(firstActual)) * 100
      : null;
  const trendDirection =
    trendDeltaPct == null
      ? "insufficient"
      : trendDeltaPct > 1
        ? "increase"
        : trendDeltaPct < -1
          ? "decrease"
          : "stable";

  const forecastValues = (data.intelligence?.forecast ?? []).map((item) => item.value);
  const forecastPeak = forecastValues.length ? Math.max(...forecastValues) : null;
  const forecastAverage = forecastValues.length
    ? forecastValues.reduce((sum, value) => sum + value, 0) / forecastValues.length
    : null;
  const alerts = data.intelligence?.alerts ?? [];
  const dangerCount = alerts.filter((alert) => alert.severity === "danger").length;
  const warningCount = alerts.filter((alert) => alert.severity === "warning").length;
  const infoCount = Math.max(0, alerts.length - dangerCount - warningCount);
  const provenance = data.intelligence?.provenance;
  const sourceRecords = provenance?.sourceRecords ?? data.records.length;
  const inferredRecords = provenance?.inferredRecords ?? 0;
  const dataConfidence =
    inferredRecords === 0 && sourceRecords > 0
      ? "high"
      : sourceRecords === 0 || inferredRecords >= sourceRecords
        ? "scenario"
        : "medium";
  const dataConfidenceLabel =
    dataConfidence === "high"
      ? "Dữ liệu nguồn chiếm ưu thế"
      : dataConfidence === "medium"
        ? "Dữ liệu hỗn hợp, cần đối soát"
        : "Kịch bản minh họa, chưa dùng phát hành chính thức";

  const executiveFindings: string[] = [];
  if (data.coverageStatus === "EMPTY") {
    executiveFindings.push(
      `Nhiệm vụ ${config.missionTitle} chưa có đủ bản ghi nguồn để lập nhận định điều hành.`,
    );
  }
  if (topBreakdown) {
    executiveFindings.push(
      `Nhóm “${topBreakdown.name}” đang chiếm ${topBreakdown.sharePct.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% cơ cấu dữ liệu được tổng hợp.`,
    );
  }
  if (trendDeltaPct != null) {
    const verb =
      trendDirection === "increase" ? "tăng" : trendDirection === "decrease" ? "giảm" : "ổn định";
    executiveFindings.push(
      `Chỉ tiêu chuỗi kỳ ${verb} ${Math.abs(trendDeltaPct).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% từ kỳ đầu đến kỳ gần nhất.`,
    );
  } else {
    executiveFindings.push(
      "Chuỗi dữ liệu hiện chưa đủ độ dài để kết luận chắc chắn về tốc độ biến động.",
    );
  }
  executiveFindings.push(
    dangerCount || warningCount
      ? `Hệ thống ghi nhận ${dangerCount} cảnh báo khẩn cấp và ${warningCount} cảnh báo cần theo dõi, kèm đối tượng và kiến nghị xử lý.`
      : "Chưa ghi nhận cảnh báo mức khẩn cấp trong tập dữ liệu báo cáo hiện tại.",
  );
  executiveFindings.push(
    `${dataConfidenceLabel}: ${sourceRecords.toLocaleString("vi-VN")} bản ghi có nguồn đối soát, ${inferredRecords.toLocaleString("vi-VN")} bản ghi/trường có yếu tố suy diễn hoặc kịch bản và ${(provenance?.observations ?? 0).toLocaleString("vi-VN")} quan sát; các nhóm chất lượng có thể giao nhau nên không cộng thành tổng.`,
  );

  return {
    topBreakdown,
    totalBreakdown,
    latestActual,
    trendDeltaPct,
    trendDirection,
    forecastPeak,
    forecastAverage,
    dangerCount,
    warningCount,
    infoCount,
    dataConfidence,
    dataConfidenceLabel,
    executiveFindings,
  };
}
