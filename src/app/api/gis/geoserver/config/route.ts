import { NextResponse } from "next/server";
import { getGeoServerConfig } from "@/config/geoserver";
import { GEOSERVER_LAYER_CATALOG } from "@/config/geoserver-layers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getGeoServerConfig();
    return NextResponse.json({
      enabled: Boolean(config.baseUrl),
      proxyWmsUrl: "/api/gis/geoserver/wms",
      proxyWfsUrl: "/api/gis/geoserver/wfs",
      defaultLayers: config.defaultLayers,
      layers: GEOSERVER_LAYER_CATALOG.filter((layer) => config.defaultLayers.includes(layer.name)),
      center: config.center,
      zoom: config.zoom,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tải cấu hình GeoServer." },
      { status: 500 },
    );
  }
}
