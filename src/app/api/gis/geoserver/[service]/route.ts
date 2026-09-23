import { NextResponse } from 'next/server';
import { getGeoServerConfig } from '@/config/geoserver';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ service: string }> };

const allowedRequests: Record<string, Set<string>> = {
  wms: new Set(['getcapabilities', 'getmap', 'getfeatureinfo', 'getlegendgraphic']),
  wfs: new Set(['getcapabilities', 'describefeaturetype', 'getfeature']),
};

export async function GET(request: Request, context: RouteContext) {
  const { service: rawService } = await context.params;
  const service = rawService.toLowerCase();
  const allowed = allowedRequests[service];
  if (!allowed) return NextResponse.json({ message: 'Dịch vụ bản đồ không được hỗ trợ.' }, { status: 404 });

  const incomingUrl = new URL(request.url);
  const operation = (incomingUrl.searchParams.get('REQUEST') || incomingUrl.searchParams.get('request') || 'GetCapabilities').toLowerCase();
  if (!allowed.has(operation)) return NextResponse.json({ message: 'Thao tác GeoServer không được phép.' }, { status: 400 });

  const config = getGeoServerConfig();
  const upstreamUrl = new URL(`${config.baseUrl}/${service}`);
  incomingUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));
  if (!upstreamUrl.searchParams.has('SERVICE')) upstreamUrl.searchParams.set('SERVICE', service.toUpperCase());

  const headers = new Headers({ accept: request.headers.get('accept') || '*/*' });
  if (config.username) {
    headers.set('authorization', `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`);
  }

  try {
    const response = await fetch(upstreamUrl, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const body = await response.arrayBuffer();
    const outgoingHeaders = new Headers();
    for (const name of ['content-type', 'cache-control', 'content-disposition']) {
      const value = response.headers.get(name);
      if (value) outgoingHeaders.set(name, value);
    }
    outgoingHeaders.set('x-energy-gis-source', 'geoserver');
    return new Response(body, { status: response.status, headers: outgoingHeaders });
  } catch (error) {
    console.error('GeoServer proxy request failed', { service, operation, error });
    return NextResponse.json(
      { message: 'Không thể kết nối GeoServer. Kiểm tra mạng nội bộ và cấu hình GEOSERVER_URL.' },
      { status: 502 },
    );
  }
}
