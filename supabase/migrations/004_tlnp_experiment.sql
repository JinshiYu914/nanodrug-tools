-- Extend lnp_saved_items.type to support the tLNP preparation workbench.
-- A tlnp_experiment row stores ONE BATCH in its `data` JSONB column: the four
-- modules (LNP 制备 / 偶联反应 / LNP 纯化 / 体内外实验), each carrying its design
-- parameters and its results, plus the batch metadata. See
-- src/lib/calculations/tlnp-experiment.ts for the shape (schemaVersion 1).
-- Folders (is_folder=true) are typed the same way so batches can be organized
-- in their own tree.

ALTER TABLE lnp_saved_items DROP CONSTRAINT IF EXISTS lnp_saved_items_type_check;

ALTER TABLE lnp_saved_items
  ADD CONSTRAINT lnp_saved_items_type_check
  CHECK (type IN ('formula', 'preparation', 'screening_session', 'ribogreen_curve', 'ribogreen_result', 'tlnp_experiment'));
