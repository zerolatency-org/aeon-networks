// apps/web/test/error-view.test.ts
import { describe, expect, test } from "bun:test";
import {
	formatErrorDetails,
	formatErrorHeadline,
	isAuthError,
	isNetworkOrRpcError,
} from "@/lib/error-view";

describe("Error View Model & Sanitization", () => {
	test("formatErrorHeadline produces concise, human-friendly titles", () => {
		expect(formatErrorHeadline(new Error("Failed to fetch"))).toBe(
			"Unable to connect to the network",
		);
		expect(formatErrorHeadline(new Error("Request timed out"))).toBe(
			"Request timed out",
		);
		expect(formatErrorHeadline(new Error("Unauthorized access"))).toBe(
			"Authentication required",
		);
		expect(formatErrorHeadline(new Error("404 Not Found"))).toBe(
			"Resource not found",
		);
	});

	test("formatErrorHeadline strips and conceals private keys and cryptographic cipher secrets", () => {
		const leakError = new Error(
			"Failed while processing 0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d for persona",
		);
		const headline = formatErrorHeadline(leakError);
		expect(headline).not.toContain("0x4f3edf983ac");
		expect(headline).toBe("An unexpected error occurred");
	});

	test("formatErrorHeadline handles unknown non-Error values gracefully", () => {
		expect(formatErrorHeadline(null)).toBe("An unexpected error occurred");
		expect(formatErrorHeadline(undefined)).toBe("An unexpected error occurred");
		expect(formatErrorHeadline("random string failure")).toBe(
			"An unexpected error occurred",
		);
	});

	test("formatErrorDetails provides actionable advice without raw stack traces", () => {
		const err = new Error("Connection reset by peer");
		const details = formatErrorDetails(err);
		expect(details).toBeDefined();
		expect(details).not.toContain("at Object.<anonymous>");
		expect(details).not.toContain("node_modules");
	});

	test("isNetworkOrRpcError detects network and RPC disconnects accurately", () => {
		expect(isNetworkOrRpcError(new Error("Failed to fetch"))).toBe(true);
		expect(
			isNetworkOrRpcError(
				new Error("NetworkError when attempting to fetch resource"),
			),
		).toBe(true);
		expect(
			isNetworkOrRpcError(
				new Error("RPC timeout: 0G Galileo node did not answer"),
			),
		).toBe(true);
		expect(isNetworkOrRpcError(new Error("Invalid JSON parameter"))).toBe(
			false,
		);
	});

	test("isAuthError detects session expiration or 401 unauthorized", () => {
		expect(isAuthError(new Error("Unauthorized"))).toBe(true);
		expect(isAuthError(new Error("401"))).toBe(true);
		expect(isAuthError(new Error("Session expired"))).toBe(true);
		expect(isAuthError(new Error("Out of gas"))).toBe(false);
	});
});
