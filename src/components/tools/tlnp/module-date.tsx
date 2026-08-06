"use client";

import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/calculations/ribogreen";

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

/**
 * The date one module was actually carried out on.
 *
 * Per module rather than per batch: a batch spans weeks — LNPs on Monday, the
 * conjugation on Wednesday, the animal work a fortnight later — and one date at
 * the top would be wrong for three of the four sections.
 *
 * Blank until set, with a one-click 今天, because guessing a date into a
 * notebook is worse than leaving it empty.
 */
export default function ModuleDate({ value, onChange, label = "实验日期" }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-36 px-2 font-mono text-xs"
      />
      {!value && (
        <button
          type="button"
          onClick={() => onChange(todayISO())}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          今天
        </button>
      )}
    </div>
  );
}
