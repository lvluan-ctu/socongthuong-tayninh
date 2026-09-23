import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CLUSTERS } from "@/data/mock";
import { ALL_GIS_LAYERS, type GisLayerId } from "@/lib/gis-catalog";
import { INDUSTRIES } from "@/lib/constants";
import type { Cluster } from "@/lib/types";

// Chuẩn hóa chuỗi ngành nghề để so khớp ổn định (bỏ dấu tiếng Việt, lowercase).
export function normalizeIndustry(sector: string): string {
  return sector
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsWord(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[\\s(),.,:\\-/–—_])${esc}(?=[\\s(),.,:\\-/–—_]|$)`);
  return re.test(haystack);
}

// Một ngành (thuộc danh mục INDUSTRIES) được xem là khớp với sector đã khai
// (của cụm hoặc nhà máy) khi giống hệt hoặc trùng/bao đúng từ — tránh khớp chuỗi con ngẫu nhiên.
export function industryBelongsTo(sector: string, industry: string): boolean {
  const s = normalizeIndustry(sector);
  const i = normalizeIndustry(industry);
  if (!s || !i) return false;
  if (s === i) return true;
  return containsWord(s, i) || containsWord(i, s);
}

export function clusterMatches(c: Cluster, industry: string): boolean {
  const tokens = c.sectors
    .split(/[–\-/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return tokens.some((t) => industryBelongsTo(t, industry));
}

export function clusterHasIndustry(c: Cluster, industry: string): boolean {
  return clusterMatches(c, industry);
}

export function clusterCountByIndustry(industry: string): number {
  return CLUSTERS.filter((c) => clusterHasIndustry(c, industry)).length;
}

interface GisLayerValue {
  selectedIndustries: string[];
  toggleIndustry: (industry: string) => void;
  setSelectedIndustries: (industries: string[]) => void;
  selectedClusterIds: string[];
  toggleCluster: (clusterId: string) => void;
  setSelectedClusterIds: (clusterIds: string[]) => void;
  /** Các lớp bản đồ đang bật trên bản đồ GIS tổng hợp (/gis/map). */
  visibleGisLayers: GisLayerId[];
  toggleGisLayer: (layerId: GisLayerId) => void;
  setVisibleGisLayers: (layers: GisLayerId[]) => void;
}

const GisLayerContext = createContext<GisLayerValue | null>(null);

export function GisLayerProvider({ children }: { children: ReactNode }) {
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(INDUSTRIES);
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>(() =>
    CLUSTERS.map((c) => c.id),
  );
  const [visibleGisLayers, setVisibleGisLayers] = useState<GisLayerId[]>(ALL_GIS_LAYERS);

  const toggleIndustry = (industry: string) =>
    setSelectedIndustries((prev) =>
      prev.includes(industry) ? prev.filter((i) => i !== industry) : [...prev, industry],
    );

  const toggleCluster = (clusterId: string) =>
    setSelectedClusterIds((prev) =>
      prev.includes(clusterId) ? prev.filter((i) => i !== clusterId) : [...prev, clusterId],
    );

  const toggleGisLayer = (layerId: GisLayerId) =>
    setVisibleGisLayers((prev) =>
      prev.includes(layerId) ? prev.filter((i) => i !== layerId) : [...prev, layerId],
    );

  const value = useMemo<GisLayerValue>(
    () => ({
      selectedIndustries,
      toggleIndustry,
      setSelectedIndustries,
      selectedClusterIds,
      toggleCluster,
      setSelectedClusterIds,
      visibleGisLayers,
      toggleGisLayer,
      setVisibleGisLayers,
    }),
    [selectedIndustries, selectedClusterIds, visibleGisLayers],
  );

  return <GisLayerContext.Provider value={value}>{children}</GisLayerContext.Provider>;
}

export function useGisLayer() {
  const ctx = useContext(GisLayerContext);
  if (!ctx) throw new Error("useGisLayer must be used within GisLayerProvider");
  return ctx;
}
