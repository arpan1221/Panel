/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    const upstream = process.env.PANEL_BACKEND ?? "http://backend:8000";
    return [{ source: "/api/backend/:path*", destination: `${upstream}/:path*` }];
  },
};

module.exports = nextConfig;
