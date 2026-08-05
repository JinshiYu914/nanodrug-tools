# Bench Sketch diagrams

Inline React SVG, not static assets — one component renders at card-thumbnail
and hero size, and it re-tints with the theme for free. A static asset would
need a light copy and a dark copy of every drawing, and they would drift.

## Rules

1. **No hex literals.** Only `currentColor` and `var(--token)`. That is the
   entire theming mechanism; a single `#2E1F63` makes a diagram invisible in
   dark mode.
2. **SVG `<text>` ignores CSS `color`.** Put the Tailwind class on the wrapping
   `<g>` and set `fill="currentColor"` on the `<text>`. `Label` in
   `primitives.tsx` already does this — use it rather than raw `<text>`.
3. **Any gradient, clip path, mask or marker id must be instance-unique.** Use
   `useId().replace(/:/g, "")` — raw `useId()` output contains `:`, which is
   invalid inside `url(#…)`. Two copies of the same diagram on one page will
   collide and one will render blank. See
   `src/components/tools/ribogreen/scatter-fit-chart.tsx:72`, where this bug
   was found and fixed once already.
4. **Every diagram needs `role="img"`, a `<title>` and a `<desc>`.**
   `DiagramFrame` handles it; pass real sentences, not the component name.
5. **Server Components by default.** Only add `"use client"` when a diagram is
   genuinely interactive.
6. **No `feTurbulence` roughening filter.** The hand-drawn feel comes from
   deliberately irregular path geometry — perturbed circle beziers, uneven
   tick lengths, arcs that do not quite close. Turbulence on 1.5px strokes
   looks muddy and costs paint time on every scroll.
7. **`variant="thumb"` must drop labels.** 11px type inside a 280px card is
   noise. The drawing has to survive without them.

## Stroke weights

Three, defined in `primitives.tsx`. Resist adding a fourth.

| Token | Use |
|---|---|
| `STROKE.structure` (2.6) | Silhouettes — the shape you recognise from across the room |
| `STROKE.detail` (1.7) | Internal structure, arrows, payloads |
| `STROKE.hair` (1.2) | Texture and leader lines, usually at reduced opacity |

## Colour

Ink (`currentColor`) carries structure. A pillar token carries **the one thing
the drawing is about** — the conjugated antibody in `lnp-cross-section`, the
UTRs in `mrna-construct`. If everything is coloured, nothing is emphasised.

## Adding one

Write the component, then register it in `index.ts`. Content references it by
the registry key, so an unregistered diagram is a type error rather than a
silent blank.
