import { MapPin } from "lucide-react";
import type { Cluster } from "@/lib/types";
import { cn } from "@/lib/utils";

const LNG_MIN = 105.85;
const LNG_MAX = 106.55;
const LAT_MIN = 10.9;
const LAT_MAX = 11.72;

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * 100;
  return { x, y };
}

function pinClass(c: Cluster): string {
  if (c.occupancy >= 75) return "text-success";
  if (c.occupancy >= 50) return "text-gov";
  return "text-warning";
}

export function MiniGIS({ clusters, height = 150 }: { clusters: Cluster[]; height?: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-md border border-border bg-surface"
      style={{ height }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <pattern id="mini-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M5 0 L0 0 0 5" fill="none" stroke="var(--border)" strokeWidth="0.15" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#mini-grid)" />
        {/* Ranh giới tỉnh Tây Ninh (mô phỏng) */}
        <path
          d="M10 14 L30 8 L48 18 L62 14 L74 26 L84 46 L80 66 L66 82 L46 92 L28 82 L16 66 L12 42 Z"
          fill="var(--teal)"
          fillOpacity="0.08"
          stroke="var(--teal)"
          strokeWidth="0.4"
        />
        {/* Trục giao thông chính */}
        <path
          d="M14 74 L40 62 L58 66 L82 40"
          fill="none"
          stroke="var(--gov)"
          strokeOpacity="0.3"
          strokeWidth="0.5"
          strokeDasharray="1.8 1.4"
        />
      </svg>

      {clusters.map((c) => {
        const { x, y } = project(c.lat, c.lng);
        return (
          <span
            key={c.id}
            title={c.name}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <MapPin
              className={cn("size-4 drop-shadow", pinClass(c))}
              fill="currentColor"
              fillOpacity={0.2}
            />
          </span>
        );
      })}
    </div>
  );
}
