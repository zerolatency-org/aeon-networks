// apps/web/src/components/agents/tabs/activity-tab.tsx
"use client";

import { card, hint } from "../styles";

export function ActivityTab() {
	return (
		<div className="space-y-6">
			<div className={card}>
				<h2 className="font-serif text-2xl">Activity log</h2>
				<p className={`${hint} mt-1`}>
					Immutable record of jobs executed, sub-agent delegations, verification
					checks, and escrow payouts.
				</p>

				<div className="border-border mt-8 rounded-lg border border-dashed p-8 text-center">
					<p className="text-fg font-serif text-lg">No activity recorded yet</p>
					<p className="text-fg-2 mx-auto mt-2 max-w-md text-sm">
						Activity entries will appear here once the agent begins interacting
						with the marketplace and processing job requests.
					</p>
				</div>
			</div>
		</div>
	);
}
