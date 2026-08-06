# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`nanodrug-tools` — a Next.js 16 (App Router) + React 19 + Tailwind v4 site providing online calculators and saved-data tools for nano drug delivery / molecular biology research, backed by Supabase (auth + Postgres). UI text is mixed Chinese/English.

## Commands

Package manager is **pnpm** (a `pnpm-workspace.yaml` exists, but the repo is a single app).

```bash
pnpm dev      # next dev (http://localhost:3000)
pnpm build    # next build
pnpm start    # serve the production build
pnpm lint     # eslint (flat config in eslint.config.mjs)
```

There is no test suite configured.

Required env vars (loaded from `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Database migrations live in [supabase/migrations/](supabase/migrations/) and must be applied to the Supabase project manually (no Supabase CLI workflow wired up).

## Architecture

### Supabase auth runs through three coordinated clients

The auth model relies on `@supabase/ssr` and **all three** clients must stay in sync — a session refreshed by middleware is what makes both server and browser clients see the same user.

- [src/lib/supabase/client.ts](src/lib/supabase/client.ts) — browser client for Client Components.
- [src/lib/supabase/server.ts](src/lib/supabase/server.ts) — server client for Server Components / Route Handlers (uses `next/headers` cookies).
- [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts) — invoked from [src/middleware.ts](src/middleware.ts) on every non-static request. It calls `supabase.auth.getUser()` to refresh cookies **and** enforces gating: unauthenticated requests to `/plasmid/*`, `/dashboard/*`, or `/profile/*` are redirected to `/login`. Add new protected route prefixes here.

### Tools live in two layers

Calculation logic is intentionally separated from UI so it can be unit-tested or reused:

- [src/lib/calculations/](src/lib/calculations/) — pure functions (e.g. [molecular-weight.ts](src/lib/calculations/molecular-weight.ts), [lnp-formula.ts](src/lib/calculations/lnp-formula.ts)). No React, no Supabase.
- [src/components/tools/](src/components/tools/) — Client Components that own form state, call the pure calculators, and render results.
- [src/app/tools/page.tsx](src/app/tools/page.tsx) — single tabbed page that hosts every calculator (mol-weight, molar-conc, dilution, formulation, ligation). The legacy per-tool routes under `src/app/tools/<name>/` still exist but the consolidated tabbed page is the one wired into navigation (see commit `1d25ebb`). When adding a new tool, prefer adding a tab here rather than a new route.

### LNP "saved items" data model

Authenticated users can save formulas/preparations into a tree (folders + items) backed by the `lnp_saved_items` table ([supabase/migrations/001_lnp_saved_items.sql](supabase/migrations/001_lnp_saved_items.sql)). Self-referential `parent_id` gives the hierarchy; RLS policies scope every row to `auth.uid() = user_id`. All access goes through [src/lib/supabase/lnp-service.ts](src/lib/supabase/lnp-service.ts), which exposes CRUD + `buildTree(items)` for assembling the nested structure consumed by [lnp-saved-panel.tsx](src/components/tools/lnp-saved-panel.tsx). New saved-data features should follow the same service-module pattern instead of calling Supabase from components directly.

The `type` column is the discriminator for every saved-data feature and is widened by a migration each time one is added — currently `formula`, `preparation`, `screening_session`, `ribogreen_curve`, `ribogreen_result`, `tlnp_experiment`. Adding a new kind means a migration that DROPs and re-ADDs `lnp_saved_items_type_check` (see [002](supabase/migrations/002_lnp_screening_sessions.sql) / [003](supabase/migrations/003_ribogreen.sql) / [004](supabase/migrations/004_tlnp_experiment.sql)) plus widening `LnpItemType`; no new table or RLS policy is needed. Note Supabase surfaces errors as plain `PostgrestError` objects, not `Error` instances, so read `.message`/`.code` off the object when sniffing for `42P01` / `23514`. `describeError(e, migrationHint)` in [use-ribogreen-saved.ts](src/components/tools/ribogreen/use-ribogreen-saved.ts) translates those codes — pass the migration filename that widens the constraint for the row kind being written, since `23514` always means "this `type` isn't in the constraint yet".

### tLNP workbench

[src/app/tools/tlnp/page.tsx](src/app/tools/tlnp/page.tsx) + [src/components/tools/tlnp/](src/components/tools/tlnp/) records a targeted-LNP experiment end to end across four modules (LNP 制备 → 偶联反应 → LNP 纯化 → 体内外实验). One batch is one `tlnp_experiment` row with the whole thing in `data`; the type tree and the never-throwing `parseTlnpExperiment` live in [tlnp-experiment.ts](src/lib/calculations/tlnp-experiment.ts).

Four things to know before editing it:

- **`TlnpPrepSample extends BenchFormulation`.** A sample *is* a formulation, so `computeBenchFormulation`, `describeMethod`, `exportBenchToPdf` and `exportBenchToXlsx` all accept `prep.samples` unchanged. Don't demote it to a `formulation:` field.
- **`ParamEntry` ([tlnp-params.ts](src/lib/calculations/tlnp-params.ts)) persists its own `label` and `options`**, not a key into a code-side registry — a user-invented field has to render on a build that never heard of it, and a value they typed once has to come back as a chip. `mergeParamEntries` is the only reader.
- **The flow graph uses our own node/edge types, never `@xyflow/react`'s.** Only [conjugation-flow.tsx](src/components/tools/tlnp/conjugation-flow.tsx) imports that library; it converts at the boundary. `.tlnp-flow` in globals.css remaps the library's `--xy-*-default` variables onto our tokens, because its own `colorMode` prop only picks between two hardcoded palettes.
- **Graph reconciliation happens in one place** — `reconcile()` in [module-conjugation.tsx](src/components/tools/tlnp/module-conjugation.tsx) re-runs `layoutNodes` + `deriveProducts` after any change, which is what makes deleting a condition cascade to its edges and products.

The RiboGreen linkage runs both ways: [formulation-picker.tsx](src/components/tools/ribogreen/formulation-picker.tsx) can list tLNP batches as a source (stamping `SampleRow.sourceKind`), and [ee-panel.tsx](src/components/tools/tlnp/ee-panel.tsx) imports key results back, always refitting from the record's stored curve rather than its cached fit.

### RiboGreen tab

[src/components/tools/ribogreen/](src/components/tools/ribogreen/) implements the 包封率/浓度 calculator mounted as the third tab of [src/app/tools/lnp-formula/page.tsx](src/app/tools/lnp-formula/page.tsx). Its `Tabs` is controlled so the shared `<LnpWorkflow />` diagram can be hidden on this tab, and the RiboGreen `TabsContent` is `forceMount`ed (wrapped in a `hidden` div) so the sample grid survives tab switches. All math lives in [src/lib/calculations/ribogreen.ts](src/lib/calculations/ribogreen.ts) with the instrument standard curves in [ribogreen-presets.ts](src/lib/calculations/ribogreen-presets.ts). Unit contract: the standard curve maps 读数 → ng/mL, 稀释倍数 is applied **after** the curve, and everything shown in the UI is ng/µL.

## Conventions

- Path alias `@/*` → `./src/*`.
- shadcn/ui components live in [src/components/ui/](src/components/ui/) — treat them as generated; re-run `shadcn` rather than hand-editing.
- Theming via `next-themes` (`ThemeProvider` in [src/app/layout.tsx](src/app/layout.tsx) + [src/components/theme-provider.tsx](src/components/theme-provider.tsx)); light/dark must both be supported.
- Toasts use `sonner`.
- The top-level `References/` directory holds external reference material and is excluded in [tsconfig.json](tsconfig.json) — do not import from it.
