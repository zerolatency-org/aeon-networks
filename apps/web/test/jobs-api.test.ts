// apps/web/test/jobs-api.test.ts
import { describe, expect, test } from "bun:test";
import {
	confirmJob,
	deliverJobTask,
	fetchJobDelivery,
	fetchJobDetail,
	fetchJobsList,
	fetchJobVerdict,
	type JobView,
	jobErrorWords,
	parseJobDetailResponse,
	parseJobListResponse,
	parseJobView,
	prepareJob,
	prepareJobAction,
	triggerEvaluate,
} from "@/lib/jobs-api";
import { ApiError } from "@/lib/siwe-api";

const mockJob: JobView = {
	jobId: "101",
	tokenId: "7",
	state: "funded",
	client: "0x1111111111111111111111111111111111111111",
	payee: "0x2222222222222222222222222222222222222222",
	evaluator: "0x3333333333333333333333333333333333333333",
	amount: "1000000000000000",
	taskHash:
		"0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
	resultHash: null,
	expiredAt: "2026-11-15T12:00:00.000Z",
	acceptWindowS: 3600,
	submittedAt: null,
	settledAt: null,
	roles: ["client"],
};

describe("Jobs API layer", () => {
	test("parseJobView parses valid wire job record", () => {
		const parsed = parseJobView(mockJob);
		expect(parsed).not.toBeNull();
		expect(parsed?.jobId).toBe("101");
		expect(parsed?.state).toBe("funded");
		expect(parsed?.roles).toEqual(["client"]);
	});

	test("parseJobView rejects malformed job record", () => {
		expect(parseJobView(null)).toBeNull();
		expect(parseJobView({})).toBeNull();
		expect(parseJobView({ ...mockJob, jobId: "invalid" })).toBeNull();
		expect(parseJobView({ ...mockJob, state: "unknown_state" })).toBeNull();
	});

	test("parseJobListResponse parses array of jobs", () => {
		const res = parseJobListResponse({ jobs: [mockJob] });
		expect(res).not.toBeNull();
		expect(res?.jobs.length).toBe(1);
	});

	test("parseJobDetailResponse parses job with deliveries and providerRun", () => {
		const detail = {
			...mockJob,
			deliveries: ["task"],
			providerRun: { status: "running", errorCode: null },
		};
		const parsed = parseJobDetailResponse(detail);
		expect(parsed).not.toBeNull();
		expect(parsed?.deliveries).toEqual(["task"]);
		expect(parsed?.providerRun?.status).toBe("running");
	});

	test("jobErrorWords translates known backend error codes into plain language", () => {
		expect(jobErrorWords("AMOUNT_TOO_LOW")).toContain("below the minimum");
		expect(jobErrorWords("CLIENT_IS_PAYEE")).toContain("cannot hire your own");
		expect(jobErrorWords("FORBIDDEN")).toContain("permission");
		expect(jobErrorWords("UNKNOWN_CODE")).toBe(
			"The job operation could not be completed.",
		);
	});

	test("fetchJobsList calls GET /api/jobs and returns parsed jobs", async () => {
		const mockFetch = (async (url: string) => {
			expect(url).toBe("/api/jobs");
			return new Response(JSON.stringify({ jobs: [mockJob] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const res = await fetchJobsList(mockFetch);
		expect(res.jobs.length).toBe(1);
	});

	test("fetchJobDetail calls GET /api/jobs/:id and returns parsed detail", async () => {
		const mockFetch = (async (url: string) => {
			expect(url).toBe("/api/jobs/101");
			return new Response(
				JSON.stringify({ ...mockJob, deliveries: ["task"], providerRun: null }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		const job = await fetchJobDetail("101", mockFetch);
		expect(job.jobId).toBe("101");
		expect(job.deliveries).toEqual(["task"]);
	});

	test("prepareJob calls POST /api/jobs/prepare and returns prepared tx payload", async () => {
		const mockFetch = (async (url: string, init?: RequestInit) => {
			expect(url).toBe("/api/jobs/prepare");
			expect(init?.method).toBe("POST");
			return new Response(
				JSON.stringify({
					chainId: 16602,
					escrow: "0xescrow",
					tokenId: "7",
					client: "0xclient",
					payee: "0xpayee",
					evaluator: "0xeval",
					provider: "0xprov",
					amount: "1000000000000000",
					expiredAt: "1794500000",
					acceptWindowS: 3600,
					tx: {
						chainId: 16602,
						to: "0xescrow",
						value: "1000000000000000",
						data: "0x12",
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		const prepared = await prepareJob(
			{
				tokenId: "7",
				taskHash:
					"0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
				amount: "1000000000000000",
			},
			mockFetch,
		);
		expect(prepared.tx.to).toBe("0xescrow");
	});

	test("confirmJob calls POST /api/jobs/confirm with txHash", async () => {
		const mockFetch = (async (url: string, init?: RequestInit) => {
			expect(url).toBe("/api/jobs/confirm");
			const body = JSON.parse(init?.body as string);
			expect(body.txHash).toBe("0xhash");
			return new Response(
				JSON.stringify({ job: mockJob, providerQueued: true }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		const res = await confirmJob("0xhash", mockFetch);
		expect(res.job.jobId).toBe("101");
		expect(res.providerQueued).toBe(true);
	});

	test("deliverJobTask calls PUT /api/jobs/:id/delivery/task with envelope", async () => {
		const mockFetch = (async (url: string, init?: RequestInit) => {
			expect(url).toBe("/api/jobs/101/delivery/task");
			expect(init?.method).toBe("PUT");
			return new Response(
				JSON.stringify({ jobId: "101", size: 512, expiresAt: "2026-11-20" }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		const res = await deliverJobTask("101", { dummy: "envelope" }, mockFetch);
		expect(res.jobId).toBe("101");
		expect(res.size).toBe(512);
	});

	test("prepareJobAction calls POST /api/jobs/:id/action/prepare and returns tx", async () => {
		const mockFetch = (async (url: string, init?: RequestInit) => {
			expect(url).toBe("/api/jobs/101/action/prepare");
			const body = JSON.parse(init?.body as string);
			expect(body.action).toBe("complete");
			return new Response(
				JSON.stringify({
					tx: { chainId: 16602, to: "0xescrow", value: "0", data: "0xaction" },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		const res = await prepareJobAction("101", "complete", mockFetch);
		expect(res.tx.data).toBe("0xaction");
	});

	test("fetchJobDelivery calls GET /api/jobs/:id/delivery/:kind", async () => {
		const mockFetch = (async (url: string) => {
			expect(url).toBe("/api/jobs/101/delivery/task");
			return new Response(
				JSON.stringify({
					kind: "task",
					storage: "mailbox",
					payloadHash: "0xhash",
					size: 100,
					ogRootHash: null,
					envelope: { content: "test" },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		const del = await fetchJobDelivery("101", "task", mockFetch);
		expect(del.kind).toBe("task");
	});

	test("fetchJobVerdict calls GET /api/jobs/:id/verdict", async () => {
		const mockFetch = (async (url: string) => {
			expect(url).toBe("/api/jobs/101/verdict");
			return new Response(
				JSON.stringify({
					verdict: "accept",
					checks: ["quality", "format"],
					score: 95,
					model: "glm-5.2",
					decidedTx: "0xdecided",
					reasons: null,
					createdAt: "2026-11-15T10:00:00Z",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		const verdict = await fetchJobVerdict("101", mockFetch);
		expect(verdict.verdict).toBe("accept");
		expect(verdict.score).toBe(95);
	});

	test("triggerEvaluate calls POST /api/jobs/:id/evaluate", async () => {
		const mockFetch = (async (url: string, init?: RequestInit) => {
			expect(url).toBe("/api/jobs/101/evaluate");
			expect(init?.method).toBe("POST");
			return new Response(JSON.stringify({ queued: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const res = await triggerEvaluate("101", mockFetch);
		expect(res.queued).toBe(true);
	});
});
