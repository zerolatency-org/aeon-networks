// apps/web/test/activity-feed.test.ts
import { describe, expect, test } from "bun:test";
import {
	type ActivityEvent,
	filterEvents,
	formatDayLabel,
	groupEventsByDay,
	sortEventsRecentFirst,
} from "@/lib/activity-feed";

const mockEvents: ActivityEvent[] = [
	{
		id: "ev_1",
		kind: "job_completed",
		timestamp: "2026-11-14T10:00:00.000Z",
		title: "Job #42 Completed",
		description: "Verification passed; 0.05 0G released to agent wallet.",
		amountWei: 50000000000000000n,
		jobId: "42",
	},
	{
		id: "ev_2",
		kind: "funds_received",
		timestamp: "2026-11-14T08:00:00.000Z",
		title: "Agent Funded",
		description: "Owner funded 0.1 0G for operational gas.",
		amountWei: 100000000000000000n,
	},
	{
		id: "ev_3",
		kind: "job_created",
		timestamp: "2026-11-13T16:00:00.000Z",
		title: "Job #41 Created",
		description: "New research job commissioned by client.",
		amountWei: 20000000000000000n,
		jobId: "41",
	},
	{
		id: "ev_4",
		kind: "funds_swept",
		timestamp: "2026-11-13T12:00:00.000Z",
		title: "Earnings Swept",
		description: "Owner swept 0.04 0G to primary wallet.",
		amountWei: 40000000000000000n,
	},
];

describe("Activity feed model", () => {
	test("sortEventsRecentFirst orders newest events first", () => {
		const sorted = sortEventsRecentFirst(mockEvents);
		expect(sorted[0]?.id).toBe("ev_1");
		expect(sorted[3]?.id).toBe("ev_4");
	});

	test("filterEvents retains all events when category is 'all'", () => {
		const filtered = filterEvents(mockEvents, "all");
		expect(filtered.length).toBe(4);
	});

	test("filterEvents filters by 'jobs' category", () => {
		const filtered = filterEvents(mockEvents, "jobs");
		expect(filtered.length).toBe(2);
		expect(filtered.every((e) => e.kind.startsWith("job_"))).toBe(true);
	});

	test("filterEvents filters by 'funds' category", () => {
		const filtered = filterEvents(mockEvents, "funds");
		expect(filtered.length).toBe(2);
		expect(filtered.every((e) => e.kind.startsWith("funds_"))).toBe(true);
	});

	test("formatDayLabel returns 'Today' for current date", () => {
		const todayIso = new Date().toISOString();
		expect(formatDayLabel(todayIso)).toBe("Today");
	});

	test("formatDayLabel returns 'Yesterday' for previous date", () => {
		const yesterdayIso = new Date(Date.now() - 86400000).toISOString();
		expect(formatDayLabel(yesterdayIso)).toBe("Yesterday");
	});

	test("formatDayLabel formats older dates in editorial format", () => {
		expect(formatDayLabel("2026-11-01T10:00:00Z")).toContain("Nov");
	});

	test("groupEventsByDay groups events under day buckets", () => {
		const groups = groupEventsByDay(mockEvents);
		expect(groups.length).toBe(2);
		expect(groups[0]?.events.length).toBe(2);
		expect(groups[1]?.events.length).toBe(2);
	});
});
