-- Lightweight, private multi-device notifications for large workbench rows.
-- Deploy with code that listens to Broadcast, then enable with
-- NEXT_PUBLIC_WORKBENCH_REALTIME_ENABLED=true.

CREATE OR REPLACE FUNCTION public.broadcast_lnp_saved_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.lnp_saved_items;
  v_topic TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  -- Libraries and explicit-save calculators share this table but do not use
  -- the workbench channel. Avoid creating Broadcast traffic for those rows.
  IF v_row.type NOT IN ('tlnp_experiment', 'ivt_batch', 'screening_session') THEN
    RETURN v_row;
  END IF;

  v_topic := CASE
    WHEN v_row.project_id IS NULL THEN 'workbench:user:' || v_row.user_id::text
    ELSE 'workbench:project:' || v_row.project_id::text
  END;

  PERFORM realtime.send(
    jsonb_build_object(
      'id', v_row.id,
      'type', v_row.type,
      'project_id', v_row.project_id,
      'data_revision', v_row.data_revision,
      'updated_at', v_row.updated_at,
      'last_modified_by', v_row.last_modified_by,
      'operation', TG_OP
    ),
    'lnp_saved_item_changed',
    v_topic,
    true
  );
  RETURN v_row;
END;
$$;

DROP TRIGGER IF EXISTS lnp_saved_items_broadcast ON public.lnp_saved_items;
CREATE TRIGGER lnp_saved_items_broadcast
  AFTER INSERT OR UPDATE OR DELETE ON public.lnp_saved_items
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_lnp_saved_item_change();

DROP POLICY IF EXISTS "Workbench members can receive broadcasts" ON realtime.messages;
CREATE POLICY "Workbench members can receive broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND (
      (SELECT realtime.topic()) = 'workbench:user:' || (SELECT auth.uid())::text
      OR (
        (SELECT realtime.topic()) ~ '^workbench:project:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.is_project_member(
          split_part((SELECT realtime.topic()), ':', 3)::uuid
        )
      )
    )
  );

-- The app no longer uses per-row Postgres Changes for this table. Broadcast
-- uses realtime.messages and avoids authorization work for the large JSON row.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lnp_saved_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.lnp_saved_items;
  END IF;
END;
$$;
