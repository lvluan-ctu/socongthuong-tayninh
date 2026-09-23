import type { NextConfig } from "next";

// Optional path prefix for deployments served from a sub-path (e.g. https://domain.com/nang-luong).
// Must be set at build time (baked into the bundle) — changing it requires a rebuild.
// Leave empty when the app owns its own (sub)domain root, which is the common case.
//
// Note: a lot of client code calls fetch("/api/...") with a root-relative path (not
// basePath-aware). When basePath is set, the reverse proxy in front of this app must
// forward unprefixed "/api/*" requests to "<basePath>/api/*" — see DEPLOY.md.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
