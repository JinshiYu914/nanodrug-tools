-- Extend lnp_saved_items.type to support RiboGreen assay data.
-- A ribogreen_curve row stores a standard-curve point set (+ fit options) in its `data` JSONB column.
-- A ribogreen_result row stores a full batch: curve snapshot, sample rows, and correction settings.
-- Folders (is_folder=true) are typed the same way so each kind can be organized in its own tree.

ALTER TABLE lnp_saved_items DROP CONSTRAINT IF EXISTS lnp_saved_items_type_check;

ALTER TABLE lnp_saved_items
  ADD CONSTRAINT lnp_saved_items_type_check
  CHECK (type IN ('formula', 'preparation', 'screening_session', 'ribogreen_curve', 'ribogreen_result'));
