import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No clickjacking, no plugins, no base-tag tricks, forms only post to this site.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  // The admin only plays audio; nothing here needs the camera, microphone, location or payment APIs.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private pages must never be stored by shared caches or the back/forward cache of a shared computer.
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/order/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  images: {
    // Uploaded images: Cloudinary in production, the API's /api/v1/uploads in development.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    localPatterns: [{ pathname: "/images/**" }, { pathname: "/api/v1/uploads/**" }],
  },
  // Compression buffers proxied Server-Sent Events; the host/CDN compresses in production.
  compress: false,
  // Admin calls go through the web origin, so the session cookie is first-party in every environment.
  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
