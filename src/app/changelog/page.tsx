import type { Metadata } from "next";
import {
  CHANGELOG,
  CHANGE_KIND_LABEL,
  type ChangeKind,
} from "@/content/changelog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "更新日志 · Changelog",
  description:
    "站点自上线以来的每一次版本改动，按时间线排列 — 新增的工具、改进的算法和修复的问题。",
};

const KIND_CLASS: Record<ChangeKind, string> = {
  feature: "border-primary/40 bg-primary/10 text-primary",
  improvement: "border-ink/20 bg-secondary text-foreground",
  fix: "border-warning/40 bg-warning-subtle text-warning",
  design: "border-ink/20 bg-muted text-muted-foreground",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
}

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="max-w-2xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Changelog
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          更新日志
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          当前版本{" "}
          <span className="font-mono font-semibold text-foreground">
            {CHANGELOG[0]?.version}
          </span>
          。
        </p>
      </header>

      {/* The rail is drawn on the list; each entry hangs a dot on it. */}
      <ol className="mt-12 border-l-2 border-ink/15 pl-6 sm:pl-8">
        {CHANGELOG.map((entry, i) => (
          <li key={entry.version} className={cn("relative", i > 0 && "mt-10")}>
            <span
              aria-hidden
              className={cn(
                "absolute -left-[calc(1.5rem+5px)] top-2 size-2.5 rounded-full border-2 sm:-left-[calc(2rem+5px)]",
                i === 0
                  ? "border-primary bg-primary"
                  : "border-ink/30 bg-background"
              )}
            />

            <div className="sketch-card p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-xl font-bold tracking-tight">
                  {entry.title}
                </h2>
                <span className="font-mono text-sm font-semibold text-primary">
                  {entry.version}
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {formatDate(entry.date)}
                </span>
              </div>

              {entry.summary && (
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {entry.summary}
                </p>
              )}

              <ul className="mt-4 space-y-2.5">
                {entry.changes.map((c, j) => (
                  <li key={j} className="flex gap-2.5 text-sm leading-relaxed">
                    <span
                      className={cn(
                        "mt-0.5 h-fit shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                        KIND_CLASS[c.kind]
                      )}
                    >
                      {CHANGE_KIND_LABEL[c.kind]}
                    </span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
