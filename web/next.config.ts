import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The old site served each page as a file too (/drawdown.html), and
      // the Calculator modes were once called Single and Series.
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/single", destination: "/advanced", permanent: true },
      { source: "/series", destination: "/stages", permanent: true },
      { source: "/single.html", destination: "/advanced", permanent: true },
      { source: "/series.html", destination: "/stages", permanent: true },
      { source: "/:slug.html", destination: "/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
