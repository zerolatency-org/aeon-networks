// apps/web/next.config.ts
import type { NextConfig } from "next";

import { apiRewrites } from "./src/lib/api-proxy";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@aeon/chain"],
	async rewrites() {
		return apiRewrites(process.env.API_URL);
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: buildSecurityHeaders({ isDev }),
			},
		];
	},
};

export default config;
