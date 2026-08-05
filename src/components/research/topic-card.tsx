import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_CLASS, type PillarAccent, type PillarId, type TopicMeta } from "@/content/research/types";

/**
 * A research topic as a sticker: ink outline, hard offset shadow, and a small
 * lean on hover. The whole card is the link target.
 *
 * `status` is real information, not decoration — "planned" means there is a
 * question here but no results yet, and saying so is better than implying
 * every line is equally far along.
 */
export function TopicCard({
  pillarId,
  accent,
  topic,
  className,
}: {
  pillarId: PillarId;
  accent: PillarAccent;
  topic: TopicMeta;
  className?: string;
}) {
  const tone = ACCENT_CLASS[accent];

  return (
    <Link
      href={`/research/${pillarId}/${topic.slug}`}
      className={cn(
        "sketch-card sketch-sticker group flex flex-col gap-3 p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider",
            topic.status === "active" ? tone.bg : "bg-transparent text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              topic.status === "active" ? tone.dot : "bg-muted-foreground"
            )}
          />
          {topic.status === "active" ? "Active" : "Planned"}
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>

      <div>
        <h3 className="font-display text-lg font-bold leading-tight tracking-tight">
          {topic.title}
        </h3>
        <p className={cn("mt-1 text-sm font-medium", tone.text)}>{topic.tagline}</p>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{topic.summary}</p>

      <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {topic.keywords.slice(0, 3).map((keyword) => (
          <li
            key={keyword}
            className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[0.68rem] text-muted-foreground"
          >
            {keyword}
          </li>
        ))}
      </ul>
    </Link>
  );
}
