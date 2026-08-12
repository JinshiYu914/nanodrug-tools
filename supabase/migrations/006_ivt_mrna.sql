-- IVT mRNA workbench batches and reusable method templates.
--
-- `ivt_batch` stores one IVT batch as JSONB. Each batch may contain multiple
-- RNA records and every record carries its own linearisation, IVT,
-- purification and expression-validation data.
--
-- `ivt_template` stores reusable linearisation, IVT and purification methods.
-- A batch copies the selected method, so changing or deleting a template never
-- rewrites a historical notebook.
--
-- The RNA library is derived from all `ivt_batch` rows and therefore needs no
-- second table or discriminator.

ALTER TABLE lnp_saved_items DROP CONSTRAINT IF EXISTS lnp_saved_items_type_check;

ALTER TABLE lnp_saved_items
  ADD CONSTRAINT lnp_saved_items_type_check
  CHECK (type IN (
    'formula',
    'preparation',
    'screening_session',
    'ribogreen_curve',
    'ribogreen_result',
    'tlnp_experiment',
    'protein',
    'cl4b_preset',
    'ivt_batch',
    'ivt_template'
  ));
