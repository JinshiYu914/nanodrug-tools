-- Optimistic concurrency for the JSON workbench records.
--
-- `data_revision` is deliberately separate from name/folder/sort changes: a
-- rename on another device must not turn a safe data save into a false
-- conflict. Clients update `data` only when the revision they loaded is still
-- current; the trigger advances the revision and timestamps on the server.

ALTER TABLE lnp_saved_items
  ADD COLUMN IF NOT EXISTS data_revision BIGINT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION set_lnp_saved_item_sync_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.data IS DISTINCT FROM OLD.data THEN
    NEW.data_revision := OLD.data_revision + 1;
  ELSE
    NEW.data_revision := OLD.data_revision;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lnp_saved_items_sync_fields ON lnp_saved_items;
CREATE TRIGGER lnp_saved_items_sync_fields
  BEFORE UPDATE ON lnp_saved_items
  FOR EACH ROW
  EXECUTE FUNCTION set_lnp_saved_item_sync_fields();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lnp_saved_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lnp_saved_items;
  END IF;
END;
$$;
