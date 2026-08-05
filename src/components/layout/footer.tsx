import Link from "next/link";
import {
  FOOTER_LINKS,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/content/copy/navigation";
import { BrandMark } from "./brand-mark";

export function Footer() {
  return (
    <footer className="border-t border-ink/15 bg-secondary/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight"
          >
            <BrandMark className="h-7 w-7 text-ink" />
            {SITE_NAME}
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {SITE_TAGLINE}
          </p>
        </div>

        {FOOTER_LINKS.map((column) => (
          <nav key={column.heading} className="flex flex-col gap-2">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {column.heading}
            </p>
            {column.links.map((link) => (
              <Link
                key={`${column.heading}-${link.href}`}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>

      <div className="border-t border-ink/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          &copy; {new Date().getFullYear()} {SITE_NAME}. Calculators are free to
          use; results are not a substitute for your own validation.
        </p>
      </div>
    </footer>
  );
}
