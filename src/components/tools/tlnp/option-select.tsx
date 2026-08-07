"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** Text shown for the empty choice. */
  emptyLabel?: string;
}

const CUSTOM = "__custom__";

/**
 * Pick one of a list, or type your own.
 *
 * This replaced an `<input list=…>` datalist, which looked right and wasn't:
 * Chrome only offers a datalist through a control the input doesn't render, and
 * once anything is typed it filters the list down to matches — so the one thing
 * the user wanted, "show me everything you have", was the one thing it wouldn't
 * do.
 *
 * A native `<select>` is used rather than a styled popup because these sit in
 * horizontally scrolling tables, and a native option list is drawn by the
 * browser outside the page — an absolutely positioned menu would be clipped by
 * the `overflow-x-auto` wrapper.
 */
export default function OptionSelect({
  value,
  options,
  onChange,
  placeholder = "自定义",
  className = "",
  emptyLabel = "未选择",
}: Props) {
  // A stored value we've never heard of is already custom, so the text field
  // has to be what opens — otherwise the select would silently show 未选择
  // over a value that is really there.
  const [typing, setTyping] = useState(false);
  const known = value === "" || options.includes(value);

  if (typing || !known) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={typing}
          className={`h-7 min-w-0 flex-1 px-2 text-xs ${className}`}
        />
        <button
          type="button"
          title="回到选项列表"
          onClick={() => {
            setTyping(false);
            onChange("");
          }}
          className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM) {
          setTyping(true);
          onChange("");
          return;
        }
        onChange(e.target.value);
      }}
      className={`h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs ${className}`}
    >
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={CUSTOM}>自定义…</option>
    </select>
  );
}
