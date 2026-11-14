// apps/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

import { E2E_EXPLORER_URL, E2E_RPC_URL } from "./e2e/env";

const PORT = Number(process.env.E2E_PORT ?? 3101);
const isCI = Boolean(process.env.CI);

export default defineConfig({
	testDir: "./e2e",
	testMatch: "**/*.e2e.ts",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 1 : 0,
	reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "retain-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: isCI
			? `bunx next start -p ${PORT}`
			: `bunx next dev --turbopack -p ${PORT}`,
		url: `http://localhost:${PORT}/lab`,
		reuseExistingServer: !isCI,
		timeout: 180_000,
		env: {
			NEXT_PUBLIC_ENABLE_LAB: "1",
			NEXT_PUBLIC_RPC_URL: E2E_RPC_URL,
			NEXT_PUBLIC_EXPLORER_URL: E2E_EXPLORER_URL,
			NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "",
			API_URL: "http://localhost:3000",
		},
	},
});
