import 'server-only';

import { randomUUID } from 'node:crypto';
import type { MissionAiAlert, MissionAiConfig, MissionAiForecastPoint, MissionAiResult, MissionAiScenario } from '@/lib/mission-ai';

export type MissionSummary = {
  title: string;
  updatedAt: string;
  kpis: Array<{ label: string; value: number; unit?: string }>;
  records?: Array<{ code: string; metric: string }>;
  intelligence: null | {
    trendTitle: string;
    trendUnit: string;
    trend: Array<{ period: string; value: number }>;
    alerts: Array<{ title: string; severity: string; message: string; recommendation: string; metric: string }>;
    provenance: { sourceRecords: number; inferredRecords: number; observations: number; notes: string[] };
  };
};

export type MissionAiRequest = {
  queryType: string;
  horizon: number;
  confidence: number;
  scenario: MissionAiScenario;
  prompt: string;
};

const DEFAULT_ENDPOINTS: Record<number, string> = {
  1: '/mission1/overload/predict',
  2: '/mission2/solar/forecast',
  3: '/mission3/solar-rooftop/recommend',
  4: '/mission4/reports/validate',
  5: '/mission5/inspection/analyze',
  6: '/mission6/emissions/analyze',
  7: '/mission7/charging/forecast',
  8: '/mission_oilgas/oilgas/forecast',
};

const DEFAULT_MISSION_2_ENDPOINTS: Record<string, string> = {
  same_period_forecast: '/mission2/solar/forecast/same-period',
  demand_forecast: '/mission2/demand/forecast',
  supply_alert: '/mission2/supply/alert',
};

const DEFAULT_HISTORY_ENDPOINT = '/mission_oilgas/oilgas/history';

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  return value == null || value === '' ? fallback : value === 'true';
}

export function getMissionAiRuntime(taskId: number) {
  const endpoint = process.env[`AI_MISSION_${taskId}_ENDPOINT`]?.trim() || DEFAULT_ENDPOINTS[taskId];
  return {
    enabled: boolEnv('AI_SERVICE_ENABLED', true),
    mock: boolEnv('AI_SERVICE_MOCK', true),
    baseUrl: (process.env.AI_SERVICE_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, ''),
    apiVersion: (process.env.AI_SERVICE_API_VERSION ?? 'v1').replace(/^\/+|\/+$/g, ''),
    apiKey: process.env.AI_SERVICE_API_KEY?.trim() || null,
    authType: process.env.AI_SERVICE_AUTH_TYPE === 'x-api-key' ? 'x-api-key' as const : 'bearer' as const,
    timeoutMs: Math.max(1_000, Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 60_000)),
    retryCount: Math.max(0, Math.min(5, Number(process.env.AI_SERVICE_RETRY_COUNT ?? 2))),
    endpoint,
    historyEndpoint: process.env.AI_MISSION_8_HISTORY_ENDPOINT?.trim() || DEFAULT_HISTORY_ENDPOINT,
    // Nhiệm vụ 5 dùng adapter multipart chuyên biệt tại /api/safety/ai-vision/analyze.
    externalCompatible: taskId !== 5 || endpoint !== DEFAULT_ENDPOINTS[taskId],
  };
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildForecast(source: Array<{ period: string; value: number }>, request: MissionAiRequest) {
  const history = source.filter((item) => Number.isFinite(item.value)).slice(-12);
  const values = history.map((item) => item.value);
  const n = values.length;
  const current = values.at(-1) ?? 0;
  const xMean = n > 0 ? (n - 1) / 2 : 0;
  const yMean = n > 0 ? values.reduce((sum, value) => sum + value, 0) / n : 0;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  const slope = denominator ? numerator / denominator : 0;
  const residual = n > 1
    ? Math.sqrt(values.reduce((sum, value, index) => sum + (value - (yMean + slope * (index - xMean))) ** 2, 0) / n)
    : Math.max(1, Math.abs(current) * 0.08);
  const scenarioFactor = request.scenario === 'growth' ? 1.08 : request.scenario === 'efficiency' ? 0.95 : 1;
  const confidenceFactor = request.confidence >= 95 ? 1.96 : request.confidence >= 90 ? 1.64 : 1.28;
  const series: MissionAiForecastPoint[] = history.map((item) => ({
    period: item.period, actual: round(item.value), forecast: null, min: null, max: null,
  }));
  const forecastValues: number[] = [];
  for (let index = 1; index <= request.horizon; index += 1) {
    const estimate = Math.max(0, (yMean + slope * (n + index - 1 - xMean)) * scenarioFactor);
    const uncertainty = residual * confidenceFactor * Math.sqrt(1 + index / Math.max(1, n));
    forecastValues.push(estimate);
    series.push({
      period: `D+${index}`,
      actual: null,
      forecast: round(estimate),
      min: round(Math.max(0, estimate - uncertainty)),
      max: round(estimate + uncertainty),
    });
  }
  return { series, current, final: forecastValues.at(-1) ?? current, slope, residual, historyCount: n };
}

function normalizeAlerts(summary: MissionSummary): MissionAiAlert[] {
  return (summary.intelligence?.alerts ?? []).slice(0, 8).map((item) => ({
    title: item.title,
    severity: item.severity === 'danger' || item.severity === 'warning' ? item.severity : 'info',
    message: item.message,
    recommendation: item.recommendation,
    metric: item.metric,
  }));
}

