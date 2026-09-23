import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/common/ChartCard";
import type { GridLoadRecord, GridPowerLine, GridSubstation } from "@/lib/grid-types";

const VOLTAGE_COLOR: Record<string, string> = {
  "500kV": "#C62828",
  "220kV": "#E59A23",
  "110kV": "#1565C0",
  "22kV": "#00897B",
};

export function GridCharts({
  substations,
  lines,
  history,
}: {
  substations: GridSubstation[];
  lines: GridPowerLine[];
  history: GridLoadRecord[];
}) {
  const capacityByVoltage = useMemo(() => {
    const map = new Map<string, { voltage: string; mva: number; count: number }>();
    substations.forEach((s) => {
      const entry = map.get(s.voltageLevel) ?? {
        voltage: s.voltageLevel,
        mva: 0,
        count: 0,
      };
      entry.mva += s.designCapacity ?? 0;
      entry.count += 1;
      map.set(s.voltageLevel, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.mva - a.mva);
  }, [substations]);

  const loadHistorySeries = useMemo(() => {
    const labelById = new Map(substations.map((s) => [s.id, s.name]));
    const historyIds = new Set(
      history.filter((row) => row.entityType === "substation").map((row) => row.entityId),
    );
    const trackedIds = substations
      .filter((substation) => historyIds.has(substation.id))
      .slice(0, 3)
      .map((substation) => substation.id);
    const byPeriod = new Map<string, Record<string, number>>();
    const tracked = history.filter(
      (r) => r.entityType === "substation" && trackedIds.includes(r.entityId),
    );
    tracked.forEach((r) => {
      const row = byPeriod.get(r.timestamp) ?? {};
      row[r.entityId] = r.loadFactorPct;
      byPeriod.set(r.timestamp, row);
    });
    const periods = Array.from(byPeriod.keys());
    const data = periods.map((p) => ({ period: p, ...(byPeriod.get(p) ?? {}) }));
    const series = trackedIds.map((id) => ({
      id,
      name: labelById.get(id) ?? id,
      dataKey: id,
      color:
        VOLTAGE_COLOR[substations.find((s) => s.id === id)?.voltageLevel ?? "110kV"] ?? "#1565C0",
    }));
    return { data, series };
  }, [history, substations]);

  const lineLoss = useMemo(
    () =>
      lines
        .filter((l) => l.status !== "Quy hoạch" && l.lossPct !== undefined)
        .map((l) => ({
          name: l.code,
          loss: l.lossPct ?? 0,
          load: ((l.actualLoadMw ?? 0) / (l.capacityMw || 1)) * 100,
        })),
    [lines],
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <ChartCard
        title="Công suất trạm theo cấp điện áp"
        subtitle="Tổng công suất thiết kế (MVA) và số trạm"
        className="min-h-80"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={capacityByVoltage} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="voltage" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number | string, name: string) => [
                `${value}${name === "Công suất" ? " MVA" : " trạm"}`,
                name,
              ]}
            />
            <Bar dataKey="mva" name="Công suất" radius={[4, 4, 0, 0]}>
              {capacityByVoltage.map((entry) => (
                <Cell key={entry.voltage} fill={VOLTAGE_COLOR[entry.voltage] ?? "#1565C0"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
          {capacityByVoltage.map((e) => (
            <span key={e.voltage} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: VOLTAGE_COLOR[e.voltage] ?? "#1565C0" }}
              />
              {e.voltage} · {e.count} trạm
            </span>
          ))}
        </div>
      </ChartCard>

      <ChartCard
        title="Hệ số tải 12 kỳ"
        subtitle={
          loadHistorySeries.series.length
            ? `So sánh ${loadHistorySeries.series.map((item) => item.name).join(" · ")}`
            : "Chưa có chuỗi snapshot vận hành của trạm"
        }
        className="min-h-80"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={loadHistorySeries.data}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(value: number | string) => [`${value}%`, "Hệ số tải"]} />
            {loadHistorySeries.series.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Tổn thất lưới truyền tải"
        subtitle="Tổn thất (%) theo tuyến đang vận hành"
        className="min-h-80"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={lineLoss} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(value: number | string) => [`${value}%`, "Tổn thất"]} />
            <Bar dataKey="loss" name="Tổn thất" radius={[4, 4, 0, 0]}>
              {lineLoss.map((e, i) => (
                <Cell
                  key={i}
                  fill={e.loss >= 5 ? "#C62828" : e.loss >= 2.5 ? "#E59A23" : "#00897B"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
