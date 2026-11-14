// apps/web/next.config.ts
import type { NextConfig } from "next";

import { apiRewrites } from "./src/lib/api-proxy";

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@aeon/chain"],
	async rewrites() {
		return apiRewrites(process.env.API_URL);
	},
};

export default config;
