import type { NextConfig } from "next";

// Deployed to GitHub Pages at https://becccasun.github.io/kaleidoscope-glyph/
// as a static export; the repo name is the URL prefix.
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isPages ? "/kaleidoscope-glyph" : "",
  images: { unoptimized: true },
};

export default nextConfig;
