import { useEffect, useState } from "react";

type BoundaryFeature = {
  geometry: GeoJSON.Geometry | null;
};

type BoundaryResponse = {
  features?: BoundaryFeature[];
};

function pointInRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLng, currentLat] = ring[index] ?? [];
    const [previousLng, previousLat] = ring[previous] ?? [];
    const intersects =
      currentLat > lat !== previousLat > lat &&
      lng < ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, coordinates: number[][][]) {
  if (!pointInRing(lng, lat, coordinates[0] ?? [])) return false;
  return !(coordinates.slice(1).some((hole) => pointInRing(lng, lat, hole)));
}

export function pointInTayNinhBoundary(
  geometry: GeoJSON.Geometry | null | undefined,
  lng: number,
  lat: number,
) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygon(lng, lat, geometry.coordinates as number[][][]);
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][]).some((polygon) =>
      pointInPolygon(lng, lat, polygon),
    );
  }
  return false;
}

export function useTayNinhBoundary() {
  const [boundary, setBoundary] = useState<GeoJSON.Geometry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      SERVICE: "WFS",
      VERSION: "2.0.0",
      REQUEST: "GetFeature",
      TYPENAMES: "nangluong_tayninh:tinh_tay_ninh",
      OUTPUTFORMAT: "application/json",
      SRSNAME: "EPSG:4326",
      COUNT: "25",
    });
    void fetch(`/api/gis/geoserver/wfs?${params.toString()}`, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<BoundaryResponse>) : null))
      .then((payload) => {
        if (!cancelled) setBoundary(payload?.features?.flatMap((feature) => feature.geometry ? [feature.geometry] : []) ?? []);
      })
      .catch(() => {
        if (!cancelled) setBoundary([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return boundary;
}

export function isInsideTayNinh(boundary: GeoJSON.Geometry[], lng: number, lat: number) {
  return boundary.some((geometry) => pointInTayNinhBoundary(geometry, lng, lat));
}

export function geometryHasPointInside(
  geometry: GeoJSON.Geometry | null | undefined,
  boundary: GeoJSON.Geometry[],
) {
  if (!geometry || boundary.length === 0) return true;
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates as [number, number];
    return isInsideTayNinh(boundary, lng, lat);
  }
  if (geometry.type === "MultiPoint") {
    return (geometry.coordinates as [number, number][]).some(([lng, lat]) =>
      isInsideTayNinh(boundary, lng, lat),
    );
  }
  return true;
}