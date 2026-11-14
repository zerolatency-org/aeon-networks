// apps/web/e2e/env.ts
// Fake hosts. They never resolve: the tests answer them. The config passes them to Next.js,
// and the CI job sets the same values for `next build`, because NEXT_PUBLIC_ values are baked in at build time.
export const E2E_RPC_URL = "https://rpc.aeon.test";
export const E2E_EXPLORER_URL = "https://scan.aeon.test";
