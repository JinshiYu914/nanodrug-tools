-- Extend lnp_saved_items.type to support screening sessions (formulation bench).
-- A screening_session row stores an array of formulation snapshots in its `data` JSONB column.
-- Folders (is_folder=true) are typed the same way so screening sessions can be organized in their own tree.

ALTER TABLE lnp_saved_items DROP CONSTRAINT IF EXISTS lnp_saved_items_type_check;

ALTER TABLE lnp_saved_items
  ADD CONSTRAINT lnp_saved_items_type_check
  CHECK (type IN ('formula', 'preparation', 'screening_session'));
