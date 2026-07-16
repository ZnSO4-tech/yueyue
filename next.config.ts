import type { NextConfig } from "next";

const pagesBasePath = process.env.PAGES_BASE_PATH || "";
const buildingGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  ...(buildingGitHubPages ? { output: "export" as const } : {}),
  basePath: pagesBasePath,
  assetPrefix: pagesBasePath || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
