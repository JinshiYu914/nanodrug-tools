"use client";

/**
 * Pill button — the selected state carries the primary tint, same as the tabs.
 *
 * Extracted from lnp/method-picker.tsx because the tLNP parameter bench is
 * built almost entirely out of these, and two copies would drift the moment
 * one of them grew a size or a disabled state.
 */
export default function Chip({
  active,
  children,
  onClick,
  title,
  disabled,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`rounded-md border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-input text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
