import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Imagen Docker liviana (node server.js).
  output: "standalone",
  // Librerías de servidor que no conviene empaquetar (fuentes, jsdom).
  serverExternalPackages: ["pdfmake", "jsdom", "html-to-pdfmake", "postgres"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
