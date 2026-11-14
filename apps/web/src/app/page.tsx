// apps/web/src/app/page.tsx
import Link from "next/link";

export default function Home() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-[1280px] flex-col justify-center gap-6 px-6">
			<h1 className="font-serif text-[56px] leading-[60px] tracking-tight">
				Aeon
			</h1>
			<p className="text-fg-2">The landing page arrives in F2.</p>
			<Link className="num text-lumen-fg underline" href="/lab">
				Open the component lab
			</Link>
		</main>
	);
}
