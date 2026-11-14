// apps/web/test/job-state.test.ts
import { describe, expect, test } from "bun:test";
import {
	jobStateBadge,
	plainWordsStatusLine,
	timelineRows,
	whoMayActNext,
} from "@/lib/job-state";
import type { JobDetailView, JobView } from "@/lib/jobs-api";

const baseJob: JobView = {
	jobId: "1",
	tokenId: "7",
	state: "funded",
	client: "0xclient",
	payee: "0xpayee",
	evaluator: "0xeval",
	amount: "1000000000000000",
	taskHash: "0xtask",
	resultHash: null,
	expiredAt: new Date(Date.now() + 3600000).toISOString(),
	acceptWindowS: 3600,
	submittedAt: null,
	settledAt: null,
	roles: ["client"],
};

const baseDetail: JobDetailView = {
	...baseJob,
	deliveries: ["task"],
	providerRun: null,
};

describe("Job State Machine View Model", () => {
	test("jobStateBadge maps every known status to label and design meaning tone", () => {
		expect(jobStateBadge("funded")).toEqual({
			label: "In progress",
			tone: "live",
		});
		expect(jobStateBadge("submitted")).toEqual({
			label: "Under review",
			tone: "warn",
		});
		expect(jobStateBadge("completed")).toEqual({
			label: "Completed",
			tone: "ok",
		});
		expect(jobStateBadge("disputed")).toEqual({
			label: "Disputed",
			tone: "warn",
		});
		expect(jobStateBadge("declined")).toEqual({
			label: "Declined",
			tone: "neutral",
		});
		expect(jobStateBadge("refunded")).toEqual({
			label: "Refunded",
			tone: "neutral",
		});
		expect(jobStateBadge("timed_out")).toEqual({
			label: "Timed out",
			tone: "neutral",
		});
		expect(jobStateBadge("split")).toEqual({ label: "Split", tone: "neutral" });
		expect(jobStateBadge("force_closed")).toEqual({
			label: "Force closed",
			tone: "neutral",
		});
	});

	test("whoMayActNext allows provider to decline when funded", () => {
		const actions = whoMayActNext({
			...baseJob,
			state: "funded",
			roles: ["provider"],
		});
		expect(actions).toContain("decline");
	});

	test("whoMayActNext allows evaluator to complete or dispute when submitted", () => {
		const actions = whoMayActNext({
			...baseJob,
			state: "submitted",
			roles: ["evaluator"],
		});
		expect(actions).toContain("complete");
		expect(actions).toContain("dispute");
	});

	test("whoMayActNext forbids unprivileged roles from evaluating", () => {
		const actions = whoMayActNext({
			...baseJob,
			state: "submitted",
			roles: ["client"],
		});
		expect(actions).not.toContain("complete");
		expect(actions).not.toContain("dispute");
	});

	test("whoMayActNext allows client to claim timeout when job expired past deadline", () => {
		const expiredJob: JobView = {
			...baseJob,
			state: "funded",
			expiredAt: new Date(Date.now() - 3600000).toISOString(),
			roles: ["client"],
		};
		const actions = whoMayActNext(expiredJob);
		expect(actions).toContain("claimTimeout");
	});

	test("whoMayActNext returns empty list for terminal completed state", () => {
		expect(
			whoMayActNext({
				...baseJob,
				state: "completed",
				roles: ["client", "evaluator"],
			}),
		).toEqual([]);
	});

	test("timelineRows builds ordered chronological progression for funded job", () => {
		const rows = timelineRows(baseDetail);
		expect(rows.length).toBe(4);
		expect(rows[0]?.step).toBe("funded");
		expect(rows[0]?.status).toBe("done");
		expect(rows[1]?.step).toBe("task_delivered");
		expect(rows[1]?.status).toBe("done");
		expect(rows[2]?.step).toBe("execution");
		expect(rows[2]?.status).toBe("active");
		expect(rows[3]?.step).toBe("settlement");
		expect(rows[3]?.status).toBe("pending");
	});

	test("timelineRows marks review active and execution done when submitted", () => {
		const submittedDetail: JobDetailView = {
			...baseDetail,
			state: "submitted",
			submittedAt: new Date().toISOString(),
			deliveries: ["task", "result"],
		};
		const rows = timelineRows(submittedDetail);
		const exec = rows.find((r) => r.step === "execution");
		expect(exec?.status).toBe("done");
		const review = rows.find((r) => r.step === "review");
		expect(review?.status).toBe("active");
	});

	test("timelineRows marks all steps done on completed job", () => {
		const completedDetail: JobDetailView = {
			...baseDetail,
			state: "completed",
			submittedAt: new Date().toISOString(),
			settledAt: new Date().toISOString(),
			deliveries: ["task", "result"],
		};
		const rows = timelineRows(completedDetail);
		expect(rows.every((r) => r.status === "done")).toBe(true);
	});

	test("plainWordsStatusLine gives understandable explanation for funded state", () => {
		const line = plainWordsStatusLine({ ...baseJob, state: "funded" });
		expect(line).toContain("Escrow funded");
		expect(line).toContain("process");
	});

	test("plainWordsStatusLine gives understandable explanation for submitted state", () => {
		const line = plainWordsStatusLine({ ...baseJob, state: "submitted" });
		expect(line).toContain("submitted");
		expect(line).toContain("verification");
	});

	test("plainWordsStatusLine gives understandable explanation for completed state", () => {
		const line = plainWordsStatusLine({ ...baseJob, state: "completed" });
		expect(line).toContain("completed");
		expect(line).toContain("released");
	});

	test("plainWordsStatusLine gives understandable explanation for disputed state", () => {
		const line = plainWordsStatusLine({ ...baseJob, state: "disputed" });
		expect(line).toContain("disputed");
	});

	test("plainWordsStatusLine gives understandable explanation for refunded state", () => {
		const line = plainWordsStatusLine({ ...baseJob, state: "refunded" });
		expect(line).toContain("refunded");
	});
});