function normalizeMission2ForecastResult(raw: unknown, fallback: MissionAiResult, requestId: string, request: MissionAiRequest): MissionAiResult {
  const root = object(raw) ?? {};
  const payload = object(root.result) ?? root;
  const points = Array.isArray(payload.points) ? payload.points : [];
  const queryType = request.queryType;
  const series: MissionAiForecastPoint[] = points.flatMap((entry) => {
    const row = object(entry);
    if (!row) return [];
    const period = textValue(row.period_label, textValue(row.timestamp, '—'));
    if (queryType === 'same_period_forecast') {
      const historical = numericValue(row.historical_generation_mwh);
      const predicted = numericValue(row.predicted_generation_mwh);
      return [{ period, actual: historical, forecast: predicted, min: round(predicted * 0.9), max: round(predicted * 1.1) }];
    }
    if (queryType === 'demand_forecast') {
      const historical = numericValue(row.historical_consumption_kwh ?? row.historical_consumption_mwh);
      const predicted = numericValue(row.predicted_demand_kwh ?? row.predicted_demand_mwh);
      return [{ period, actual: historical, forecast: predicted, min: round(predicted * 0.9), max: round(predicted * 1.1) }];
    }
    const demand = numericValue(row.forecasted_demand_mw);
    const available = numericValue(row.available_supply_mw);
    return [{ period, actual: available, forecast: demand, min: Math.max(0, round(demand - numericValue(row.deficit_mw))), max: available }];
  });
  const first = object(points[0]);
  const last = object(points.at(-1));
  const current = queryType === 'same_period_forecast'
    ? numericValue(first?.historical_generation_mwh)
    : queryType === 'demand_forecast'
      ? numericValue(first?.historical_consumption_kwh ?? first?.historical_consumption_mwh)
      : numericValue(first?.available_supply_mw);
  const final = queryType === 'same_period_forecast'
    ? numericValue(last?.predicted_generation_mwh)
    : queryType === 'demand_forecast'
      ? numericValue(last?.predicted_demand_kwh ?? last?.predicted_demand_mwh)
      : numericValue(last?.forecasted_demand_mw);
  const changePct = current ? round((final - current) / Math.abs(current) * 100) : 0;
  const total = queryType === 'same_period_forecast'
    ? numericValue(payload.total_predicted_mwh)
    : queryType === 'demand_forecast'
      ? numericValue(payload.total_predicted_demand_kwh ?? payload.total_predicted_demand_mwh)
      : final;
  const demandUnit = payload.total_predicted_demand_kwh != null || object(points[0])?.predicted_demand_kwh != null ? 'kWh' : 'MWh';
  const growth = numericValue(payload.growth_pct, changePct);
  const riskLevel = textValue(payload.overall_risk_level, 'Thấp');
  const isSupplyRisk = queryType === 'supply_alert' && ['Cao', 'Nghiêm trọng', 'HIGH', 'CRITICAL'].includes(riskLevel);
  const title = queryType === 'same_period_forecast'
    ? 'Dự báo sản lượng điện cùng kỳ'
    : queryType === 'demand_forecast'
      ? 'Dự báo nhu cầu điện khách hàng'
      : 'Cảnh báo cấp điện và đề xuất';
  const subject = textValue(payload.plant_id, textValue(payload.customer_id, textValue(payload.area_id, 'Đối tượng phân tích')));
  const headline = queryType === 'supply_alert'
    ? `${subject}: mức rủi ro cấp điện ${riskLevel}, nhu cầu kỳ cuối ${final.toLocaleString('vi-VN')} MW.`
    : `${subject}: ${title.toLowerCase()} ${total.toLocaleString('vi-VN')} ${queryType === 'demand_forecast' ? demandUnit : 'MWh'}, biến động ${growth.toLocaleString('vi-VN')}%.`;
  const recommendations = Array.isArray(payload.recommendations) ? payload.recommendations.map(String).filter(Boolean) : [];
  const alert: MissionAiAlert = {
    title: queryType === 'supply_alert' ? `Rủi ro cấp điện: ${riskLevel}` : 'Kết quả dự báo AI',
    severity: isSupplyRisk ? 'danger' : queryType === 'supply_alert' && riskLevel !== 'Thấp' ? 'warning' : 'info',
    message: queryType === 'supply_alert' ? `API ghi nhận ${points.filter((entry) => numericValue(object(entry)?.deficit_mw) > 0).length} thời điểm có nguy cơ thiếu công suất.` : headline,
    recommendation: recommendations[0] ?? 'Theo dõi sai số dự báo và đối soát dữ liệu vận hành trước khi quyết định.',
    metric: queryType === 'supply_alert' ? riskLevel : `${growth.toLocaleString('vi-VN')}%`,
  };
  const report = reportLines(title, [
    `**Kết luận:** ${headline}`,
    '',
    `- Đối tượng: ${subject}`,
    `- Số điểm dữ liệu: ${points.length}.`,
    `- Giá trị gần nhất: ${current.toLocaleString('vi-VN')} ${queryType === 'supply_alert' ? 'MW' : queryType === 'demand_forecast' ? demandUnit : 'MWh'}.`,
    `- Giá trị dự báo cuối kỳ: ${final.toLocaleString('vi-VN')} ${queryType === 'supply_alert' ? 'MW' : queryType === 'demand_forecast' ? demandUnit : 'MWh'}.`,
    queryType === 'same_period_forecast' ? `- Tăng trưởng so với cùng kỳ: ${growth.toLocaleString('vi-VN')}%.` : null,
    queryType === 'supply_alert' ? `- Mức rủi ro tổng thể: ${riskLevel}.` : null,
    '',
    '## Khuyến nghị',
    ...(recommendations.length ? recommendations.map((item) => `- ${item}`) : [`- ${alert.recommendation}`]),
  ]);
  return {
    ...fallback,
    requestId: String(payload.requestId ?? root.requestId ?? requestId),
    generatedAt: String(payload.generatedAt ?? new Date().toISOString()),
    mode: 'EXTERNAL',
    model: { name: 'mission2-forecast', version: '1.0.0' },
    metricTitle: queryType === 'supply_alert' ? 'Nhu cầu và khả năng cấp điện' : queryType === 'demand_forecast' ? 'Nhu cầu điện dự báo' : 'Sản lượng điện mặt trời',
    unit: queryType === 'supply_alert' ? 'MW' : queryType === 'demand_forecast' ? demandUnit : 'MWh',
    summary: { ...fallback.summary, headline, currentValue: current, forecastValue: final, changePct: queryType === 'same_period_forecast' ? growth : changePct, riskCount: isSupplyRisk ? 1 : 0, report },
    series: series.length ? series : fallback.series,
    alerts: [alert],
    recommendations: [...recommendations, alert.recommendation].slice(0, 6),
  };
}

