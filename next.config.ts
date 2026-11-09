import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Permite servir con next/image las imágenes de Supabase Storage
    // (signed URLs del bucket de evidencias) en una futura migración.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" }
    ]
  }
};

export default nextConfig;
