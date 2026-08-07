-- Two cross-batch libraries for the tLNP workbench.
--
-- Both are the same idea: a fact that belongs to the user rather than to one
-- experiment, so it can be picked in any batch instead of retyped.
--
--   protein     — { name, mw, conc, concUnit, note }
--                 A conjugation partner. The batch copies the values it uses
--                 rather than referencing the row, so editing the library later
--                 never rewrites what a past notebook says was pipetted.
--   cl4b_preset — { columnLength, columnDiameter, flowRate, buffer }
--                 One packed column's geometry and running conditions.
--
-- See src/lib/calculations/tlnp-experiment.ts (ProteinEntry, Cl4bParams) for
-- the shapes and src/lib/supabase/tlnp-library.ts for the access layer.
--
-- No new table, no new index, no new RLS policy: lnp_saved_items already scopes
-- every row with auth.uid() = user_id and indexes (user_id, type).

ALTER TABLE lnp_saved_items DROP CONSTRAINT IF EXISTS lnp_saved_items_type_check;

ALTER TABLE lnp_saved_items
  ADD CONSTRAINT lnp_saved_items_type_check
  CHECK (type IN ('formula', 'preparation', 'screening_session', 'ribogreen_curve', 'ribogreen_result', 'tlnp_experiment', 'protein', 'cl4b_preset'));
