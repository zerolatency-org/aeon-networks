// apps/web/src/lib/activity-feed.ts

export type ActivityEventKind =
	| "job_created"
	| "job_completed"
	| "job_disputed"
	| "funds_received"
	| "funds_swept";

export type ActivityCategory = "all" | "jobs" | "funds";

export type ActivityEvent = {
	id: string;
	kind: ActivityEventKind;
	timestamp: string;
	title: string;
	description: string;
	amountWei?: bigint;
	jobId?: string;
};

export type DayGroup = {
	dayLabel: string;
	dateKey: string;
	events: ActivityEvent[];
};

export function sortEventsRecentFirst(
	events: ActivityEvent[],
): ActivityEvent[] {
	return [...events].sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);
}

export function filterEvents(
	events: ActivityEvent[],
	category: ActivityCategory,
): ActivityEvent[] {
	if (category === "all") return events;
	if (category === "jobs") {
		return events.filter(
			(e) =>
				e.kind === "job_created" ||
				e.kind === "job_completed" ||
				e.kind === "job_disputed",
		);
	}
	if (category === "funds") {
		return events.filter(
			(e) => e.kind === "funds_received" || e.kind === "funds_swept",
		);
	}
	return events;
}

export function formatDayLabel(timestamp: string): string {
	const eventDate = new Date(timestamp);
	const now = new Date();

	const isToday =
		eventDate.getFullYear() === now.getFullYear() &&
		eventDate.getMonth() === now.getMonth() &&
		eventDate.getDate() === now.getDate();
	if (isToday) return "Today";

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	const isYesterday =
		eventDate.getFullYear() === yesterday.getFullYear() &&
		eventDate.getMonth() === yesterday.getMonth() &&
		eventDate.getDate() === yesterday.getDate();
	if (isYesterday) return "Yesterday";

	return eventDate.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function groupEventsByDay(events: ActivityEvent[]): DayGroup[] {
	const sorted = sortEventsRecentFirst(events);
	const map = new Map<string, ActivityEvent[]>();

	for (const event of sorted) {
		const key = event.timestamp.slice(0, 10);
		const list = map.get(key) ?? [];
		list.push(event);
		map.set(key, list);
	}

	const groups: DayGroup[] = [];
	for (const [dateKey, dayEvents] of map.entries()) {
		const label = dayEvents[0]
			? formatDayLabel(dayEvents[0].timestamp)
			: dateKey;
		groups.push({
			dayLabel: label,
			dateKey,
			events: dayEvents,
		});
	}

	return groups;
}