function localResult(config: MissionAiConfig, summary: MissionSummary, request: MissionAiRequest, requestId: string): MissionAiResult {
  const intelligence = summary.intelligence;
  const forecast = buildForecast(intelligence?.trend ?? [], request);
  const changePct = forecast.current ? (forecast.final - forecast.current) / Math.abs(forecast.current) * 100 : 0;
  const alerts = normalizeAlerts(summary);
  const queryLabel = config.queryTypes.find((item) => item.value === request.queryType)?.label ?? 'Phân tích AI';
  const direction = changePct > 1 ? 'tăng' : changePct < -1 ? 'giảm' : 'ổn định';
  const recommendations = Array.from(new Set([
    ...alerts.map((item) => item.recommendation).filter(Boolean),
    `Theo dõi lại ${config.metricTitle.toLowerCase()} sau mỗi kỳ cập nhật dữ liệu và đánh giá sai số dự báo.`,
    `Ưu tiên kiểm tra ${alerts.filter((item) => item.severity === 'danger').length || 'các'} trường hợp rủi ro cao trước khi ra quyết định vận hành.`,
  ])).slice(0, 6);
  const provenance = intelligence?.provenance ?? { sourceRecords: 0, inferredRecords: 0, observations: 0, notes: [] };
  const headline = `${queryLabel}: ${config.metricTitle} dự kiến ${direction} ${Math.abs(changePct).toFixed(1)}% sau ${request.horizon} kỳ.`;
  const report = [
    `# Báo cáo ${config.title}`,
    '',
    `**Kết luận:** ${headline}`,
    '',
    `- Dữ liệu đầu vào: ${forecast.historyCount} kỳ chuỗi thời gian, ${provenance.observations.toLocaleString('vi-VN')} quan sát nghiệp vụ.`,
    `- Giá trị gần nhất: ${round(forecast.current).toLocaleString('vi-VN')} ${config.unit}.`,
    `- Giá trị cuối kỳ dự báo: ${round(forecast.final).toLocaleString('vi-VN')} ${config.unit}.`,
    `- Mức tin cậy yêu cầu: ${request.confidence}%; kịch bản: ${request.scenario}.`,
    `- Số cảnh báo được đưa vào phân tích: ${alerts.length}.`,
    '',
    '## Khuyến nghị',
    ...recommendations.map((item) => `- ${item}`),
    '',
    '## Lưu ý dữ liệu',
    ...(provenance.notes.length ? provenance.notes.map((item) => `- ${item}`) : ['- Chưa có ghi chú nguồn dữ liệu.']),
    '',
    `**Yêu cầu người dùng:** ${request.prompt}`,
  ].join('\n');

  return {
    requestId,
    generatedAt: new Date().toISOString(),
    dataCutoff: summary.updatedAt,
    mode: 'MOCK',
    model: { name: 'energy-local-forecast', version: '2.0' },
    horizon: request.horizon,
    confidence: request.confidence,
    metricTitle: config.metricTitle,
    unit: intelligence?.trendUnit || config.unit,
    summary: { headline, currentValue: round(forecast.current), forecastValue: round(forecast.final), changePct: round(changePct), riskCount: alerts.filter((item) => item.severity !== 'info').length, report },
    series: forecast.series,
    alerts,
    recommendations,
    provenance,
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numericValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseVietnameseNumber(value: string | undefined) {
  const normalized = String(value ?? '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function reportLines(title: string, lines: Array<string | null | undefined>) {
  return [`# ${title}`, '', ...lines.filter((line): line is string => Boolean(line))].join('\n');
}

function normalizeExternalResult(raw: unknown, fallback: MissionAiResult, requestId: string, config: MissionAiConfig, request: MissionAiRequest): MissionAiResult {
  if (config.taskId === 2 && request.queryType !== 'generation_forecast') return normalizeMission2ForecastResult(raw, fallback, requestId, request);
  const root = object(raw) ?? {};
  const payload = object(root.result) ?? root;
  const summary = object(payload.summary);
  const model = object(payload.model);
  const seriesCandidate = Array.isArray(payload.series) ? payload.series : Array.isArray(payload.forecast) ? payload.forecast : [];
  const normalizedSeries = seriesCandidate.flatMap((entry, index) => {
    const row = object(entry);
    if (!row) return [];
    const forecast = Number(row.forecast ?? row.predicted ?? row.value ?? row.load_mva ?? row.predicted_generation_mw ?? row.energy_kwh);
    if (!Number.isFinite(forecast)) return [];
    const actual = Number(row.actual);
    const min = Number(row.min ?? row.lower ?? row.lowerBound);
    const max = Number(row.max ?? row.upper ?? row.upperBound);
    return [{
      period: String(row.period ?? row.timestamp ?? `D+${index + 1}`),
      actual: Number.isFinite(actual) ? actual : null,
      forecast,
      min: Number.isFinite(min) ? min : round(forecast * 0.9),
      max: Number.isFinite(max) ? max : round(forecast * 1.1),
    }];
  });
  const conclusion = object(payload.conclusion);
  const findings = Array.isArray(payload.findings) ? payload.findings.map(String) : [];
  const providerHeadline = String(summary?.headline ?? summary?.message ?? payload.headline ?? payload.message ?? conclusion?.message ?? (findings[0] || fallback.summary.headline));
  let providerReport = [fallback.summary.report, '', '## Kết quả bổ sung từ AI Service', `- ${providerHeadline}`, ...findings.slice(1).map((item) => `- ${item}`)].join('\n');
  const externalSeries = normalizedSeries.length ? normalizedSeries : fallback.series;
  const externalFinal = normalizedSeries.at(-1)?.forecast;
  const providerCurrent = Number(payload.current_load_mva ?? normalizedSeries[0]?.forecast);
  const externalCurrent = Number.isFinite(providerCurrent) ? providerCurrent : fallback.summary.currentValue;
  const externalUnit = config.taskId === 1 ? 'MVA' : config.taskId === 2 ? 'MW' : config.taskId === 7 ? 'kWh' : fallback.unit;
  const externalMetricTitle = config.taskId === 1 ? 'Phụ tải máy biến áp' : config.taskId === 2 ? 'Công suất phát dự báo' : fallback.metricTitle;
  const externalChangePct = externalFinal != null && externalCurrent
    ? round((externalFinal - externalCurrent) / Math.abs(externalCurrent) * 100)
    : fallback.summary.changePct;
  const modelName = typeof payload.model === 'string' ? payload.model : String(model?.name ?? payload.modelName ?? 'Hệ thống gơi ý AI');
  const result: MissionAiResult = {
    ...fallback,
    requestId: String(payload.requestId ?? root.requestId ?? requestId),
    generatedAt: String(payload.generatedAt ?? new Date().toISOString()),
    mode: 'EXTERNAL',
    model: {
      name: modelName,
      version: String(model?.version ?? payload.modelVersion ?? ''),
    },
    summary: {
      ...fallback.summary,
      headline: providerHeadline,
      currentValue: externalCurrent,
      forecastValue: externalFinal ?? fallback.summary.forecastValue,
      changePct: externalChangePct,
      report: providerReport,
    },
    series: externalSeries,
    metricTitle: externalMetricTitle,
    unit: externalUnit,
    recommendations: findings.length ? Array.from(new Set([...findings, ...fallback.recommendations])).slice(0, 6) : fallback.recommendations,
  };

  if (config.taskId === 1) {
    const current = numericValue(payload.current_load_mva, result.summary.currentValue);
    const peak = numericValue(payload.peak_forecast_mva, result.summary.forecastValue);
    const peakPct = numericValue(payload.peak_forecast_pct);
    const risk = textValue(payload.risk_level, 'UNKNOWN');
    const rawMessage = textValue(payload.message, providerHeadline);
    const message = risk === 'HIGH'
      ? 'Dự báo máy biến áp có khả năng quá tải trong chân trời phân tích.'
      : risk === 'MEDIUM'
        ? 'Phụ tải tiến gần ngưỡng cảnh báo, cần theo dõi sát theo giờ.'
        : rawMessage === 'Load within safe operating range'
          ? 'Phụ tải đang nằm trong vùng vận hành an toàn.'
          : rawMessage;
    const alert: MissionAiAlert = {
      title: `Mức rủi ro ${risk}`,
      severity: risk === 'HIGH' ? 'danger' : risk === 'MEDIUM' ? 'warning' : 'info',
      message,
      recommendation: risk === 'HIGH' ? 'Rà soát phương thức vận hành và san tải trước giờ cực đại dự báo.' : 'Tiếp tục theo dõi đường cong phụ tải theo giờ.',
      metric: `${peakPct.toFixed(1)}% công suất`,
    };
    providerReport = reportLines('Dự báo quá tải máy biến áp', [
      `**Kết luận:** ${message}`,
      '',
      `- Trạm: ${textValue(payload.substation_id, '—')}`,
      `- Phụ tải hiện tại: ${current.toLocaleString('vi-VN')} MVA`,
      `- Cực đại dự báo: ${peak.toLocaleString('vi-VN')} MVA (${peakPct.toLocaleString('vi-VN')}%)`,
      `- Nguồn dữ liệu: ${textValue(payload.data_source, 'AI Service')}`,
      `- Dữ liệu đến: ${textValue(payload.data_as_of, fallback.dataCutoff)}`,
      '',
      '## Khuyến nghị',
      `- ${alert.recommendation}`,
    ]);
    Object.assign(result, { metricTitle: 'Phụ tải máy biến áp', unit: 'MVA', alerts: [alert, ...result.alerts].slice(0, 8) });
    Object.assign(result.summary, { headline: message, currentValue: current, forecastValue: peak, changePct: current ? round((peak - current) / current * 100) : 0, riskCount: risk === 'LOW' ? 0 : 1, report: providerReport });
  }

  if (config.taskId === 2) {
    const plant = object(payload.plant_info) ?? {};
    const values = result.series.map((point) => point.forecast ?? 0);
    const peak = Math.max(0, ...values);
    const daily = numericValue(payload.predicted_daily_generation_mwh);
    const name = textValue(plant.project_name, textValue(payload.plant_id, 'Nhà máy điện mặt trời'));
    const headline = `${name}: dự kiến ${daily.toLocaleString('vi-VN')} MWh trong kỳ dự báo, công suất cực đại ${peak.toLocaleString('vi-VN')} MW.`;
    providerReport = reportLines('Dự báo nguồn năng lượng tái tạo', [
      `**Kết luận:** ${headline}`,
      '',
      `- Địa điểm: ${textValue(plant.location, '—')}`,
      `- Công suất thiết kế: ${numericValue(plant.design_capacity_mwp).toLocaleString('vi-VN')} MWp`,
      `- Trạng thái: ${textValue(plant.status, '—')}`,
      `- Chủ đầu tư: ${textValue(plant.investor, '—')}`,
      '',
      '## Khuyến nghị',
      '- Theo dõi sai số dự báo theo giờ và ưu tiên điều độ/bảo trì ngoài khung công suất cực đại.',
    ]);
    Object.assign(result, { metricTitle: 'Công suất phát điện mặt trời', unit: 'MW' });
    Object.assign(result.summary, { headline, currentValue: result.series[0]?.forecast ?? 0, forecastValue: peak, changePct: 0, report: providerReport });
  }

  if (config.taskId === 3) {
    const customer = object(payload.customer) ?? {};
    const site = object(payload.site) ?? {};
    const recommendation = object(payload.recommendation) ?? {};
    const grid = object(payload.grid) ?? {};
    const monthlyUse = numericValue(customer.monthly_consumption_kwh);
    const monthlyGeneration = numericValue(recommendation.monthly_generation_kwh);
    const capacity = numericValue(recommendation.capacity_kwp);
    const conclusionMessage = textValue(conclusion?.message, textValue(payload.ai_analysis_result, providerHeadline));
    const analysis = textValue(payload.ai_analysis_result);
    result.series = [
      { period: 'Điện tiêu thụ', actual: monthlyUse, forecast: null, min: null, max: null },
      { period: 'ĐMT dự kiến', actual: null, forecast: monthlyGeneration, min: round(monthlyGeneration * 0.9), max: round(monthlyGeneration * 1.1) },
    ];
    providerReport = reportLines('Tư vấn điện mặt trời mái nhà', [
      `**Kết luận:** ${conclusionMessage}`,
      '',
      `- Khách hàng: ${textValue(customer.name, textValue(customer.customer_id, '—'))}`,
      `- Diện tích mái: ${numericValue(site.roof_area_m2).toLocaleString('vi-VN')} m²`,
      `- Công suất đề xuất: ${capacity.toLocaleString('vi-VN')} kWp`,
      `- Sản lượng dự kiến: ${monthlyGeneration.toLocaleString('vi-VN')} kWh/tháng`,
      `- Khả năng tự dùng: ${numericValue(recommendation.self_consumption_pct).toLocaleString('vi-VN')}%`,
      `- Trạm đấu nối: ${textValue(grid.transformer_name, '—')}; công suất còn lại ${numericValue(grid.remaining_capacity_kva).toLocaleString('vi-VN')} kVA`,
      '',
      '## Phân tích AI',
      analysis || '- Chưa có diễn giải bổ sung.',
    ]);
    Object.assign(result, { metricTitle: 'Cân bằng điện năng mái nhà', unit: 'kWh/tháng', recommendations: [conclusionMessage, ...result.recommendations].slice(0, 6) });
    Object.assign(result.summary, { headline: conclusionMessage, currentValue: monthlyUse, forecastValue: monthlyGeneration, changePct: monthlyUse ? round(monthlyGeneration / monthlyUse * 100) : 0, report: providerReport });
  }

  if (config.taskId === 4) {
    const reported = numericValue(payload.reported_toe);
    const evn = numericValue(payload.evn_calculated_toe);
    const difference = numericValue(payload.difference_toe);
    const differencePct = numericValue(payload.difference_pct);
    const status = textValue(payload.status, 'CHUA_XAC_DINH');
    const message = textValue(payload.message, providerHeadline);
    result.series = [
      { period: 'CSDL EVN', actual: evn, forecast: null, min: null, max: null },
      { period: 'Cơ sở báo cáo', actual: null, forecast: reported, min: null, max: null },
    ];
    const alert: MissionAiAlert = { title: status === 'DAT' ? 'Số liệu phù hợp' : 'Chênh lệch cần xác minh', severity: status === 'DAT' ? 'info' : 'danger', message, recommendation: status === 'DAT' ? 'Lưu kết quả đối soát và tiếp tục quy trình phê duyệt.' : 'Đối chiếu điểm đo, kỳ chốt số và hồ sơ quy đổi trước khi phê duyệt.', metric: `${differencePct.toLocaleString('vi-VN')}%` };
    providerReport = reportLines('Đối soát báo cáo sử dụng năng lượng', [
      `**Kết luận:** ${message}`,
      '',
      `- Mã số thuế/cơ sở: ${textValue(payload.tax_code_or_name, '—')}`,
      `- Năm báo cáo: ${numericValue(payload.year).toFixed(0)}`,
      `- Cơ sở khai báo: ${reported.toLocaleString('vi-VN')} TOE`,
      `- EVN quy đổi: ${evn.toLocaleString('vi-VN')} TOE từ ${numericValue(payload.facility_count).toFixed(0)} điểm đo/mã khách hàng`,
      `- Chênh lệch: ${difference.toLocaleString('vi-VN')} TOE (${differencePct.toLocaleString('vi-VN')}%)`,
      '',
      '## Khuyến nghị',
      `- ${alert.recommendation}`,
    ]);
    Object.assign(result, { metricTitle: 'Đối soát năng lượng quy đổi', unit: 'TOE', alerts: [alert] });
    Object.assign(result.summary, { headline: message, currentValue: evn, forecastValue: reported, changePct: differencePct, riskCount: status === 'DAT' ? 0 : 1, report: providerReport });
  }

  if (config.taskId === 6) {
    const summaryText = textValue(payload.tom_tat, providerHeadline);
    const totalMatch = summaryText.match(/phát thải tổng cộng\s+([\d.,]+)/i);
    const scope1Match = summaryText.match(/Phạm vi 1 chỉ đóng góp\s+([\d.,]+)/i);
    const scope2Match = summaryText.match(/Phạm vi 2[^.]*?với\s+([\d.,]+)\s*tCO2e/i);
    const total = parseVietnameseNumber(totalMatch?.[1]);
    const scope1 = parseVietnameseNumber(scope1Match?.[1]);
    const scope2 = parseVietnameseNumber(scope2Match?.[1]);
    if (scope1 || scope2) {
      result.series = [
        { period: 'Phạm vi 1', actual: scope1, forecast: null, min: null, max: null },
        { period: 'Phạm vi 2', actual: scope2, forecast: null, min: null, max: null },
      ];
    }
    const headline = summaryText.split(/(?<=[.!?])\s/)[0] || summaryText;
    const attention = textValue(payload.diem_dang_chu_y);
    const anomaly = textValue(payload.bat_thuong);
    providerReport = reportLines('Phân tích phát thải khí nhà kính', [
      `**Kết luận:** ${headline}`,
      '',
      `- Doanh nghiệp: ${textValue(payload.company_name, '—')}`,
      `- Nguồn phát thải chính: ${textValue(payload.nguon_phat_thai_chinh, '—')}`,
      `- Phạm vi: ${textValue(payload.pham_vi_phat_thai, '—')}`,
      `- Tỷ trọng: ${textValue(payload.cuong_do_ty_trong, '—')}`,
      `- Bất thường: ${anomaly || 'Không có thông tin'}`,
      `- Điểm đáng chú ý: ${attention || 'Không có thông tin'}`,
      '',
      '## Diễn giải AI',
      summaryText,
    ]);
    Object.assign(result, { metricTitle: 'Cơ cấu phát thải theo phạm vi', unit: 'tCO₂e', recommendations: [textValue(payload.nguon_phat_thai_chinh), attention, ...result.recommendations].filter(Boolean).slice(0, 6) });
    Object.assign(result.summary, { headline, currentValue: total || scope1 + scope2, forecastValue: scope2, changePct: total ? round(scope2 / total * 100) : 0, report: providerReport });
  }

  if (config.taskId === 7) {
    const forecast = Array.isArray(payload.forecast) ? payload.forecast : [];
    const sessions = forecast.map((entry) => numericValue(object(entry)?.sessions));
    const energies = forecast.map((entry) => numericValue(object(entry)?.energy_kwh));
    const peakEnergy = Math.max(0, ...energies);
    const totalEnergy = energies.reduce((sum, value) => sum + value, 0);
    const peak = object(payload.peak) ?? {};
    const status = textValue(payload.status, 'NORMAL');
    const headline = `${textValue(payload.station_id, 'Trạm sạc')}: ${status === 'HIGH_DEMAND' ? 'nhu cầu cao' : 'nhu cầu ổn định'}, cực đại ${numericValue(peak.sessions, Math.max(0, ...sessions))} lượt lúc ${textValue(peak.time, '—')}.`;
    providerReport = reportLines('Dự báo nhu cầu sạc xe điện', [
      `**Kết luận:** ${headline}`,
      '',
      `- Tổng điện năng kỳ dự báo: ${totalEnergy.toLocaleString('vi-VN')} kWh`,
      `- Điện năng cực đại theo giờ: ${peakEnergy.toLocaleString('vi-VN')} kWh`,
      `- Số lượt cực đại: ${numericValue(peak.sessions, Math.max(0, ...sessions))} lượt`,
      '',
      '## Khuyến nghị',
      '- Điều phối công suất và kiểm tra khả dụng đầu sạc trước các khung giờ nhu cầu cao.',
    ]);
    Object.assign(result, { metricTitle: 'Nhu cầu điện tại trạm sạc', unit: 'kWh' });
    Object.assign(result.summary, { headline, currentValue: energies[0] ?? 0, forecastValue: peakEnergy, changePct: energies[0] ? round((peakEnergy - energies[0]) / energies[0] * 100) : 0, riskCount: status === 'HIGH_DEMAND' ? 1 : 0, report: providerReport });
  }

  return result;
}

function normalizeOilGasResult(
  historyRaw: unknown,
  forecastRaw: unknown,
  fallback: MissionAiResult,
  requestId: string,
): MissionAiResult {
  const historyRoot = object(historyRaw) ?? {};
  const forecastRoot = object(forecastRaw) ?? {};
  const history = Array.isArray(historyRoot.data) ? historyRoot.data : [];
  const forecast = Array.isArray(forecastRoot.forecast) ? forecastRoot.forecast : [];
  const series: MissionAiResult['series'] = [
    ...history.flatMap((entry) => {
      const row = object(entry);
      const value = Number(row?.actual_generation_mw);
      return row && Number.isFinite(value)
        ? [{ period: textValue(row.timestamp, '—'), actual: value, forecast: null, min: null, max: null }]
        : [];
    }),
    ...forecast.flatMap((entry) => {
      const row = object(entry);
      const value = Number(row?.predicted_generation_mw);
      return row && Number.isFinite(value)
        ? [{ period: textValue(row.timestamp, '—'), actual: null, forecast: value, min: round(value * 0.9), max: round(value * 1.1) }]
        : [];
    }),
  ];
  const actualValues = history.map((entry) => Number(object(entry)?.actual_generation_mw)).filter(Number.isFinite);
  const forecastValues = forecast.map((entry) => Number(object(entry)?.predicted_generation_mw)).filter(Number.isFinite);
  const current = actualValues.at(-1) ?? fallback.summary.currentValue;
  const final = forecastValues.at(-1) ?? fallback.summary.forecastValue;
  const dailyGeneration = numericValue(forecastRoot.predicted_daily_generation_mwh);
  const changePct = current ? round((final - current) / Math.abs(current) * 100) : fallback.summary.changePct;
  const headline = `${textValue(forecastRoot.plant_id, textValue(historyRoot.plant_id, 'Nhà máy dầu khí'))}: dự kiến ${dailyGeneration.toLocaleString('vi-VN')} MWh/ngày, công suất kỳ cuối ${final.toLocaleString('vi-VN')} MW.`;
  const increase = changePct > 10;
  const alert: MissionAiAlert = {
    title: increase ? 'Sản lượng dự báo tăng cao' : 'Sản lượng dự báo trong vùng theo dõi',
    severity: increase ? 'warning' : 'info',
    message: increase ? 'Công suất dự báo tăng hơn 10% so với điểm thực tế gần nhất.' : 'Chưa ghi nhận mức tăng bất thường so với điểm thực tế gần nhất.',
    recommendation: 'Đối soát công suất phát, nhiên liệu và lịch bảo trì trước kỳ vận hành tiếp theo.',
    metric: `${changePct.toLocaleString('vi-VN')}% so với hiện tại`,
  };
  const report = reportLines('Dự báo sản lượng phát điện dầu khí', [
    `**Kết luận:** ${headline}`,
    '',
    `- Nhà máy: ${textValue(forecastRoot.plant_id, textValue(historyRoot.plant_id, '—'))}`,
    `- Dữ liệu lịch sử: ${actualValues.length} điểm đo; dữ liệu dự báo: ${forecastValues.length} điểm.`,
    `- Sản lượng dự báo trong ngày: ${dailyGeneration.toLocaleString('vi-VN')} MWh.`,
    `- Công suất thực tế gần nhất: ${current.toLocaleString('vi-VN')} MW.`,
    `- Công suất dự báo kỳ cuối: ${final.toLocaleString('vi-VN')} MW.`,
    '',
    '## Khuyến nghị',
    `- ${alert.recommendation}`,
  ]);

  return {
    ...fallback,
    requestId,
    generatedAt: new Date().toISOString(),
    mode: 'EXTERNAL',
    model: { name: 'mission-oilgas-forecast', version: '1.0.0' },
    metricTitle: 'Công suất phát điện dầu khí',
    unit: 'MW',
    summary: {
      ...fallback.summary,
      headline,
      currentValue: round(current),
      forecastValue: round(final),
      changePct,
      riskCount: increase ? 1 : 0,
      report,
    },
    series: series.length ? series : fallback.series,
    alerts: [alert],
    recommendations: [alert.recommendation, ...fallback.recommendations].slice(0, 6),
  };
}

function metricNumber(value: string | undefined) {
  const match = String(value ?? '').match(/-?\d+(?:[.,]\d+)?/);
  const parsed = Number(match?.[0].replace(',', '.') ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildProviderPayload(config: MissionAiConfig, summary: MissionSummary, request: MissionAiRequest) {
  const trend = summary.intelligence?.trend ?? [];
  const forecastHours = Math.min(168, Math.max(24, request.horizon * 24));
  switch (config.taskId) {
    case 1: {
      const configuredCapacity = Number(process.env.AI_EXTERNAL_OVERLOAD_CAPACITY_MVA);
      const capacity = Number.isFinite(configuredCapacity) && configuredCapacity > 0
        ? configuredCapacity
        : metricNumber(summary.records?.[0]?.metric) || 25;
      return {
        substation_id: process.env.AI_EXTERNAL_OVERLOAD_SUBSTATION_ID ?? 'PB-0110D00-VITRI3011679',
        capacity_mva: Math.max(1, capacity),
        forecast_hours: forecastHours,
      };
    }
    case 2: {
      const configuredCapacity = Number(process.env.AI_EXTERNAL_SOLAR_CAPACITY_MW);
      if (request.queryType === 'same_period_forecast') return {
        plant_id: process.env.AI_EXTERNAL_SOLAR_PLANT_ID ?? 'DMT-001',
        period_type: process.env.AI_EXTERNAL_SOLAR_PERIOD_TYPE ?? 'day',
        hours: forecastHours,
      };
      if (request.queryType === 'demand_forecast') return {
        customer_id: process.env.AI_EXTERNAL_SOLAR_CUSTOMER_ID ?? 'PE00123456789',
        period_type: process.env.AI_EXTERNAL_DEMAND_PERIOD_TYPE ?? 'day',
        forecast_periods: forecastHours,
      };
      if (request.queryType === 'supply_alert') return {
        area_id: process.env.AI_EXTERNAL_SUPPLY_AREA_ID ?? 'KV-CANTHO-01',
        available_capacity_mw: Number(process.env.AI_EXTERNAL_SUPPLY_CAPACITY_MW ?? 150),
        period_type: process.env.AI_EXTERNAL_SUPPLY_PERIOD_TYPE ?? 'day',
        periods: forecastHours,
      };
      return {
        plant_id: process.env.AI_EXTERNAL_SOLAR_PLANT_ID ?? 'DMT-001',
        ...(Number.isFinite(configuredCapacity) && configuredCapacity > 0 ? { installed_capacity_mw: configuredCapacity } : {}),
        forecast_hours: forecastHours,
      };
    }
    case 3:
      return { customer_id: process.env.AI_EXTERNAL_ROOFTOP_CUSTOMER_ID ?? 'PE00123456789' };
    case 4:
      return {
        search_key: process.env.AI_EXTERNAL_EFFICIENCY_SEARCH_KEY ?? '1100715331',
        year: Number(process.env.AI_EXTERNAL_EFFICIENCY_YEAR ?? 2025),
        reported_toe: Number(process.env.AI_EXTERNAL_EFFICIENCY_REPORTED_TOE ?? 22514),
      };
    case 6:
      return { company_name: process.env.AI_EXTERNAL_CARBON_COMPANY_NAME ?? 'Công ty TNHH Giày FU-LUH' };
    case 7:
      return {
        station_id: process.env.AI_EXTERNAL_EV_STATION_ID ?? 'STATION-001',
        forecast_hours: forecastHours,
      };
    case 8:
      return {
        plant_id: process.env.AI_EXTERNAL_OILGAS_PLANT_ID ?? 'OILGAS-001',
        hours: forecastHours,
      };
    default:
      return {
        task_id: config.taskId,
        mission_code: config.missionCode,
        query_type: request.queryType,
        horizon: request.horizon,
        confidence: request.confidence,
        scenario: request.scenario,
        prompt: request.prompt,
        data_context: { title: summary.title, kpis: summary.kpis, trend, alerts: summary.intelligence?.alerts ?? [] },
      };
  }
}

async function fetchWithRetry(url: string, body: BodyInit | null, headers: Headers, timeoutMs: number, retryCount: number, method = 'POST') {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { method, headers, ...(body ? { body } : {}), signal: controller.signal, cache: 'no-store' });
      const text = await response.text();
      if (!response.ok) throw new Error(`AI service trả về HTTP ${response.status}: ${text.slice(0, 500)}`);
      try { return JSON.parse(text) as unknown; } catch { throw new Error('AI service trả về dữ liệu không phải JSON hợp lệ.'); }
    } catch (error) {
      lastError = error;
      if (attempt >= retryCount) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

export async function executeMissionAi(config: MissionAiConfig, summary: MissionSummary, request: MissionAiRequest, requestId: string = randomUUID()) {
  const runtime = getMissionAiRuntime(config.taskId);
  if (!runtime.enabled) throw new Error('Tích hợp AI đang bị tắt bởi AI_SERVICE_ENABLED=false.');
  const fallback = localResult(config, summary, request, requestId);
  if (runtime.mock || !runtime.externalCompatible) return { result: fallback, rawResponse: null as Record<string, unknown> | null };

  const configuredEndpoint = config.taskId === 2
    ? process.env[`AI_MISSION_2_${request.queryType.toUpperCase()}_ENDPOINT`]?.trim() || DEFAULT_MISSION_2_ENDPOINTS[request.queryType] || runtime.endpoint
    : runtime.endpoint;
  const endpoint = configuredEndpoint.startsWith('/') ? configuredEndpoint : `/${configuredEndpoint}`;
  const url = `${runtime.baseUrl}/api/${runtime.apiVersion}${endpoint}`;
  const headers = new Headers({ Accept: 'application/json', 'X-Request-Id': requestId, 'X-Client-App': 'energy-app-v2' });
  if (runtime.apiKey) headers.set(runtime.authType === 'x-api-key' ? 'X-API-Key' : 'Authorization', runtime.authType === 'x-api-key' ? runtime.apiKey : `Bearer ${runtime.apiKey}`);
  const providerPayload = buildProviderPayload(config, summary, request);
  if (config.taskId === 8) {
    const historyEndpoint = runtime.historyEndpoint.startsWith('/') ? runtime.historyEndpoint : `/${runtime.historyEndpoint}`;
    const query = new URLSearchParams({
      plant_id: String(providerPayload.plant_id),
      hours: String(providerPayload.hours),
    });
    const getHeaders = new Headers({ Accept: 'application/json', 'X-Request-Id': requestId, 'X-Client-App': 'energy-app-v2' });
    if (runtime.apiKey) getHeaders.set(runtime.authType === 'x-api-key' ? 'X-API-Key' : 'Authorization', runtime.authType === 'x-api-key' ? runtime.apiKey : `Bearer ${runtime.apiKey}`);
    const [historyRaw, forecastRaw] = await Promise.all([
      fetchWithRetry(`${runtime.baseUrl}/api/${runtime.apiVersion}${historyEndpoint}?${query}`, null, getHeaders, runtime.timeoutMs, runtime.retryCount, 'GET'),
      fetchWithRetry(`${url}?${query}`, null, getHeaders, runtime.timeoutMs, runtime.retryCount, 'GET'),
    ]);
    return {
      result: normalizeOilGasResult(historyRaw, forecastRaw, fallback, requestId),
      rawResponse: { history: object(historyRaw), forecast: object(forecastRaw) },
    };
  }
  let providerBody: BodyInit;
  if (config.taskId === 4) {
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    providerBody = new URLSearchParams(Object.entries(providerPayload).map(([key, value]) => [key, String(value)]));
  } else {
    headers.set('Content-Type', 'application/json');
    providerBody = JSON.stringify(providerPayload);
  }
  const raw = await fetchWithRetry(url, providerBody, headers, runtime.timeoutMs, runtime.retryCount);
  return { result: normalizeExternalResult(raw, fallback, requestId, config, request), rawResponse: object(raw) };
}
