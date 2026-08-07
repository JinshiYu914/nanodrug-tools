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

The `type` column is the discriminator for every saved-data feature and is widened by a migration each time one is added — currently `formula`, `preparation`, `screening_session`, `ribogreen_curve`, `ribogreen_result`, `tlnp_experiment`, `protein`, `cl4b_preset`. Adding a new kind means a migration that DROPs and re-ADDs `lnp_saved_items_type_check` (see [002](supabase/migrations/002_lnp_screening_sessions.sql) / [003](supabase/migrations/003_ribogreen.sql) / [004](supabase/migrations/004_tlnp_experiment.sql) / [005](supabase/migrations/005_tlnp_libraries.sql)) plus widening `LnpItemType`; no new table or RLS policy is needed. Note Supabase surfaces errors as plain `PostgrestError` objects, not `Error` instances, so read `.message`/`.code` off the object when sniffing for `42P01` / `23514`. `describeError(e, migrationHint)` in [use-ribogreen-saved.ts](src/components/tools/ribogreen/use-ribogreen-saved.ts) translates those codes — pass the migration filename that widens the constraint for the row kind being written, since `23514` always means "this `type` isn't in the constraint yet".

### tLNP workbench

[src/app/tools/tlnp/page.tsx](src/app/tools/tlnp/page.tsx) + [src/components/tools/tlnp/](src/components/tools/tlnp/) records a targeted-LNP experiment end to end across four modules (LNP 制备 → 偶联反应 → LNP 纯化 → 体内外实验). One batch is one `tlnp_experiment` row with the whole thing in `data`; the type tree and the never-throwing `parseTlnpExperiment` live in [tlnp-experiment.ts](src/lib/calculations/tlnp-experiment.ts).

Seven things to know before editing it:

- **`TlnpPrepSample extends BenchFormulation`.** A sample *is* a formulation, so `computeBenchFormulation`, `describeMethod`, `exportBenchToPdf` and `exportBenchToXlsx` all accept `prep.samples` unchanged. Don't demote it to a `formulation:` field.
- **`ParamEntry` ([tlnp-params.ts](src/lib/calculations/tlnp-params.ts)) persists its own `label` and `options`**, not a key into a code-side registry — a user-invented field has to render on a build that never heard of it, and a value they typed once has to come back as a chip. `mergeParamEntries` is the only reader — and the only place `ParamPreset.retired` can take effect, since deleting an option from the code-side list is not enough to stop a stored `options` array putting it back.
- **UI wording is 抗体 everywhere; the code says `protein`.** `ProteinEntry`, `proteinId`, the `protein` library row type and the `lnp_saved_items` discriminator all keep the old name because renaming them would need a migration for a change of vocabulary. Every user-facing string, sheet header and PDF column says 抗体. The one exception is 荧光蛋白 (fluorescent protein), which is a different word entirely.
- **Conjugation dosing is linker : 抗体, never RNA : 抗体.** [tlnp-conjugation.ts](src/lib/calculations/tlnp-conjugation.ts) walks RNA mass → N/P → ionizable lipid → total lipid → linker lipid, so the RNA is only ever a way of counting how much lipid went in. The three conversion inputs live in `ReactionSystem.basis`, snapshotted off the sample rather than read live, because a system can describe an LNP that was never in this batch. Schema v1 took 抗体 : RNA moles and needed an RNA length; that ratio has no relation to the number of reactive groups on the particle and is deliberately **not** carried across by the v1 → v2 migration. `explainConjugationDose` returns the same chain as printable steps, and the 加样体系 box shows it — four chained conversions can't be checked by eye, and a pipetting number nobody can check is one nobody should trust.
- **A reaction system is charged in µg of RNA, not µL of LNP** (schema v3). `ReactionSystem.rnaMass` is what the user decides; the LNP volume to pipette is derived from it and `lnpConc`. Letting both be typed would let them disagree. v2 blobs convert on read (`conc × volume ÷ 1000`), so an already-recorded reaction doses to exactly the numbers it did before.
- **The LNP fields in a system are a copy, refreshed on request — never a live read.** `sampleSnapshot` takes the copy, `sampleDrift` reports which fields have since diverged from the source sample, and the ⟳ in [reaction-matrix.tsx](src/components/tools/tlnp/reaction-matrix.tsx) is how the user asks for the update. Auto-syncing would let a formulation corrected in March rewrite what a January notebook says was pipetted. 投料 RNA is excluded from drift: reacting less than the whole prep is a decision, not staleness.
- **Module 2 is a matrix, not a graph.** One `ReactionSystem` is one column of [reaction-matrix.tsx](src/components/tools/tlnp/reaction-matrix.tsx) and one tube: an LNP, an antibody, a ratio, the reaction parameters. v1 stored a sample × condition xyflow graph; `parseTlnpExperiment` folds each legacy product into a system. `@xyflow/react` was removed with it — don't reintroduce a canvas without re-reading why the grid replaced it.
- **Antibodies and CL-4B columns are copied out of their libraries, never referenced.** [tlnp-library.ts](src/lib/supabase/tlnp-library.ts) backs both with plain `lnp_saved_items` rows (`protein`, `cl4b_preset`). A batch stores the values it used, so editing or deleting a library entry can't rewrite what a finished notebook says was pipetted; `ProteinEntry.libraryId` is a breadcrumb, not a foreign key.

