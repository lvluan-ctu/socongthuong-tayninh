import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GOV = "oklch(0.513 0.16 255.7)";
const TEAL = "oklch(0.566 0.101 182.5)";
const SUCCESS = "oklch(0.523 0.135 144.2)";
const WARNING = "oklch(0.743 0.15 72.1)";
const DESTRUCTIVE = "oklch(0.539 0.194 26.7)";
const ANALYTICS = "oklch(0.549 0.162 297.7)";
const MUTED = "oklch(0.554 0.041 257.4)";
const BORDER = "oklch(0.918 0.017 250.8)";
const SURFACE_STRONG = "oklch(0.955 0.011 252)";

const AXIS_TICK = { fontSize: 10, fill: MUTED } as const;
const GRID = { strokeDasharray: "3 3", stroke: BORDER, vertical: false } as const;

export function MiniBarChart({
  data,
  dataKey = "value",
  name = "Giá trị",
  fill = GOV,
  colorField,
  height = 120,
}: {
  data: { name: string; value: number; [k: string]: string | number }[];
  dataKey?: string;
  name?: string;
  fill?: string;
  colorField?: string;
  height?: number;
}) {
  const gid = useId().replace(/[:]/g, "");
  const useGradient = !colorField;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={1} />
            <stop offset="100%" stopColor={fill} stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} />
        <YAxis tick={AXIS_TICK} />
        <Tooltip cursor={{ fill: SURFACE_STRONG }} />
        <Bar
          dataKey={dataKey}
          name={name}
          radius={[3, 3, 0, 0]}
          fill={useGradient ? `url(#${gid})` : fill}
        >
          {colorField ? data.map((d, i) => <Cell key={i} fill={String(d[colorField])} />) : null}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MiniDonutChart({
  data,
  colors,
  height = 150,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  height?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-28 w-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={34}
              outerRadius={54}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: colors[i % colors.length] }}
              />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="font-medium tabular-nums">{d.value.toLocaleString("vi-VN")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MiniTrendChart({
  data,
  lines,
  height = 120,
}: {
  data: Record<string, string | number>[];
  lines: { key: string; name: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="month" tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} />
        <Tooltip />
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
