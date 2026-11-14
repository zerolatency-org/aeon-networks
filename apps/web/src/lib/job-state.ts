// apps/web/src/lib/job-state.ts
import type { JobAction, JobDetailView, JobState, JobView } from "./jobs-api";

export type StateBadge = {
	label: string;
	tone: "live" | "warn" | "ok" | "neutral";
};

const BADGE_MAP: Record<JobState, StateBadge> = {
	funded: { label: "In progress", tone: "live" },
	submitted: { label: "Under review", tone: "warn" },
	completed: { label: "Completed", tone: "ok" },
	disputed: { label: "Disputed", tone: "warn" },
	declined: { label: "Declined", tone: "neutral" },
	refunded: { label: "Refunded", tone: "neutral" },
	timed_out: { label: "Timed out", tone: "neutral" },
	split: { label: "Split", tone: "neutral" },
	force_closed: { label: "Force closed", tone: "neutral" },
};

export function jobStateBadge(state: JobState): StateBadge {
	return BADGE_MAP[state] || { label: state, tone: "neutral" };
}

export function whoMayActNext(job: JobView): JobAction[] {
	const actions: JobAction[] = [];
	const isClient = job.roles.includes("client");
	const isProvider = job.roles.includes("provider");
	const isEvaluator = job.roles.includes("evaluator");

	const isExpired = new Date(job.expiredAt).getTime() <= Date.now();

	if (job.state === "funded") {
		if (isProvider) {
			actions.push("decline");
		}
		if (isClient && isExpired) {
			actions.push("claimTimeout");
		}
	} else if (job.state === "submitted") {
		if (isEvaluator) {
			actions.push("complete", "dispute");
		}
	} else if (job.state === "disputed") {
		// After dispute window / evaluation claim
		if (isClient && isExpired) {
			actions.push("forceClose");
		}
	}

	return actions;
}

export type TimelineRow = {
	step: "funded" | "task_delivered" | "execution" | "review" | "settlement";
	title: string;
	description: string;
	status: "done" | "active" | "pending";
	time?: string | null;
};

export function timelineRows(job: JobDetailView): TimelineRow[] {
	const rows: TimelineRow[] = [];

	// Step 1: Funded
	rows.push({
		step: "funded",
		title: "Escrow Funded",
		description: "Payment locked in 0G escrow contract",
		status: "done",
	});

	// Step 2: Task Delivered
	const taskDelivered = job.deliveries.includes("task");
	rows.push({
		step: "task_delivered",
		title: "Task Delivered",
		description: taskDelivered
			? "Encrypted task payload stored in mailbox"
			: "Waiting for client task upload",
		status: taskDelivered ? "done" : "active",
	});

	// Step 3: Execution
	const hasResult =
		job.deliveries.includes("result") || job.submittedAt !== null;
	const isSettled =
		job.state === "completed" ||
		job.state === "disputed" ||
		job.state === "declined" ||
		job.state === "refunded";

	let execStatus: "done" | "active" | "pending" = "pending";
	if (hasResult || isSettled) {
		execStatus = "done";
	} else if (taskDelivered) {
		execStatus = "active";
	}

	rows.push({
		step: "execution",
		title: "Agent Execution",
		description:
			execStatus === "done"
				? "Deliverable generated and submitted"
				: "Agent processing task with verified LLM",
		status: execStatus,
		time: job.submittedAt,
	});

	// If submitted, show review step
	if (job.state === "submitted" || isSettled) {
		const reviewStatus = isSettled ? "done" : "active";
		rows.push({
			step: "review",
			title: "Verification Review",
			description: isSettled
				? "Deliverable evaluated"
				: "Evaluating deliverable against requirements",
			status: reviewStatus,
		});
	}

	// Step 4: Settlement
	let settleStatus: "done" | "active" | "pending" = "pending";
	if (isSettled) {
		settleStatus = "done";
	}

	rows.push({
		step: "settlement",
		title: "Settlement",
		description:
			job.state === "completed"
				? "Funds released to agent payee"
				: job.state === "disputed"
					? "Disputed funds resolved"
					: job.state === "declined" || job.state === "refunded"
						? "Escrow refunded to client"
						: "Pending task completion and acceptance",
		status: settleStatus,
		time: job.settledAt,
	});

	return rows;
}

export function plainWordsStatusLine(job: JobView): string {
	switch (job.state) {
		case "funded":
			return "Escrow funded. Waiting for agent to process task.";
		case "submitted":
			return "Deliverable submitted. Awaiting verification review.";
		case "completed":
			return "Job completed and payment settled and released to provider.";
		case "disputed":
			return "Job was disputed. Reviewing verdict details.";
		case "declined":
			return "Job was declined by the agent provider.";
		case "refunded":
			return "Job was refunded to client wallet.";
		case "timed_out":
			return "Job expired and timed out before completion.";
		case "split":
			return "Job settlement was split between client and provider.";
		case "force_closed":
			return "Job escrow was force closed.";
		default:
			return "Job in progress.";
	}
}
