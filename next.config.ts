import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phone / LAN testing hits the machine by IP; without this, Next blocks
  // /_next/* for that host and the client map UI can fail to hydrate.
  allowedDevOrigins: ["192.168.31.66", "127.0.0.1", "localhost"],
  // The repo sits inside a parent folder that has its own package-lock.json;
  // pin the workspace root so Turbopack does not walk up and warn.
  turbopack: {
    root: __dirname,
  },
  images: {
    // Listing photos come from the MLS feed (ddfcdn) and Cloudinary uploads.
    // Pin explicit MLS hosts — Next 16 is stricter about hostname wildcards,
    // and a missed pattern made every gallery tile fall back to the placeholder.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "ddfcdn.realtor.ca", pathname: "/**" },
      { protocol: "https", hostname: "*.realtor.ca", pathname: "/**" },
      { protocol: "https", hostname: "realtor.ca", pathname: "/**" },
      // TRREB / AMPRE delivery CDN (explicit host — Next is strict about wildcards).
      { protocol: "https", hostname: "trreb-image.ampre.ca", pathname: "/**" },
      { protocol: "https", hostname: "*.ampre.ca", pathname: "/**" },
      { protocol: "https", hostname: "ampre.ca", pathname: "/**" },
      { protocol: "https", hostname: "*.crea.ca", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      // Pre-con renderings imported from the brokerage WordPress site.
      { protocol: "https", hostname: "estate-4u.com", pathname: "/**" },
      { protocol: "https", hostname: "*.estate-4u.com", pathname: "/**" },
    ],
  },
  redirects() {
    return [
      // The mls-v2 frontend's listing URLs. The backend's daily newsletter
      // still builds them, and old emails and search results point at them;
      // without these they 404 on this site.
      { source: "/listing/rental/:key", destination: "/property/:key", permanent: true },
      { source: "/listing/:key", destination: "/property/:key", permanent: true },
    ];
  },
};

export default nextConfig;
