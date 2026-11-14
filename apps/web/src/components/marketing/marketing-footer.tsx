import { ThemeSwitch } from "@/components/theme/theme-switch";
import { LINKS } from "@/content/marketing";
export function MarketingFooter() {
	return (
		<footer className="border-border border-t">
			<div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
				<nav aria-label="Footer">
					<ul className="text-fg-2 flex flex-wrap gap-x-6 gap-y-2">
						{Object.entries({
							Docs: LINKS.docs,
							GitHub: LINKS.github,
							Explorer: LINKS.explorer,
							Faucet: LINKS.faucet,
						}).map(([label, href]) => (
							<li key={label}>
								<a
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-fg hover:underline"
								>
									{label}
								</a>
							</li>
						))}
					</ul>
				</nav>
				<ThemeSwitch />
			</div>
			<p className="text-fg-3 mx-auto max-w-[1280px] px-6 pb-8 text-sm">
				Aeon runs on the 0G Galileo testnet.
			</p>
		</footer>
	);
}
