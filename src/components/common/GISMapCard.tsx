import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClusterMap } from "./ClusterMap";
import { cn } from "@/lib/utils";
import type { Cluster } from "@/lib/types";

export function GISMapCard({
  clusters,
  selectedId,
  onSelect,
  height = 420,
}: {
  clusters: Cluster[];
  selectedId?: string | null;
  onSelect?: (c: Cluster) => void;
  height?: number;
}) {
  return (
    <div className="gov-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
            Bản đồ cụm công nghiệp
          </h2>
          <p className="text-xs text-muted-foreground">Bản đồ OpenStreetMap – tỉnh Tây Ninh</p>
        </div>
        <Button variant="outline" size="sm">
          <Maximize2 className="size-4" /> Toàn màn hình
        </Button>
      </header>

      <div className="relative bg-surface" style={{ height }}>
        <ClusterMap
          clusters={clusters}
          selectedId={selectedId}
          onSelect={onSelect}
          height={height}
        />
        <div className="absolute right-3 top-3 z-[500] rounded-md border border-border bg-card/90 p-2 text-xs shadow-panel">
          <p className="mb-1 font-semibold text-navy">Tỷ lệ lấp đầy</p>
          <Legend color="bg-success" label="≥ 75%" />
          <Legend color="bg-gov" label="50 – 74%" />
          <Legend color="bg-warning" label="< 50%" />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("size-2 rounded-full", color)} /> {label}
    </p>
  );
}
