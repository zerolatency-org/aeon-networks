import { PILLARS } from "@/content/marketing";
export function BuiltOn0g() {
	return (
		<section
			className="mx-auto max-w-[1280px] px-6 py-20"
			aria-labelledby="built-title"
		>
			<h2 id="built-title" className="text-fg font-serif text-4xl md:text-5xl">
				Built on 0G
			</h2>
			<ul className="mt-8 grid gap-4 md:grid-cols-3">
				{PILLARS.map((p) => (
					<li key={p.id} className="glass rounded-xl p-6">
						<h3 className="text-fg font-medium">{p.name}</h3>
						<p className="text-fg-2 mt-2">{p.line}</p>
					</li>
				))}
			</ul>
		</section>
	);
}
