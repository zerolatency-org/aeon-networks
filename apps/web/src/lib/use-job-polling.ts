// apps/web/src/lib/use-job-polling.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { fetchJobDetail, type JobDetailView } from "./jobs-api";

export function useJobPolling(jobId: string) {
	const [isVisible, setIsVisible] = useState(
		typeof document !== "undefined" ? !document.hidden : true,
	);
	const pollIntervalRef = useRef(3000);

	useEffect(() => {
		if (typeof document === "undefined") return;

		const handleVisibilityChange = () => {
			setIsVisible(!document.hidden);
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	const query = useQuery<JobDetailView>({
		queryKey: ["jobs", jobId],
		queryFn: () => fetchJobDetail(jobId),
		enabled: Boolean(jobId),
		refetchInterval: (queryData) => {
			if (!isVisible) return false;
			const job = queryData.state.data;
			if (!job) return pollIntervalRef.current;

			// Stop polling if job reached terminal state
			if (
				job.state === "completed" ||
				job.state === "declined" ||
				job.state === "refunded" ||
				job.state === "force_closed"
			) {
				return false;
			}

			// Active job poll every 3s
			return pollIntervalRef.current;
		},
		refetchIntervalInBackground: false,
	});

	return query;
}
