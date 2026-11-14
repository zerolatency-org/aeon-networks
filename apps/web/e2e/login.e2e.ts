// apps/web/e2e/login.e2e.ts
import { expect, type Page, test } from "@playwright/test";

import {
	githubUser,
	injectWallet,
	mockApi,
	rejectNextSignature,
} from "./support";

async function connectWallet(page: Page) {
	await page
		.getByRole("button", { name: /^(Continue with wallet|Connect wallet)$/ })
		.click();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: /MetaMask/ })
		.first()
		.click();
}

const heading = (page: Page, name: string) =>
	page.getByRole("heading", { level: 1, name });
const signButton = (page: Page) =>
	page.getByRole("button", { name: "Sign message" });
const balance = (page: Page) =>
	page.getByRole("button", { name: "Wallet and balance" });

test("a signed-out visitor is sent to login, and public pages stay open", async ({
	page,
}) => {
	await mockApi(page);

	await page.goto("/agents");
	await expect(page).toHaveURL(/\/login\?next=%2Fagents$/);
	await expect(heading(page, "Sign in to Aeon")).toBeVisible();

	await page.goto("/settings");
	await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);

	await page.goto("/");
	await expect(heading(page, "Aeon")).toBeVisible();
});

test("wallet sign-in lands on the page you asked for and shows the balance", async ({
	page,
}) => {
	await injectWallet(page);
	const api = await mockApi(page);

	await page.goto("/login?next=%2Fagents");
	await connectWallet(page);
	await expect(heading(page, "Sign to continue")).toBeVisible();
	await signButton(page).click();

	await expect(page).toHaveURL(/\/agents$/);
	await expect(page.getByText("No agents yet")).toBeVisible();
	await expect(balance(page)).toContainText("1.42 0G");
	expect(api.calls).toEqual({ nonce: 1, verify: 1, link: 0 });
});

test("a GitHub user without a wallet links one, then reaches the agents page", async ({
	page,
}) => {
	await injectWallet(page);
	const api = await mockApi(page, { user: githubUser });

	// The guard sends a user with no wallet to the link step instead of the page.
	await page.goto("/agents");
	await expect(page).toHaveURL(/\/login\?next=%2Fagents$/);
	await expect(heading(page, "Link your wallet")).toBeVisible();
	await expect(page.getByText("Signed in as Ada")).toBeVisible();

	await connectWallet(page);
	await signButton(page).click();

	await expect(page).toHaveURL(/\/agents$/);
	await expect(balance(page)).toContainText("1.42 0G");
	expect(api.calls).toEqual({ nonce: 1, verify: 0, link: 1 });
});

test("a wallet that belongs to another account is refused in plain words", async ({
	page,
}) => {
	await injectWallet(page);
	await mockApi(page, {
		user: githubUser,
		linkError: { code: "WALLET_TAKEN", status: 409 },
	});

	await page.goto("/login?next=%2Fagents");
	await connectWallet(page);
	await signButton(page).click();

	await expect(
		page.getByText("This wallet belongs to another account"),
	).toBeVisible();
	await expect(page.getByText(/WALLET_TAKEN/)).toHaveCount(0);
	await expect(page).toHaveURL(/\/login/);
});

test("a wallet on the wrong network is asked to switch, then continues", async ({
	page,
}) => {
	await injectWallet(page, { chainId: 1 });
	await mockApi(page);

	await page.goto("/login");
	await connectWallet(page);
	await expect(heading(page, "Switch to 0G Galileo")).toBeVisible();

	await page.getByRole("button", { name: "Switch to Galileo" }).click();
	await expect(heading(page, "Sign to continue")).toBeVisible();
});

test("cancelling the signature says so, and signing again works", async ({
	page,
}) => {
	await injectWallet(page);
	await mockApi(page);

	await page.goto("/login");
	await connectWallet(page);
	await expect(heading(page, "Sign to continue")).toBeVisible();

	await rejectNextSignature(page);
	await signButton(page).click();
	await expect(page.getByText("Signature cancelled")).toBeVisible();

	await signButton(page).click();
	await expect(page).toHaveURL(/\/agents$/);
});
