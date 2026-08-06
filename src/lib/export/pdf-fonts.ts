"use client";

import { Font } from "@react-pdf/renderer";

/**
 * Register the CJK fonts every PDF export needs.
 *
 * @react-pdf ships no CJK glyphs, so a formulation named 「空白对照」 renders as
 * blank boxes without this. The files are copied from @fontsource/noto-sans-sc
 * into /public/fonts and are load-bearing — do not delete them.
 *
 * Registration is process-wide and idempotent behind the latch, so every
 * exporter can call this unconditionally at the top of its entry point.
 */
let fontsRegistered = false;

export function ensureCjkFonts(): void {
  if (fontsRegistered) return;
  try {
    Font.register({
      family: "NotoSansSC",
      fonts: [
        { src: "/fonts/NotoSansSC-Regular.woff", fontWeight: 400 },
        { src: "/fonts/NotoSansSC-Bold.woff", fontWeight: 700 },
      ],
    });
    fontsRegistered = true;
  } catch (e) {
    console.warn(
      "CJK font registration failed; CJK characters may not render",
      e
    );
  }
}