Every module records **its own date** (`prep.design.date`, `conjugation.design.date`, `purification.design.date`, and one per assay arm) — a batch spans weeks, so one date at the top would be wrong for three of the four sections.

Module 4 is **a parameter bench plus two purpose-built result tables**, and nothing else. Both designs are `AssayDesign = { date, params, note }`; the typed grid that used to sit beside the bench is gone, because it asked for 细胞系 twice and let the two answers disagree (v2 blobs fold the typed fields back into the bench, and anything with no home there becomes a custom param rather than being dropped). The results are not generic: 体外 is a sample × replicate matrix that yields mean ± SD and a bar chart — the same shape as the sheet the numbers arrive in, so the whole block pastes in one go and copies back out as TSV. 体内 is a list of named runs managed like chromatograms, each a paste of 样本/器官/Total ROI/Avg ROI that yields two grouped-column charts and a liver/spleen share stacked to 1; a batch is imaged more than once and 6 h and 24 h are different figures, not more rows of one. A single 样本/数值 list could plot neither. Charts are hand-rolled SVG in [assay-charts.tsx](src/components/tools/tlnp/assay-charts.tsx) on `chart-scale.ts`; 总览与导出 renders **the same components**, so the report cannot disagree with the page it summarises.

**Pickers use [option-select.tsx](src/components/tools/tlnp/option-select.tsx), not `<input list>`.** A datalist filters its options down to what has been typed and, in Chrome, offers no affordance to open at all — so "show me everything" was the one thing it wouldn't do. A native `<select>` (plus 自定义… switching to a text field) is also the only kind of popup that isn't clipped by the `overflow-x-auto` wrapper the matrices live in.

The RiboGreen linkage runs both ways, and the workbench deliberately carries **no second copy of the calculator**:

- **Push** — [formulation-picker.tsx](src/components/tools/ribogreen/formulation-picker.tsx) lists tLNP batches as a source, stamping `SampleRow.sourceKind`.
- **Round trip** — 「输入样品数值计算」 hands off to the real RiboGreen tab and comes back with a saved record. The URL is the whole protocol and lives in [tlnp-handoff.ts](src/lib/calculations/tlnp-handoff.ts): out to `/tools/lnp-formula?tab=ribogreen&tlnp=<batch>&stage=prep|purify`, back to `/tools/tlnp?batch=<batch>&m=1|3&import=<record>`. `stage` picks which names are prefilled (prep samples vs reaction systems) and which module receives the results. The `?tab=`/`?tlnp=` reader is [handoff-reader.tsx](src/components/tools/ribogreen/handoff-reader.tsx), split out purely so `useSearchParams` sits behind a Suspense boundary — calling it directly from the client page opts `/tools/lnp-formula` out of static prerendering and fails the build.
- **Import** — [use-ribogreen-link.ts](src/components/tools/tlnp/use-ribogreen-link.ts) always refits from the record's stored curve rather than its cached fit, and matches rows by id, not by position.

Both stages render the same [characterization-matrix.tsx](src/components/tools/tlnp/characterization-matrix.tsx) (RiboGreen 浓度/体积/包封率/得率, DLS 粒径/PDI/Zeta, TEM 有/无, 备注). Linked RiboGreen cells go read-only — those numbers came off a fitted curve, and letting them be typed over would leave no way to tell measured from remembered.

### RiboGreen tab

[src/components/tools/ribogreen/](src/components/tools/ribogreen/) implements the 包封率/浓度 calculator mounted as the third tab of [src/app/tools/lnp-formula/page.tsx](src/app/tools/lnp-formula/page.tsx). Its `Tabs` is controlled so the shared `<LnpWorkflow />` diagram can be hidden on this tab, and the RiboGreen `TabsContent` is `forceMount`ed (wrapped in a `hidden` div) so the sample grid survives tab switches. All math lives in [src/lib/calculations/ribogreen.ts](src/lib/calculations/ribogreen.ts) with the instrument standard curves in [ribogreen-presets.ts](src/lib/calculations/ribogreen-presets.ts). Unit contract: the standard curve maps 读数 → ng/mL, 稀释倍数 is applied **after** the curve, and everything shown in the UI is ng/µL.

## Conventions

- Path alias `@/*` → `./src/*`.
- shadcn/ui components live in [src/components/ui/](src/components/ui/) — treat them as generated; re-run `shadcn` rather than hand-editing.
- Theming via `next-themes` (`ThemeProvider` in [src/app/layout.tsx](src/app/layout.tsx) + [src/components/theme-provider.tsx](src/components/theme-provider.tsx)); light/dark must both be supported.
- Toasts use `sonner`.
- The top-level `References/` directory holds external reference material and is excluded in [tsconfig.json](tsconfig.json) — do not import from it.
