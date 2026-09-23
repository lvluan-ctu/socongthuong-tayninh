import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/common/ChartCard";
import type { ChargingDemandRecord, ChargingStation } from "@/lib/energy-types";

const COLORS = ["#1565C0", "#1976D2", "#00897B", "#2E7D32", "#E59A23", "#7C3AED"];

export function ChargingCharts({
  stations,
  demandHistory,
}: {
  stations: ChargingStation[];
  demandHistory: ChargingDemandRecord[];
}) {
  const typeMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stations) map.set(s.type, (map.get(s.type) ?? 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [stations]);

  const byDistrict = useMemo(() => {
    const map = new Map<string, { powerKw: number; ports: number }>();
    for (const s of stations) {
      const cur = map.get(s.district) ?? { powerKw: 0, ports: 0 };
      cur.powerKw += s.powerKw;
      cur.ports += s.ports.ccs2 + s.ports.chademo + s.ports.acType2;
      map.set(s.district, cur);
    }
    return Array.from(map.entries()).map(([district, v]) => ({ district, ...v }));
  }, [stations]);

  const freeRatio = useMemo(
    () =>
      stations.map((s) => {
        const total = s.ports.ccs2 + s.ports.chademo + s.ports.acType2;
        return {
          name: s.code,
          ratio: total ? Math.round((s.freePorts / total) * 100) : 0,
          free: s.freePorts,
        };
      }),
    [stations],
  );

  const trend = useMemo(() => {
    const byPeriod = new Map<string, number>();
    for (const r of demandHistory) {
      byPeriod.set(r.period, (byPeriod.get(r.period) ?? 0) + r.energyKwh);
    }
    return Array.from(byPeriod.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([period, kwh]) => ({ period, kwh: Math.round(kwh) }));
  }, [demandHistory]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ChartCard title="Cơ cấu loại hình trạm">
        <div className="relative h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={typeMix}
                dataKey="value"
                nameKey="name"
                innerRadius={44}
                outerRadius={72}
                paddingAngle={2}
                strokeWidth={1}
              >
                {typeMix.map((item, i) => (
                  <Cell key={item.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, "Trạm"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 space-y-1.5">
          {typeMix.map((item, i) => (
            <p key={item.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="truncate text-navy">{item.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{item.value} trạm</span>
            </p>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Công suất & cổng theo huyện">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byDistrict} margin={{ left: -18, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="district" tickLine={false} axisLine={false} fontSize={9} interval={0} />
            <YAxis yAxisId="kw" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis
              yAxisId="p"
              orientation="right"
              tickLine={false}
              axisLine={false}
              fontSize={10}
            />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              yAxisId="kw"
              dataKey="powerKw"
              name="Công suất (kW)"
              fill="#1565C0"
              radius={[4, 4, 0, 0]}
            />
            <Bar yAxisId="p" dataKey="ports" name="Số cổng" fill="#00897B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tỷ lệ cổng trống theo trạm">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={freeRatio} margin={{ left: -18, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={9} interval={0} />
            <YAxis tickLine={false} axisLine={false} fontSize={10} unit="%" domain={[0, 100]} />
            <Tooltip formatter={(value: number) => [`${value}%`, "Cổng trống"]} />
            <Bar dataKey="ratio" name="Cổng trống" radius={[4, 4, 0, 0]}>
              {freeRatio.map((item) => (
                <Cell
                  key={item.name}
                  fill={item.ratio <= 10 ? "#C62828" : item.ratio <= 40 ? "#E59A23" : "#2E7D32"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Xu hướng nhu cầu sạc toàn tỉnh">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend} margin={{ left: -12, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis tickLine={false} axisLine={false} fontSize={10} />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString("vi-VN")} kWh`, "Nhu cầu"]}
            />
            <Line
              type="monotone"
              dataKey="kwh"
              name="Nhu cầu"
              stroke="#7C3AED"
              strokeWidth={2.5}
              dot={{ r: 2.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
