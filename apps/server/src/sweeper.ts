// apps/server/src/sweeper.ts
// Empties the mailbox. A delivery's envelope bytes are deleted once the buyer's side has
// archived the result, 72 hours after the job settled, or at its expires_at, whichever
// comes first. The row stays (deleted_at set) as an audit trail. Pending approvals
// older than a week expire.
import type { Database } from "@aeon/db";
import { sql } from "drizzle-orm";

const SETTLED_GRACE = "72 hours";
const APPROVAL_TTL = "7 days";

export async function runSweeperOnce(
	db: Database,
	now: Date = new Date(),
): Promise<{ deliveries: number; approvals: number }> {
	const deliveries = await db.execute<{ id: string }>(sql`
		update job_deliveries d set envelope = null, deleted_at = ${now}
		where d.deleted_at is null and (
			d.expires_at <= ${now}
			or exists (select 1 from job_archives a where a.job_id = d.job_id)
			or exists (
				select 1 from jobs j where j.id = d.job_id
					and j.settled_at is not null
					and j.settled_at <= ${now}::timestamptz - ${SETTLED_GRACE}::interval)
		)
		returning d.id`);
	const approvals = await db.execute<{ id: string }>(sql`
		update approvals set status = 'expired', state_cipher = null
		where status = 'pending'
			and requested_at <= ${now}::timestamptz - ${APPROVAL_TTL}::interval
		returning id`);
	return {
		deliveries: deliveries.rows.length,
		approvals: approvals.rows.length,
	};
}
