// apps/web/src/components/auth/problem-notice.tsx
export function ProblemNotice({
	title,
	hint,
}: {
	title: string;
	hint: string;
}) {
	return (
		<div
			role="alert"
			className="bg-coral/12 rounded-md p-3 text-[13px] leading-5"
		>
			<p className="text-coral font-medium">{title}</p>
			<p className="text-fg-2 mt-0.5">{hint}</p>
		</div>
	);
}
